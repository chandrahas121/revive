# Pillar 4 V2 — Return Prevention (redesign plan)

> A prediction + recommendation layer that **diagnoses why** an item is risky,
> **routes** to the cheapest intervention that removes that specific cause, and
> **only intervenes** on shoppers it can actually move. Still stateless — writes
> nothing, grants nothing. No Green Credits (that's Pillar 5).

---

## 0. Why V2 (what was wrong with V1)

V1 did one thing: `risk > threshold → show a generic blue banner`. Three problems:

1. **The output was the same regardless of *why* the item was risky.** Size doubt,
   impulse-discount, and thin-reviews all produced the same banner.
2. **It nudged everyone above a cutoff** — including people who'd keep the item
   anyway, and people a banner makes *more* likely to return.
3. **The shipped code is behind the doc.** `ml/prevent.py` still scores on 6
   features, uses a non-deterministic `hash(category) % 100`, has no calibration,
   and still computes a `credit_promise`. The 11-feature `featurize()` / SHAP /
   isotonic described in `PILLAR4_RETURN_PREVENTION.md` don't actually exist yet.

V2 fixes all three. The spine: **diagnose → route → target.**

Dropped from the earlier brainstorm: standalone "risk-gated VTON" and "bracket
resolution." VTON survives, but as a *response to declared doubt* (see F3), not a
separate trigger.

---

## 1. The features we're building

| # | Feature | Job | Reuses |
|---|---|---|---|
| **F1** | Persuadability gating ("nudge budget") | **target** — decide *whether* to intervene | existing risk score |
| **F2** | SHAP reason-specific nudges ("risk receipt") | **diagnose** — pick the *right* nudge | existing model |
| **F3** | Conviction tap → VTON-on-doubt | **route** + collect labels | existing VTON |
| **F4** | Fit-twin social proof | **route** — specific, real proof | `size_profile` |
| **F5** | Returns hotspot dashboard (optional 2nd screen) | **diagnose at catalog level** | same model |
| **F6** | Return-initiation triage (`/keep/` redesign) | **resolve the reason** | size model |

Build order is in §5. F1–F3 + F6 are the core; F4/F5 are upgrades if time allows.

---

## 2. The math (risk, uncertainty, persuadability)

All three run on data we **already compute**. The only genuinely new signal is the
conviction tap (F3), and it's optional — the gate works without it.

### 2.1 Risk
The calibrated GBDT output for an item-user pair. `risk = isotonic(model.predict(features))`,
a number in [0,1] = probability of return. Already produced by `/risk/`.

### 2.2 Uncertainty (no new data)
How unsure the model is. Derived from the risk number plus existing features:

```python
uncertainty = 1 - 2 * abs(risk - 0.5)      # 1.0 at risk=0.5, ~0 at the extremes
if size_in_profile == 0: uncertainty += 0.2   # we guessed the size → thin input
if rating_count_log < 2: uncertainty += 0.1   # thin reviews → noisy input
if conviction == "low":  uncertainty += 0.3   # only if F3 tap was used
uncertainty = min(1.0, uncertainty)
```

- `risk≈0.95` → confident return (Lost Cause), low uncertainty.
- `risk≈0.10` → confident keep (Sure Thing), low uncertainty.
- `risk≈0.50` → genuinely on the fence — the movable middle.

### 2.3 Persuadability + the intervene decision
```python
persuadability = risk * uncertainty
intervene = (persuadability > 0.30) and (risk < 0.90)
```

Plain English: **nudge when the item is risky enough to matter AND the model (or
shopper) is unsure enough to be movable — but stay silent when risk is so high the
shopper has clearly already decided.** `risk` and `intervene` become **separate
fields**. High risk with `intervene=false` is a feature, not a bug.

> Honesty note for judges: synthetic data can't *prove* uplift. Frame this as "we
> target estimated persuadability, not raw risk," and show the logic. The
> conviction tap is what would validate it for real over time.

---

## 3. Feature detail

### F1 — Persuadability gating ("nudge budget")
Every nudge has an annoyance cost; spend it only where expected uplift is positive.
Implements §2. Four shopper types the raw risk score can't tell apart: Sure Thing,
Lost Cause, Persuadable, Sleeping Dog (nudging *raises* their return rate — ~40% of
customers in the Smart Green Nudging study). We only nudge Persuadables.
**Output:** `intervene: bool` + `intervene_reason: str` on `/risk/`.

### F2 — SHAP reason-specific nudges ("risk receipt")
Run SHAP on each prediction; the **dominant feature picks the intervention**:

| Dominant driver | Nudge |
|---|---|
| `size_delta` | fit nudge + real measurements (+ conviction tap → VTON, F3) |
| `discount_depth` × apparel | cooling-off microcopy ("buying for the price or the fit?") |
| low `rating` / `rating_count` | surface fit/quality review snippets (F4) |
| `first_in_category` | short "what to check" explainer |

Make it a **counterfactual**: "Flagged mostly because it's a deep discount on a
category you've never bought. What removes the doubt: [measurements / try-on]."
This also kills the "is the GBDT decoration?" question — the model's reasoning *is*
the UX. **Output:** replace single `nudge_text` with `risk_driver` + `nudge_text`.

### F3 — Conviction tap → VTON-on-doubt  *(this is where VTON lives now)*
For an item where `intervene=true`, show one tap:
**"How sure are you about this size?"** → 😬 not sure / 🤔 somewhat / 😎 confident.

- 😬 **not sure** → this is the VTON moment: **"See it on you before you buy"** →
  launch the existing upper-body VTON with the user's body. Also expand fit tools /
  fit-twin data. (Footwear / bottoms, where VTON can't render → route to
  measurements + fit-twin instead. Keep the offer honest: VTON shows drape, pair it
  with size data, don't present it as a fit guarantee.)
- 😎 **confident** → back off. Don't interrupt a confident buyer.

**Why it matters twice:**
1. *Better nudge now* — VTON is offered exactly when the shopper admits doubt,
   instead of sitting as a passive always-on button they ignore.
2. *Fixes the data problem* — the tap + the eventual return outcome = a **real
   labeled training pair**, retiring V1's #1 weakness (synthetic data). The system
   gets more accurate as it's used. Demoable as an appended row in a "training
   signal" log; no real retraining pipeline needed for the demo.

`(features at tap time) + (conviction) → (kept / returned)` is the label.

### F4 — Fit-twin social proof
Replace hardcoded "87% kept this" with real k-NN over `size_profile`: shoppers with
the closest measurements + brand history who bought *this exact item*, and their
keep-vs-return split. "19 of 23 shoppers with your measurements kept this in size 9;
the 4 who returned all sized down." Authentic, specific proof. A small synthetic
neighbor table keyed on `size_profile` is enough for the demo.

### F5 — Returns hotspot dashboard (optional second screen)
Aggregate per-item risk across users → a merchant view of which SKUs are
structurally high-risk and **why** (missing measurements, fit-complaint reviews,
brand bias). Same model, zero new ML. Prevention at the *source*. Best "wow" second
surface if time allows.

### F6 — Return-initiation triage (`/keep/` redesign — kill the credit bribe)
Drop `credit_promise`. Branch the response on the stated `reason`:

| Reason | Strategy | Copy |
|---|---|---|
| too big / small | **exchange-first** | "Ship size 8 instead — keep this until it arrives." (one tap, uses size model; cuts refunds ~28–34%, often upsells) |
| changed my mind | **friction / loss-aversion** (non-monetary) | "Last one in your size" / "Refund takes 5–7 days — keeping is instant." |
| defective / damaged / wrong / not as described | **none** | never nudge — it's the trust signal (already correct in V1) |
| vague / other | **2-question diagnostic** | "Where doesn't it fit?" → route genuine misfits straight through |

Optional non-bribe positive incentive: **altruistic framing** — "Tell us why it
didn't fit — it helps the next shopper your size." Costs nothing, feels good, and
the answer is a labeled example (ties to F3). Pitch line:
**"We don't pay people not to return — we remove the reason they're returning."**
This also makes Pillar 4 stand alone, with no dependency on Pillar 5's wallet.
**Output:** `strategy` field (`exchange` / `friction` / `none` / `diagnostic`) +
copy + `recommended_size` for exchanges.

---

## 4. API changes

### `POST /api/prevent/risk/`
Add to the response:
```jsonc
{
  "risk": 0.62,
  "uncertainty": 0.76,          // NEW (§2.2)
  "persuadability": 0.47,       // NEW
  "intervene": true,            // NEW — the gate (F1)
  "intervene_reason": "mid-risk + low size confidence",  // NEW
  "risk_driver": "size_delta",  // NEW — drives nudge choice (F2)
  "nudge_text": "Nike runs small for your size — size 9 is your match.",
  "conviction_prompt": true,    // NEW — show the F3 tap
  "fit_twins": { "kept": 19, "total": 23, "note": "returners sized down" }, // NEW (F4)
  "flagged_item_id": "B087LGFC7P",
  "breakdown": [ /* per-item: risk, uncertainty, intervene, risk_driver */ ]
}
```
Remove `credit_promise`. `show_rich_content` is replaced by `risk_driver` +
`conviction_prompt`.

### `POST /api/prevent/keep/`
```jsonc
{
  "risk": 0.41,
  "strategy": "exchange",                 // NEW: exchange | friction | none | diagnostic
  "recommended_size": 8,                  // NEW (when strategy=exchange)
  "nudge_text": "Ship size 8 instead — keep this until the replacement arrives.",
  "reason": "too small"
}
```
Remove `credit_promise`. Keep the hard-reason → `strategy:"none"` rule.

---

## 5. Build order

1. **Fix the base model first.** Bring `ml/prevent.py` up to the doc: deterministic
   11-feature `featurize()` (drop `hash(category)`; use the synonym-normalized
   category prior), isotonic calibration applied at inference, remove
   `credit_promise`. Without this, everything below sits on a shaky model.
2. **F1 — persuadability gate.** Add `uncertainty`, `persuadability`, `intervene`
   to `score_risk()`. Pure arithmetic on the risk output. Highest novelty/effort.
3. **F2 — risk_driver.** Run SHAP (or feature-importance fallback) per prediction;
   map dominant driver → nudge. Branch `ReturnNudge.jsx` on `risk_driver`.
4. **F3 — conviction tap + VTON handoff.** Add the 3-tap component; "not sure" →
   launch existing VTON (upper-body) / fit tools; log `(features, conviction)` to a
   visible training-signal list.
5. **F6 — `/keep/` triage.** Branch `KeepView` on `reason` → `strategy`; wire
   `KeepItModal.jsx` to render exchange / friction / diagnostic / none.
6. **F4 — fit-twins** (synthetic neighbor table). 
7. **F5 — hotspot dashboard** (only if time).

Files touched: `ml/prevent.py`, `ml/notebooks/train_prevention.py`,
`backend/prevent/views.py`, `frontend/.../ReturnNudge.jsx`,
`frontend/.../KeepItModal.jsx`, `frontend/.../CartContext.jsx`.

---

## 6. Demo script

1. **Cart A — nudge fires.** risk 0.62, borderline size, low conviction →
   `intervene=true`. Reason-specific nudge ("Nike runs small → size 9") + fit-twin
   stat. Tap 😬 → VTON opens on the user's body. Tap logged to training signal.
2. **Cart B — deliberate silence.** risk 0.88, repeat buyer keeping their usual
   size → `intervene=false`. **No banner.** Say out loud: *"We held back on
   purpose — this shopper keeps it; interrupting only risks the sale."* This
   restraint is the whole pitch.
3. **Return wizard.** "Too small" → one-tap **exchange** to size 8 (no refund
   default). "Arrived damaged" → no nudge (trust). 
4. *(optional)* Hotspot dashboard: the SKUs manufacturing returns + the content gap.

The line judges remember: **"We don't detect returns — we prevent the preventable
ones, and we stay silent everywhere else."**

---

## 7. Honesty notes / limitations

- Synthetic data → can't *prove* uplift numbers. Present the *logic* of
  persuadability targeting, not a measured lift. The conviction tap is the path to
  real validation.
- VTON is upper-body only → gate the "see it on you" CTA to upper-body apparel;
  route footwear/bottoms to measurements + fit-twins. Present VTON as drape preview,
  not a fit guarantee.
- F4 fit-twins use a synthetic neighbor table for the demo; production builds it
  from real purchase/return history.
- Pillar 4 persists nothing. The conviction log shown in the demo is illustrative;
  a real labeling pipeline is the production follow-up.
