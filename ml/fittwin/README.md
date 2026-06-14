# Fit-Twin — Pillar 4 (Return Prevention)

Show how an item really fit other shoppers and recommend a size — **without ever
asking for height, weight, or any measurements**. The fit verdict (small / fit /
large) is a real human judgement from the Rent the Runway clothing-fit dataset,
so nothing is trained on a formula and nothing is circular.

Two tiers, both measurement-free:

* **Personalised** — when we know the shopper's usual size in this category (from
  their kept-order history, `User.fit_size_profile`), we match real shoppers who
  wear a similar size ("size twins") and read their real fit outcomes.
* **Aggregate** — brand-new shopper, nothing known: we show the item's overall fit
  signal ("runs small, most buyers sized up") and the typical true-fit size.

```
 RTR dataset (real)     build_index.py            match.py                 API + UI
 ──────────────────  ► ─────────────────  ►  ───────────────────  ►  ─────────────
 fit / size / item     parse + clean ->        cohort by item/cat,       POST /api/prevent/
 / category            fittwin_index.pkl       summarise real fit          fit-twin/
                                               outcomes by size            FitTwin.jsx
```

## 1. Get the data (once)

The sandbox has no internet; download on your machine with your Kaggle key
(`data/KAGGLE_SETUP.md`).

```powershell
cd "c:\Users\chand\OneDrive\Desktop\amazon-hackon"
pip install kaggle
python data/download_datasets.py --fit
#   -> data/renttherunway_final_data.json   (ModCloth is downloaded too but not used)
```

A small `data/_sample_renttherunway.json` is bundled so every step runs before
you download — smoke-test only; the demo uses real data.

> ModCloth note: the download includes `modcloth_final_data.json`, but the builder
> ignores it on purpose — ModCloth has no `weight` field and uses a different size
> scale, so merging would corrupt size recommendations. RTR (~160k rows) is the
> source of truth.

## 2. Build the index

```powershell
python ml/fittwin/build_index.py            # reads data/renttherunway_final_data.json
#                                             writes ml/artifacts/fittwin_index.pkl
```

## 3. Migrate + seed real demo users

```powershell
cd backend
python manage.py migrate
python manage.py seed_fittwin               # real users + fashion products from the dataset
```

`seed_fittwin` creates demo accounts `fittwin1..N@revive.test` (password
`revive123`). Each carries a real `fit_size_profile` — the sizes that genuinely fit
that shopper, per category — which is the **only** thing Fit-Twin needs to
personalise. It also adds fashion `Product`s linked to real dataset items
(`Product.fit_item_id`) so item-level matching works.

## 3b. How the size profile builds itself (no measurements)

`User.fit_size_profile` is derived from the shopper's **kept orders**, not from
any form:

* placing an order stores the chosen `size` on the `Order` (clothing has a size
  selector on the product page);
* `prevent/fit_profile.update_fit_size_profile(user)` runs on each order and
  recomputes `{category: median kept size}`, **excluding returned/cancelled
  orders** (those sizes didn't work);
* the Fit-Twin endpoint also rebuilds the profile lazily if a category isn't
  cached yet, so existing orders count immediately.

Seeded `fittwin*` users come with a profile from the dataset; real users grow one
as they shop. To rebuild every user's profile in bulk:

```powershell
python manage.py backfill_fit_profiles
```

## 4. Demo flow

1. Log in as `fittwin1@revive.test` / `revive123` (has a real size profile).
2. Open a seeded fashion product (dress / gown / top / jacket / romper).
3. The **"How this fits people your size"** card shows: `% who found a true fit`,
   the best-bet size, a runs-small/large badge, and chips of real shoppers'
   sizes + outcomes (green = true fit, orange = ran small, purple = ran large).
4. Log out (or use a fresh account) and open the same product → the card falls
   back to the aggregate signal ("X% of buyers found this true to size"). Still
   no questions asked.

## API

`POST /api/prevent/fit-twin/`
```jsonc
{
  "category": "dress",     // mapped to a dataset category
  "item_id": "2260466",     // optional (Product.fit_item_id) -> item-level
  "size": 12                // optional; if absent we use the logged-in user's
                            //   fit_size_profile, else the item's aggregate signal
}
```
Response: `{ available, scope, personalised, twins_found, good_fit, good_fit_pct,
recommended_size, direction, nudge, twins[] }`.
**No measurements are ever requested.**

## Files

| File | Role |
|---|---|
| `ml/fittwin/parsing.py` | defensive parsers for messy dataset strings |
| `ml/fittwin/build_index.py` | RTR dataset → cleaned records → `fittwin_index.pkl` |
| `ml/fittwin/match.py` | `find_fit_twins()` — size-based cohort + real fit outcomes |
| `backend/prevent/views.py` | `FitTwinView` (reads `fit_size_profile`; no body asked) |
| `backend/core/management/commands/seed_fittwin.py` | real demo users + fashion products |
| `frontend/src/components/stitch/FitTwin.jsx` | the fit card |
| `data/download_datasets.py` | `--fit` downloads the clothing-fit dataset |

## How it works (for judges)

For the cohort who bought this item (or category), we read the **real** fit verdicts
of shoppers near the buyer's usual size and recommend a size adjusted for how the
item runs (mostly "small" → size up). No body data is collected, no model is trained
on synthetic labels — every number traces to a real shopper's outcome. It's a
retrieval / nearest-by-size summary, the same family as fit engines like True Fit.
