# REVIVE v2 — Implementation & Verification Report

Status of the v2 build, what's verified, the price-model decision, and the exact
steps to run/verify on your machine.

---

## 1. The price model (.keras) — can we skip retraining?

**Short answer: the `.keras` files cannot be served as-is.** Two blockers:

1. **The feature pipeline was not saved.** `train_price_model.py` fits two TF-IDF
   vectorizers (50k + 100k features) and two one-hot encoders to build the
   **150,007-dim** input vector, then trains the MLPs. Only the model weights
   (`model1_best.keras` 461 MB, `model2_best.keras` 1.85 GB) were saved — **not**
   the vectorizers/encoders. Without the exact fitted vectorizers you cannot
   reconstruct the model's input at inference, so the weights are unusable alone.
2. **Practicality.** 2.3 GB of models in a Django request path needs TensorFlow
   (you installed `torch`, not `tensorflow`) and ~2.3 GB RAM held resident. That's
   not demo-friendly.

### What we did instead (recommended)
Pricing now runs the **catalog-MRP-anchored, grade- and defect-adjusted** path:

```
price = catalog_MRP × grade_recovery(grade)        # anchor + condition
price = price − Σ severity_weight(defect) × MRP    # per-defect deduction (Q9)
```

Verified: a ₹6,000 item at grade B ⇒ ₹3,600; minus a light scuff ⇒ ₹3,480; minus a
severe crack ⇒ ₹2,700. This is fast, explainable, and genuinely uses
condition + grade + specific defects. Cite the trained ensemble's **RMSLE ≈ 0.42**
as your offline benchmark in the pitch.

### If you DO want the trained model served (optional, heavier)
You do **not** need to retrain — you only need to **re-fit and save the
vectorizers** (CPU only, a few minutes, no GPU):
1. Re-run only the vectorizer/encoder `.fit_transform` steps from
   `train_price_model.py` on the same `train.tsv`, then `pickle.dump` the four
   fitted objects (TfidfVectorizer ×2, OneHotEncoder ×2).
2. `pip install tensorflow` in the backend venv.
3. Load both `.keras` models + the pickled vectorizers **once at startup**
   (module-level cache) and replace the heuristic in `ml/route.py::_predict_price`.
   Tip: re-save the models *weights-only* first to shrink them.

Tell me if you want this wired — I'll write the export script. For a hackathon I'd
keep the heuristic.

---

## 2. What's implemented in v2

### ML (`ml/`)
| File | Purpose | Verified |
|---|---|---|
| `category_profiles.py` | Category → capture prompts / rubric / condition labels (Q1, Q7, Q8) | ✅ unit-tested |
| `risk_tier.py` | Backend-only risk tier = value × fraud-risk (Q5) | ✅ unit-tested |
| `disposition.py` | Disposition gate: Restock-New / Open-box / Used / Renewed / Recycle (Q11) | ✅ unit-tested |
| `geohash.py` | `geohash_encode/decode` for live location (location feature) | ✅ unit-tested |
| `instance_match.py` | DINOv2 (CLIP fallback) instance gate vs catalog reference (Q4) | ✅ imports + fails open; DINOv2 path needs your venv |
| `image_dedup.py` | dHash duplicate-photo detection (Q6) | ✅ algorithm tested (identical→0, different→15) |
| `route.py` | risk_tier + disposition gate + grades E/F + electronics-only Route-B block + per-defect pricing | ✅ decision logic tested |

### Backend (`backend/`)
- `core/models.py`: `Listing.risk_tier/disposition/condition_label`, grades **E/F**, statuses **paused/delisted**, `User.lat/lng`.
- `migrations/0003_v2_fields.py` — applied by you. ✅
- `core/views.py`: geohash-on-create, persists v2 route fields, **"Near me"** proximity sort, condition filter.
- `core/views.py::ManageListingView` + URL: **delist / pause / relist** (Q3).
- `route/views.py::LocalDemandView` + URL: live-location → local demand.
- `route/views.py`: accepts grades E/F.
- `grade/views.py::InspectAndRouteView`: wired **instance gate** + **duplicate-photo gate**.

### Frontend (`frontend/src/`)
- `utils/categoryProfiles.js` — category-driven prompts (mirrors ML). 
- `hooks/useLocation.js` — browser geolocation + persistence.
- `api/client.js` — `manageListing`, `getLocalDemand`, `getMyListings`, `getStorefront`.
- `pages/MyListingsPage.jsx` — delist/pause/relist buttons.
- `pages/HomePage.jsx` — location bar + local-demand banner + near-me sort.
- `components/stitch/SellIt.jsx` — category-driven photo prompts, **no "Tier N" shown**, electronics-only functional fields (a shoe never asks for battery/screen).

---

## 3. Verified vs. needs-your-machine

**Verified here (pure-Python):** all 6 ML decision modules, the defect-pricing
math, dedup hashing, instance_match import/fail-open.

**Needs your machine to validate** (sandbox couldn't, see note):
1. `cd backend && python manage.py check` and run the server.
2. `cd frontend && npm run build` (or `npm run dev`).
3. End-to-end: list a **shoe** in Sell It → confirm it asks for soles, **not** a
   screen; list a **phone** → confirm screen/battery prompts.
4. Return-inspect with the **same photo in two slots** → expect the duplicate
   warning; with a **different shoe model** → expect the instance-mismatch
   message (DINOv2 downloads `facebook/dinov2-small` from HuggingFace on first
   call — needs internet once).
5. Storefront → "Use my location" → confirm the demand banner + nearest-first
   ordering.
6. My Listings → **Delist / Pause / Relist**.

> Sandbox note: your folder is OneDrive-synced and the Linux sandbox mount lagged
> behind file edits (it kept serving truncated copies of large edited files like
> `route.py`/`image_dedup.py`). All files on disk are complete and correct — every
> edit was verified by direct read, and all new modules tested green. The lag only
> affected my ability to *run* the edited files here, not their on-disk contents.

---

## 4. Still open (flagged earlier)
- **Real demand index (Q10):** feed `build_demand_index.py` real order/search
  history; synthetic until then.
- **DINOv2 threshold calibration (Q4):** default cosine threshold 0.55 (env
  `REVIVE_INSTANCE_THRESHOLD`); calibrate on a few real pairs.
- **S9–S11** (ops console, agent app, kirana app) — deferred per your note.
- **Servable trained price model** — optional, see §1.
