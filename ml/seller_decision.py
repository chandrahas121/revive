"""
ARCA · Seller returns decision engine (Phase 1).

Two coordinated decisions, the way Amazon actually runs it:
  • FINANCIAL / LIABILITY  → refund verdict + reimbursement route (SAFE-T / supplier
    warranty / A-to-z / none), gated by fault + refund-source + eligibility.
  • DISPOSITION / RECOVERY → where the unit goes (restock / grade&resell / liquidate
    / warranty / dispose / donate), with a HARD functional-pass gate on resale.

Everything is deterministic rules (unit-testable, offline). An optional LLM layer
(OpenRouter via ml.llm) only *refines* the fault rationale + drafts the claim
narrative; it never changes the eligibility math and always fails open.

Researched rules encoded (see ARCA_RETURNS_AGENT_PLAN.md):
  - Liquidate: customer/carrier/distributor-damaged. Dispose only: defective /
    warehouse-damaged / expired / hazmat / opened-hygiene.
  - SAFE-T needs an AMAZON-issued refund (not a voluntary seller refund).
  - India SAFE-T window = 15 days; excluded categories + >₹25k self-ship blocked;
    superficial damage (box dents / broken seal) is NOT claimable; ≥8% claim ratio
    flags the account → suppress weak claims.
"""
from typing import Any, Dict, Optional

try:
    from ml.disposition import disposition as _disposition_gate, sealed_only, is_electronics
except Exception:  # pragma: no cover - allow standalone import
    _disposition_gate = None
    def sealed_only(_c): return False
    def is_electronics(_c): return False

# ── Amazon policy constants ──────────────────────────────────────────────────
SAFET_EXCLUDED_CATEGORIES = {
    "furniture", "musical instruments", "tyres", "tires", "jewellery", "jewelry", "sports",
}
SAFET_SELF_SHIP_VALUE_CAP = 25000     # ₹ — self-ship orders above this need manual handling
SAFET_WINDOW_DAYS = 15                # India seller-fulfilled filing window
SAFET_ABUSE_RATIO = 0.08             # claim/returns ratio that flags an account "abusive"

# Fault → can the unit be liquidated (vs. dispose-only)?
_LIQUIDATABLE_FAULT = {"customer", "carrier", "distributor", "fraud"}
_DISPOSE_ONLY_FAULT = {"defective", "warehouse", "expired"}

# SAFE-T sub-reason codes (India)
SUB_DAMAGED = "damaged_or_used"            # heavily damaged / mildly used / open seal
SUB_MATERIALLY_DIFFERENT = "materially_different"   # different item / empty box / counterfeit
SUB_NOT_RETURNED = "item_not_returned"


# ── 1. Fault attribution ─────────────────────────────────────────────────────
def attribute_fault(
    *,
    reason_code: str = "",
    grade: str = "C",
    functional: Optional[bool] = None,
    seal_intact: bool = False,
    completeness: float = 1.0,
    substitution: bool = False,
    identity_ok: bool = True,
    weight_flag: bool = False,
) -> Dict[str, Any]:
    """Attribute *who/what* caused the condition, from the return reason + inspection.
    Returns {fault, confidence, rationale}. fault ∈ customer|fraud|carrier|defective|warehouse|none."""
    r = (reason_code or "").lower()

    # Wrong item / empty box / counterfeit → fraud (a customer-fault subtype, distinct claim path)
    if substitution or not identity_ok or weight_flag:
        return {"fault": "fraud", "confidence": 0.95,
                "rationale": "Returned item does not match the order (wrong/empty/substituted)."}

    # Sealed + matching → nobody at fault, fully sellable
    if seal_intact and identity_ok:
        return {"fault": "none", "confidence": 0.9,
                "rationale": "Returned sealed and unopened; matches the order."}

    # Functional failure: is it a genuine defect or buyer-inflicted?
    if functional is False:
        # "defective / doesn't work / damaged on arrival" reasons → manufacturing defect
        if any(k in r for k in ("defective", "not work", "doesn't work", "malfunction", "dead on arrival", "doa", "stopped working")):
            return {"fault": "defective", "confidence": 0.85,
                    "rationale": "Non-functional and reported defective — manufacturing/DOA fault, buyer not at fault."}
        # functional failure with a non-defect reason (e.g. 'no longer needed') → buyer likely broke it
        return {"fault": "customer", "confidence": 0.7,
                "rationale": "Non-functional but not reported as defective — damage likely occurred in buyer possession."}

    # Physical damage / heavy wear on a functional item
    if grade.upper() in ("C", "D") or completeness < 0.7:
        if any(k in r for k in ("damaged", "broke", "crack")) and "transit" in r:
            return {"fault": "carrier", "confidence": 0.6,
                    "rationale": "Damage reported in transit — carrier-attributable."}
        return {"fault": "customer", "confidence": 0.65,
                "rationale": "Cosmetic wear/damage inconsistent with an unused return — buyer-handled."}

    # Light wear, functional → customer-handled but resellable used, low fault severity
    return {"fault": "customer", "confidence": 0.5,
            "rationale": "Opened and lightly handled by the buyer; resellable as used."}


# ── 2. Disposition (recovery) — functional-gated ─────────────────────────────
def disposition_decision(
    *,
    grade: str,
    category: str,
    functional: Optional[bool],
    sealed: bool,
    completeness: float,
    fault: str,
    verified_match: bool = True,
    safe: bool = True,
) -> Dict[str, Any]:
    """Where the unit goes. Wraps ml.disposition, then overlays the Amazon
    LIQUIDATE / WARRANTY / DISPOSE rules that hinge on FAULT + functional status."""
    g = (grade or "C").upper()
    complete = completeness is None or completeness >= 0.8

    base = {"outcome": "USED_P2P", "condition_label": "Used – Good"}
    if _disposition_gate is not None:
        try:
            base = _disposition_gate(
                grade=g, category=category, sealed=sealed, opened=not sealed,
                verified_match=verified_match, complete=complete,
                functional_pass=functional, safe=safe,
            )
        except Exception:
            pass
    outcome = base.get("outcome", "USED_P2P")
    label = base.get("condition_label", "Used – Good")

    hygiene_blocked = sealed_only(category) and not sealed
    hazmat = not safe

    # HARD GATE: a non-functional item can never be graded-and-resold.
    if functional is False:
        if fault == "defective" and is_electronics(category):
            return _disp("WARRANTY", "Defective – supplier warranty", "supplier",
                         "Functional check failed (defective). Route to supplier warranty for credit, not consumer resale.")
        return _disp("DISPOSE", "Not resellable", "dispose",
                     "Functional check failed. Not resellable to a consumer.")

    # Dispose-only overrides (never liquidatable): hygiene/hazmat/expired/warehouse/defective-dead
    if hygiene_blocked or hazmat or g == "F":
        return _disp("DISPOSE", "Not resellable", "dispose",
                     "Hygiene/hazmat/dead-unit policy — dispose only, no resale or liquidation.")

    # Sellable-as-new / open-box / used → grade & resell
    if outcome in ("RESTOCK_NEW", "OPEN_BOX", "USED_P2P", "RENEWED_SPN"):
        channel = "grade_resell" if outcome != "RESTOCK_NEW" else "restock_new"
        return _disp(_MAP_OUTCOME.get(outcome, "GRADE_RESELL"), label, channel,
                     f"Functional pass — {label}. Relist via Grade & Resell.")

    # Recycle/donate outcome but a liquidatable fault + not hazmat → LIQUIDATE for salvage value
    if outcome == "RECYCLE_DONATE" and fault in _LIQUIDATABLE_FAULT:
        return _disp("LIQUIDATE", "Liquidation (Warehouse-Deals-style)", "liquidate",
                     "Customer/carrier-damaged and not resellable — eligible for liquidation (~8% recovery).")

    return _disp("DISPOSE", "Not resellable", "dispose", "No viable resale or liquidation path.")


_MAP_OUTCOME = {"RESTOCK_NEW": "RESTOCK_NEW", "OPEN_BOX": "GRADE_RESELL",
                "USED_P2P": "GRADE_RESELL", "RENEWED_SPN": "WARRANTY"}


def _disp(disposition, condition_label, channel, rationale):
    return {"disposition": disposition, "condition_label": condition_label,
            "resale_channel": channel, "rationale": rationale}


# ── 3. Financial / liability — SAFE-T eligibility engine ─────────────────────
def financial_decision(
    *,
    fault: str,
    category: str,
    order_value: float,
    refund_issued_by: str = "none",      # 'amazon' | 'seller' | 'none'
    days_since_delivered: Optional[int] = None,
    safet_ratio: float = 0.0,
    damage_superficial: bool = False,
    has_evidence: bool = True,
) -> Dict[str, Any]:
    """Refund verdict + reimbursement route + SAFE-T eligibility, per Amazon policy."""
    cat = (category or "").lower()
    ineligible = []

    # ---- Refund verdict (money to the buyer) ----
    if fault in ("fraud", "customer"):
        refund_verdict = "restocking_fee" if fault == "customer" else "withhold"
    elif fault == "defective":
        refund_verdict = "full"        # buyer not at fault
    else:
        refund_verdict = "full"

    # ---- Reimbursement route ----
    if fault == "defective":
        route = "SUPPLIER_WARRANTY"
        sub_reason = None
    elif fault in ("customer", "fraud", "carrier"):
        route = "SAFE_T"
        sub_reason = SUB_MATERIALLY_DIFFERENT if fault == "fraud" else SUB_DAMAGED
    else:
        route = "NONE"
        sub_reason = None

    # ---- SAFE-T eligibility gates (only relevant when route == SAFE_T) ----
    safet_eligible = route == "SAFE_T"
    if safet_eligible:
        if any(x in cat for x in SAFET_EXCLUDED_CATEGORIES):
            safet_eligible = False; ineligible.append(f"Category '{category}' is excluded from SAFE-T.")
        if order_value and order_value > SAFET_SELF_SHIP_VALUE_CAP:
            safet_eligible = False; ineligible.append(f"Order value ₹{order_value:,.0f} exceeds the ₹{SAFET_SELF_SHIP_VALUE_CAP:,} self-ship SAFE-T cap.")
        if damage_superficial:
            safet_eligible = False; ineligible.append("Superficial damage (box dents / broken seal) is not reimbursable.")
        if refund_issued_by == "seller":
            safet_eligible = False; ineligible.append("Refund was issued voluntarily by the seller — SAFE-T needs an Amazon-issued refund.")
        if not has_evidence:
            safet_eligible = False; ineligible.append("Evidence bundle incomplete (need photos/video + label + serial).")
        if days_since_delivered is not None and days_since_delivered > SAFET_WINDOW_DAYS:
            safet_eligible = False; ineligible.append(f"Past the {SAFET_WINDOW_DAYS}-day filing window ({days_since_delivered} days).")

    # ---- Refund-source handling: must wait for Amazon's forced refund ----
    awaiting_amazon_refund = route == "SAFE_T" and refund_issued_by != "amazon" and not ineligible
    if awaiting_amazon_refund:
        refund_verdict = "withhold_pending_amazon"

    # ---- Account-health self-defense ----
    suppress = safet_eligible and safet_ratio >= SAFET_ABUSE_RATIO
    suppress_reason = (f"Your SAFE-T claim ratio is {safet_ratio:.0%} (≥{SAFET_ABUSE_RATIO:.0%}). "
                       "Filing more may flag the account as abusive — hold this claim.") if suppress else None

    days_left = None
    if days_since_delivered is not None:
        days_left = max(0, SAFET_WINDOW_DAYS - days_since_delivered)

    return {
        "refund_verdict": refund_verdict,
        "reimbursement_route": route,
        "safet_eligible": bool(safet_eligible and not suppress),
        "safet_sub_reason": sub_reason if safet_eligible else None,
        "ineligible_reasons": ineligible,
        "awaiting_amazon_refund": awaiting_amazon_refund,
        "filing_deadline_days": days_left,
        "suppress": suppress,
        "suppress_reason": suppress_reason,
    }


# ── 4. Orchestration — the full ARCA decision ────────────────────────────────
def decide(ctx: Dict[str, Any], images=None, use_llm: bool = True) -> Dict[str, Any]:
    """
    Combine fault → disposition + financial into one decision object.

    ctx keys: grade, category, functional(bool|None), sealed(bool), completeness(float),
      reason_code, substitution(bool), identity_ok(bool), weight_flag(bool),
      order_value(float), refund_issued_by, days_since_delivered(int|None),
      safet_ratio(float), damage_superficial(bool), has_evidence(bool), verified_match(bool)
    """
    g = (ctx.get("grade") or "C").upper()
    category = ctx.get("category", "Other")

    fault = attribute_fault(
        reason_code=ctx.get("reason_code", ""), grade=g,
        functional=ctx.get("functional"), seal_intact=ctx.get("sealed", False),
        completeness=ctx.get("completeness", 1.0), substitution=ctx.get("substitution", False),
        identity_ok=ctx.get("identity_ok", True), weight_flag=ctx.get("weight_flag", False),
    )

    # Optional LLM refinement of the fault rationale (never changes eligibility math).
    if use_llm and images is not None:
        fault = _llm_refine_fault(fault, ctx, images) or fault

    disp = disposition_decision(
        grade=g, category=category, functional=ctx.get("functional"),
        sealed=ctx.get("sealed", False), completeness=ctx.get("completeness", 1.0),
        fault=fault["fault"], verified_match=ctx.get("verified_match", True),
        safe=ctx.get("safe", True),
    )
    fin = financial_decision(
        fault=fault["fault"], category=category, order_value=float(ctx.get("order_value", 0) or 0),
        refund_issued_by=ctx.get("refund_issued_by", "none"),
        days_since_delivered=ctx.get("days_since_delivered"),
        safet_ratio=float(ctx.get("safet_ratio", 0) or 0),
        damage_superficial=ctx.get("damage_superficial", False),
        has_evidence=ctx.get("has_evidence", True),
    )
    return {"fault": fault, "disposition": disp, "financial": fin}


def _llm_refine_fault(fault, ctx, images):
    """LLM enriches the *rationale* (and may ESCALATE to fraud if it spots a
    counterfeit/substitution the rules missed) — but it never downgrades the
    deterministic fault, so the SAFE-T eligibility math stays rule-driven and
    the outcome is stable. (Per ARCA_RETURNS_AGENT_PLAN §3.)"""
    try:
        from ml.llm import llm_json
        out = llm_json(
            system=("You are a returns-fraud analyst for an Amazon MFN seller. The rule engine has "
                    f"already attributed fault='{fault['fault']}'. Look at the attached photos and "
                    "write a one-sentence forensic rationale. Only if you clearly see a counterfeit or "
                    "a completely different/substituted item, set escalate_fraud=true. Reply ONLY as JSON "
                    '{"rationale":"...","escalate_fraud":true|false}.'),
            user=(f"Ordered: {ctx.get('expected_title', category_of(ctx))}. Return reason: "
                  f"{ctx.get('reason_code','')}. AI grade: {ctx.get('grade')}. Functional: {ctx.get('functional')}. "
                  "Photos of the returned item are attached."),
            images=images, max_tokens=200,
        )
        if not out:
            return None
        new_fault = "fraud" if out.get("escalate_fraud") else fault["fault"]
        return {"fault": new_fault, "confidence": fault.get("confidence", 0.7),
                "rationale": out.get("rationale", fault["rationale"]), "llm": True}
    except Exception:
        pass
    return None


def category_of(ctx):
    return ctx.get("category", "the item")


# ── 5. SAFE-T claim narrative (LLM, fail-open to template) ────────────────────
def draft_claim_narrative(*, product_title, sub_reason, fault_rationale, order_id, similarity=None) -> str:
    template = (
        f"SAFE-T reimbursement request for order {order_id}. Reason: "
        f"{'different/wrong item returned' if sub_reason == SUB_MATERIALLY_DIFFERENT else 'item returned damaged/used by buyer'}. "
        f"{fault_rationale} "
        + (f"AI integrity gate visual similarity vs. the ordered product: {round((similarity or 0) * 100)}%. " if similarity is not None else "")
        + "Evidence attached: multi-angle photos of the returned item, return package with shipping label, and the "
          "tamper-evident AI grade report. Requesting reimbursement at fair market value."
    )
    try:
        from ml.llm import llm_text
        out = llm_text(
            system=("You draft concise, factual, policy-compliant SAFE-T claim narratives for Amazon "
                    "investigators. 2-4 sentences, no fluff, state the reason code, the evidence, and the ask."),
            user=template, max_tokens=220,
        )
        return out or template
    except Exception:
        return template
