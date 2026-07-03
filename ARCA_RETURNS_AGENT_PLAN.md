# REVIVE · Autonomous Returns & Claims Agent (ARCA) — In-Depth Implementation Plan

> Goal: turn the small **Merchant-Fulfilled (MFN) seller's** return desk into an
> autonomous pipeline — the seller films/photographs the return from a few angles,
> and a chain of specialized AI agents **grades it, attributes fault, decides
> disposition, checks SAFE-T eligibility against Amazon's real rules, and drafts a
> submit-ready SAFE-T claim with a tamper-evident evidence bundle.**
>
> This is the agentic, execution-grade version of `SELLER_DECISION_MODEL_PLAN.md`.
> It drops the warehouse-CCTV/VMS assumption (a small seller has a phone, not a
> camera rig) and replaces it with **guided multi-angle capture** — which REVIVE
> already has (`utils/categoryProfiles.js::capturePrompts` + the Grading Assistant).

---

## 0. Is it possible? — Yes, with three honest boundaries

1. **Grading, fault attribution, disposition, eligibility, and claim *drafting* are fully automatable** with REVIVE's existing CV stack + an LLM reasoning layer. This is the bulk of the value and is demoable now.
2. **SAFE-T *submission* cannot be a clean API call.** Amazon's SP-API exposes returns data and reimbursement *amounts* (Finances API) but has **no public POST endpoint to file a SAFE-T claim** — it's an open feature request. So the final step is either (a) a **one-click, pre-filled draft** the seller submits in Seller Central, or (b) a **headless-browser / third-party middleware** push (eVanik-style) in production. We build (a); we design for (b).
3. **The "forced refund" rule is a hard constraint, not a nicety.** A SAFE-T claim is invalid if the seller refunded voluntarily — it requires an **Amazon-issued refund**. The agent must therefore *withhold* the refund, let Amazon's auto-refund SLA fire, and only then mark the claim eligible. This inverts normal "be nice to the customer" instinct and must be encoded.

---

## 1. Amazon reality this plan is built on (researched)

| Fact | Consequence for the agent |
|---|---|
| Return report carries `Order ID, MSKU, ASIN, FNSKU, reason code, disposition` (`GET_XML_RETURNS_DATA_BY_RETURN_DATE`) | Identity + reason are pulled, not typed. |
| **Refund at first scan**; SAFE-T needs an **Amazon-issued** refund | Agent must NOT auto-refund fraud/damage; wait for Amazon's forced refund. |
| India SAFE-T window = **15 calendar days** from return-delivered-to-seller (or refund date); RNR 50–75 days; self-return-not-received 30–60 days | Timeline agent computes hard deadlines and prioritizes. |
| Reimbursement = **Fair Market Value at Amazon's discretion − fees**, often ~20% of loss | Set seller expectations; don't promise MRP. |
| **8% claim-to-returns ratio → account flagged "abusive," SAFE-T blocked** | Agent tracks the ratio and *suppresses* weak claims to protect the account. |
| Category exclusions (Furniture, Musical Instruments, Tyres, Jewellery, Sports; value > ₹25k self-ship) | Eligibility gate must hard-block these. |
| **Superficial damage excluded** (box dents, broken seal, primary-packaging damage); only severe damage / missing accessories / materially-different qualify | Fault agent must distinguish cosmetic-only from claimable damage. |
| Liquidate vs dispose: **Customer/Carrier/Distributor-damaged → liquidate; Defective/Expired/Warehouse-damaged → dispose only; hazmat/recall → dispose** | Disposition agent branches on *fault*, not wear. |
| Evidence: continuous unboxing video (seal→AWB→extract→360°→functional test), photo of return package with label, serial number; video ≤ **250 MB** | Evidence agent enforces the schema + compresses. |
| Appeal window: **5 business days** after No-Grant; investigator reply SLA **3 business days** | Orchestrator schedules appeals/replies. |

Sources listed at the end.

---

## 2. Capture model (replaces CCTV with the seller's phone)

The seller opens a return case and records **one continuous "unboxing" pass** *or* a set of **guided angle photos** (REVIVE already prompts these per category):

- **Sealed-parcel frame** — package + shipping label/AWB + barcode readable (identity + tamper proof).
- **Weight frame (optional, high-value)** — parcel on any scale, reading visible (empty-box / substitution defense).
- **Extraction** — seal cut + item out (single take if video).
- **360° + defect angles** — category-specific (`capturePrompts`): shoe→soles/insole, phone→powered-on screen/ports, apparel→tags/fabric.
- **Functional frame** — electronics powered on and exercised on camera (Amazon rejects functional claims not shown live).

**Evidence integrity (reuse what exists):** each captured asset is hashed (SHA-256) and appended to the **Health Card ledger** REVIVE already builds (`backend/trust`), producing a **tamper-evident evidence bundle** with a verifiable chain — this is exactly what a SAFE-T investigator needs and what our Product Health Card already is.

---

## 3. The multi-agent architecture (ARCA-for-REVIVE)

A directed pipeline of 5 specialized agents + an orchestrator. Vision runs on REVIVE's local CV models; the reasoning agents are **LLM calls with structured (JSON-schema) tool-use** (Claude via REVIVE's existing `LLM_PROVIDER` config), each **failing open to a deterministic rule table** so the demo works offline.

```
 Seller capture (photos/video) ──► [Orchestrator: ReturnCase created, evidence hashed]
        │
        ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ A1 · INTAKE & IDENTITY                                                 │
 │  • OCR the label/AWB + barcode → Order ID, ASIN, FNSKU (SP-API pull)   │
 │  • DINOv2 instance-match photo vs catalog image  (ml/instance_match)   │
 │  • optional weight-read vs expected                                    │
 │  → {identity_ok, detected_asin, tamper_ok, weight_flag}                │
 └───────────────┬──────────────────────────────────────────────────────┘
   mismatch/empty│                              │ ok
        ▼        │                              ▼
 (materially different / empty box)   ┌──────────────────────────────────┐
 → skip grading, mark fraud           │ A2 · VISION & GRADING EVALUATOR   │
                                      │  • ml/grade: Grounding DINO+CLIP+  │
                                      │    LLM → cosmetic A–F, defects     │
                                      │  • functional test (category rule/ │
                                      │    powered-on-screen frame check)  │
                                      │  • completeness/seal/accessories   │
                                      │  • counterfeit/substitution check  │
                                      │    (logo/brand vs ASIN reference)  │
                                      │  → structured condition report     │
                                      └───────────────┬───────────────────┘
                                                      ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ A3 · FAULT + DISPOSITION ENGINE                                        │
 │  fault = f(reason_code, cosmetic, functional, seal, weight, substitution)│
 │  disposition ← ml/disposition (+LIQUIDATE/WARRANTY extension):         │
 │    sellable→Restock/Grade&Resell · customer/carrier-dmg→Liquidate ·    │
 │    defective/warehouse/expired/hygiene/hazmat→Dispose/Warranty         │
 │  price ← ml/route EV + LightGBM (not MRP fractions)                    │
 │  → {fault, disposition, resale_channel, recovery_value, refund_verdict}│
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ A4 · POLICY VERIFIER & TIMELINE TRACKER  (the SAFE-T gatekeeper)       │
 │  • category not excluded? value ≤ ₹25k self-ship? not hazmat/recall?   │
 │  • refund issued BY AMAZON? (else: withhold + wait for forced refund)  │
 │  • damage is claimable (severe/missing/materially-diff, NOT cosmetic)? │
 │  • within 15-day window? compute deadline + countdown                  │
 │  • seller's SAFE-T ratio < 8%? (else suppress weak claim to protect a/c)│
 │  → {safe_t_eligible, sub_reason_code, deadline, suppress?, why_not[]}   │
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ A5 · CLAIM DRAFTER & SUBMITTER                                         │
 │  • assemble payload: Order ID, ASIN, AWB, serial, evidence bundle      │
 │  • compress video ≤ 250 MB; pick exact sub-reason code                 │
 │  • LLM writes concise policy-compliant investigator narrative          │
 │  • OUTPUT: one-click submit-ready draft (Seller Central deep-link) OR   │
 │    middleware/headless push (production)                               │
 └───────────────┬──────────────────────────────────────────────────────┘
                 ▼
        [Orchestrator: monitor status → auto-reply (3-day SLA) → appeal (5-day)]
```

**Agent I/O contracts (all JSON-schema-validated):**

- **A1 Intake** → `{order_id, asin, fnsku, identity_ok:bool, tamper_ok:bool, weight_flag:bool, detected_object}`
- **A2 Grading** → `{grade:A..F, confidence, functional:pass|fail|unknown, completeness, seal_intact, accessories_missing[], defects[], counterfeit:bool, condition_summary}`
- **A3 Fault/Disposition** → `{fault:customer|carrier|defective|warehouse|none, disposition:RESTOCK_NEW|GRADE_RESELL|LIQUIDATE|WARRANTY|DISPOSE|DONATE, condition_label, recovery_value, refund_verdict:full|restock_fee|withhold}`
- **A4 Policy** → `{safe_t_eligible:bool, sub_reason_code, filing_deadline, days_left, account_ratio, suppress:bool, ineligible_reasons[]}`
- **A5 Claim** → `{claim_draft:{narrative, evidence_refs[], video_ref, sub_reason_code}, submit_mode:one_click|middleware, seller_central_url}`

---

## 4. Decision logic encoded (the rules that fix today's holes)

1. **Functional-fail is a hard gate on resale.** `functional==fail` ⇒ disposition ∈ {WARRANTY, DISPOSE}, never GRADE_RESELL — regardless of cosmetic grade. (Fixes "defective graded B → resell.")
2. **Fault drives liquidate vs dispose**, per Amazon: customer/carrier-damaged→LIQUIDATE; defective/warehouse/expired→DISPOSE; hazmat/recall→DISPOSE.
3. **SAFE-T is opened by fault + refund status, not grade.** Buyer-damaged / materially-different / empty-box ⇒ SAFE-T draftable *once Amazon has refunded* — in parallel with liquidation. Cosmetic-only damage ⇒ NOT claimable (Amazon excludes superficial).
4. **Withhold-refund automation.** If A3 verdict is withhold/claim, A4 sets `do_not_refund` and the orchestrator waits for Amazon's forced refund before enabling submission.
5. **Account-health self-defense.** If SAFE-T ratio ≥ 8% (or nearing), A4 `suppress`es marginal claims and tells the seller why — protecting the account from being flagged abusive.
6. **Two coordinated outputs surfaced in UI:** *Refund verdict* (money) and *Disposition* (where it goes) as separate panels — restoring the design's two-decision layout.

---

## 5. How it plugs into the existing REVIVE stack

| ARCA piece | Reuse in REVIVE | New work |
|---|---|---|
| A1 identity | `ml/instance_match.py` (DINOv2), catalog ref image | Label/AWB OCR (Claude vision or `pytesseract`); SP-API returns pull (prod) |
| A2 grading | `ml/grade.py` (Grounding DINO+CLIP+LLM), `ml/heatmap.py`, `capturePrompts` | functional-frame check; counterfeit/logo check prompt |
| A3 disposition | `ml/disposition.py`, `ml/route.py` (EV), `ml/risk_tier.py`, LightGBM price model | extend disposition vocab with LIQUIDATE/WARRANTY; fault attributor |
| A4 policy | — | `seller_decision.py` eligibility engine (category/value/window/ratio/refund-source) |
| A5 claim | `backend/trust` Health Card + SHA-256 ledger = evidence bundle | claim drafter (LLM), video compressor, sub-reason selector, submit adapter |
| Orchestrator | Celery (already the ML queue) | agent DAG runner + status monitor + deadline scheduler (Celery beat) |
| UI | Seller Central we built (Manage Returns → Grading Assistant, SAFE-T tab) | per-agent progress, two-decision panels, evidence bundle viewer, claim preview |
| Persistence | Django models (Product, Listing, HealthCard) | `ReturnCase`, `EvidenceAsset`, `FaultDecision`, `SafetClaim` models |

**Agent runtime:** each reasoning agent = one Anthropic tool-use call (`LLM_PROVIDER` config) returning schema-validated JSON, wrapped in a Celery task; vision agent = local CV. Everything **fails open to deterministic rule tables** (REVIVE's existing philosophy) so the pipeline runs with no API key for the demo.

---

## 6. Data model (new)

```
ReturnCase(order_id, asin, fnsku, sku, product FK, reason_code, refund_status,
           refund_issued_by, delivered_to_seller_at, state)         # lifecycle
EvidenceAsset(case FK, kind[label|weight|angle|functional|video],
              file, sha256, captured_at)                            # → ledger
GradeResult(case FK, grade, functional, completeness, seal_intact,
            defects json, counterfeit, condition_summary, model_version)
FaultDecision(case FK, fault, disposition, condition_label,
              recovery_value, refund_verdict)
SafetClaim(case FK, eligible, sub_reason_code, filing_deadline, status,
           narrative, evidence_manifest json, submit_mode, appeal_deadline)
```
`EvidenceAsset` hashes chain into the existing `trust` ledger → the Product Health Card **is** the SAFE-T evidence bundle.

---

## 7. Build phases (demo-first, each independently shippable)

**Phase 1 — Decision core (no UI):** `seller_decision.py` = fault attributor + SAFE-T eligibility engine + functional-gated disposition (wraps `ml/disposition.py`). Pure, unit-tested against the Amazon rule table above. *This alone fixes the "defective→resell" and "SAFE-T only on fraud" bugs.*

**Phase 2 — Grade endpoint returns the full agent result.** `SellerGradeView` → runs A1–A4, returns `{identity, grade, fault, disposition, refund_verdict, safe_t}`. Add functional-frame check + counterfeit prompt.

**Phase 3 — Two-decision UI + evidence bundle.** Grading Assistant shows *Refund verdict | Disposition* panels, blocked-reason chips, the evidence bundle (hashed assets), and a **SAFE-T eligibility checklist with countdown**. Conditional CTAs (relist / warranty / dispose / draft SAFE-T).

**Phase 4 — Claim drafter (A5) + SAFE-T tab.** Real drafted claims (narrative + sub-reason + manifest + deadline) replace the static SAFE-T rows; "Copy to Seller Central" one-click. Video compressed ≤250 MB.

**Phase 5 — Orchestrator + timeline.** Celery-beat watches refund status (withhold→wait for Amazon forced refund→enable submit), deadline countdowns, appeal/reply scheduling, 8%-ratio guard.

**Phase 6 (production) — Live wiring.** SP-API returns/finances pull, Shiprocket reverse-tracking webhooks, headless/middleware submission, real OCR.

**Smallest demo slice:** Phase 1 + 2 + a trimmed Phase 3 (two panels + SAFE-T checklist) + Phase 4 draft preview — all runnable with REVIVE's local ML and no external API.

---

## 8. Honest constraints (state these in the demo, don't hide them)

- **No SAFE-T submit API** → agent produces a submit-ready draft; human clicks (or middleware in prod).
- **Functional test from a phone photo is weak** — a powered-on-screen frame is evidence of "boots," not full function. Label it "functional: shown on camera / assumed," flag high-value for manual test.
- **FMV reimbursement ≈ 20% of loss** and the **8% abuse cap** are real — the agent's job includes *not* filing weak claims, and setting recovery expectations honestly.
- **Category/value exclusions** (Furniture, Jewellery, Tyres, Musical Instruments, Sports; >₹25k self-ship) hard-block SAFE-T.
- **Superficial damage is excluded** — box dents / broken seal alone are not claimable; the fault agent must not draft those.

---

### Sources
- FBA Grade & Resell (4 used grades, functional+cosmetic+packaging+accessories): https://sell.amazon.com/blog/announcements/fba-grade-and-resell
- Liquidate vs dispose by damage reason: https://help.sostocked.com/article/279-removals-disposal-liquidations
- Refund at first scan (SAFE-T needs Amazon-issued refund): https://seller-union.com/amazon-launches-refund-at-first-scan-for-seller-fulfilled-returns/
- SAFE-T India window/evidence (Easy Ship guide, sell.amazon.in): https://sell.amazon.in/seller-blog/here-is-how-easy-ship-sellers-can-file-safe-t-claims
- SAFE-T India step-by-step (walbayzon): https://www.walbayzon.com/post/the-complete-guide-for-amazon-easy-ship-sellers-to-file-safe-t-claims-india
- SAFE-T eligibility/evidence/window (SalesDuo): https://salesduo.com/blog/amazon-safe-t-claim-guide/
- SP-API Returns Reports (GET_XML_RETURNS_DATA_BY_RETURN_DATE): https://developer-docs.amazon.com/sp-api/docs/report-type-values-returns
- No SP-API SAFE-T submit endpoint (feature request): https://github.com/amzn/selling-partner-api-models/issues/560
- Companion decision model: `SELLER_DECISION_MODEL_PLAN.md`
