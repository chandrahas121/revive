"""
ml/recommend.py
---------------
Hybrid recommender: Implicit ALS (collaborative) + CLIP content + grade boost + proximity.

Public interface:
    recommend(user_id, n=5, geohash5=None, available_listings=None) -> list[dict]

Score formula:
    score(user, item) = α · ALS_score
                      + β · CLIP_sim(item_emb, user_history_embs)
                      + γ · grade_boost       (A=1.0, B=0.8, C=0.4, D=0.0)
                      + δ · proximity_boost   (same geohash5 → +1)

Cold-start (new refurb items): ALS=0, CLIP carries the cold item via content.
"""
from __future__ import annotations
import logging
import os
import pickle
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# ─── Hybrid weights ────────────────────────────────────────────────────────
ALPHA = 0.50   # ALS collaborative weight
BETA  = 0.30   # CLIP content weight
GAMMA = 0.15   # Grade boost weight
DELTA = 0.05   # Proximity boost weight

GRADE_BOOST = {"A": 1.0, "B": 0.8, "C": 0.4, "D": 0.0}

# ─── Lazy-loaded artifacts ─────────────────────────────────────────────────
_als_user_factors: Optional[np.ndarray] = None
_als_item_factors: Optional[np.ndarray] = None
_user_id_map: Optional[Dict[str, int]] = None
_item_id_map: Optional[Dict[str, int]] = None
_als_loaded = False


def _load_als():
    global _als_user_factors, _als_item_factors, _user_id_map, _item_id_map, _als_loaded
    if _als_loaded:
        return
    artifacts_dir = Path(__file__).parent / "artifacts"

    try:
        with open(artifacts_dir / "als_user_factors.pkl", "rb") as f:
            _als_user_factors = pickle.load(f)
        with open(artifacts_dir / "als_item_factors.pkl", "rb") as f:
            _als_item_factors = pickle.load(f)
        with open(artifacts_dir / "als_user_id_map.pkl", "rb") as f:
            _user_id_map = pickle.load(f)
        with open(artifacts_dir / "als_item_id_map.pkl", "rb") as f:
            _item_id_map = pickle.load(f)
        logger.info("[recommend] ALS artifacts loaded.")
    except FileNotFoundError:
        logger.info("[recommend] ALS artifacts not found — content-only mode.")
    except Exception as e:
        logger.warning(f"[recommend] ALS load error: {e}")

    _als_loaded = True


def _als_score(user_id: str, item_id: str) -> float:
    """Dot product of user and item latent factors. 0.0 if not in model."""
    _load_als()
    if _als_user_factors is None or _user_id_map is None or _item_id_map is None:
        return 0.0
    u_idx = _user_id_map.get(str(user_id))
    i_idx = _item_id_map.get(str(item_id))
    if u_idx is None or i_idx is None:
        return 0.0
    score = float(np.dot(_als_user_factors[u_idx], _als_item_factors[i_idx]))
    # Normalise to [0, 1]
    return min(1.0, max(0.0, score / 10.0))


def _clip_content_score(
    item_embedding: Optional[np.ndarray],
    user_history_embeddings: List[np.ndarray],
) -> float:
    """Average cosine similarity of item embedding against user history embeddings."""
    if item_embedding is None or not user_history_embeddings:
        return 0.0
    sims = [
        float(np.dot(item_embedding, h))
        for h in user_history_embeddings
        if h is not None
    ]
    return round(sum(sims) / len(sims), 4) if sims else 0.0


def _load_listing_embeddings() -> Dict[str, np.ndarray]:
    """Load precomputed CLIP embeddings for all listings from disk."""
    emb_path = Path(__file__).parent / "artifacts" / "listing_embeddings.pkl"
    if emb_path.exists():
        try:
            with open(emb_path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            logger.warning(f"[recommend] Listing embeddings load error: {e}")
    return {}


def recommend(
    user_id: str,
    n: int = 5,
    geohash5: Optional[str] = None,
    available_listings: Optional[List[Dict]] = None,
    user_history_embeddings: Optional[List[np.ndarray]] = None,
) -> List[Dict[str, Any]]:
    """
    Return top-N recommended listings for a user.

    Args:
        user_id:                  User identifier.
        n:                        Number of recommendations (default 5).
        geohash5:                 User's geohash for proximity boost.
        available_listings:       List of listing dicts from the backend:
                                  [{listing_id, product_id, grade, source,
                                    geohash5, clip_embedding (list), price}]
                                  If None, returns empty (backend must supply).
        user_history_embeddings:  Precomputed CLIP embeddings of user's
                                  purchase history (from backend cache).

    Returns:
        [{listing_id, score, reason, grade, price}]
        sorted by score descending.
    """
    if not available_listings:
        return []

    # Load precomputed CLIP embeddings if not supplied by backend
    stored_embeddings = _load_listing_embeddings()

    scored = []
    for listing in available_listings:
        listing_id = listing.get("listing_id", "")
        grade = listing.get("grade", "C")
        source = listing.get("source", "warehouse")
        lhash = listing.get("geohash5", "")
        product_id = listing.get("product_id", listing_id)
        price = float(listing.get("price", 0))

        # Only recommend A/B grade items (quality filter)
        if grade not in ("A", "B"):
            continue

        # 1. ALS collaborative score
        als = _als_score(user_id, product_id)

        # 2. CLIP content score
        # Item embedding: from listing dict (backend supplies) or precomputed file
        raw_emb = listing.get("clip_embedding")
        if raw_emb is not None:
            item_emb = np.array(raw_emb, dtype=np.float32)
            # Normalize
            norm = np.linalg.norm(item_emb)
            if norm > 0:
                item_emb = item_emb / norm
        else:
            item_emb = stored_embeddings.get(listing_id)

        clip_score = _clip_content_score(item_emb, user_history_embeddings or [])

        # 3. Grade boost
        g_boost = GRADE_BOOST.get(grade, 0.4)

        # 4. Proximity boost
        prox = 1.0 if (geohash5 and lhash and geohash5[:4] == lhash[:4]) else 0.0

        # 5. Hybrid score
        hybrid = (
            ALPHA * als
            + BETA * clip_score
            + GAMMA * g_boost
            + DELTA * prox
        )

        # Build reason string
        reason_parts = []
        if als > 0.3:
            reason_parts.append("customers like you loved this")
        if clip_score > 0.4:
            reason_parts.append("matches your style")
        if prox > 0:
            reason_parts.append("available near you")
        if source == "p2p":
            reason_parts.append("Amazon-verified P2P")
        if not reason_parts:
            reason_parts.append(f"Grade {grade} certified refurbished")
        reason = " · ".join(reason_parts)

        scored.append({
            "listing_id": listing_id,
            "product_id": product_id,
            "score": round(hybrid, 4),
            "reason": reason,
            "grade": grade,
            "source": source,
            "price": price,
            "als_score": round(als, 4),
            "clip_score": round(clip_score, 4),
            "grade_boost": g_boost,
            "proximity_boost": prox,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:n]
