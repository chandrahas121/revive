"""
ml/risk_tier.py
---------------
v2 CORE CORRECTION (final_idea_v2.md §2 Axis B).

Risk Tier is the BACKEND-ONLY axis. It is driven by value AND category fraud-risk
(not price alone), and it decides verification depth, guarantee window, liable
party, and route eligibility. It is NEVER shown to the customer.

  LOW    → AI-only grading,        7-day,  seller-liable (escrow)
  MEDIUM → AI + agent doorstep,    30-day, seller-liable + A-to-Z backstop
  HIGH   → AI + SPN node,          90-day, SPN-liable

Why fraud-risk and not pure price (fixes Q5): a ₹4,500 phone is cheap but highly
fraud-prone (IMEI swap, dead battery) and needs agent verification; a ₹4,500
cast-iron pan does not. Pure-price tiering can't tell them apart.
"""
from __future__ import annotations
from typing import Dict, Any

try:
    from ml.category_profiles import is_electronics, canonical_category
except ImportError:  # allow running as a stand-alone script
    from category_profiles import is_electronics, canonical_category

# Categories that are fraud-prone / need functional verification at lower values
_HIGH_FRAUD_CATEGORIES = {"Phone", "Tablet", "Laptop", "Camera", "Jewelry", "Watch"}

LOW, MEDIUM, HIGH = "LOW", "MEDIUM", "HIGH"

# Map risk tier → legacy integer tier (for backward-compat with v1 callers/UI).
_TIER_INT = {LOW: 1, MEDIUM: 2, HIGH: 3}

_GUARANTEE_DAYS = {LOW: 7, MEDIUM: 30, HIGH: 90}
_INSPECTION = {
    LOW: "AI cosmetic grading",
    MEDIUM: "AI + Flex-agent doorstep verification",
    HIGH: "AI + professional SPN node inspection",
}
_LIABLE = {
    LOW: "Seller (Amazon payment escrow)",
    MEDIUM: "Seller (escrow) + Amazon A-to-Z backstop",
    HIGH: "Amazon SPN partner",
}


def _is_high_fraud(category: str) -> bool:
    return canonical_category(category) in _HIGH_FRAUD_CATEGORIES or is_electronics(category)


def risk_tier(catalog_mrp: float, category: str) -> str:
    """
    Compute the backend-only Risk Tier from catalog MRP and category fraud-risk.

    Returns one of "LOW" | "MEDIUM" | "HIGH".
    """
    try:
        mrp = float(catalog_mrp)
    except (TypeError, ValueError):
        mrp = 0.0

    high_fraud = _is_high_fraud(category)

    if mrp > 10_000 or (high_fraud and mrp > 4_000):
        return HIGH
    if mrp > 2_000 or high_fraud:
        return MEDIUM
    return LOW


def tier_int(catalog_mrp: float, category: str) -> int:
    """Legacy integer tier (1/2/3) for backward compatibility."""
    return _TIER_INT[risk_tier(catalog_mrp, category)]


def tier_meta(catalog_mrp: float, category: str) -> Dict[str, Any]:
    """Full risk-tier metadata bundle (for Health Card + ops console, never the buyer UI)."""
    rt = risk_tier(catalog_mrp, category)
    return {
        "risk_tier": rt,
        "tier_int": _TIER_INT[rt],
        "guarantee_days": _GUARANTEE_DAYS[rt],
        "inspection": _INSPECTION[rt],
        "liable_party": _LIABLE[rt],
        "is_electronics": is_electronics(category),
    }
