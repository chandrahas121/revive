"""
ml/price_keras.py
-----------------
Serve the trained Keras MLP ensemble (model1_best.keras + model2_best.keras)
using the regenerated vectorizers (ml/artifacts/price_vectorizers.pkl from
export_vectorizers.py). No retraining — just inference.

Requires (backend venv):  pip install tensorflow nltk
Artifacts in ml/artifacts/:  model1_best.keras, model2_best.keras, price_vectorizers.pkl

predict_price_inr(grade, category, mrp, title="", brand="") -> float | None
Returns None if anything is missing so route.py falls back to the heuristic.
"""
from __future__ import annotations
import glob
import logging
import math
import os
import pickle
import re
import shutil
import threading
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_ART = Path(__file__).parent / "artifacts"
# Loading a .keras archive unpacks weights to a temp dir; on Windows that dir can
# land next to the artifacts and get locked (antivirus / leftover handle), giving
# "[WinError 32] ... model.weights.h5 ... used by another process". Serialise the
# load and clean stale temp dirs so a single grade can't race itself.
_load_lock = threading.Lock()


def _clean_stale_tmp() -> None:
    """Best-effort removal of leftover Keras unpack dirs in ml/artifacts."""
    for d in glob.glob(str(_ART / "tmp*")):
        try:
            shutil.rmtree(d, ignore_errors=True)
        except Exception:
            pass
_state = {"loaded": False, "ok": False, "m1": None, "m2": None, "vec": None}

# Mercari item_condition_id: 1=New … 5=Poor. Map REVIVE cosmetic grade onto it.
_GRADE_TO_COND = {"A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 5}

# REVIVE category → Mercari-style category text (for the synthetic listing text)
_CAT_TEXT = {
    "Footwear": "women shoes sneakers", "Apparel": "women tops blouses shirts",
    "Phone": "electronics cell phones", "Laptop": "electronics computers laptops",
    "Monitor": "electronics computers monitor display screen",
    "Home & Kitchen": "home kitchen dining", "Books": "other books",
    "Beauty": "beauty skincare", "Toys": "kids toys",
}

# Final clamp: keep prediction within a sane band of MRP.
_PRICE_FLOOR, _PRICE_CEIL = 0.05, 0.90


def _clean_text(s: str) -> str:
    """Mirror train_price_model.py preprocessing. Uses nltk if present."""
    s = re.sub(r"\b(can|don|won|didn|doesn|haven|shouldn|wouldn|couldn|aren)'t\b",
               lambda m: m.group(1) + " not", s)
    s = s.replace("\\r", " ").replace("\\n", " ")
    s = re.sub(r"[^A-Za-z0-9.]+", " ", s)
    s = re.sub(r"(?<!\d)\.(?!\d)", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    try:
        from nltk.corpus import stopwords
        from nltk.stem import WordNetLemmatizer
        sw = set(stopwords.words("english")) - {"no", "nor", "not"}
        lem = WordNetLemmatizer()
        return " ".join(lem.lemmatize(w) for w in s.split() if w not in sw)
    except Exception:
        return s


def _ensure_loaded() -> bool:
    if _state["loaded"]:
        return _state["ok"]
    # PERF (point 1): the 2.3 GB Keras ensemble must NOT load during AI scans by
    # default — that makes grading slow. It loads ONLY if explicitly enabled via
    # REVIVE_USE_KERAS_PRICE=1. Otherwise the fast catalog/heuristic price is used.
    if os.environ.get("REVIVE_USE_KERAS_PRICE", "").lower() not in ("1", "true", "yes"):
        _state["loaded"] = True
        logger.info("[price_keras] disabled (set REVIVE_USE_KERAS_PRICE=1 to enable).")
        return False

    # Serialise: only ONE thread ever loads; others wait and reuse the result.
    with _load_lock:
        if _state["loaded"]:
            return _state["ok"]
        try:
            vec_path = _ART / "price_vectorizers.pkl"
            m1_path = _ART / "model1_best.keras"
            m2_path = _ART / "model2_best.keras"
            if not (vec_path.exists() and m1_path.exists() and m2_path.exists()):
                _state["loaded"] = True
                logger.info("[price_keras] artifacts missing → heuristic fallback.")
                return False
            from tensorflow.keras.models import load_model

            def _do_load():
                with open(vec_path, "rb") as f:
                    _state["vec"] = pickle.load(f)
                # compile=False → don't rebuild the optimizer (faster, less RAM)
                _state["m1"] = load_model(m1_path, compile=False)
                _state["m2"] = load_model(m2_path, compile=False)

            _clean_stale_tmp()
            try:
                _do_load()
            except (OSError, PermissionError) as e:
                # Windows temp-file lock (WinError 32). Clean leftovers and retry once.
                logger.warning(f"[price_keras] load hit a file lock ({e}); cleaning temp + retrying once…")
                _clean_stale_tmp()
                time.sleep(0.6)
                _do_load()
            _state["ok"] = True
            logger.info("[price_keras] Keras ensemble + vectorizers loaded.")
        except Exception as e:
            _state["ok"] = False
            logger.warning(f"[price_keras] load failed → heuristic fallback: {e}")
        finally:
            _state["loaded"] = True
    return _state["ok"]


def _effective_condition(grade: str, signals: Optional[dict]) -> int:
    """Map the cosmetic grade to a Mercari item_condition_id (1=New … 5=Poor),
    REFINED by the category condition signals the grader produced from all angles —
    so a like-new item WITH original tags/box/accessories reads as 'New', while one
    that's missing accessories or doesn't power on reads worse. This is how the
    detailed grading feeds the pricing model's main condition feature."""
    cond = _GRADE_TO_COND.get(grade, 3)
    if not signals:
        return cond
    func = signals.get("functional")
    box  = signals.get("box_present")
    acc  = signals.get("accessories_present")
    tags = signals.get("tags_present")
    if func is False:
        return 5                                  # doesn't work → Poor
    if grade == "A":
        if tags is True or (box is True and acc is True):
            return 1                              # truly New / New-with-tags
        return 2                                  # Like new (used but complete-ish)
    if grade == "B" and acc is False:
        return 3                                  # Very good but missing accessories
    return cond


def predict_price_inr(grade: str, category: str, mrp: float = 1000.0,
                      title: str = "", brand: str = "",
                      signals: Optional[dict] = None) -> Optional[float]:
    """Predict resale price in INR using the trained ensemble, or None to fall back."""
    if not _ensure_loaded():
        return None
    try:
        import numpy as np
        from scipy.sparse import hstack
        v = _state["vec"]
        cat_text = _CAT_TEXT.get(category, "other")
        name_brand = _clean_text(f"{title} {brand}".strip() or cat_text)
        text_combined = _clean_text(f"{title} {cat_text} {category}")

        X_name = v["tfidf_name"].transform([name_brand])
        X_text = v["tfidf_text"].transform([text_combined])
        X_ship = v["ohe_ship"].transform([[0]])                 # buyer pays
        X_cond = v["ohe_cond"].transform([[_effective_condition(grade, signals)]])
        X = hstack((X_name, X_text, X_ship, X_cond)).tocsr().astype("float32").toarray()

        p1 = float(_state["m1"].predict(X, verbose=0).flatten()[0])
        p2 = float(_state["m2"].predict(X, verbose=0).flatten()[0])
        wmin = v.get("ensemble_wmin", 0.405)
        log_pred = wmin * p1 + (1 - wmin) * p2
        usd = math.expm1(log_pred)
        inr = usd * v.get("usd_to_inr", 83.0)
        return float(max(mrp * _PRICE_FLOOR, min(mrp * _PRICE_CEIL, inr)))
    except Exception as e:
        logger.warning(f"[price_keras] inference failed → heuristic fallback: {e}")
        return None
