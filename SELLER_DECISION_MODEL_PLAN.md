# REVIVE Seller Returns — Correct Decision Model (Amazon-accurate) + Implementation Plan

> Fixes the core flaw: today a single cosmetic grade (A–F) drives one hardcoded
> "recovery" list, so a **functionally defective but cosmetically-B item is told to
> "resell as used,"** and SAFE-T only fires on wrong-item fraud. Real Amazon runs
> **two independent decisions** (money/liability vs. disposition) gated by identity,
> fault, functional test, and category policy. This plan re-models it that way and
> wires it to REVIVE's existing engine.

## 1. How Amazon actually does it (researched)

**Return report identifiers.** Every return carries `Order ID, MSKU, ASIN, FNSKU, Title, Qty, FC, Disposition, Customer Return Reason, Status`. Identity is confirmed by the **FNSKU/barcode sticker** scanned at the FC and matched to the ASIN. [[amzprep]](https://amzprep.com/amazon-fba-returns/)

**Refund at first scan (mandatory).** The customer is refunded when the return is first scanned by the carrier — *before* inspection. On receipt Amazon decides: **sellable → back to inventory (no reimbursement); unsellable → determine who caused the damage → if Amazon/carrier at fault, reimburse the seller.** [[Seller Union]](https://seller-union.com/amazon-launches-refund-at-first-scan-for-seller-fulfilled-returns/)

**FBA Grade and Resell — the 4 used grades.** Eligible unsellable returns are inspected on four axes — **functional performance (powers on / works), cosmetic appearance, packaging condition, missing/damaged accessories** — and graded **Used: Like New / Very Good / Good / Acceptable**, then relisted with a condition note. [[sell.amazon.com]](https://sell.amazon.com/blog/announcements/fba-grade-and-resell)

**Liquidate vs. dispose depends on FAULT, not wear.**
- **Customer-Damaged / Carrier-Damaged / Distributor-Damaged → eligible for liquidation** (~5–10% of ASP).
- **Defective / Expired / Warehouse-Damaged → NOT liquidatable → disposal.**
- **Hazmat / recalled → never liquidated.** [[SoStocked]](https://help.sostocked.com/article/279-removals-disposal-liquidations)

**SAFE-T claim (seller reimbursement).** Valid reasons: **buyer returned item damaged, item materially different / wrong item returned, item not returned, lost in transit, refund issued due to buyer error, seller-faulted-reason mislabel, incorrect fees.** Requires an **Amazon-issued refund** (not a voluntary seller refund), plus **evidence: invoice, delivery/tracking, photos of the returned item, order id/ASIN.** US seller-fulfilled window = **30 days** from return-delivery-scan or refund date (whichever is later), effective Feb 16 2026; FBA lost/damaged reimbursement window = 90 days; cap raised to $500k. [[salesduo]](https://salesduo.com/blog/amazon-safe-t-claim-guide/) [[myamazonguy]](https://myamazonguy.com/news/amazon-safe-t-claim-filing-window/)

**Restocking fees.** Sellers may charge up to ~20% (used/damaged/opened) instead of refunding in full — a partial-refund lever.

## 2. The variables the decision actually needs

| Variable | Source | Why it matters |
|---|---|---|
| ASIN + FNSKU/barcode | scan at intake | Identity; SAFE-T "wrong item" evidence; Grade&Resell requires FNSKU |
| Customer return reason code | order/return record | Sets expectation + fault hypothesis (defective vs. changed-mind) |
| Multi-angle photos (category-specific) | seller capture | Feeds cosmetic grade + evidence bundle |
| **Cosmetic grade A–F** | AI (Grounding DINO + CLIP) | One axis only — NOT the whole decision |
| **Functional test pass/fail** | AI / category rule | Gates resale independently of cosmetics |
| Completeness (accessories, packaging, seal) | AI | New vs Open-Box vs Used; missing-parts penalty |
| Category policy (hygiene / hazmat / perishable / recall) | catalog | Hard dispose-only overrides |
| Refund status + who issued it | order record | SAFE-T requires Amazon-issued refund |
| **Fault attribution** | AI + reason consistency | Customer/carrier/defective/warehouse → liquidate vs dispose vs reimburse |
| Return window / dates | order record | SAFE-T filing eligibility |

## 3. The corrected model — a pipeline, not a lookup

```
                 ┌─────────────────────────────────────────────┐
  INTAKE  ─────► │ Stage 0 · IDENTITY & ELIGIBILITY            │
  (scan FNSKU/   │  barcode→ASIN match · DINOv2 instance gate  │
   ASIN, photos) │  category resellable? hazmat/recall? in     │
                 │  window? refund issued & by whom?           │
                 └───────────────┬─────────────────────────────┘
                       mismatch  │  ok
              ┌──────────────────┘
              ▼                   ▼
   WRONG ITEM / FRAUD     ┌─────────────────────────────────────┐
   → no grade             │ Stage 1 · CONDITION (AI, 4 axes)     │
   → SAFE-T "materially   │  cosmetic A–F · functional pass/fail │
     different" draft     │  completeness · seal/packaging       │
                          └───────────────┬─────────────────────┘
                                          ▼
                          ┌─────────────────────────────────────┐
                          │ Stage 2 · FAULT ATTRIBUTION          │
                          │  reason code × inspection:           │
                          │  • sealed+match → no fault (sellable)│
                          │  • wear ~ normal use → customer-handled
                          │  • functional fail + "defective" →   │
                          │      defective (supplier/not buyer)  │
                          │  • damage ≠ stated reason → buyer-fault
                          │  • crushed box/transit marks → carrier│
                          └───────────────┬─────────────────────┘
                                          ▼
        ┌──────────────── Stage 3 · TWO COORDINATED DECISIONS ───────────────┐
        │                                                                     │
        │  A. FINANCIAL / LIABILITY            B. DISPOSITION / RECOVERY       │
        │  ┌───────────────────────────┐       ┌────────────────────────────┐ │
        │  │ refund verdict:           │       │ RESTOCK NEW (sealed,verified)│
        │  │  full / restocking-fee /  │       │ GRADE & RESELL used          │
        │  │  withhold                 │       │   (LikeNew/VG/Good/Accept.)  │
        │  │ reimbursement route:      │       │   ⟵ requires functional PASS │
        │  │  SAFE-T (Amazon refund +  │       │ LIQUIDATE (Warehouse Deals)  │
        │  │   buyer-fault/wrong-item +│       │   ⟵ customer/carrier-damaged │
        │  │   evidence + in window)   │       │      only, not hazmat        │
        │  │  SUPPLIER WARRANTY (defect)│      │ RETURN-TO-SUPPLIER / WARRANTY│
        │  │  A-to-z / none            │       │ DISPOSE (defective/expired/  │
        │  └───────────────────────────┘       │   warehouse-dmg/hygiene/hazmat)
        │                                       │ DONATE (grade F but usable)  │
        │                                       └────────────────────────────┘ │
        └─────────────────────────────────────────────────────────────────────┘
```

**The two rules that fix your examples**
1. **Functional PASS is a hard gate for any "resell/grade" path.** A cosmetic-B item that fails the functional test can NOT be graded-and-resold — it routes to supplier warranty (defective) or dispose. The letter grade never overrides functional failure.
2. **SAFE-T is driven by fault + refund status, not by the grade.** Buyer-damaged (fault=customer, Amazon refunded, evidence present) → SAFE-T draftable *even at grade B*, in parallel with liquidation. Wrong-item → SAFE-T "materially different." Voluntary seller refund → SAFE-T ineligible (surface why).

**Decision matrix (condensed)**

| Cosmetic | Functional | Fault / reason | Sealed | → Recovery (B) | → Financial (A) |
|---|---|---|---|---|---|
| A | pass | none | yes | Restock **New** | Full refund |
| A/B | pass | customer-handled | no | **Open Box / Used–VG** | Full (or restock fee) |
| C/D | pass | customer-damaged | no | **Liquidate** (or Used–Acceptable if demand) | Restock fee + **SAFE-T** (buyer fault) |
| any | **fail** | defective on arrival | – | **Supplier warranty**, else Dispose | Full refund (buyer not at fault) |
| any | fail | warehouse/expired | – | **Dispose** (not liquidatable) | FBA reimbursement |
| — | — | **wrong item** | – | none (no grade) | **SAFE-T** materially-different |
| any | any | hygiene/hazmat/recall opened | – | **Dispose** only | per policy |

## 4. Connecting it to REVIVE (reuse, don't rebuild)

REVIVE already ships most of Decision B — the seller path just bypassed it.
- **Decision B → delegate to `ml/disposition.py` (the Disposition Gate).** Feed it `(grade, category, sealed, opened, verified_match, functional, completeness)` → it already returns `RESTOCK_NEW / OPEN_BOX / USED_P2P / RENEWED_SPN / RECYCLE_DONATE`. Extend its vocabulary with `LIQUIDATE` and `WARRANTY` (or map: defective→RENEWED_SPN/WARRANTY, customer-damaged-low→LIQUIDATE, F→RECYCLE_DONATE).
- **Pricing → use `ml/route.py` EV optimizer + the LightGBM price model** instead of hardcoded MRP fractions, so recovery values are real.
- **Risk tier → `ml/risk_tier.py`** decides verification depth (high-value phone needs functional proof + agent), guarantee window, liable party — already exists.
- **Grade&Resell 4-grade label** ← map A→Like New, B→Very Good, C→Good, D→Acceptable, E/F→unsellable (warranty/dispose).
- **Health Card + ledger** ← already generated on relist; extend to record fault + functional + evidence hash (this IS the SAFE-T evidence bundle).
- **Decision A (SAFE-T / warranty / refund) is NEW** — small pure module `ml/seller_decision.py` (or `backend/core/seller_decision.py`). No consumer-side equivalent; build it.
- **Local routing / kirana** ← Decision B's resell/liquidate output flows into the existing demand-gravity router unchanged.

## 5. Implementation plan (phased, demo-safe)

**Phase 1 — Backend decision engine (pure functions, unit-testable)**
- `seller_decision.py`:
  - `attribute_fault(reason_code, grade, functional, seal_intact, defect_signals) → {fault: customer|carrier|defective|warehouse|none, confidence}`
  - `financial_decision(fault, refund_issued_by, in_window, evidence) → {refund_verdict, reimbursement: SAFE_T|WARRANTY|A_TO_Z|NONE, safet_reason_code, eligibility_checks[]}`
  - `disposition_decision(...)` → thin wrapper over `ml/disposition.py` + LIQUIDATE/WARRANTY extension + functional-pass gate.
  - Returns ONE object with both tracks + eligibility flags + the evidence bundle (photos, grade report, hash, order id, ASIN).

**Phase 2 — Wire the grade endpoint**
- `SellerGradeView` returns `{identity, grade, functional, completeness, fault, decisionA, decisionB, eligibility, evidence}` (not just the raw grade). Add a real **functional signal** per category (phone: powered-on-screen photo required & checked; apparel: N/A → pass).

**Phase 3 — Frontend: coordinated two-decision UI**
- Restore the **two-panel layout**: "A · Refund verdict" and "B · Recovery action" (the design already had this).
- Recovery ladder comes from Decision B (disposition + EV price), with **blocked reasons shown** ("functional check failed — cannot resell").
- Conditional CTAs: SAFE-T draft only when eligible (with the eligibility checklist + evidence bundle already in the SAFE-T tab); Warranty when defective; Dispose when policy-locked.
- **Stage 0 identity step**: a "Scan FNSKU / confirm ASIN" control before capture (barcode input or the existing DINOv2 instance gate), so identity is explicit.

**Phase 4 — Close the loops**
- SAFE-T tab shows **real drafted claims produced by the decision engine** (not static rows), each with its evidence bundle + 30/90-day deadline.
- Dashboard counts real fault mix / reimbursement outcomes.

**Phase 5 — Honesty & guardrails**
- Where a signal isn't truly measured (e.g. functional test from a single photo), label it "assumed / needs manual check" rather than asserting pass. Hazmat/hygiene/recall are hard rule overrides regardless of AI.

## 6. What to build first (smallest correct slice for the demo)
1. `seller_decision.py` with the fault + two-track logic (Phase 1).
2. Functional-gate the resell path so a "defective" return can never say "resell as used" (fixes the flagged bug).
3. Two-panel result UI + conditional SAFE-T/warranty/dispose (Phase 3, partial).
4. Leave EV-pricing and full barcode scanning as fast-follows.

---
### Sources
- FBA Grade and Resell (official): https://sell.amazon.com/blog/announcements/fba-grade-and-resell
- Liquidate vs dispose by damage reason (SoStocked): https://help.sostocked.com/article/279-removals-disposal-liquidations
- Refund at first scan (Seller Union): https://seller-union.com/amazon-launches-refund-at-first-scan-for-seller-fulfilled-returns/
- SAFE-T eligibility/evidence (SalesDuo): https://salesduo.com/blog/amazon-safe-t-claim-guide/
- SAFE-T 30-day window (MyAmazonGuy): https://myamazonguy.com/news/amazon-safe-t-claim-filing-window/
- FBA returns processing/identifiers (AMZ Prep): https://amzprep.com/amazon-fba-returns/
- Unfulfillable inventory guide (Seller Assistant): https://www.sellerassistant.app/blog/amazon-unfulfillable-inventory-complete-guide/
