"""
ml/prevent.py
-------------
Return-risk prediction and pre-purchase nudge intelligence.

Public interface:
    score_risk(user_id, cart_items, user_history=None) -> dict

Model: GBDT (LightGBM) trained on (category, size-delta, brand-bias,
       return-rate priors, gift-flag) features.

Fallback: Rule-based heuristic when model artifact not available.
"""
from __future__ import annotations
import logging
import os
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# ─── Return-rate priors by category (from synthetic + review-mined data) ─────
CATEGORY_RETURN_RATES: Dict[str, float] = {
    "Footwear":       0.32,
    "Clothing":       0.28,
    "Electronics":    0.12,
    "Home & Kitchen": 0.08,
    "Books":          0.03,
    "Sports":         0.14,
    "Beauty":         0.18,
    "Toys":           0.10,
    "Jewelry":        0.22,
    "default":        0.15,
}

# ─── Brand sizing bias table (positive = runs large, negative = runs small) ──
BRAND_SIZE_BIAS: Dict[str, float] = {
    # Footwear brands
    "Nike":       -0.5,
    "Adidas":     -0.3,
    "Puma":        0.2,
    "Woodland":    0.5,
    "Bata":        0.3,
    "Reebok":     -0.2,
    # Clothing brands
    "Zara":       -0.4,
    "H&M":        -0.2,
    "Allen Solly": 0.3,
    "Arrow":       0.2,
    "Peter England": 0.1,
    "default":     0.0,
}

# ─── Lazy-loaded GBDT model ───────────────────────────────────────────────────
_risk_model = None
_risk_model_loaded = False


def _load_risk_model():
    global _risk_model, _risk_model_loaded
    if _risk_model_loaded:
        return _risk_model
    model_path = Path(__file__).parent / "artifacts" / "risk_model.pkl"
    if model_path.exists():
        try:
            with open(model_path, "rb") as f:
                _risk_model = pickle.load(f)
            logger.info("[prevent] GBDT risk model loaded.")
        except Exception as e:
            logger.warning(f"[prevent] Could not load risk model: {e}")
    else:
        logger.info("[prevent] No risk model artifact — using heuristic scoring.")
    _risk_model_loaded = True
    return _risk_model


def _heuristic_risk(
    category: str,
    brand: str,
    size_delta: float,
    return_rate_prior: float,
    is_gift: bool,
    user_return_rate: float,
) -> float:
    """Rule-based risk score in [0, 1] when GBDT model unavailable."""
    risk = return_rate_prior

    # Size mismatch signal
    risk += abs(size_delta) * 0.15

    # Brand size bias
    bias = BRAND_SIZE_BIAS.get(brand, BRAND_SIZE_BIAS["default"])
    risk += abs(bias) * 0.08

    # Gift flag (gifts are returned more)
    if is_gift:
        risk += 0.12

    # User history
    risk = 0.4 * risk + 0.6 * user_return_rate

    return min(1.0, max(0.0, risk))


def _nudge_text(
    risk: float,
    brand: str,
    size_delta: float,
    category: str,
    flagged_item: Optional[Dict],
) -> str:
    """Generate context-aware nudge text for the checkout UI."""
    if risk < 0.25:
        return ""

    bias = BRAND_SIZE_BIAS.get(brand, 0.0)

    if category in ("Footwear", "Clothing"):
        if size_delta > 0.3:
            direction = "up" if bias < 0 else "down"
            return (
                f"💡 Size tip: Customers with your profile size {direction} in {brand}. "
                f"87% who matched your size kept this item."
            )
        elif abs(bias) > 0.3:
            run = "small" if bias < 0 else "large"
            return (
                f"💡 {brand} tends to run {run}. "
                f"Customers like you often order one size up."
            )

    if risk > 0.50:
        return (
            f"⚠️ High return rate for this category ({int(risk*100)}% of buyers return). "
            f"Check size guide before ordering."
        )

    return (
        f"💡 {int((1-risk)*100)}% of customers who bought this item kept it. "
        f"Check size guide for best fit."
    )


def score_risk(
    user_id: str,
    cart_items: List[Dict],
    user_history: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Score return risk for a cart and generate a nudge.

    Args:
        user_id:      User identifier.
        cart_items:   List of {product_id, category, brand, size, mrp, is_gift}.
        user_history: {return_rate, purchased_categories, size_history}
                      (fetched from DB by backend; pass None for cold-start).

    Returns:
        {
          "risk": float,                 # 0.0–1.0
          "flagged_item_id": str,        # product_id of highest-risk item
          "nudge_text": str,             # "" if low risk
          "credit_promise": float,       # green credits if return avoided
          "breakdown": [per-item risks]
        }
    """
    user_history = user_history or {}
    user_return_rate = float(user_history.get("return_rate", 0.15))

    model = _load_risk_model()

    item_risks = []
    for item in cart_items:
        category = item.get("category", "default")
        brand = item.get("brand", "default")
        is_gift = bool(item.get("is_gift", False))

        # Size delta: difference between user's typical size and current order
        user_size = float(user_history.get("size_history", {}).get(category, 0))
        item_size = float(item.get("size", 0))
        size_delta = abs(item_size - user_size)

        prior = CATEGORY_RETURN_RATES.get(category, CATEGORY_RETURN_RATES["default"])

        if model is not None:
            try:
                import numpy as np
                brand_bias = BRAND_SIZE_BIAS.get(brand, 0.0)
                features = np.array([[
                    prior,
                    size_delta,
                    brand_bias,
                    float(is_gift),
                    user_return_rate,
                    hash(category) % 100 / 100.0,
                ]])
                # LightGBM Booster.predict() returns probability directly for binary tasks
                raw_pred = model.predict(features)
                risk_score = float(raw_pred[0]) if hasattr(raw_pred, '__len__') else float(raw_pred)
                # Clip to [0, 1] — LGBM binary already returns probability
                risk_score = max(0.0, min(1.0, risk_score))
            except Exception as e:
                logger.warning(f"[prevent] Model inference error: {e}")
                risk_score = _heuristic_risk(
                    category, brand, size_delta, prior, is_gift, user_return_rate
                )
        else:
            risk_score = _heuristic_risk(
                category, brand, size_delta, prior, is_gift, user_return_rate
            )

        # ── Fold in seed-time review intelligence (ml/review_insights) ──────────
        # review_summary.return_risk raises the floor; a non-neutral fit signal bumps
        # risk and carries a ready-made "buyers say this runs small" nudge line.
        review_summary = item.get("review_summary") or {}
        fit_signal = item.get("fit_signal") or {}
        rr = review_summary.get("return_risk")
        if isinstance(rr, (int, float)):
            risk_score = max(risk_score, float(rr))
        direction = fit_signal.get("direction")
        if direction and direction != "true_to_size":
            risk_score = min(1.0, risk_score + 0.12 * float(fit_signal.get("confidence", 0.5) or 0.5))

        item_risks.append({
            "product_id": item.get("product_id", "unknown"),
            "category": category,
            "brand": brand,
            "risk": round(risk_score, 3),
            "nudge_line": (review_summary.get("nudge_line") or "").strip(),
            "fit_direction": direction or "",
        })

    # ── Bracketeering: same product added in ≥2 distinct sizes ───────────────────
    # A "size hedge" (buy S+M+L, keep one, return the rest) is a top return driver.
    # `size` collapses letter sizes to 0, so detect on the raw size_label instead.
    from collections import defaultdict
    sizes_by_product: Dict[str, set] = defaultdict(set)
    for it in cart_items:
        lbl = str(it.get("size_label") or "").strip()
        if lbl:
            sizes_by_product[str(it.get("product_id"))].add(lbl)
    bracket_pid = next((pid for pid, s in sizes_by_product.items() if len(s) >= 2), None)
    bracket_nudge = ""
    if bracket_pid:
        n_sizes = len(sizes_by_product[bracket_pid])
        bracket_nudge = (
            f"You've added {n_sizes} different sizes of the same item. Ordering several "
            f"sizes to send the rest back delays your refund and adds return waste — use "
            f"the fit guide to pick your best size and keep just one."
        )

    if not item_risks:
        return {
            "risk": 0.0,
            "flagged_item_id": None,
            "nudge_text": "",
            "bracket_nudge": bracket_nudge,
            "bracket_product_id": bracket_pid,
            "credit_promise": 0,
            "breakdown": [],
        }

    # Flag highest-risk item
    flagged = max(item_risks, key=lambda x: x["risk"])
    overall_risk = flagged["risk"]

    # Find original item dict for nudge
    flagged_cart_item = next(
        (i for i in cart_items if i.get("product_id") == flagged["product_id"]),
        cart_items[0],
    )
    size_delta = abs(
        float(flagged_cart_item.get("size", 0))
        - float(user_history.get("size_history", {}).get(flagged["category"], 0))
    )

    # Prefer the review-derived nudge ("Buyers say this runs small …") when the mined
    # fit signal produced one; otherwise fall back to the profile/brand heuristic.
    nudge = flagged.get("nudge_line") or _nudge_text(
        overall_risk,
        flagged["brand"],
        size_delta,
        flagged["category"],
        flagged_cart_item,
    )

    # Green credit promise if buyer keeps the item (return avoidance incentive)
    credit_promise = int(overall_risk * 15) if overall_risk > 0.25 else 0

    return {
        "risk": round(overall_risk, 3),
        "flagged_item_id": flagged["product_id"],
        "nudge_text": nudge,
        "bracket_nudge": bracket_nudge,
        "bracket_product_id": bracket_pid,
        "credit_promise": credit_promise,
        "breakdown": item_risks,
    }
