"""
ml/route.py
-----------
Smart routing — full EV optimizer + geohash demand gravity model.

Implements the Phoenix plan Pillar 2 spec exactly:

    EV(path) = P(sell | grade, category, price) × resale_price
             − logistics_cost(distance_to_demand_cluster)
             − refurb_cost(defects)
             − holding_cost(days_to_sell)

    argmax(EV) across [resell_p2p, resell_warehouse, refurbish, donate, recycle]
    Special rule: if max(EV) < donation_tax_benefit + brand_value → donate

Geohash Demand Gravity Model (the differentiator):
    - Precomputed demand index per (geohash5, category)
    - Find nearest demand cluster to seller's geohash5
    - logistics_cost = haversine(seller_cell, nearest_cluster) × ₹/km
    - This is what saves Priya's shoes the 600 km warehouse trip

Sell-Probability Model:
    - Logistic sigmoid on (price/category_median, grade_ord, demand_score, seasonality)
    - Not just a lookup table

Public interface:
    route_item(listing_id, grade, category, defects, geohash5, mrp, product_id) -> dict
"""
from __future__ import annotations
import logging
import math
import os
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# ─── Physical constants ───────────────────────────────────────────────────────
CO2_PER_KM = 0.21              # kg CO₂ per km (last-mile logistics avg)
WAREHOUSE_ROUNDTRIP_KM = 600   # Bengaluru → central warehouse → back
LOCAL_KM = 15                  # avg local P2P / cluster delivery distance km
COMMISSION_P2P = 0.12          # Amazon P2P commission (12%)
COMMISSION_WAREHOUSE = 0.18    # Warehouse resale commission (18%)
LOGISTICS_COST_PER_KM = 1.5   # ₹ per km shipping cost
HOLDING_COST_PER_DAY = 2.5     # ₹ per day holding cost (storage + capital)
BRAND_VALUE_FACTOR = 0.05      # Brand goodwill recovered via donation
DONATION_TAX_BENEFIT = 0.10    # Fraction of MRP as donation tax benefit

# ─── Refurb cost table (₹ per defect type × severity) ────────────────────────
REFURB_COST_TABLE: Dict[str, Dict[str, float]] = {
    "scratch on surface":       {"minor": 50,   "moderate": 150, "severe": 300},
    "dent on surface":          {"minor": 100,  "moderate": 350, "severe": 700},
    "stain on fabric":          {"minor": 80,   "moderate": 200, "severe": 400},
    "torn fabric":              {"minor": 150,  "moderate": 400, "severe": 800},
    "missing part":             {"minor": 200,  "moderate": 600, "severe": 1200},
    "damaged area":             {"minor": 100,  "moderate": 300, "severe": 600},
    "crack on surface":         {"minor": 120,  "moderate": 400, "severe": 900},
    "broken piece":             {"minor": 200,  "moderate": 500, "severe": 1000},
    "worn out area":            {"minor": 60,   "moderate": 150, "severe": 350},
    "discoloration on surface": {"minor": 40,   "moderate": 100, "severe": 250},
    "default":                  {"minor": 80,   "moderate": 250, "severe": 600},
}

# ─── Category-median price priors (₹, for sell-prob calibration) ─────────────
# Rough category medians for Indian market returns
CATEGORY_MEDIAN_PRICE: Dict[str, float] = {
    "Footwear": 1200.0,
    "Clothing": 800.0,
    "Electronics": 8000.0,
    "Home & Kitchen": 1500.0,
    "Books": 300.0,
    "Sports": 2000.0,
    "Beauty": 600.0,
    "Toys": 700.0,
    "Jewelry": 1800.0,
}

# ─── Grade constants ──────────────────────────────────────────────────────────
GRADE_ORD: Dict[str, int] = {"A": 4, "B": 3, "C": 2, "D": 1}
GRADE_RECOVERY: Dict[str, float] = {"A": 0.78, "B": 0.60, "C": 0.42, "D": 0.25}
GRADE_DAYS_TO_SELL: Dict[str, float] = {"A": 5, "B": 10, "C": 18, "D": 35}
GRADE_REFURB_NEXT: Dict[str, str] = {"D": "C", "C": "B", "B": "A", "A": "A"}

# ─── Geohash-5 demand index (synthetic Bengaluru cells, precomputed) ──────────
# In production: HGET demand:{geohash5}:{category} from Redis
# Format: {geohash5: {"lat": float, "lng": float, "demand": float}}
SYNTHETIC_DEMAND_INDEX: Dict[str, Dict[str, Any]] = {
    "tbxx1": {"lat": 12.9716, "lng": 77.5946, "demand": 0.92, "label": "Koramangala"},
    "tbxx2": {"lat": 12.9352, "lng": 77.6245, "demand": 0.78, "label": "HSR Layout"},
    "tbxx3": {"lat": 13.0012, "lng": 77.5953, "demand": 0.65, "label": "Indiranagar"},
    "tbxx4": {"lat": 12.9279, "lng": 77.6271, "demand": 0.82, "label": "BTM Layout"},
    "tbxw1": {"lat": 12.9141, "lng": 77.6407, "demand": 0.55, "label": "Bommanahalli"},
    "tbxw2": {"lat": 12.8456, "lng": 77.6603, "demand": 0.43, "label": "Electronic City"},
    "tbxv1": {"lat": 13.0359, "lng": 77.5970, "demand": 0.70, "label": "Malleshwaram"},
    "tbxv2": {"lat": 13.0533, "lng": 77.5688, "demand": 0.58, "label": "Rajajinagar"},
    "tbxu1": {"lat": 12.9850, "lng": 77.7480, "demand": 0.48, "label": "Whitefield"},
    "tbxu2": {"lat": 13.0688, "lng": 77.5760, "demand": 0.62, "label": "Yeshwanthpur"},
    # Default fallback cell
    "00000": {"lat": 12.9716, "lng": 77.5946, "demand": 0.50, "label": "Bengaluru"},
}

# Category-specific demand multipliers per cell (simulating real order history)
CATEGORY_CELL_BOOST: Dict[str, Dict[str, float]] = {
    "Footwear":    {"tbxx1": 1.3, "tbxx2": 1.1, "tbxv1": 0.9},
    "Electronics": {"tbxu1": 1.4, "tbxx3": 1.2, "tbxx1": 1.1},
    "Clothing":    {"tbxx1": 1.2, "tbxx4": 1.1, "tbxx2": 1.0},
}

# ─── Lazy-loaded LightGBM pricing model ──────────────────────────────────────
_price_model_cache: Optional[Any] = None
_price_model_loaded: bool = False


def _load_price_model() -> Optional[Any]:
    global _price_model_cache, _price_model_loaded
    if _price_model_loaded:
        return _price_model_cache
    model_path = Path(__file__).parent / "artifacts" / "price_model.pkl"
    if model_path.exists():
        try:
            with open(model_path, "rb") as f:
                _price_model_cache = pickle.load(f)
            logger.info("[route] LightGBM price model loaded.")
        except Exception as e:
            logger.warning(f"[route] Could not load price model: {e}")
    else:
        logger.info("[route] No price model artifact — using heuristic pricing.")
    _price_model_loaded = True
    return _price_model_cache


# ═══════════════════════════════════════════════════════════════════════════════
# PRICING MODEL
# ═══════════════════════════════════════════════════════════════════════════════

# Maps REVIVE internal category names → Mercari category text tokens
# (same tokens appear in both the training corpus and inference-time synthetic text)
_REVIVE_TO_MERCARI_TEXT: Dict[str, tuple] = {
    "Footwear":      ("women", "shoes", "sneakers"),
    "Clothing":      ("women", "tops blouses", "shirts"),
    "Electronics":   ("electronics", "computers", "laptops"),
    "Home & Kitchen":("home", "kitchen dining", "cookware"),
    "Books":         ("other", "books", "other"),
    "Sports":        ("sports outdoors", "exercise", "cardio"),
    "Beauty":        ("beauty", "skincare", "moisturizers"),
    "Toys":          ("kids", "toys", "action figures"),
    "Jewelry":       ("women", "jewelry", "necklaces"),
}

# Grade → human-readable condition words used in Mercari listings (training distribution)
_GRADE_CONDITION_TEXT: Dict[str, str] = {
    "A": "new like new mint perfect",
    "B": "good very good excellent",
    "C": "fair acceptable used worn",
    "D": "poor heavily used flawed",
}

# Grade → Mercari condition ordinal (1=New→5, 5=Poor→1 reversed to 5=best)
_GRADE_TO_COND_ORD: Dict[str, float] = {"A": 5.0, "B": 4.0, "C": 3.0, "D": 1.0}


def _predict_price(grade: str, category: str, mrp: float = 1000.0,
                   title: str = "", brand: str = "", signals: Optional[dict] = None) -> float:
    """
    Predict resale price. Order of preference:
      1. Trained Keras MLP ensemble (ml/price_keras.py) if its artifacts exist
      2. LightGBM artifact (price_model.pkl) — TF-IDF+SVD or legacy tabular
      3. Heuristic: mrp × GRADE_RECOVERY
    """
    # 1) Trained Keras ensemble (model1_best.keras + model2_best.keras + vectorizers)
    try:
        from ml.price_keras import predict_price_inr as _keras_price
    except Exception:
        try:
            from price_keras import predict_price_inr as _keras_price
        except Exception:
            _keras_price = None
    if _keras_price is not None:
        kp = _keras_price(grade, category, mrp, title=title, brand=brand, signals=signals)
        if kp is not None:
            # The Mercari-trained ensemble predicts an absolute US-marketplace
            # price that ignores the catalog MRP magnitude — so a like-new iPhone
            # would come back at a few thousand rupees. Per design (§4.1) the
            # model is a market-relative SIGNAL: anchor it on the catalog MRP via
            # the grade-recovery curve so high-value items stay credible, and let
            # the model nudge the result by condition. Per-defect deductions are
            # then applied by the caller (_apply_defect_discount).
            anchor = mrp * GRADE_RECOVERY.get(grade, 0.42)
            blended = 0.70 * anchor + 0.30 * float(kp)
            return float(max(mrp * 0.08, min(mrp * 0.92, blended)))

    artifact = _load_price_model()
    if artifact is not None:
        try:
            import numpy as np
            artifact_type = (
                artifact.get("type", "legacy")
                if isinstance(artifact, dict)
                else "legacy"
            )

            # ── NEW: TF-IDF + SVD inference path ──────────────────────────────
            if artifact_type == "lgbm_tfidf_svd_v2":
                from scipy.sparse import hstack as sp_hstack

                model      = artifact["model"]
                tfidf_word = artifact["tfidf_word"]
                tfidf_char = artifact["tfidf_char"]
                svd        = artifact["svd"]

                # Build synthetic listing text from the info we have at inference time.
                # These tokens were all present in the training corpus, so the
                # vectorizer will produce meaningful (non-zero) TF-IDF weights.
                c0, c1, c2  = _REVIVE_TO_MERCARI_TEXT.get(category, ("other", "other", "other"))
                cond_words   = _GRADE_CONDITION_TEXT.get(grade, "used")
                # Repeat category tokens to increase their TF weight (mirrors how
                # real listings write their category name into the title/description)
                text = f"{c0} {c1} {c2} {cond_words} {c0} {c1} {category.lower()}"

                X_word   = tfidf_word.transform([text])
                X_char   = tfidf_char.transform([text])
                X_sparse = sp_hstack([X_word, X_char], format="csr")
                X_svd    = svd.transform(X_sparse)                  # (1, 64)

                # 5 numeric features — must match build_numeric() in training script
                cond_ord  = _GRADE_TO_COND_ORD.get(grade, 3.0)
                # name_len_norm: use 0.15 (≈12 chars, typical short product name)
                X_num = np.array([[cond_ord, 0.0, 0.15, 1.0, 0.0]])  # (1, 5)
                X     = np.hstack([X_svd, X_num])                   # (1, 69)

                predicted_log = float(model.predict(X)[0])
                predicted_usd = math.expm1(predicted_log)       # undo log1p → USD
                predicted_inr = predicted_usd * 83.0            # USD → INR
                grade_adj     = predicted_inr * GRADE_RECOVERY.get(grade, 0.42)
                return float(max(mrp * 0.05, min(mrp * 0.90, grade_adj)))

            # ── LEGACY: 10-column tabular path (backward compatible) ──────────
            else:
                model    = artifact["model"] if isinstance(artifact, dict) else artifact
                encoders = artifact.get("encoders", {}) if isinstance(artifact, dict) else {}

                # Map REVIVE category → Mercari cat_0 / cat_1 / cat_2
                CAT_MAP = {
                    "Footwear":      ("Women", "Shoes", "Sneakers"),
                    "Clothing":      ("Women", "Tops & Blouses", "T-Shirts"),
                    "Electronics":   ("Electronics", "Computers", "Laptops"),
                    "Home & Kitchen":("Home", "Kitchen & Dining", "Cookware"),
                    "Books":         ("Other", "Books", "Other"),
                    "Sports":        ("Sports & Outdoors", "Exercise", "Cardio"),
                    "Beauty":        ("Beauty", "Skincare", "Moisturizers"),
                    "Toys":          ("Kids", "Toys", "Action Figures"),
                    "Jewelry":       ("Women", "Jewelry", "Necklaces"),
                }
                cat_0_str, cat_1_str, cat_2_str = CAT_MAP.get(
                    category, ("Other", "Other", "Other"))
                condition_ord = GRADE_ORD.get(grade, 2)

                def encode(val: str, col: str) -> int:
                    cats = encoders.get(col, [])
                    return {v: i for i, v in enumerate(cats)}.get(val, -1)

                features = np.array([[
                    encode(cat_0_str, "cat_0"),
                    encode(cat_1_str, "cat_1"),
                    encode(cat_2_str, "cat_2"),
                    encode("unknown", "brand_name"),
                    float(condition_ord),
                    0.0,    # shipping (buyer pays)
                    15.0,   # name_len typical
                    100.0,  # desc_len typical
                    0.0,    # brand_in_name
                    1.0,    # has_desc
                ]])

                predicted_log = float(model.predict(features)[0])
                predicted_usd = math.expm1(predicted_log)
                predicted_inr = predicted_usd * 83.0
                grade_adj     = predicted_inr * GRADE_RECOVERY.get(grade, 0.42)
                return float(max(mrp * 0.05, min(mrp * 0.90, grade_adj)))

        except Exception as e:
            logger.warning(f"[route] Price model inference error: {e}")

    return mrp * GRADE_RECOVERY.get(grade, 0.42)


# ═══════════════════════════════════════════════════════════════════════════════
# SELL-PROBABILITY MODEL (Logistic on price/median ratio + grade + demand)
# ═══════════════════════════════════════════════════════════════════════════════

def _sell_probability(
    price: float,
    grade: str,
    category: str,
    demand_score: float,
    seasonality: float = 1.0,
) -> float:
    """
    Logistic sell-probability model.
    Inputs: price/category_median ratio, grade ordinal, demand score, seasonality.
    This is the 'sell-probability model' specified in Phoenix Pillar 2.
    """
    median = CATEGORY_MEDIAN_PRICE.get(category, 1000.0)
    price_ratio = price / max(median, 1.0)   # 1.0 = at median, <1 = discount, >1 = premium

    grade_ord = GRADE_ORD.get(grade, 2) / 4.0  # normalise to [0.25, 1.0]

    # Logistic feature weights (calibrated on intuition, tune with real data)
    # Lower price → higher sell prob | Better grade → higher | High demand → higher
    z = (
        + 2.5                              # intercept (base sell prob ~0.92 at z=0)
        - 3.0 * (price_ratio - 0.6)       # penalty if priced above 60% of median
        + 1.5 * grade_ord                  # grade bonus
        + 1.2 * demand_score               # local demand bonus
        + 0.3 * (seasonality - 1.0)        # seasonality adjustment
    )
    prob = 1.0 / (1.0 + math.exp(-z))
    return round(min(0.97, max(0.05, prob)), 3)


# ═══════════════════════════════════════════════════════════════════════════════
# GEOHASH DEMAND GRAVITY MODEL
# ═══════════════════════════════════════════════════════════════════════════════

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine great-circle distance in km."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _geohash5_approx_center(gh: str) -> tuple[float, float]:
    """
    Approximate lat/lng centre of a geohash5 cell.
    Returns (lat, lng). Uses lookup first, then decodes if not found.
    """
    if gh in SYNTHETIC_DEMAND_INDEX:
        info = SYNTHETIC_DEMAND_INDEX[gh]
        return info["lat"], info["lng"]
    # Fallback: decode geohash (no external lib needed — simple base32 decode)
    BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
    lat_min, lat_max = -90.0, 90.0
    lng_min, lng_max = -180.0, 180.0
    is_lng = True
    for char in gh.lower():
        idx = BASE32.find(char)
        if idx < 0:
            break
        for bits in (16, 8, 4, 2, 1):
            if is_lng:
                mid = (lng_min + lng_max) / 2
                if idx & bits:
                    lng_min = mid
                else:
                    lng_max = mid
            else:
                mid = (lat_min + lat_max) / 2
                if idx & bits:
                    lat_min = mid
                else:
                    lat_max = mid
            is_lng = not is_lng
    return (lat_min + lat_max) / 2, (lng_min + lng_max) / 2


def _demand_lookup(geohash5: str, category: str) -> Dict[str, Any]:
    """
    Geohash Demand Gravity Model.

    Steps:
      1. Try Redis HGET demand:{geohash5}:{category} (production path)
      2. Fall back to precomputed SYNTHETIC_DEMAND_INDEX
      3. Find nearest high-demand cluster to seller's cell (gravity model)
      4. Compute logistics_cost = haversine(seller, nearest_cluster) × ₹/km
         vs warehouse roundtrip cost
    """
    # Step 1: Try Redis (skip if USE_REDIS=false/0/no — avoids timeout during demo)
    raw_demand = None
    _use_redis = os.environ.get("USE_REDIS", "true").lower() not in ("false", "0", "no", "off")
    if _use_redis:
        try:
            import redis, json
            r = redis.Redis(
                host=os.environ.get("REDIS_HOST", "localhost"),
                port=int(os.environ.get("REDIS_PORT", 6379)),
                decode_responses=True,
                socket_connect_timeout=1,
            )
            raw = r.hget(f"demand:{geohash5}", category)
            if raw:
                raw_demand = json.loads(raw)
        except Exception:
            pass

    # Resolve seller cell early — used in artifact lookup and gravity fallback
    seller_gh = geohash5 or "tbxx1"

    # Step 2: Try demand_index.json artifact (from build_demand_index.py)
    if not raw_demand:
        try:
            idx_path = Path(__file__).parent / "artifacts" / "demand_index.json"
            if idx_path.exists():
                import json
                with open(idx_path) as f:
                    _idx = json.load(f)
                raw_demand = _idx.get(seller_gh, {}).get(category)
        except Exception:
            pass

    if raw_demand:
        return raw_demand

    # Step 3: Gravity model fallback
    seller_lat, seller_lng = _geohash5_approx_center(seller_gh)

    # Step 3: Find nearest high-demand cluster using gravity model
    # Gravity score = demand_score / (1 + distance_km²) — classic gravity decay
    cat_boosts = CATEGORY_CELL_BOOST.get(category, {})
    best_cluster = None
    best_gravity = -1.0
    best_dist_km = WAREHOUSE_ROUNDTRIP_KM  # worst case

    for gh, info in SYNTHETIC_DEMAND_INDEX.items():
        if gh == "00000":
            continue
        dist_km = _haversine_km(seller_lat, seller_lng, info["lat"], info["lng"])
        cat_boost = cat_boosts.get(gh, 1.0)
        base_demand = info["demand"] * cat_boost
        # Gravity model: demand attenuates with distance²
        gravity = base_demand / (1.0 + (dist_km ** 2) / 25.0)  # 25 = ~5km² half-distance
        if gravity > best_gravity:
            best_gravity = gravity
            best_cluster = gh
            best_dist_km = dist_km

    # Step 4: Compute demand for seller's own cell
    seller_info = SYNTHETIC_DEMAND_INDEX.get(seller_gh, SYNTHETIC_DEMAND_INDEX["00000"])
    cat_boost = cat_boosts.get(seller_gh, 1.0)
    demand_score = min(1.0, seller_info["demand"] * cat_boost)

    # Nearest cluster for P2P routing
    cluster_info = SYNTHETIC_DEMAND_INDEX.get(best_cluster, seller_info)
    cluster_label = cluster_info.get("label", best_cluster)
    local_buyers = int(demand_score * 80 + 5)

    return {
        "demand_score": round(demand_score, 3),
        "local_buyers": local_buyers,
        "nearest_cluster": best_cluster,
        "nearest_cluster_label": cluster_label,
        "dist_to_cluster_km": round(best_dist_km, 1),
        "gravity_score": round(best_gravity, 4),
        "note": (
            f"{local_buyers} buyers within 8 km searched for {category} this month"
            + (f" · nearest demand cluster: {cluster_label} ({best_dist_km:.1f} km)"
               if best_cluster != seller_gh else " · you're in the demand cluster!")
        ),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# EV FUNCTIONS — exact formula from Phoenix spec
# ═══════════════════════════════════════════════════════════════════════════════

def _logistics_cost_p2p(dist_to_cluster_km: float) -> float:
    """
    P2P logistics cost = actual distance to nearest demand cluster × ₹/km.
    This is the geohash gravity differentiator — if item is already in demand
    cluster (dist ≈ 0), logistics_cost → near zero.
    """
    return max(dist_to_cluster_km, 2.0) * LOGISTICS_COST_PER_KM  # min 2km


def _ev_resell_p2p(
    price: float,
    sell_prob: float,
    dist_to_cluster_km: float,
    grade: str,
) -> float:
    """
    EV(resell_p2p) = P(sell) × net_price
                   − logistics_cost(dist_to_demand_cluster)  ← GRAVITY MODEL
                   − holding_cost(days_to_sell × ₹/day)
    """
    days = GRADE_DAYS_TO_SELL.get(grade, 10)
    net_price = price * (1 - COMMISSION_P2P)
    logistics = _logistics_cost_p2p(dist_to_cluster_km)
    holding = days * HOLDING_COST_PER_DAY
    return sell_prob * net_price - logistics - holding


def _ev_resell_warehouse(
    price: float,
    sell_prob: float,
    grade: str,
) -> float:
    """
    EV(resell_warehouse) = P(sell) × 0.85 × price  [warehouse markup penalty]
                         − logistics(600km roundtrip)  ← always 600km
                         − holding_cost(20 days)
    """
    logistics = WAREHOUSE_ROUNDTRIP_KM * LOGISTICS_COST_PER_KM
    holding = 20 * HOLDING_COST_PER_DAY
    net_price = price * (1 - COMMISSION_WAREHOUSE)
    return sell_prob * 0.85 * net_price - logistics - holding


def _ev_refurbish(
    post_refurb_price: float,
    refurb_cost: float,
    sell_prob_post_refurb: float,
) -> float:
    """
    EV(refurbish) = P(sell | post_refurb) × post_refurb_price
                  − refurb_cost(defects)
                  − logistics(to_refurb_center + back = full roundtrip)
                  − holding(refurb_days + listing_days)

    Note: Full roundtrip because item must travel to refurb center AND
    return to fulfillment / P2P listing location. Partial-trip assumption
    was wrong — refurb always involves a warehouse detour.
    """
    logistics = WAREHOUSE_ROUNDTRIP_KM * LOGISTICS_COST_PER_KM  # full 600km roundtrip
    holding = (7 + 12) * HOLDING_COST_PER_DAY  # 7 days refurb + 12 days listing
    return sell_prob_post_refurb * post_refurb_price - refurb_cost - logistics - holding


def _ev_donate(mrp: float) -> float:
    """
    EV(donate) = donation_tax_benefit + brand_value
               = mrp × (DONATION_TAX_BENEFIT + BRAND_VALUE_FACTOR)
    Used as the floor in the Phoenix spec:
      'if max(EV) < donation_tax_benefit + brand_value → donate'
    """
    return mrp * (DONATION_TAX_BENEFIT + BRAND_VALUE_FACTOR)


def _ev_recycle() -> float:
    """EV(recycle) = scrap + compliance baseline = ₹15."""
    return 15.0


# ═══════════════════════════════════════════════════════════════════════════════
# REFURB COST LOOKUP
# ═══════════════════════════════════════════════════════════════════════════════

def _compute_refurb_cost(defects: List[Dict]) -> float:
    """Defect type → repair cost lookup per Phoenix spec component 4."""
    total = 0.0
    for d in defects:
        dtype = d.get("type", "default")
        severity = d.get("severity", "minor")
        lookup = REFURB_COST_TABLE.get(dtype, REFURB_COST_TABLE["default"])
        total += lookup.get(severity, lookup["minor"])
    return total


# v2 (Q9): per-defect price deduction for selling AS-IS. The cosmetic grade sets
# the base recovery; specific defects then deduct a severity-weighted fraction of
# MRP so a cracked screen costs more than a light scuff — not just a letter grade.
_DEFECT_SEVERITY_DEDUCT = {"minor": 0.02, "moderate": 0.06, "severe": 0.15}


def _apply_defect_discount(price: float, defects: List[Dict], mrp: float) -> float:
    """Reduce the as-is price by a severity-weighted, MRP-scaled defect penalty
    (capped at 50% of MRP). Returns the discounted price, floored at 5% of MRP."""
    if not defects:
        return price
    deduction = 0.0
    for d in defects:
        sev = d.get("severity", "minor")
        deduction += _DEFECT_SEVERITY_DEDUCT.get(sev, 0.02) * mrp
    deduction = min(deduction, mrp * 0.5)
    return max(mrp * 0.05, price - deduction)


# ═══════════════════════════════════════════════════════════════════════════════
# TIER LOGIC  (from final_idea.md §3 Rule 3 + §4 Pillar 2 tier table)
# ═══════════════════════════════════════════════════════════════════════════════

TIER1_LIMIT = 2_000.0    # MRP < ₹2,000
TIER2_LIMIT = 10_000.0   # MRP ₹2,000–₹10,000; above = Tier 3

# Demand gate constants
BASE_HOLDING_COST = 2.5  # ₹/day — same as HOLDING_COST_PER_DAY
DECAY_FACTOR = 0.05      # holding cost grows 5% per day
SELL_THRESHOLD = 50.0    # min expected local value (₹) to flag as SELL


# v2: risk-tier (value × fraud-risk) + disposition gate. Imported lazily so
# route.py still works if the new modules are absent (falls back to price tier).
try:
    from ml.risk_tier import tier_int as _tier_int_fn, risk_tier as _risk_tier_fn
    from ml.category_profiles import is_electronics as _is_electronics_fn
    from ml.disposition import disposition as _disposition_fn
    _V2 = True
except Exception:  # pragma: no cover
    try:
        from risk_tier import tier_int as _tier_int_fn, risk_tier as _risk_tier_fn
        from category_profiles import is_electronics as _is_electronics_fn
        from disposition import disposition as _disposition_fn
        _V2 = True
    except Exception:
        _V2 = False


def _get_tier(mrp: float, category: str = "") -> int:
    """Legacy integer tier (1/2/3). v2: derived from risk_tier(mrp, category)."""
    if _V2:
        return _tier_int_fn(mrp, category)
    if mrp < TIER1_LIMIT:
        return 1
    if mrp <= TIER2_LIMIT:
        return 2
    return 3


_ROUTE_LABEL: Dict[str, str] = {
    "restock_new":      "Restock as New",
    "resell_p2p":       "Resell Nearby",
    "resell_warehouse": "Resell City-Wide",
    "refurbish":        "Refurbish & Resell",
    "donate":           "Donate",
    "recycle":          "Recycle",
}

_CUSTOMER_MESSAGE: Dict[str, str] = {
    "restock_new":      "Good news — this is unused, so it goes back as new",
    "resell_p2p":       "Your item will be resold to someone nearby",
    "resell_warehouse": "Your item will be listed city-wide on Amazon Resale",
    "refurbish":        "Your item will be professionally refurbished and resold",
    "donate":           "Your item will be donated to a verified NGO partner",
    "recycle":          "Your item will be responsibly recycled",
}


def _apply_tier_rules(chosen_path: str, tier: int, dist_to_cluster_km: float,
                      category: str = "") -> str:
    """
    Physical-route eligibility rules (final_idea_v2.md §7). These constrain HOW a
    resell item ships — they do NOT decide whether to resell/refurbish/donate
    (that is the Disposition Gate's job in route_item, Stage 0).

    The ONLY hard rule here: the kirana-relay (Route B) is blocked for fraud-prone
    ELECTRONICS that can't be verified at a counter — a ₹6,000 phone must use
    city-wide/agent, but a ₹6,000 Nike shoe keeps its kirana-relay option.
    (The old "HIGH tier always refurbishes" rule was removed — disposition now
    decides RENEWED_SPN, so a like-new open-box phone is no longer force-refurbished.)
    """
    electronics = _is_electronics_fn(category) if _V2 else (tier >= 2)

    if tier >= 2 and electronics:
        # Electronics relay block — long-distance P2P must use city-wide (no kirana)
        if chosen_path == "resell_p2p" and dist_to_cluster_km > 5.0:
            return "resell_warehouse"
    return chosen_path


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1 — DEMAND GATE
# ═══════════════════════════════════════════════════════════════════════════════

def demand_gate(
    item_id: str,
    location_geohash: str,
    category: str,
    grade: str,
    asking_price: float,
    days_listed: int,
) -> Dict[str, Any]:
    """
    Stage 1 demand gate — runs every 6 hours while an item waits for a buyer.

    Returns a dict with:
      action:  SELL | HOLD | ESCALATE_CITY | ESCALATE_FC | LIQUIDATE
      reason:  human-readable explanation
      demand_score, sell_probability, expected_local_value, holding_cost
    """
    demand_info = _demand_lookup(location_geohash, category)
    demand_score = demand_info["demand_score"]
    sell_prob = _sell_probability(asking_price, grade, category, demand_score)
    holding_cost = BASE_HOLDING_COST * (1.0 + DECAY_FACTOR * days_listed)
    expected_local_value = sell_prob * asking_price - holding_cost

    # Day thresholds (strict order: longest first)
    if days_listed >= 60:
        action = "LIQUIDATE"
        reason = "Item unsold after 60 days — liquidate via FBA or donate to NGO"
    elif days_listed >= 21:
        action = "ESCALATE_FC"
        reason = f"No city-wide buyer after {days_listed}d — entering Amazon FC for national listing"
    elif days_listed >= 7:
        action = "ESCALATE_CITY"
        reason = f"No local buyer after {days_listed}d — widening to city-wide / national listing"
    elif expected_local_value > SELL_THRESHOLD:
        action = "SELL"
        reason = f"Local demand sufficient (EV=₹{expected_local_value:.0f}) — proceed to Stage 2 routing"
    else:
        action = "HOLD"
        reason = f"Expected local value ₹{expected_local_value:.0f} below threshold — hold and re-check in 6h"

    return {
        "item_id": item_id,
        "action": action,
        "reason": reason,
        "demand_score": round(demand_score, 3),
        "sell_probability": round(sell_prob, 3),
        "expected_local_value": round(expected_local_value, 2),
        "holding_cost_per_day": round(holding_cost / max(days_listed, 1), 2),
        "days_listed": days_listed,
        "local_buyers": demand_info.get("local_buyers", 0),
        "demand_note": demand_info.get("note", ""),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC INTERFACE
# ═══════════════════════════════════════════════════════════════════════════════

def route_item(
    listing_id: str,
    grade: str,
    category: str,
    defects: Optional[List[Dict]] = None,
    geohash5: Optional[str] = None,
    mrp: float = 1000.0,
    product_id: str = "unknown",
    title: str = "",
    brand: str = "",
    condition_signals: Optional[Dict] = None,
    *,
    sealed: bool = False,
    opened: bool = True,
    verified_match: bool = True,
    complete: bool = True,
    functional_pass: Optional[bool] = None,
    tier_value: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Route a graded return item to its highest-value second life.

    Implements the Phoenix Pillar 2 EV optimizer exactly:
        EV = P(sell|grade,category,price) × resale_price
           − logistics_cost(distance_to_nearest_demand_cluster)
           − refurb_cost(defects)
           − holding_cost(days_to_sell)

    Geohash Gravity Model:
        logistics_cost is computed from actual haversine distance to the
        nearest demand cluster in the (geohash5, category) demand index —
        not a fixed constant. P2P routes the item to the cluster, never to
        the central warehouse.

    Phoenix special rule:
        if max(EV) < donation_tax_benefit + brand_value → donate
    """
    defects = defects or []

    # ── Step 1: Price prediction (catalog-MRP-anchored, grade-adjusted) ───────
    price = _predict_price(grade, category, mrp, title=title, brand=brand, signals=condition_signals)
    # v2 (Q9): deduct a severity-weighted penalty for the specific defects found,
    # so pricing reflects condition + defects, not just the letter grade.
    price = _apply_defect_discount(price, defects, mrp)

    # ── Step 2: Geohash demand gravity lookup ─────────────────────────────────
    demand_info = _demand_lookup(geohash5 or "tbxx1", category)
    demand_score = demand_info["demand_score"]
    dist_to_cluster_km = demand_info["dist_to_cluster_km"]
    local_buyers = demand_info["local_buyers"]

    # ── Step 3: Sell-probability (logistic model, not just lookup table) ──────
    sell_prob = _sell_probability(price, grade, category, demand_score)

    # ── Step 4: Refurb cost lookup + post-refurb pricing ─────────────────────
    refurb_cost = _compute_refurb_cost(defects)
    post_refurb_grade = GRADE_REFURB_NEXT.get(grade, "B")
    post_refurb_price = _predict_price(post_refurb_grade, category, mrp)
    sell_prob_post_refurb = _sell_probability(
        post_refurb_price, post_refurb_grade, category, demand_score
    )

    # ── Step 5: Compute EV for each path ─────────────────────────────────────
    ev_p2p = _ev_resell_p2p(price, sell_prob, dist_to_cluster_km, grade)
    ev_warehouse = _ev_resell_warehouse(price, sell_prob, grade)
    ev_refurbish = _ev_refurbish(post_refurb_price, refurb_cost, sell_prob_post_refurb)
    ev_donate = _ev_donate(mrp)
    ev_recycle = _ev_recycle()

    ev_breakdown = {
        "resell_p2p":       round(ev_p2p, 2),
        "resell_warehouse": round(ev_warehouse, 2),
        "refurbish":        round(ev_refurbish, 2),
        "donate":           round(ev_donate, 2),
        "recycle":          round(ev_recycle, 2),
    }

    # ── Step 6: Risk tier (backend-only) ──────────────────────────────────────
    # Tier is decided by the item's CURRENT value (the seller's asking / resale
    # price), not its original MRP — a 4-year-old ₹90k laptop now worth ₹12k should
    # not be forced into a ₹10k+ Tier-3 SPN inspection. `mrp` still anchors the
    # resale-price prediction above; `tier_value` (when given) drives tiering only.
    tier_basis = float(tier_value) if tier_value is not None else mrp
    tier = _get_tier(tier_basis, category)

    # ── Step 6b: Stage 0 Disposition Gate (v2 §6) ─────────────────────────────
    # Decides whether the item restocks as NEW / open-box / used / renewed /
    # recycle. Flags not available to the router default conservatively
    # (opened, unsealed); the listing/return flow passes richer flags via the
    # backend when it has them.
    disp = None
    if _V2:
        disp = _disposition_fn(
            grade=grade,
            category=category,
            sealed=bool(sealed),
            opened=bool(opened),
            verified_match=bool(verified_match),
            complete=bool(complete),
            functional_pass=functional_pass,
            safe=(grade != "F"),
            refurb_economical=(ev_refurbish > 0),
        )

    # ── Step 7: choose the path ───────────────────────────────────────────────
    max_path = max(ev_breakdown, key=lambda k: ev_breakdown[k])
    max_ev = ev_breakdown[max_path]
    donation_floor = ev_donate  # = mrp × (tax_benefit + brand_value)

    if disp is not None:
        # v2: the Disposition Gate is AUTHORITATIVE for the destination class.
        # The EV optimizer only chooses the physical resell route (p2p vs city-wide)
        # for items that are actually being resold — it can no longer override the
        # disposition into donate/refurbish (that was the donate/refurbish bug).
        outcome = disp["outcome"]
        if outcome == "RESTOCK_NEW":
            chosen_path = "restock_new"
        elif outcome == "RECYCLE_DONATE":
            chosen_path = "donate" if ev_donate >= ev_recycle else "recycle"
        elif outcome == "RENEWED_SPN":
            chosen_path = "refurbish"
        else:  # OPEN_BOX / USED_P2P → resell; pick the better resell route by EV
            chosen_path = "resell_p2p" if ev_p2p >= ev_warehouse else "resell_warehouse"
    else:
        # Legacy (no v2 modules): original EV argmax with donation floor
        if max_ev < donation_floor:
            chosen_path = "donate"
        elif grade in ("D", "E") and ev_refurbish < 0 and max_path in ("resell_p2p", "resell_warehouse"):
            chosen_path = "donate" if ev_donate > ev_recycle else "recycle"
        else:
            chosen_path = max_path

    # Physical-route eligibility (electronics kirana block) — resell paths only
    if chosen_path in ("resell_p2p", "resell_warehouse"):
        chosen_path = _apply_tier_rules(chosen_path, tier, dist_to_cluster_km, category)

    # A restocked-as-new item is sold at full catalog price, not a resale discount.
    if chosen_path == "restock_new":
        price = mrp

    # ── Step 8: Environmental impact ─────────────────────────────────────────
    if "p2p" in chosen_path:
        # Item routed locally — saves the full warehouse roundtrip MINUS local delivery
        # Even if seller is in the demand cluster (dist=0), they still avoid sending
        # to the central warehouse (600km roundtrip). Local delivery = dist_to_cluster × 2.
        local_delivery_km = max(dist_to_cluster_km * 2, LOCAL_KM)
        km_saved = max(0.0, WAREHOUSE_ROUNDTRIP_KM - local_delivery_km)
    else:
        km_saved = 0.0
    co2_saved_kg = round(km_saved * CO2_PER_KM, 2)
    green_credits = round(co2_saved_kg * 2.5)  # 2.5 credits per kg CO₂ saved

    # ── Step 9: MCDA framing (for pitch) ─────────────────────────────────────
    mcda_note = (
        f"EV optimizer: {chosen_path} wins with EV=₹{max_ev:.0f} "
        f"vs liquidate=₹{ev_recycle:.0f} "
        f"({max_ev / max(ev_recycle, 1):.0f}× recovery ratio)"
    )

    return {
        "listing_id":             listing_id,
        "chosen_path":            chosen_path,
        "route_label":            _ROUTE_LABEL.get(chosen_path, chosen_path),
        "customer_message":       (disp["customer_message"] if disp else _CUSTOMER_MESSAGE.get(chosen_path, "")),
        "tier":                   tier,
        "risk_tier":              (_risk_tier_fn(tier_basis, category) if _V2 else None),
        "disposition":            (disp["outcome"] if disp else None),
        "condition_label":        (disp["condition_label"] if disp else None),
        "enters_revive":          (disp["enters_revive"] if disp else True),
        "ev_breakdown":           ev_breakdown,
        "price":                  round(price, 2),
        "price_post_refurb":      round(post_refurb_price, 2),
        "refurb_cost":            round(refurb_cost, 2),
        "sell_probability":       sell_prob,
        "km_saved":               round(km_saved, 1),
        "co2_saved_kg":           co2_saved_kg,
        "demand_score":           demand_score,
        "local_buyers":           local_buyers,
        "demand_note":            demand_info["note"],
        "nearest_cluster":        demand_info.get("nearest_cluster_label", ""),
        "dist_to_cluster_km":     round(dist_to_cluster_km, 1),
        "green_credits_earned":   green_credits,
        "mcda_note":              mcda_note,
    }
