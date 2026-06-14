# Pillar 4 — Return Prevention

> Predict return risk **before** a purchase and surface recommendations the
> buyer can act on or ignore. A stateless prediction + nudge layer — it writes
> nothing and grants nothing.

**Scope note.** Pillar 4 is purely the *prediction + recommendation* layer:
return-risk scoring and the nudges shown at checkout and at return initiation.
Any **reward for keeping an order (Green Credits)** is a separate concern —
**Pillar 5** — and is intentionally NOT implemented here. There is no wallet,
ledger, vesting job, or persisted deflection in this pillar.

This document covers the ML model, the backend API, the training/verification
workflow, and the frontend integration.

---

## 1. What Pillar 4 does

Two moments in the customer journey:

| Moment | Screen | Goal |
|---|---|---|
| **Checkout** | S7 | Predict per-item return risk. If high, show a size/fit nudge, detect "bracketing" (multiple sizes of one item), and surface richer content (360°, measurements, fabric). |
| **Return initiation** | S2 | For *soft* return reasons, show a gentle "are you sure?" keep-it prompt. The buyer keeps or returns — purely advisory. |

Everything Pillar 4 produces is a recommendation. The buyer is always free to
proceed.

---

## 2. Architecture at a glance

```
                         ┌─────────────────────────────────────────┐
  Checkout (S7) ───────► │  POST /api/prevent/risk/                 │
   {cart:[{listing_id,   │   RiskView                                │
          size?}]}       │    ├─ _resolve_cart()  (listing → DB)    │
                         │    ├─ _build_user_history(user)           │
                         │    └─ ml.prevent.score_risk()             │
                         │         ├─ _detect_brackets()             │
                         │         ├─ featurize() ──► GBDT + isotonic │
                         │         └─ _size_fit_nudge()              │
                         └─────────────────────────────────────────┘

                         ┌─────────────────────────────────────────┐
  Return wizard (S2) ──► │  POST /api/prevent/keep/                 │
   {order_id, reason}    │   KeepView                                │
                         │    └─ ml.prevent.keep_it_nudge()         │
                         │        (read-only; nothing persisted)     │
                         └─────────────────────────────────────────┘
```

The **single source of truth** for the model's input is `featurize()` in
`ml/prevent.py`. Both the trainer and the live inference path call it, so
training and serving can never drift.

---

## 3. Files

| File | Role |
|---|---|
| `ml/prevent.py` | Feature schema (`FEATURE_NAMES`, `featurize`), `score_risk()`, `keep_it_nudge()`, bracket detection, category normalization, isotonic calibration, linear heuristic fallback. |
| `ml/notebooks/train_prevention.py` | Synthetic-cohort generator (with nonlinear interactions) + LightGBM trainer + calibration. Imports `featurize`/`_heuristic_risk` from `ml.prevent`. |
| `ml/artifacts/risk_model.pkl` | Trained LightGBM booster. |
| `ml/artifacts/risk_calibrator.pkl` | Isotonic probability calibrator. |
| `ml/artifacts/risk_metrics.json` | F1 (primary), AUC, heuristic-vs-GBDT comparison, Brier, feature importance. |
| `backend/prevent/views.py` | `RiskView`, `KeepView` (both stateless). |
| `backend/prevent/urls.py` | Routes `risk/`, `keep/`. |
| `backend/prevent/models.py` | *Empty* — Pillar 4 persists nothing. |
| `backend/core/models.py` | `User.size_profile` (per-category buyer sizes — a model input). |
| `backend/core/management/commands/seed_db.py` | Seeds demo users (`priya`, `rahul`) with size profiles + return rates. |
| `frontend/src/components/stitch/ReturnNudge.jsx` | Checkout bracket banner + size/fit nudge + rich-content panel. |
| `frontend/src/components/stitch/KeepItModal.jsx` | Return-wizard "are you sure?" keep-it prompt (no rewards). |
| `frontend/src/context/CartContext.jsx` | Per-size cart lines (enables bracket detection). |

---

## 4. The model

### 4.1 Feature schema (`FEATURE_NAMES`)

Order is fixed and shared between training and inference:

| # | Feature | Meaning |
|---|---|---|
| 1 | `category_return_prior` | Base return rate for the (normalized) category. |
| 2 | `size_delta` | \|ordered size − buyer's profile size\| (0 if unknown). |
| 3 | `brand_bias_abs` | \|brand sizing bias\| (runs small/large). |
| 4 | `is_gift` | 1 if flagged as a gift. |
| 5 | `user_return_rate` | Buyer's historical return rate. |
| 6 | `num_sizes_same_product` | **Bracket signal** — # sizes of the same product in cart. |
| 7 | `discount_depth` | `(mrp − price) / mrp`, clamped to [0, 1]. |
| 8 | `size_in_profile` | 1 if we knew the buyer's size for this category. |
| 9 | `rating` | Product rating 1–5. |
| 10 | `rating_count_log` | `log1p(#ratings)`. |
| 11 | `first_in_category` | 1 if buyer has never bought this category. |

### 4.2 Category normalization

Catalogue categories are free-form / lowercase (`clothing`, `kitchen`,
`cameras`). `normalize_category()` maps them to canonical prior keys via a
synonym table, applied inside `featurize()` so it's enforced everywhere.

### 4.3 Training data — and why the GBDT is not circular

A fair objection to a model trained on synthetic data: *if the labels come from
a formula you wrote, the model just re-learns your formula.* We avoid this.

The latent return probability is a **linear base** (identical to the linear
heuristic in `ml/prevent.py`) **plus genuine nonlinear interactions** a linear
model structurally cannot represent:

- `size_delta × brand_bias` — a brand that runs small *and* a size mismatch
  compound super-additively.
- **`discount_depth × category` sign flip** — deep discounts *raise* return risk
  for apparel (impulse buys) but *lower* it for electronics (a genuine bargain).
  A single linear discount coefficient must compromise; a tree splits on category
  first and gets both right.
- `first_in_category × size_delta` — unfamiliar category + size doubt.

The GBDT trains on the **11 base features only** (no interaction features are
handed to it), so any lift is what it *discovered*. We report both numbers.

### 4.4 Metrics (current)

| Metric | Original | Now |
|---|---|---|
| AUC | 0.63 | **0.85** |
| F1 (primary) | 0.44 | **0.70** |
| Heuristic (linear) F1 | — | 0.68 |
| **GBDT lift over heuristic** | — | **+3.3% F1 (+1.7pt AUC)** |
| Brier (raw → calibrated) | — | 0.138 → 0.138 |

The lift is the concrete answer to "what does the ML add over the heuristic":
**the category×discount sign-flip the linear model can't capture.** Top features
by gain: `category_return_prior`, `size_delta`, `user_return_rate`,
**`num_sizes_same_product`** (the bracket signal).

### 4.5 Calibration

A raw GBDT score is not a probability. We fit **isotonic regression** on a
held-out split and apply it at inference, so the `risk` value is a calibrated
estimate, and report the Brier score before/after. **No model probability is
ever shown to the user as a population statistic** — nudge copy describes
relative likelihood and points to verifiable content (size guide, measurements).

### 4.6 Fallback

If `risk_model.pkl` is missing or fails to load, `_heuristic_risk()` (the linear
base) runs. The API degrades gracefully and never hard-fails.

---

## 5. API

Base path: `/api/prevent/`. Auth: `AllowAny` (works for anonymous carts;
authenticated requests get richer history). Both endpoints are **read-only**.

### 5.1 `POST /api/prevent/risk/` — checkout risk + nudges

**Request**
```json
{
  "cart": [
    { "listing_id": 15, "size": 38 },
    { "listing_id": 15, "size": 40 },
    { "listing_id": 15, "size": 42 }
  ],
  "user_history": { "size_history": { "Clothing": 40 } }   // optional
}
```
- `listing_id` is preferred — the backend resolves category/brand/price/mrp from
  the DB. Raw items are also accepted as a pass-through.
- For authenticated users, `return_rate`, `purchased_categories`, and
  `size_profile` are derived from their account automatically.

**Response**
```json
{
  "risk": 0.908,
  "flagged_item_id": "B087LGFC7P",
  "nudge_text": "💡 Size check: this differs from the size you usually buy…",
  "show_rich_content": true,
  "bracket": { "B087LGFC7P": 3 },
  "bracket_nudge": "👟 You have 3 sizes of the same item in your cart…",
  "breakdown": [ { "product_id": "B087LGFC7P", "category": "clothing", "brand": "Allen Solly", "risk": 0.908 } ]
}
```

| Field | Use |
|---|---|
| `risk` | Highest per-item calibrated risk in the cart (0–1). |
| `flagged_item_id` | The riskiest item's product id. |
| `nudge_text` | Size/fit nudge string (empty if low risk). |
| `show_rich_content` | `true` when risk ≥ 0.50 → render 360°/measurements/fabric panel. |
| `bracket` | `{product_id: size_count}` for products with ≥2 sizes, else `null`. |
| `bracket_nudge` | "Pick your size before checkout" string. |
| `breakdown` | Per-item risk list. |

### 5.2 `POST /api/prevent/keep/` — return-initiation nudge

**Request**
```json
{ "order_id": 42, "reason": "changed my mind" }
```
Provide `order_id` **or** `listing_id` (or raw `category`/`brand`/`price`).

**Response**
```json
{
  "risk": 0.197,
  "eligible": true,
  "nudge_text": "Before you return — are you sure? This item is a good match for you…",
  "reason": "changed my mind"
}
```

**Eligibility rule:** soft reasons are eligible (show the prompt); **hard reasons
are never nudged** — `defective`, `damaged`, `wrong item`, `not as described`,
`missing` (the fault is the seller's). The endpoint persists nothing; the buyer's
keep/return choice is handled client-side.

---

## 6. Workflow — how to run it

### 6.1 Train / retrain the model
```bash
# from repo root; needs lightgbm, scikit-learn, pandas, numpy
python ml/notebooks/train_prevention.py            # default 80k rows
```
Writes `risk_model.pkl`, `risk_calibrator.pkl`, `risk_metrics.json`.

### 6.2 Backend setup (SQLite for local dev)
```bash
cd backend
export DATABASE_URL="sqlite:///db.sqlite3"   # PowerShell: $env:DATABASE_URL="sqlite:///db.sqlite3"
python manage.py migrate
python manage.py seed_db        # products, listings + demo users priya/rahul (pw: revive123)
python manage.py runserver
```

### 6.3 Demo flow
```
1. Log in as priya@revive.test / revive123 (return_rate 0.35, sizes Footwear 9, Clothing 40).
2. Open a Nike shoe → add sizes 9, 10, 11 → go to checkout.
   → bracket banner + size/fit nudge fire live.
3. My Orders → "Return or replace" → reason "Doesn't fit".
   → "are you sure?" keep-it prompt → "Keep this item" or "Continue return".
```

### Verified behaviour
| Case | Result |
|---|---|
| 3 sizes of one shoe | risk ≈ 0.95, `bracket={shoe:3}`, `show_rich_content=true` |
| Priya size 9 ordering size 11 | size/fit nudge fires (size_delta from her profile) |
| Electronics deep discount | risk ≈ 0.02 (bargain, not impulse — the sign flip) |
| Return "changed my mind" | eligible, keep-it prompt shown |
| Return "arrived damaged" | not eligible, no prompt |

---

## 7. Frontend (wired)

**Checkout (S7)** — `frontend/src/App.jsx` `Checkout` + `ReturnNudge.jsx`
- On every cart change, `POST /api/prevent/risk/` with `{cart:[{listing_id, size}]}`.
- `bracket_nudge` → amber bracket banner; `nudge_text` → blue size/fit nudge;
  `show_rich_content` → expandable 360°/measurements/fabric panel.
- Cart lines are keyed by listing id + size (`CartContext`), so adding several
  sizes of one shoe is what triggers the bracket.

**Product page** — size selector for size-sensitive categories (footwear,
clothing); the chosen size flows into the cart and the risk call.

**Return wizard (S2)** — `OrdersPage.jsx` + `KeepItModal.jsx`
- "Return or replace" opens the modal; selecting a reason calls
  `POST /api/prevent/keep/`. Soft reasons show the "are you sure?" prompt with
  "Keep this item" / "Continue return". Hard reasons show no prompt. The choice
  is client-side only.

---

## 8. Notes / known limitations

- **Size profiles** live on `User.size_profile` ({category: size}) and are seeded
  for demo users, so `size_delta` actually moves. Catalogue *products* carry no
  per-listing size; the ordered size comes from the client size selector.
  Building real size profiles from purchase history is the production follow-up.
- **Synthetic training data with engineered nonlinearity.** The GBDT's lift over
  the linear heuristic is real (it comes from the interactions). Grounding a slice
  on a real returns dataset — replacing `generate_synthetic_dataset()` and keeping
  the `featurize()` schema — would fully retire the "is it circular?" question.
- **Business metric.** F1 is the reported primary, but return prevention is an
  *intervention* problem (nuisance nudges vs. missed preventable returns). A
  cost-weighted threshold or precision@k tells a stronger business story;
  `risk_metrics.json` stores the F1-optimal `threshold` to swap.
- **`risk_model.pkl` / `risk_calibrator.pkl` / `numpy` / `lightgbm`** must be
  importable in the backend runtime for the GBDT path; otherwise the linear
  heuristic fallback runs.
- The keep-it prompt is advisory only. Rewarding kept orders (Green Credits) — the
  wallet, ledger, and vesting — belongs to **Pillar 5** and is out of scope here.
- Local dev used SQLite via a `DATABASE_URL` override; production config
  (Postgres) is unchanged.
```
