# REVIVE v2 — Progress & Handoff (living doc)

> Shared context for any agent/model working on this repo. **Keep this updated as you finish work.** Repo root: `C:\projects\Hackon` (moved out of OneDrive). Design source of truth: **`final_idea_v2.md`**. Original idea: `final_idea.md`. Earlier analyses: `REVIVE_v2_PLAN.md`, `VERIFICATION_v2.md`.

## 0. What REVIVE is
AI decision engine for returned/unused products: identify product from catalog → grade condition → **Disposition Gate** decides destination (Restock-New / Open-box / Used / Renewed / Recycle) → two-stage EV routing with geohash demand-gravity → Product Health Card → Green Credits. Stack: Django REST (`backend/`), React+Vite (`frontend/`), ML in `ml/` (Django-free, importable).

## 1. v2 architecture decisions (LOCKED — see final_idea_v2.md §2, §6)
- **Two independent axes (not one "tier"):** (a) **Category Profile** (product type) drives photo prompts + grading rubric + condition labels — customer-facing; (b) **Risk Tier** (value × fraud-risk: LOW/MEDIUM/HIGH) drives verification depth + guarantee + route eligibility — **backend-only, never shown to customer**.
- **Disposition Gate is authoritative** for the destination; EV optimizer only picks the physical resell route. Sealed+verified → Restock as New (normal catalog, full price, NOT Revive). Opened grade-A → Open box. Used B–D → Revive. Grade D–E electronics / HIGH → Renewed (SPN). Grade F/unsafe → Recycle.
- **Grades extended A–F**: A/B/C/D cosmetic + **E (functional defect/parts)** + **F (recycle)**.
- **Storefront = two surfaces only: Revive + Renewed** (Warehouse/Returns tabs removed). Renewed = Amazon authorized-center refurb → **professional Health Card** (repairs, usage, warranty, NO AI grade). Revive = AI-scanned seller/return items → **AI Health Card** (AI grade + defects + seller photos + seller rating + guarantee).
- **Location**: ask once for permission (silent), use for nearest-first sort only. No persistent "deals near you" bar.
- **Pricing**: catalog-match sets MRP (seller doesn't type it) + system-suggested resale price (adjustable ±15%); per-defect deductions applied.

## 2. IMPLEMENTED (with files)
### ML (`ml/`) — unit-tested green earlier
- `category_profiles.py` — capture prompts / rubric / condition labels per category; `is_electronics`, aliases. (Q1/Q7/Q8)
- `risk_tier.py` — `risk_tier(mrp,category)`, `tier_int`, `tier_meta`. (Q5)
- `disposition.py` — disposition gate → outcome + condition_label + customer_message. (Q11)
- `geohash.py` — `geohash_encode/decode`. (location)
- `instance_match.py` — DINOv2 (CLIP fallback) instance match vs catalog ref; fails open w/o torch. (Q4)
- `image_dedup.py` — dHash duplicate-photo detection (dhash returns None on failure; 0 is valid). (Q6)
- `route.py` — wired risk_tier + disposition (AUTHORITATIVE) + grades E/F + electronics-only kirana block + per-defect price discount + restock_new price=mrp. Tries `price_keras` only if `REVIVE_USE_KERAS_PRICE=1`, else heuristic.
- `price_keras.py` — loads model1_best.keras+model2_best.keras+price_vectorizers.pkl; gated behind `REVIVE_USE_KERAS_PRICE=1` (so 2.3GB model never loads during scans by default). (Q3/perf)
- `notebooks/export_vectorizers.py` — regenerates the missing TF-IDF vectorizers from Mercari train.tsv (NO retraining) → `price_vectorizers.pkl`.

### Backend (`backend/`)
- `core/models.py`: User.lat/lng; Listing.risk_tier/disposition/condition_label, grades E/F, statuses paused/delisted; Product.rating/rating_count.
- Migrations: `0003_v2_fields.py` (applied), `0004_product_rating.py` (**needs `migrate`**).
- `core/views.py`: geohash-on-create, persists v2 route fields, **Near-me proximity sort**, `source=revive` group filter, `condition` filter, `grade_override`/`completeness_override` honored, **ManageListingView** (delist/pause/relist), **CatalogSuggestView** (`/api/catalog/suggest/`).
- `core/urls/listings.py`: routes for manage + catalog/suggest.
- `route/views.py`: `LocalDemandView` (`/api/route/local-demand/`), accepts grades E/F.
- `grade/views.py`: InspectAndRouteView wired **instance gate** + **duplicate-photo gate**; `skip_match=true` bypasses fraud/instance gate for seller's own item.
- `core/management/commands/import_amazon_data.py` — Amazon Reviews 2023 importer.

### Frontend (`frontend/src/`)
- `utils/categoryProfiles.js` — mirrors ml category profiles.
- `hooks/useLocation.js` — geolocation + localStorage persistence.
- `api/client.js` — manageListing, getLocalDemand, getMyListings, getStorefront, suggestCatalog.
- `pages/HomePage.jsx` — one-time location request, near-me sort, condition filter; LocationBar removed.
- `pages/MyListingsPage.jsx` — Delist/Pause/Relist buttons.
- `pages/GradingResultPage.jsx` (RETURN flow) — category-driven prompts + required-angle gate (multi-image grade already used here).
- `components/stitch/SellIt.jsx` — category-driven prompts; **grade ALL images** via "Grade my item" (gated on required angles); tier label hidden; electronics-only functional fields; **catalog match → MRP + suggested price**; passes grade_override.
- `components/Header.jsx`, `components/ProductFeed.jsx`, `components/Product.jsx` — storefront = Revive + Renewed only; badges "Revive"/"Renewed by Amazon".

## 3. LEFT TO DO
- **Health Card UI split (NOT done):** `frontend/src/components/stitch/HealthCard.jsx` still one design. Implement the TWO templates from final_idea_v2.md §6.2: (A) Renewed professional card (repairs/usage/warranty, no AI grade) when source=renewed; (B) Revive AI card (AI grade + defect photos + seller photos + seller rating + guarantee) otherwise.
- **Show seller photos + rating** on Revive Health Card / product detail (multi-angle photos currently only used for grading, not stored/displayed per-listing — need a ListingImage model or image array).
- **Review text**: importer stores rating + rating_count only. Add a `Review` model + import review jsonl if individual reviews are wanted.
- **Real demand index (Q10):** `ml/build_demand_index.py` still synthetic; feed real order/search history.
- **DINOv2 threshold calibration (Q4):** env `REVIVE_INSTANCE_THRESHOLD` default 0.55 — calibrate on real pairs.
- **S9–S11** (ops console, agent app, kirana app) — deferred.
- **Servable trained price model** — optional; see §5.
- **Restock-as-New path**: route returns chosen_path="restock_new"; backend create/return flow does not yet special-case it into the normal (New) catalog vs Revive — verify listing source/status handling.

## 4. TESTS TO RUN (on your machine — sandbox can't run reliably, see §6)
First: `cd backend && python manage.py migrate` then `python manage.py check`.
Then `cd frontend && npm run build`.

**A. Routing/disposition (most important — just changed, unverified at runtime):**
```python
# from repo root, after: pip env with ml importable
from ml.route import route_item
for g,c,m,sealed in [('B','Footwear',6000,False),('A','Phone',8000,False),
                     ('E','Phone',8000,False),('F','Apparel',1500,False),
                     ('A','Home & Kitchen',2500,True),('C','Footwear',3000,False)]:
    r=route_item('x',g,c,defects=[{'severity':'minor'}],geohash5='tdr1w',mrp=m,
                 sealed=sealed,opened=not sealed)
    print(g,c,m,'->',r['chosen_path'],r['disposition'],r['condition_label'],r['price'])
```
EXPECT (the bug fixes): B Footwear→`resell_p2p`/`resell_warehouse` (NOT donate); A Phone open-box→`resell_*` (NOT refurbish); E Phone→`refurbish`/RENEWED_SPN; F→`donate`/`recycle`; sealed Home&Kitchen→`restock_new` with price==MRP(2500); C Footwear→`resell_p2p`.
**If you see donate/refurbish for B/A, delete `__pycache__` (stale bytecode) and re-run.**

**B. Sell flow (SellIt):** list a **shoe** → must ask soles/insole, NEVER screen/battery; list a **phone** → screen-on + battery. Upload all required angles → "Grade my item" enables → grades the whole set. Uploading the same photo twice → duplicate warning. Catalog match dropdown fills MRP + suggested price (needs §5 data imported).

**C. Return flow (GradingResultPage):** returned shoe asks for soles (not screen); required-angle gate blocks scan; different shoe model → instance-mismatch message (DINOv2 downloads `facebook/dinov2-small` from HF once — needs internet).

**D. Storefront:** only **Revive** + **Renewed** tabs; location permission asked once; nearest-first ordering.

**E. My Listings:** Delist / Pause / Relist work and update status.

## 5. PRICE MODEL (.keras) — how to make it serve (optional)
`.keras` weights exist in `ml/artifacts/` but the TF-IDF vectorizers were never saved, so weights alone are unusable. To serve them:
1. `cd backend && uv add tensorflow nltk`
2. Run `ml/notebooks/export_vectorizers.py` on Kaggle (same Mercari train.tsv) → confirm printed dim == **150007** → download output to `ml/artifacts/price_vectorizers.pkl`.
3. Set env `REVIVE_USE_KERAS_PRICE=1` and restart backend. Log should show `[price_keras] Keras ensemble + vectorizers loaded.`
Default (no env) = fast catalog/heuristic pricing. RAM ~1GB for the models. Recommended for hackathon: keep heuristic, cite trained RMSLE≈0.42 as offline benchmark.

## 6. ENVIRONMENT GOTCHAS (critical for agents using the sandbox)
- **Sandbox bash mount LAGS behind file-tool (Edit/Write) edits** and can serve truncated/old copies of large just-edited files (observed `route.py` fluctuating 879–885 lines mid-sync). **The canonical files on disk (what your local Python/Read tool sees) are correct.** Don't trust a sandbox SyntaxError on a freshly-edited large file — verify by reading the file; run real tests locally.
- **Stale `.pyc` after the folder move:** Python may prefer old `ml/__pycache__/*.pyc`. If tests show old behavior, `rm -rf ml/__pycache__` (or `find . -name __pycache__ -exec rm -rf {} +`) and re-run. On the sandbox the pyc dir was read-only; use `PYTHONPYCACHEPREFIX=/tmp/x` to force fresh compile.
- Migrations 0003 applied; **0004 pending** (`python manage.py migrate`).

## 7. ISSUE → STATUS MAP (user's original Q1–Q11 + later feedback)
Q1 return prompts category-based ✅ | Q2 catalog price/match ✅ | Q3 delist ✅ | Q4 instance gate (DINOv2) ✅ | Q5 risk tier backend-only ✅ | Q6 dedup ✅ | Q7 category not tier ✅ | Q8 rubric+E/F ✅ | Q9 grade+defects in price ✅ | Q10 demand index ⚠️ synthetic | Q11 Revive/Renewed + 2 health cards ✅ design, ⚠️ HealthCard.jsx UI split LEFT.
Later: multi-image grade ✅ | grading speed (keras gated) ✅ | location once ✅ | storefront 2 tabs ✅ | real data importer ✅ | disposition-authoritative routing ✅ (just fixed, verify locally per §4A) | health-card UI split ❌ LEFT.
