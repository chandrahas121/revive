# REVIVE v2 — Progress & Handoff (living doc)

> Shared context for any agent/model working on this repo. **Keep this updated as you finish work.** Repo root: `C:\projects\Hackon` (moved out of OneDrive). Design source of truth: **`final_idea_v2.md`**. Original idea: `final_idea.md`. Earlier analyses: `REVIVE_v2_PLAN.md`, `VERIFICATION_v2.md`.
> NOTE: working copy is under `...\OneDrive\Documents\amazon-hackon`. OneDrive has since been **quit** (user confirmed); the mid-merge corruption documented below is resolved. Sandbox bash may still lag behind file-tool writes — that's a sandbox artifact, not disk corruption.

> ## ⚡ CURRENT STATE (read first)
> Pillars 1/2/3/5 integrated; app builds. **Storefront is now driven by a self-contained curated demo catalog (`seed_demo`) — now ~172 products balanced across Phone/Laptop/Footwear/men's-Apparel (172 New · 30 Revive · 18 Renewed).** Product pages show **real customer reviews fetched from the Amazon Reviews 2023 dataset** (Amazon-style summary + star breakdown + review list; see 2026-06-15d log). **Pillar 4 Fit-Twin is now wired into the demo catalog** — every apparel product carries a real Rent-the-Runway fit item, demo@revive.in has a fit profile, and "How this fits" shows on clothing only (not shoes); see 2026-06-15e. The Amazon *metadata* catalog import is DEPRECATED/removed from the demo path (it was women-heavy + only-electronics-renewed) — but the *review* dataset is now used via `data/download_reviews.py`. Numbered-page pagination + title/brand search. Sell-It is catalogue-free (type name + original price) and the **trained `.keras` price model serves the resale suggestion**, MRP-anchored + per-defect, adjustable ±20%. Both Health Cards live.
> **Staged second-life LIFECYCLE (2026-06-15c):** returns/listings are NOT instantly live — they walk a disposition-driven track (`core/lifecycle.py`): Renewed = pickup→refurbishing→certified-live→sold; Revive = held-local(awaiting demand)→live→sold; sealed→Restock-New (exits); dead→recycle/donate. Return flow stages the item via `POST /api/returns/process/`; demo `POST /api/listings/<id>/advance/` steps stages on camera. Staged items show in the storefront with a `⏳` badge but aren't buyable until live. Timeline UI: `frontend/.../LifecycleTimeline.jsx` (on the return result + product page + the [Demo] advance button).
> **To run the demo on your machine:**
> ```bash
> python data/download_reviews.py                   # once: pull real Amazon reviews → data/reviews_*.jsonl
> cd backend && python manage.py migrate
> python manage.py seed_demo --revive 30 --renewed 18   # ~172 products + real reviews
> cd ../frontend && npm run build                  # or npm run dev
> ```
> Trained price model: `REVIVE_USE_KERAS_PRICE=1` is set in `backend/.env`. It loads ~2.3 GB on the **first** Sell-It grade (~20–35 s) → **pre-warm before recording** (start backend, grade one throwaway item). Unset/0 = fast heuristic, no model load. (`seed_demo` forces it off so seeding stays fast.)
> Logins: buyer `demo@revive.in / demo12345`, sellers `*.seller@revive.in / seller12345`.

## SESSION LOG — 2026-06-15e · Fit-Twin integrated into the seed_demo catalog (real RTR data, clothing-only)

User ask: integrate Fit-Twin against **this** clothing-fit dataset, verify it works, set it up for **demo@revive.in**, and make "How this fits" show **only in the clothing section** (not shoes).

**What was wrong before.** Fit-Twin's index is real (192,544 rows from the full `data/renttherunway_final_data.json`), but it was wired to the *old* `seed_fittwin` demo (which made its own RTR dress/gown products + `fittwin*@revive.test` users). On the current `seed_demo` catalog the apparel products had **no `fit_item_id`** (so every item fell back to the same category cohort), `assign_fit_items` didn't recognise the `"apparel"`/`"Footwear"` categories at all, the menswear letter banding sent almost everything to **XXL**, and the card also rendered on **shoes**.

**Fixes**
- **Letter sizing recalibrated** (`ml/fittwin/match.py`): RTR is women's numeric sizes; the fixed `≤16→XL` cut clumped the large dress sizes at XXL. Bands are now **data-driven (quantile cuts on the index's own size distribution)** and the recommendation is the band of the **median true-fit size** (not the single highest-rate band, which jumped to sparse extremes). Verified spread over the 40 highest-volume items: **L:26 · M:9 · XL:3 · S:2** (centred on M/L, believable for menswear) — was all-XXL.
- **`assign_fit_items`** now recognises `"apparel"` (footwear deliberately excluded — shoes don't use the S–XXL model).
- **`seed_demo` integration** (step 2c): calls `assign_fit_items --all` so **all 40 apparel products get a distinct real RTR item** (item-level fit), and seeds **demo@revive.in** a cross-category fit profile `{dress:8, gown:10, sheath:8, top:6}` so the advice is **personalised** (no measurements). Verified: apparel items return `available=True`, `twin_mode=body` with **80 behavioral twins**, real recs (M/L) + direction; footwear keeps an empty `fit_item_id`.
- **Clothing-only in UI** (`ProductDetailPage.jsx`): new `isApparel()` (clothing keywords **minus** footwear) now gates the `FitTwin` card, so "How this fits" shows on shirts/tees/jeans/jackets but **not on shoes**.
- **Brand sizing bias** (`prevent/fit_profile.py`): fixed the `"u.s. polo assn."` key (was `"us polo assn."` → never matched) and added the new catalog brands (Van Heusen, Louis Philippe, Tommy Hilfiger, Jack & Jones, Pepe Jeans, Raymond, Wrogn, Spykar, Flying Machine, Park Avenue).

**Verified:** `manage.py check` 0 · `seed_demo` clean (40 apparel fit items assigned) · Fit-Twin API as demo@revive.in returns personalised item-level recs on apparel and is absent on footwear · brand-bias resolves for the catalog brands · `vite build` clean. (The old `seed_fittwin` command still exists for the standalone RTR demo; the live storefront path is now `seed_demo`.)

## SESSION LOG — 2026-06-15d · Real Amazon reviews + ~150-product balanced catalog

User ask: items + their reviews should display **like Amazon does**, with the review text **fetched from the Amazon reviews dataset**; categories phones / men's clothing / shoes / laptops. Plus: grow the catalog to **~100–200 products balanced across categories**, listed across New / Revive / Renewed (most in New).

**A. Real reviews from the Amazon Reviews 2023 (UCSD/McAuley) dataset.**
- **NEW `data/download_reviews.py`** — streams the raw per-category review `.jsonl.gz` (multi-GB) over HTTP and **early-stops** after N usable reviews per *storefront bucket*, so we pull a few MB not GB. Buckets: `phone`→Cell_Phones_and_Accessories, `laptop`→Electronics, `footwear`/`apparel`→Clothing_Shoes_and_Jewelry. Each kept review is keyword-relevance + length filtered, mojibake (`U+FFFD`→`'`) and `<br/>` cleaned. Output: `data/reviews_<bucket>.jsonl` (`rating,title,text,author_id,asin,verified,helpful,timestamp`). **Ran it: 2300–2400 real reviews across the 4 buckets.**
- **NEW `core.models.Review`** (FK→Product: author, rating, title, body, verified_purchase, helpful_votes, review_date, source_asin) — migration **`0008_review`**. Authors are anonymised in the dataset, so a deterministic "Firstname L." display name is derived from the opaque `user_id` (mixed IN/US pool).
- **`seed_demo._seed_reviews`** attaches the real reviews to products **by category**. Real review TEXT is 100% authentic, but each product's set is composed by **dealing each real star-bucket round-robin** across all products in the category (low-star buckets capped) so every item gets the same believable Amazon positive-skew — verified: **all products 4.2–4.7★, ~15 reviews each** (no more flagship-at-2.7★ clumping). Product `rating` is recomputed from its real reviews; `rating_count` stays the large catalogue figure (Amazon shows far more ratings than written reviews).
- **API**: `ListingDetailView` now returns `ratings` (`average`, `total`, `review_count`, 5→1 `breakdown`) + `reviews` (top 30, most-helpful first via `Review.Meta.ordering`). New `ReviewSerializer`.
- **UI** (`ProductDetailPage.jsx`): real aggregate replaces the hardcoded "142 ratings / 4 stars" (partial-fill `Stars` component + click-to-scroll); a full **"Customer reviews"** section = rating summary + 5★→1★ breakdown bars + review list (avatar, name, stars, bold title, "Reviewed on <date>", **Verified Purchase**, body, "N people found this helpful").

**B. Bigger balanced catalog.** `_demo_catalog.py` expanded **57→172 products**, balanced across the hero categories: **Phone 40, Apparel 40 (men's tees/shirts/pants/jackets), Laptop 38, Footwear 38**, + Monitor 8 + a few Home/Books/Toys. `seed_demo --revive 30 --renewed 18` → **172 New · 30 Revive · 18 Renewed · 48 cards** (most in New, as asked).

**Verified:** `manage.py check` 0 · `makemigrations`/`migrate` clean (0008) · `seed_demo` clean (counts above, ratings 4.2–4.7) · detail API returns ratings+reviews (sample verified) · `vite build` clean (1896 modules).

**Addendum — reviews now MATCH the product (meta-title grounding).** First cut matched reviews only by category, so an apparel product could show women's pantyhose/panties and a phone could show case/tripod reviews. Fixed: `data/download_reviews.py` rewritten to **ground each product's identity in the dataset's real product TITLE (meta_categories)** — it streams the meta file, keeps a large pool of ASINs whose *title* is genuinely the right product type (need/avoid whole-word rules, e.g. a real "smartphone" not a "case/band"), then joins the review file by `parent_asin` to attach **that exact ASIN's real reviews**. `seed_demo._seed_reviews` then gives each demo product ONE real product's review set (coherent, no cross-product mix), matches apparel **garment sub-type** (tee↔tee, jeans↔jeans, shirt↔shirt, jacket↔jacket) via the real title, and drops accessory/wrong-item ASINs (belts, shoe-care, intimates) with a `ptitle` gate. Result: **Footwear / Apparel / Phone show real matching products** (CAT/KEEN/New Balance shoes; Fruit-of-the-Loom/IZOD/Goodthreads men's tops; Samsung/Honor smartphones). **Laptop is a known weak spot** — the Electronics file is dominated by laptop *accessories* ("Laptop Desk/Docking Station") so few real laptops survive; left as-is per scope. Each review row now also carries `ptitle` (the real product title) in the JSONL for classification.

**Re-run on your machine:** `python data/download_reviews.py` (once, pulls the real reviews) → `cd backend && python manage.py migrate && python manage.py seed_demo --revive 30 --renewed 18`. `seed_demo` skips review seeding gracefully if the `data/reviews_*.jsonl` files aren't present.

## SESSION LOG — 2026-06-15c · Laptop regrade bug + staged second-life LIFECYCLE (returns don't go live instantly)

Two asks: (1) a laptop "Re-grade" in Sell-It showed **B at 0% confidence / no grading**; (2) verify routing vs plan + make the return→second-life flow real & demoable (it was "return → instantly in Revive/Renewed", which isn't real-world).

**Bug 1 — laptop regrade (fixed, 3 layers).** `skip_match=true` (seller's own item) correctly bypasses the match/instance gates, but the **duplicate-photo gate still ran**; a laptop's flat metallic angles (lid/base/ports) hash within the loose `DUP_HAMMING_THRESHOLD=6` → false "same shot" → a `{duplicate_photos:true}` response with **no `grade`** → frontend rendered `GRADE_CONFIG[undefined]||B` at 0%. Fixes: threshold 6→**3** (`ml/image_dedup.py`); dedup hard-block now **returns-only** (`and not skip_match`, `grade/views.py`); SellIt `runGradingMulti` now **guards on missing `res.data.grade`** and shows the gate message instead of a fake card.

**Routing verification.** `route.py` matches v2 §10 (Disposition Gate authoritative; EV picks only the physical resell route; risk-tier electronics-kirana block). **Gap found & fixed:** the inspect view passed `condition_signals` only into *pricing* — disposition kwargs (`sealed/opened/complete/functional_pass`) stayed at defaults, so **Journey 4 (sealed return → Restock-New) could never fire** and `functional`/`completeness` didn't drive disposition. Now wired in `grade/views.py` (sealed←`seal_intact`, complete←`completeness≥0.8`/accessories, functional_pass←`functional`).

**Real-world research (validated user's instinct).** High-value used/defective → certified refurb (Amazon Renewed via SPN) → warehouse → sold (inspection/refurb cost justified). Low-value as-is returns are **not warehoused** (inspect+store > recovery — why retailers liquidate/destroy). REVIVE's differentiator: keep it **local, activate only on geohash demand** — no warehouse glut.

**Staged LIFECYCLE (new — the headline change).** A return/listing is no longer instantly live; it walks a disposition-driven track:
- `core/lifecycle.py` (single source of truth; mirrored conceptually in `frontend/.../LifecycleTimeline.jsx`). Tracks: **renewed** = Pickup scheduled → Refurbishing → Certified & live → Sold; **revive** = Held locally (awaiting nearby demand) → Live near you → Sold; **restock** = Back as New (exits); **exit** = Recycled/Donated.
- Model (`core/models.py`): new `Status` = `REFURB_SCHEDULED / REFURBISHING / AWAITING_DEMAND` (migration `0007`).
- Endpoints (`core/views.py` + `core/urls/listings.py`): `POST /api/returns/process/` turns a graded return into a **staged** Listing (re-runs `route_item` authoritatively, sets source + first-stage status, marks order RETURNED); `POST /api/listings/<id>/advance/` = **demo control** to step a listing to its next stage. Storefront list now includes staged statuses (visible w/ badge, **not buyable** — order create still requires `listed`). `ListingSerializer` exposes `lifecycle`.
- Frontend: `LifecycleTimeline` stepper; `GradingResultPage` "Confirm handover" now **stages the item** and shows "what happens next" + track link (disposition-aware routing subline too); storefront cards show a `⏳ stage` badge and swap Add-to-Cart for "track it" when staged; `ProductDetailPage` shows the timeline + **[Demo] advance-stage** button and disables buying while staged; `MyListingsPage` status chips for the new stages.

**Verified:** `manage.py check` 0 · `vite build` clean · Python check (sealed→RESTOCK_NEW, opened-A→OPEN_BOX, dead-screen→RENEWED_SPN, used→USED_P2P, F→RECYCLE/donate; all 4 tracks chain correctly) · **APIClient integration test**: iPhone(dead)→renewed `refurb_scheduled→refurbishing→listed→sold`, Nike(used)→revive `awaiting_demand→listed→sold`, Blender(sealed)→restock `listed`(source=new), order→returned. Temp tests removed.

**Demo narration:** return a phone → grade → "scheduled for refurbishment" (NOT live) → open it in Renewed (shows Refurbishing, not buyable) → tap **Demo: advance stage** twice → it certifies & goes live → buy it. Return a shoe → "held locally, awaiting nearby demand" → advance → "Live near you" → buy. Return a sealed item → "back as New" (rejoins catalog, never enters Revive).

**Addendum 3 — Health Card gated to second-life + Green Credits wired live.** (1) New catalogue items wrongly offered a "View Product Health Card" button (clicking 404'd then rendered a fake Revive card from props); now gated on `!listing.is_new` in `ProductDetailPage` — Health Card is a second-life-only artifact. Card impl itself verified sound: tamper-evident `card_hash` (SHA-256 of payload), append-only hash-chained `LedgerEntry` (UPDATE/DELETE blocked at model level), two source-aware designs (Revive AI vs Renewed professional). (2) Green Credits backend (wallet/vest/redeem/donate) was correct but **earning + spending weren't wired into live flows** — `kind='earn'` existed only in seed scripts, and the checkout redeem toggle only previewed the discount without committing the spend. Added `green/credits.py` (`award_keep_credits` / `cancel_pending_credits` / `credit_amount`, mirroring `utils/tier.js`): placing an order now creates a **PENDING earn** (vests at return-window close), returning an order **cancels** it, and checkout now calls `redeemCredits(commit:true)` so the **balance actually drops**. Integration-tested: buy Footwear ₹8000 → +40 pending; redeem → spend recorded; return → pending cancelled. The 20% cap is on discount-rupees (1 credit = ₹0.10).

**Addendum 2 — Keras price loader hardened (WinError 32).** Loading the `.keras` ensemble unpacks weights to a temp dir that lands in `ml/artifacts/` and got locked on Windows (`[WinError 32] model.weights.h5 used by another process`) — leftover `tmp*` dirs + antivirus/handle locks — so pricing silently fell back to the heuristic. `ml/price_keras._ensure_loaded` is now **thread-locked**, **cleans stale `ml/artifacts/tmp*` before loading**, and **retries once** on `OSError/PermissionError`. Verified: model loads in ~50s, `predict_price_inr` returns a value (raw signal then MRP-anchored in `route.py`). Still pre-warm once before recording. (Grading itself always ran end-to-end; only the trained-price load was falling back.)

**Addendum — Grounding DINO restored + Sell-It submit feedback.** DINO was returning empty detections: the venv had **transformers 5.12.0**, which is incompatible with the `grounding-dino-tiny` checkpoint (all `bbox_embed` keys load as MISSING → meta tensors → "Cannot copy out of meta tensor"). Pinned **`transformers>=4.44,<5`** (`ml/requirements.txt`) and installed `4.57.6` via `uv pip install --python .venv/Scripts/python.exe` (note: this venv has **no pip**, use **uv**; `huggingface-hub` auto-downgraded to 0.36.2). Verified DINO loads + runs and DINOv2/instance-match deps still import. CLIP is `openai-clip` (independent of transformers). **The running dev server must be restarted** to pick up the downgrade. Also: Sell-It tier-3 "Schedule Professional Inspection" looked dead — a required field (battery %/declaration) failed validation but the error only showed at the top of a long form; now errors also render next to the submit button and scroll into view.

## SESSION LOG — 2026-06-15b · Pillar 1 grading made multi-angle + category-aware, fed into pricing

The grader DID aggregate all angles for the GRADE (worst-grade-wins) but the output looked single-image, and it never used the category-specific checks (tags/box/screen-on). Fixed end-to-end.

**Root causes found**
- `condition_summary` was copied from only the single best-confidence frame → looked like one image was read.
- The LLM prompt was category- and angle-blind → box/tag/screen-on were never actually checked.
- Aggregated defect bboxes from different angles were all drawn on the COVER image (wrong positions).

**What changed**
- **Category + angle aware VLM prompt** (`ml/captioner.py`): `caption()` now takes `category`+`slot`, injects a category rubric + per-angle focus (a SOLE photo → tread wear; SCREEN-ON → powers_on; TAG → tags_present), and asks for new JSON fields `tags_present / accessories_present / powers_on / seal_intact` (null when not judgeable from that angle). Prompt building centralised; backends take the built prompt; cache key now includes category+slot. Verified live against OpenRouter (5.6s, real response, new fields present).
- **Slot-focus helpers** (`ml/category_profiles.py`): `slot_focus`, `slot_signal`, `grading_instructions(category, slot)`.
- **Slot-aware grading + aggregation** (`ml/grade.py`): `grade_image(..., angle)`; `grade_multi_image(images, slots, slot_labels)` grades each photo with its angle. New aggregation: worst-grade-wins; defects tagged with `angle`+`image_index` (deduped per type+angle); condition signals combined across angles (`_tri_state`); `functional` also fails if `powers_on` is False; **condition_summary SYNTHESIZED across all angles** ("Inspected 3 angles: Side… Soles… Box… Condition checks: tags attached, box included"); returns `per_angle` + `condition_signals`.
- **View** (`backend/grade/views.py`): reads `slots`, passes them in; renders a **per-angle defect map** (each image drawn with its OWN defects — fixes the wrong-bbox-on-cover bug) → `angle_heatmaps`; passes `condition_signals` to `route_item`.
- **Grading → Mercari pricing** (`ml/price_keras.py` + `route.py`): the trained model's main feature is `item_condition_id` (1=New…5=Poor) plus name/brand + category TF-IDF text. New `_effective_condition(grade, signals)` refines that id from the grading signals — grade A **with tags/box/accessories + functional → New(1)**; A missing accessories → Like-new(2); not functional → Poor(5). Threaded `condition_signals` through `route_item → _predict_price → predict_price_inr`. So the detailed grade now visibly moves the price.
- **Frontend** (`SellIt.jsx`, `GradingResultPage.jsx`): send a `slots` field per image; show **category condition chips** (✓/✕ Original tags / box / Powers on / Accessories) and a **multi-angle defect-map strip** ("N angles inspected"), with defect chips tagged by angle.

**Verified:** `manage.py check` 0 issues · `vite build` clean · ML structural test (3-angle aggregation → worst grade C, per-angle defects, synthesized summary, signals, effective-condition mapping all correct) · live caption() returns the new schema.

## SESSION LOG — 2026-06-15 · Curated demo catalog, pagination/search, catalogue-free Sell-It + trained pricing

Fixed the two demo blockers the user reported (bad dataset seeding; broken Sell-It pricing).

**A. Seeding & storefront**
- **NEW `core/management/commands/seed_demo.py`** — self-contained, reads **no dataset files**. Builds the whole store from `_demo_catalog.py` (every product → one NEW listing), then pre-classifies a subset as second-life **on the same products** (buying options): Renewed = balanced phones/laptops/**monitors** (round-robin so monitors actually appear, not just top-by-MRP laptops); Revive = balanced tees + shoes + a few open-box electronics. Generates Health Cards; seeds returnable demo orders (phone/laptop/monitor/t-shirt/shoes) + credits. Verified: **57 products · 57 New · 16 Revive · 10 Renewed · 26 cards**; Renewed = Monitor:4/Laptop:3/Phone:3, Revive = Apparel:7/Footwear:6 + open-box. No women data.
- `_demo_catalog.py` — added **6 Monitors** (category `"Monitor"`) + a few Home/Books/Toys extras for variety.
- **Monitor category profile** added to `ml/category_profiles.py` + `frontend/src/utils/categoryProfiles.js` (screen-on/ports/stand prompts, `is_electronics`), aliases monitor/display/screen, added to `SELLABLE_CATEGORIES`. Electronics checks key off `is_electronics()` so Monitor escalates correctly in `risk_tier`.
- **Numbered-page pagination** in `core/views.py` `ListingListView` (page/page_size → count/num_pages, applied in BOTH the normal and near-me branches — the near-me branch previously hard-capped at 40 with no paging, the real "all on one page" cause). **Search** now matches title OR brand (`Q`).
- Frontend: `HomePage.jsx` drives `page` via URL + resets on search/filter; `ProductFeed.jsx` renders an Amazon-style numbered pager (Prev · 1 … N · Next).
- **`seed_real.py` / `import_amazon_data.py` / `download_datasets.py` / `data/meta_*.jsonl` are DEPRECATED** (left in repo, no longer used; safe to delete).

**B. Sell-It (catalogue-free) + trained-model pricing**
- `SellIt.jsx`: removed the catalogue auto-complete dependency — seller types **product name + original price** freely (categories incl. Monitor). Price now comes **after** grading: `runGradingMulti` sends `mrp` + `expected_title` + `geohash5` to `/api/grade/inspect/`, reads `route.price` (the trained-model resale price) → pre-fills asking price, adjustable **±20%** (clamped on submit).
- Wired the trained model end-to-end: `route_item`/`_predict_price` now accept `title`/`brand` and pass them to `price_keras.predict_price_inr`; `grade/views.py` passes `expected_title`. `REVIVE_USE_KERAS_PRICE=1` in `.env`.
- **Important fix:** the Mercari `.keras` ensemble predicts an absolute US-marketplace price that ignores MRP magnitude (a like-new iPhone came back at ₹5.4k). Per §4.1 it's a *market signal* → `_predict_price` now **anchors it on catalog MRP** via the grade-recovery curve (`0.70*anchor + 0.30*model`, clamped 8–92% MRP); per-defect deductions still applied after. Verified credible: A iPhone 69,900→₹39,787 (57%), C iPhone+defect→₹17,915 (26%), B Laptop→₹23,921 (44%), B Monitor→₹11,083 (44%), A Nike→₹7,934 (61%). Grade+defects clearly drive the price.

**Verified this session:** `manage.py check` 0 issues · `seed_demo` clean (counts above) · `vite build` clean (1894 modules) · Keras ensemble loads (TF/nltk/scipy present) and serves anchored prices via `route_item`.

## SESSION LOG — 2026-06-14 · Integrate Pillars 1/2/3/5 (UNBLOCKED)

The repo was stuck **mid-merge** (`git status`: "All conflicts fixed but you are still merging") with conflict markers physically left in files that had been `git add`-ed without resolving, **plus** OneDrive had **corrupted ~10 source files** (silent truncation + one NUL-byte padding). This made the whole app fail to build and `ml/route.py` fail to import. Fixed everything needed to get Pillars 1/2/3/5 integrated and building.

**What was fixed**
- **Merge conflicts resolved (kept v2 / commit `433e6bf` side):** `ml/route.py` (10 blocks — disposition gate, risk_tier, keras-gated pricing, restock_new, electronics-only kirana block, per-defect discount), `GradingResultPage.jsx` (required-angle gate), `MyListingsPage.jsx` (delist/pause/relist), `ProductDetailPage.jsx` (kept HEAD side here — VTON price/grade props are actually used by `VirtualTryOn.jsx`).
- **OneDrive-corrupted files restored from the git index (`git show :0:<f>`):** `frontend/src/api/client.js`, `components/Header.jsx` (NUL padding), `components/Product.jsx`, `components/ProductFeed.jsx`, `components/stitch/SellIt.jsx`, `components/stitch/VirtualTryOn.jsx`, `pages/HomePage.jsx`, `pages/LoginPage.jsx`, `pages/SignupPage.jsx`, `pages/CheckoutPage.jsx`. (Conflict-marker files were re-resolved from the canonical git blob, not the laggy mount.)
- **Migration conflict fixed:** two leaf nodes (`0004_order_size` + `0004_product_rating`) → created **`core/migrations/0005_merge_0004_order_size_0004_product_rating.py`**. Migrations now apply cleanly in a linear graph.

**Verified this session**
- `ml/route.py` parses + `route_item()` matches §4A expectations exactly (B Footwear→resell_p2p/USED_P2P, A Phone→resell_p2p/OPEN_BOX, E Phone→refurbish/RENEWED_SPN, F→donate, sealed H&K→restock_new @ MRP, C Footwear→resell_p2p).
- **Frontend `vite build` succeeds — 1894 modules, clean** (the only error is an EPERM deleting OneDrive-locked `frontend/dist/`; build to a fresh `--outDir` is clean).
- **Backend `manage.py check` → 0 issues.** All ml modules (`grade, recommend, disposition, risk_tier, category_profiles, geohash, build_demand_index`) parse + import.
- Cross-pillar wiring confirmed: `grade/views.py` orchestrates grade→`route_item`; `trust/` card generate/get/verify/qr/ledger; `green/` wallet/vest/redeem/donate; `core` `RecommendView`. `api/client.js` exposes every endpoint the pages call.
- `check_pillar2.py` shows 12/15; the 3 "fails" are **stale v1 assertions** (price-tier vs risk-tier, HIGH-always-refurbish) that v2 deliberately changed — not regressions.

**Run on your (non-OneDrive) machine to finish DB setup**
- `cd backend && python manage.py migrate` (sandbox couldn't write the OneDrive sqlite — "disk I/O error"; migrations proven to apply against a local copy).
- `python data/check_pillar1.py` needs OpenRouter key + one-time DINO/DINOv2 HF download (network).
- **Don't re-run the old keep-theirs bash scripts** — the OneDrive mount served truncated copies; all edits here were written to canonical disk / from the git blob.

**Still open after this session:** Health Card UI split (two templates) — see §3; everything else in §3 unchanged.

## SESSION LOG — 2026-06-14e · Guaranteed branded demo catalog

Added `core/management/commands/_demo_catalog.py` — 43 guaranteed branded products (Samsung/Vivo/Apple/OnePlus/Xiaomi/Realme phones, Dell/HP/Lenovo/Apple/ASUS laptops, Nike/Adidas/Puma/Reebok/Skechers/Bata shoes, and Allen Solly/US Polo/Levi's/Van Heusen/etc. tees/shirts/pants). `seed_real` now upserts these (always) right after the real import. They carry a very high `rating_count`, so the popularity sort AND the second-life curation surface them first — guaranteeing the demo shows Samsung/Vivo/Apple as **Renewed**, Nike/Adidas shoes + branded apparel as **Revive**, and that Sell-It catalog search reliably finds Nike/Vivo/Samsung/Dell/Levi's/etc. Verified end-to-end (real data + demo) — clean run, brands present + curated.

**Final demo seed command** (uses everything in `data/meta_*.jsonl`):
```bash
cd backend && python manage.py migrate
python manage.py seed_real --per-file 4000 --revive 50 --renewed 25
```
For even more phones/laptops/shoes/apparel, delete the relevant `data/meta_*.jsonl` and re-download with a bigger cap (downloader skips existing files):
```bash
python data/download_datasets.py --meta --category Phones      --max-items 8000
python data/download_datasets.py --meta --category Electronics --max-items 8000
python data/download_datasets.py --meta --category Clothing    --max-items 8000
```
`seed_real` rebuilds the DB from the downloaded files each run — your downloaded data is never deleted.

## SESSION LOG — 2026-06-14d · Real-Amazon storefront + seller photos

Fixed the "everything is Revive/Renewed" problem: the store now looks like real Amazon — a NEW catalog by default, with only a curated minority listed as second-life.

**Model / backend**
- `Listing.Source.NEW = 'new'` added; `grade` now `blank=True`; new `Listing.images` JSONField (seller angle shots). Migration **`core/0006_*`** (run `migrate`).
- **Every product → one New listing at MRP.** `ListingListView`: no `source` → New catalog (popularity-sorted, 120); `source=revive` → p2p/return/warehouse; `source=renewed` → renewed; `source=all` → everything.
- `ListingSerializer` adds `is_new`, `mrp`, `images`, and `second_life` (a New tile's "Used/Renewed from ₹X" summary). `ListingDetailView` adds `buying_options` (New + second-life on the same product, New first). Live Sell-It POST now persists uploaded photos to `Listing.images`.

**Seed (`seed_real`)**
- Imports the FULL catalog as New, then **curates only ~60 second-life** (default `--revive 40 --renewed 20`): Renewed = high-value electronics (certified, no seller); Revive = a category-spread with seller angle photos. The rest stay New. Grades are only on the curated set — New items are ungraded (real grading stays the live AI demo).
- Verified on the REAL downloaded data: **1685 products → 1685 New · 40 Revive · 20 Renewed · 60 cards.** API check: All=120 New, Revive=40, Renewed=20, search filters New, a New tile returns buying_options [New, Used] + a `second_life` summary.

**Frontend**
- `Product.jsx`: New tiles (no grade badge, real rating + count, "Used/Renewed from ₹X") vs second-life tiles (grade + Revive/Renewed badge + strikethrough MRP/% off).
- `ProductFeed.jsx`: tabs All / Shop Revive / Renewed with surface-aware heading.
- `ProductDetailPage.jsx`: buying-options block in the buy box + a seller-photos strip.
- `HealthCard.jsx` Revive card: seller-photos strip.
- Frontend `vite build` clean; `manage.py check` 0 issues.

> **You must re-run on your machine:** `python manage.py migrate` then `python manage.py seed_real` — your current DB still has the old all-second-life data. After that the homepage is the New catalog and only ~60 items are Revive/Renewed.

## SESSION LOG — 2026-06-14b · Real Amazon dataset (replaces demo seed)

Wired the real **Amazon Reviews 2023 (UCSD/McAuley)** catalog in place of the hand-typed demo seed, with intelligent categorisation and v2-routed listings. (Note: this sandbox can't download GB-scale files or write the OneDrive-free sqlite, so the **download + import run on your machine**; the pipeline was validated end-to-end against a real-schema sample on a local DB copy.)

**New / changed files**
- `data/download_datasets.py` — added **`download_amazon_meta()`** + `--meta` flag. Streams `meta_*.jsonl.gz` from UCSD and **stops after N usable items**, so you pull a few MB, not the full multi-GB file. Writes `data/meta_<category>.jsonl`. Categories: Electronics, Phones, Clothing, Home, Sports, Toys, Beauty, Books.
- `backend/core/management/commands/import_amazon_data.py` — rewritten. **Per-item category inference** (`infer_category`, title-first; strips the ambiguous "Clothing, Shoes & Jewelry" umbrella so shirts aren't tagged Footwear) → one file yields Phone/Laptop/Footwear/Apparel/… . Every listing is **enriched through `ml.route.route_item()`** for a real grade-adjusted price + tier + risk_tier + disposition + condition_label, gets an image, a round-robin **seller**, a spread **geohash**, and a **Revive vs Amazon-Renewed** source split. Items dispositioned **RECYCLE_DONATE / RESTOCK_NEW are not listed** (they exit the storefront, per §6). Quality filters: real title+image, price ₹50–₹5,00,000.
- `backend/core/management/commands/seed_real.py` — **NEW one-command orchestrator**: ensures demo sellers + buyer, imports every `data/meta_*.jsonl`, generates Health Cards for a sample, creates demo orders + Green-Credit history. `--keep-demo`, `--per-file N`, `--as-listings F`. Replaces `seed_db` for real data.

**How to populate real data (on your machine)**
```bash
cd backend && python manage.py migrate            # graph fixed last session (0005 merge)
# download a slice per category (MB, not GB):
python data/download_datasets.py --meta --category Electronics --max-items 4000
python data/download_datasets.py --meta --category Clothing    --max-items 4000
python data/download_datasets.py --meta --category Home        --max-items 3000
python data/download_datasets.py --meta --category Sports      --max-items 2000
python manage.py seed_real                         # imports all data/meta_*.jsonl
```

**Validated this session** (real-schema 12-item sample, local DB copy): smart categorisation correct across Phone/Laptop/Electronics/Footwear/Apparel/Home/Beauty/Books/Toys/Sports; bad rows (no price / no image / empty title) filtered; listings carry real MRP→routed price, tier 1/2/3, LOW/MEDIUM/HIGH risk, OPEN_BOX/USED_P2P/RENEWED dispositions, sellers, geohash; Revive + Amazon-Renewed surfaces both populate; opened-hygiene item correctly excluded; Health Cards + demo orders + credits created. `manage.py check` → 0 issues; both commands discoverable.

> Sandbox-mount caveat (worse this session): bash served **persistently truncated** copies of files written by the file-tools, so the two management commands were (re)written via bash and patched there; the canonical on-disk files are complete and correct (verified via direct read). If a bash build/parse ever shows a truncation in a freshly-written file, it's the mount — read the file to confirm.

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
- `core/models.py`: User.lat/lng; **Listing.Source.NEW**, `grade` blank-able, **Listing.images** (seller angle shots, JSON); risk_tier/disposition/condition_label, grades E/F, statuses paused/delisted; Product.rating/rating_count.
- Migrations: `0003_v2_fields`, `0004_product_rating`, **`0005_merge_*`** (leaf-node fix), **`0006_listing_images_alter_listing_grade_and_more`** (NEW source + images). Run `migrate`.
- `core/views.py`: **NEW-catalog storefront** — `ListingListView` default = New catalog (popularity sort, 120); `?source=revive` / `?source=renewed` / `?source=all`. `ListingDetailView` adds **`buying_options`** (New + second-life). POST persists **seller photos** to `Listing.images`. Plus geohash-on-create, Near-me sort, ManageListingView (delist/pause/relist), CatalogSuggestView, RecommendView (excludes New).
- `core/serializers.py`: ListingSerializer adds **`is_new`, `mrp`, `images`, `second_life`** (New tile's "Used/Renewed from ₹X").
- `route/views.py`: `LocalDemandView`; accepts grades E/F.
- `grade/views.py`: InspectAndRouteView wired **instance gate** + **dedup gate**; `skip_match=true` for seller's own item.
- `trust/views.py`: `_serialize_card` returns `source`, `condition_label`, `seller_name`, `product` block (self-describing card → drives Revive vs Renewed UI).
- `core/management/commands/`: **`import_amazon_data.py`** (smart per-item categorise + route-enriched second-life), **`seed_real.py`** (NEW catalog + curated ~60 second-life + cards + orders + credits), **`_demo_catalog.py`** (43 guaranteed branded products, high rating_count). `data/download_datasets.py` has `--meta` streaming downloader.

### Frontend (`frontend/src/`)
- `components/Product.jsx` — **New tiles** (no grade badge, real rating + count, "Used/Renewed from ₹X") vs **second-life tiles** (grade + Revive/Renewed badge + strikethrough MRP/% off).
- `components/ProductFeed.jsx` — tabs **All / Shop Revive / Renewed**, surface-aware heading.
- `pages/ProductDetailPage.jsx` — **buying-options block** (New + Renewed/Revive) + **seller-photos strip**; VTON props.
- `components/stitch/HealthCard.jsx` — **dispatcher on `source`**: RenewedHealthCard (professional, no AI grade) + ReviveHealthCard (AI grade + defects + functional + seller name/rating + **seller photos strip** + guarantee).
- `pages/HomePage.jsx` — one-time location, near-me sort; maps is_new/mrp/second_life/rating through.
- `pages/MyListingsPage.jsx` — Delist/Pause/Relist. `pages/GradingResultPage.jsx` — category prompts + required-angle gate. `components/stitch/SellIt.jsx` — category prompts, grade-all-images, catalog match → MRP + suggested price.
- `api/client.js` — grade/route/card/credits/recommend/storefront/manageListing/suggestCatalog.

## 3. LEFT TO DO
### DONE since v2 integration (kept for reference)
- ✅ **Health Card UI split** — `HealthCard.jsx` dispatcher on `source`: Renewed (professional, no AI grade) + Revive (AI grade + defects + functional + seller + guarantee).
- ✅ **Seller photos persisted per listing** — `Listing.images`; seeded for curated Revive + persisted by live Sell-It POST; shown on product page + Revive card.
- ✅ **Real-Amazon storefront** — `Source.NEW` + New catalog default; only a curated minority is Revive/Renewed; buying-options block; `second_life` summary.
- ✅ **Real Amazon dataset + guaranteed branded demo catalog** — `seed_real` + `_demo_catalog`.
- ✅ **Restock-as-New** — importer excludes RESTOCK_NEW/RECYCLE_DONATE from second-life listings (they stay in the New catalog / exit), per §6.

### Still open / optional
- ✅ **Review text** (done 2026-06-15d): `Review` model + `data/download_reviews.py` (real Amazon Reviews 2023 data) + `seed_demo._seed_reviews` + Amazon-style reviews UI on the product page.
- **Real demand index (Q10):** `ml/build_demand_index.py` still synthetic; feed real order/search history.
- **DINOv2 threshold calibration (Q4):** env `REVIVE_INSTANCE_THRESHOLD` default 0.55 — calibrate on real pairs.
- **Demo product images** are clean category-representative Unsplash URLs (a few phones/laptops share one) — swap exact press shots into `_demo_catalog.py` `IMG`/items if desired.
- **S9–S11** (ops console, agent app, kirana app) — deferred.
- **Servable trained price model** — optional; see §5.

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

**D. Storefront:** **All** tab = NEW catalog (Amazon-like, no grades); **Shop Revive** + **Renewed** tabs = curated second-life; a New product with a second-life option shows "Used/Renewed from ₹X" + buying-options on its page; location asked once; nearest-first ordering.

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
- Migrations through **0006** must be applied (`python manage.py migrate`): 0005 = leaf-node merge, 0006 = `Source.NEW` + `Listing.images` + blank grade. The OneDrive-mounted sqlite threw "disk I/O error" in the sandbox; migrations were proven to apply against a local copy — run on your machine.
- **Re-seed after pulling**: `seed_real` wipes + rebuilds the catalog from `data/meta_*.jsonl` (your downloaded data is never deleted) and always re-adds the `_demo_catalog` brands.

## 7. ISSUE → STATUS MAP (user's original Q1–Q11 + later feedback)
Q1 return prompts category-based ✅ | Q2 catalog price/match ✅ | Q3 delist ✅ | Q4 instance gate (DINOv2) ✅ | Q5 risk tier backend-only ✅ | Q6 dedup ✅ | Q7 category not tier ✅ | Q8 rubric+E/F ✅ | Q9 grade+defects in price ✅ | Q10 demand index ⚠️ synthetic | Q11 Revive/Renewed + 2 health cards ✅ design & implementation.
Later: multi-image grade ✅ | grading speed (keras gated) ✅ | location once ✅ | real data importer ✅ | disposition-authoritative routing ✅.
Latest feedback: two Health Cards (Renewed vs Revive) ✅ | seller photos persisted + shown ✅ | **real-Amazon storefront** (New catalog default, curated minority Revive/Renewed, All tab, buying options) ✅ | grades are demo-curated only, real grading stays the live AI flow ✅ | guaranteed branded catalog so Sell-It search finds Nike/Vivo/Samsung/Dell/Levi's etc. ✅.
