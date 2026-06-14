"""
ml/disposition.py
-----------------
v2 DISPOSITION GATE (final_idea_v2.md §6).

Runs AFTER grading + verification and BEFORE EV routing (Stage 0). Mirrors how
Amazon FBA / retail actually handle returns: a verified unopened item goes back
to the NEW catalog; only opened/used items become Open-box / Used / Renewed;
dead/unsafe items are recycled.

A return CAN be sold as new again — but ONLY if verified unopened & original
condition. Once opened/used it can never be "New"; it becomes Open-box/Used/
Renewed depending on grade.

Outcomes:
  RESTOCK_NEW    → normal catalog as NEW (full price)         — does NOT enter Revive
  OPEN_BOX       → unified catalog, "Open box" (slight discount)
  USED_P2P       → unified catalog, "Used – <grade>" (grade-adjusted)
  RENEWED_SPN    → SPN refurb → "Renewed" (90-day, SPN-tested)
  RECYCLE_DONATE → exits marketplace (NGO / e-waste)
"""
from __future__ import annotations
from typing import Dict, Any, Optional

try:
    from ml.category_profiles import is_electronics, sealed_only, canonical_category
except ImportError:
    from category_profiles import is_electronics, sealed_only, canonical_category

RESTOCK_NEW = "RESTOCK_NEW"
OPEN_BOX = "OPEN_BOX"
USED_P2P = "USED_P2P"
RENEWED_SPN = "RENEWED_SPN"
RECYCLE_DONATE = "RECYCLE_DONATE"

_OUTCOME_LABEL = {
    RESTOCK_NEW:    "New",
    OPEN_BOX:       "Open box",
    USED_P2P:       "Used",
    RENEWED_SPN:    "Renewed",
    RECYCLE_DONATE: "Recycle / Donate",
}

# Customer-facing one-liner shown on the grading/disposition result screen (S3).
_OUTCOME_MESSAGE = {
    RESTOCK_NEW:    "Good news — this is unused, so it goes back as new.",
    OPEN_BOX:       "This is unused but opened — it'll be sold as an open-box deal nearby.",
    USED_P2P:       "Your item will be resold to someone nearby.",
    RENEWED_SPN:    "Your item will be professionally refurbished and certified.",
    RECYCLE_DONATE: "Your item will be responsibly recycled or donated.",
}

# Cosmetic-grade → used condition label (category-aware top states handled separately).
_USED_GRADE_LABEL = {
    "A": "Used – Like New",
    "B": "Used – Very Good",
    "C": "Used – Good",
    "D": "Used – Acceptable",
}


def disposition(
    grade: str,
    category: str,
    *,
    sealed: bool = False,
    opened: bool = True,
    verified_match: bool = True,
    complete: bool = True,
    functional_pass: Optional[bool] = None,
    safe: bool = True,
    refurb_economical: bool = False,
) -> Dict[str, Any]:
    """
    Decide the disposition outcome + the condition label the buyer will see.

    Args:
      grade            cosmetic grade A–F (E=needs repair, F=dead)
      category         product category (drives sealed-only / electronics rules)
      sealed           item is still factory-sealed / unopened
      opened           item has been opened (ignored if sealed=True)
      verified_match   product-match verification passed (category + instance)
      complete         all accessories/parts present
      functional_pass  True/False/None(untested) — functional status
      safe             passes safety/hygiene/expiry checks
      refurb_economical whether central refurb is worth it for this item
    """
    g = (grade or "C").upper()
    cat = canonical_category(category)
    func_ok = functional_pass is not False  # None (untested) treated as not-failed

    # F0: unsafe / hygiene-sealed-but-opened / dead → recycle or donate
    if not safe or g == "F":
        return _result(RECYCLE_DONATE, g, cat)
    if sealed_only(category) and not sealed:
        # hygiene/consumable opened → cannot be resold
        return _result(RECYCLE_DONATE, g, cat)

    # F1: sealed, unopened, verified → restock as NEW
    if sealed and verified_match:
        return _result(RESTOCK_NEW, g, cat)

    # F2: functional defect (grade E) → SPN refurb / parts
    if g == "E":
        return _result(RENEWED_SPN, g, cat)

    # F3: opened but functionally new (grade A, complete, passes) → Open box
    if opened and g == "A" and complete and func_ok:
        return _result(OPEN_BOX, g, cat)

    # F4: heavy cosmetic damage but functional, refurb worthwhile → Renewed
    if g == "D" and refurb_economical and is_electronics(category):
        return _result(RENEWED_SPN, g, cat)

    # F5: functional failure on electronics → refurb
    if functional_pass is False and is_electronics(category):
        return _result(RENEWED_SPN, g, cat)

    # F6: default — used resale with grade-adjusted label
    return _result(USED_P2P, g, cat)


def _condition_label(outcome: str, grade: str, category: str) -> str:
    """Category-aware condition label (handles broken-seal nuance, §6)."""
    if outcome == RESTOCK_NEW:
        return "New (sealed)" if is_electronics(category) else "New with tags"
    if outcome == OPEN_BOX:
        return "Open box"
    if outcome == RENEWED_SPN:
        return "Renewed"
    if outcome == RECYCLE_DONATE:
        return "Not resellable"
    # USED
    return _USED_GRADE_LABEL.get(grade, "Used – Good")


def _result(outcome: str, grade: str, category: str) -> Dict[str, Any]:
    return {
        "outcome": outcome,
        "outcome_label": _OUTCOME_LABEL[outcome],
        "condition_label": _condition_label(outcome, grade, category),
        "customer_message": _OUTCOME_MESSAGE[outcome],
        "enters_revive": outcome not in (RESTOCK_NEW, RECYCLE_DONATE),
    }
