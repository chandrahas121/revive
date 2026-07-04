# REVIVE — Seller Central + Flex: Implementation Progress

> Working doc so any agent can pick up where the last one stopped.
> Last updated: 2026-07-02

## Goal (from the user)
Extend the existing consumer REVIVE app with a **Seller Central** experience for the
small seller (~200 returns/month) that automates inspect → grade → price → relist.
Build order: **(1) implement the design → (2) wire Phase A backend → (3) Flex (Phase B) only if time permits.**
Everything demoable in a 5-minute video. Monorepo (same repo/frontend app).

## Source of truth
- **Plan:** `seller_central_plan.md` (product flow, guardrails, mapping to real Amazon).
- **Design:** `Seller frontend replication-handoff/seller-frontend-replication/project/Seller Central.dc.html`
  — a single self-contained mock (Claude Design `<sc-if>/<sc-for>` format) with all screens + mock data
  in the inline `<script type="text/x-dc">` at the bottom (state model, grade cases, dashboard data).
  Design tokens/colors in `_ds/.../revive/styles.css`.
- The design is **Phase A only** (no Flex screen). Flex is Phase B, to be designed/built later.

## Environment notes (new laptop)
- Python 3.14 installed. Node/npm: **NOT yet confirmed installed** — verify before `npm install`/`npm run dev`.
- Backend runs fully offline (SQLite fallback, ML gates fail open, no Redis/LLM key needed).
- Do NOT ask the user for terminal permissions — just run.

## Key integration facts (backend)
- `POST /api/grade/inspect/` (multipart: images[], slots[], expected_title, category, product_id, mrp, skip_match)
  → `{ match, grade, confidence, defects[], condition_summary, completeness, functional, heatmap_b64, route }`.
  This is the real grading engine the Grading Assistant should call in Phase A.
- Listing model (`backend/core/models.py`): has `source` (new/return/p2p/renewed), `grade` A–F,
  `disposition`, `condition_label`, `risk_tier`, `images[]`, `status` (lifecycle). Reuse for relisted items.
- `POST /api/returns/process/` turns a graded return into a staged second-life Listing.
- Consumer storefront reads `/api/listings/`. A seller relist should appear there.
- Auth: JWT httpOnly cookie; `AuthContext` (`login/register/logout/me`). Seller demo user = "AARAV RETAIL".

## Frontend integration facts
- `frontend/src/App.jsx` — add `<Route path="/seller/*" element={<SellerApp/>} />`.
- Design uses inline styles throughout → port faithfully as inline styles (fastest pixel-fidelity path).
- `frontend/src/api/client.js` has axios helpers (`inspectReturn`, `processReturn`, `getStorefront`, etc.).

---

## TASK CHECKLIST

### Phase A — Frontend (implement the design)  ← DO FIRST
- [x] Scaffold `frontend/src/seller/` folder + `SellerApp.jsx` with internal `<Routes>` and shared UI context (`SellerUI.jsx`: menu flyout + Health Card modal + relist/review/safet flags)
- [x] Port mock data → `frontend/src/seller/data/sellerData.js` (widgets, charts, products, returnTabs, reqRows, recvRows, gradeCases, safetRows, dash, hcMap)
- [x] `SellerChrome` (top bar + sub nav) + `MenuFlyout` overlay
- [x] `SellerSignIn` page (create-account screen → go dashboard)
- [x] `SellerDashboard` (widgets, Compare Sales charts, Deep-dive ASIN cards)
- [x] `SellerInventory` (Manage All Inventory table + row menu)
- [x] `SellerProductDetail` (edit-listing form)
- [x] `SellerMcf` (Create MCF Order — 3-column form)
- [x] `SellerReturns` (Manage Returns: tabs = Return requests / Returns received / SAFE-T claims)
- [x] `GradingAssistant` (guided capture, "Grade with AI" reveal, integrity check, grade ring + scale, condition note, dual decisions, recovery ladder, confirm/relist)
- [x] `ReturnsDashboard` (Returns & Recovery this month: KPIs, breakdown, grade dist, action mix, activity)
- [x] `HealthCardModal` overlay
- [x] Add "Seller Central" link from consumer Header → `/seller`; route wired in `App.jsx` as `/seller/*`
- [x] Verify build: `npm install` (done, exit 0) → `npm run build` **passes (1911 modules, 4.58s)**; all 18 modules transform HTTP 200 via Vite. Dev server runs at http://localhost:5173/seller. (Visual click-through by a human still recommended, but no compile/import errors.)

Routes: `/seller/signin`, `/seller` (dashboard), `/seller/inventory`, `/seller/inventory/:asin`,
`/seller/mcf`, `/seller/returns` (?tab=requests|received|safet), `/seller/returns/grade/:caseId`,
`/seller/returns/dashboard`.

### Phase A — Backend wiring (make it real)
- [x] Relist endpoint `POST /api/seller/relist/` (`core/seller_views.py`) — reuses a real seeded catalog Product (real image + reviews) and creates a live `Listing` (status=listed, source=return/new, condition_label) that appears on the consumer storefront under `?source=revive`. Non-resellable cases (phone→warranty, hygiene→dispose, wrong→safet) return `{listed:false, action}` and create no listing. Fails soft.
- [x] `GET /api/seller/dashboard/` — live relisted counter blended with seeded baseline.
- [x] URLs registered: `core/urls/seller.py` → included in `revive/urls.py`.
- [x] Frontend wired: `sellerRelist()` in `api/client.js`; `GradingAssistant.onConfirm` calls it (fail-soft) and adds a **"View on storefront ↗"** button (the demo money-shot) that opens `/?source=revive`.
- [~] `seed_seller` — NOT built as a separate command. Chosen architecture makes it unnecessary: the relist reuses `seed_demo` products, and the returns queue is self-contained frontend mock. **Demo prerequisite: run `python manage.py seed_demo` so the storefront has products for relist to reuse.** (If a backend-driven queue is wanted later, add Orders here.)
- [x] **Real ML grading wired.** ML deps (`ml/requirements.txt`: torch, torchvision, transformers<5, openai-clip, opencv) installed into `backend/.venv` (Python 3.12). `GradingAssistant` now has an **Upload photos** button: when the seller uploads angle photos, "Grade with AI" POSTs them to the real `/api/grade/inspect/` (skip_match=true, operator=seller) and renders the **live** grade/confidence/defects/condition-note + the ML **heatmap overlays** (`angle_heatmaps` b64). Adapter `seller/gradeAdapter.js` normalizes the response + derives the recovery ladder from the live grade; the live grade flows into the relist payload. Falls back to the curated case (seeded narrative) when no photo is uploaded or the engine errors (fail-open). Mismatch/duplicate gates surface as banners.
  - Note: first live grade downloads Grounding DINO + CLIP checkpoints from HuggingFace (~700MB, needs network) and is slow (~seconds–minutes). Subsequent grades are cached (SHA-256). If models can't load, inspect fails open to a default B grade.
  - **VERIFIED live over HTTP:** `POST /api/grade/inspect/` (uploaded photo, skip_match=true) → `http=200, grade=A, conf=0.78, model=revive-grade-v1.0, defects=1, heatmap=yes, angle_heatmaps=1`. Real pipeline (`revive-grade-v1.0`), not `fallback-v0`. Models downloaded once (338MB checkpoint) and cached; first grade took ~107s incl. download, cached repeats are instant. Torch needed the VC++ redist (see below).
- [x] Guardrails enforced: hygiene→dispose-only & wrong-item→SAFE-T are encoded in `CASE_MAP` (create no listing); frontend blocks the other recovery paths per case.
- [x] **Verified end-to-end** (backend on Python 3.12 venv, migrated, `seed_demo` run, runserver :8000):
  - `POST /api/seller/relist/ {case:"hp"}` → creates real Listing (iQOO phone, "Used - Very Good") that appears on `/api/listings/?source=revive` (16→17).
  - `{case:"kurta"}` → Allen Solly apparel relisted as "New".
  - `{case:"hygiene"}` / `{case:"phone"}` / `{case:"wrong"}` → `{listed:false, action}` (no listing) — guardrails hold.
  - Consumer surfaces unchanged: default storefront = 87 New; `/api/grade/inspect/` still 405-resolves; test listings cleaned up back to 16-revive baseline.
- Note: storefront has a **60s read-cache** — a freshly relisted item can take up to 60s to appear under "Shop Revive". Fine for demo (wait a beat, or hard-refresh).
- [ ] (Optional polish) Pre-warm live-demo grade cases — only relevant if wiring real ML grading (not needed for current curated-mock grading).

### Phase B — Flex doorstep grading (stretch, only if time)
- [ ] Mobile-width Flex pickup page (phone frame): capture → grade → instant routing (kirana / hub locker / return to seller / dispose) with km + CO₂ saved
- [ ] Guardrails: high-value never→kirana; damaged packaging repack rule; hygiene dispose; wrong-item cancels local route
- [ ] Doorstep-graded case lands in seller queue badged "Graded at doorstep by Flex agent"

---

## COMPLETED
- Extracted plan from failed ultraplan cloud session → `seller_central_plan.md`.
- Read full design mock + existing frontend/backend structure.

## GRADING FLOW FIX (2026-07-02, after user feedback "it's hardcoded / face photo graded A")
Root causes found + fixed:
1. **No-upload showed a hardcoded grade** — the old `runGrade` fell back to the curated mock when no photo was uploaded. FIXED: photos are now **required**; "Grade with AI" is disabled until the seller uploads photos (no defaults).
2. **`skip_match=true` disabled the integrity gate** — so a wrong item (a face) sailed through and graded A. FIXED: removed `skip_match`; the gate now runs. Verified the **DINOv2 instance gate works fully offline** and correctly rejects wrong/cross-category items (`match=False`, no grade) while matching items grade.
3. **Wrong ML category** — was passing the display string ("Over-ear headphones"). FIXED: each case now carries `mlCategory` (Electronics/Clothing/Beauty) + `expectedTitle`, passed to the gate + grader. Reference images for those categories cached at `ml/artifacts/catalog_refs/`.
4. **Hygiene rule** now enforced in `gradeAdapter` — a hygiene case locks recovery to **dispose-only** regardless of cosmetic grade.
5. Seller's **uploaded photos are previewed**, then replaced by the ML **defect-heatmap** overlays after grading. Mismatch/duplicate/error each show a banner and do not fake a grade.

**Verified over HTTP (real `/api/grade/inspect/`, gate ON):**
- Electronics ref image on hp → `match=True, grade=A`. Face image on hp → `match=False, no grade`. ✓
- Clothing ref on kurta → match+grade. Electronics image on kurta (Clothing) → `match=False`. ✓
- Beauty ref on hygiene → match+grade (then adapter forces dispose-only). ✓
- Frontend `npm run build` clean (1912 modules).

The proper flow now: Returns received → Inspect → **Upload the return's photos** → Grade with AI → (integrity gate: wrong item = fraud flag / else live grade + defects + heatmaps + condition note) → ranked recovery (hygiene = dispose-only) → Confirm & relist → live on storefront.

## REAL-PRODUCT REWORK (2026-07-02, after "it's hardcoded / no product image / how is it checking similarity")
The return cases were fictional (boAt etc.) with no real product/image, and the integrity check
compared against a **generic category stock photo** — so a face graded A and no product image showed.
Root fix: **drive the whole seller-returns flow from real seeded catalog products.**
- `GET /api/seller/queue/` — 6 real catalog products (real images/titles) as return cases (phone, footwear, apparel; sealed/defect flags).
- `POST /api/seller/grade/` — grades a return against **its own catalog product image**: DINOv2 instance gate (`_product_ref_bytes` fetches+caches the product photo) rejects a wrong item (`match=false` with the product name), else runs the real grading pipeline + heatmap.
- `SellerRelistView` now accepts `product_id` → relists the exact graded product.
- Frontend: `SellerReturns` Received tab loads the queue and shows **real product images**; `GradingAssistant` rewritten to load the case's product, **display the catalog reference image + explain the check** ("AI matches your photos against this exact product; wrong item = flagged, not graded") + tester guidance ("upload the product photo to pass, a selfie to see the mismatch"). Requires photo upload (no hardcoded grade). Grades via `/api/seller/grade/`, relists the real product.
- NOTE: seed images are category-generic (all Nike shoes share one Unsplash photo), so matching is effectively **category-level anti-fraud** (can't return a shoe as a phone / a face as a shoe) — honest and reliable offline. True per-serial matching would need per-product photos + an LLM vision key.
- **VERIFIED HTTP:** queue=6 real products; grade Nike photo→match A; grade face→`match=false` ("doesn't look like the Nike Air Max 270 from the order"); relist(product_id)→listing on storefront (revive 16→17). Build clean (1912 modules), `manage.py check` clean.

## ARCA RETURNS AGENT — BUILD LOG (2026-07-03)
Building the multi-agent decision model from `ARCA_RETURNS_AGENT_PLAN.md` (+ `SELLER_DECISION_MODEL_PLAN.md`).
OpenRouter key is now in root `.env` (`OPENROUTER_API_KEY`, model `anthropic/claude-3-haiku`); `settings.py`
loads root `.env` (line 22). **Restart the backend with `--noreload` after `.env` changes** so the key loads.

- [x] **`ml/llm.py`** — central OpenRouter helper (`llm_json`, `llm_text`), fails open to None if no key.
- [x] **`ml/seller_decision.py`** (Phase 1) — the two-track engine, all deterministic + optional LLM refine:
  - `attribute_fault()` → customer|fraud|carrier|defective|warehouse|none
  - `disposition_decision()` → wraps `ml/disposition.py`, **hard functional-gate on resale**, adds LIQUIDATE/WARRANTY/DISPOSE per fault (customer/carrier→liquidate; defective/warehouse/hygiene/hazmat→dispose).
  - `financial_decision()` → refund verdict + reimbursement route + **SAFE-T eligibility** (excluded categories, ₹25k cap, 15-day window, superficial-damage exclusion, Amazon-issued-refund requirement, 8% abuse-ratio suppression).
  - `decide()` orchestrates; `draft_claim_narrative()` = LLM claim text (fail-open template).
  - **Unit-tested (7 scenarios):** defective→WARRANTY (not resell) ✓ · buyer-damaged→SAFE-T ✓ · sealed→RESTOCK_NEW ✓ · wrong-item→SAFE-T materially_different ✓ · seller-refunded→ineligible ✓ · jewellery→excluded ✓ · refund-not-issued→withhold_pending_amazon ✓.
- [x] **Phase 2 — `SellerGradeView` wired to `decide()`.** `POST /api/seller/grade/` now returns `gr.decision = {fault, disposition, financial, claim_narrative?}`. Accepts `functional` (pass|fail — the seller's on-camera functional test), `reason_code`, `order_value`, `sealed`, `refund_issued_by`, `days_since_delivered`, `substitution`. **Verified live over HTTP** incl. a real LLM-drafted SAFE-T narrative from OpenRouter.
- [x] **Phase 3 — Frontend two-decision UI.** `GradingAssistant`:
  - **Functional test control** (Works ✓ / Faulty ✕) — the seller's on-camera functional check; sent as `functional=pass|fail`. Also sends reason_code/order_value/sealed/refund_issued_by/days.
  - New **`ArcaDecision`** panel replaces the grade-only recovery ladder: fault chip + rationale, "A · Where it goes" (disposition + condition label + why), "B · The money" (refund verdict + reimbursement route). SAFE-T block shows eligible + sub-reason + **deadline countdown** + the LLM claim narrative + "File SAFE-T claim →", or the ineligible reasons, or the "withhold — await Amazon refund" note, or the 8%-suppress warning.
  - Confirm action now follows the **real disposition** (relist / route-to-warranty / send-to-liquidation / dispose), not the grade-only mode. Falls back to the old ladder only if the engine returns nothing.
- [x] **Phase 4 — SAFE-T loop closed.** `SellerUI` holds `safetClaims`; "File SAFE-T claim →" persists the ARCA-drafted claim (narrative + evidence bundle + deadline) and the **SAFE-T tab renders it** under "⚡ Drafted just now by the AI Grading Assistant" with Review & submit. Frontend build clean (1912 modules).
- [x] **Phase 5 — Evidence bundle.** `SellerGradeView` SHA-256s every captured angle → `evidence = {assets:[{slot,sha256,bytes}], bundle_hash, count, captured_at}`, returned on both the graded and wrong-item responses. The relist ledger (`LedgerEntry.GRADED`) now records `evidence_bundle_hash`. Frontend: **`EvidenceBundle`** card (hashed assets + chained bundle hash) shows in the grade result AND the mismatch view; the hash flows into the relist payload (→ Health Card ledger) and the drafted SAFE-T claim. **Verified live:** `count=2, bundle_hash=d3f2…`, per-asset SHA-256s. Refund-timing is represented in the decision (`awaiting_amazon_refund` / `withhold_pending_amazon`), surfaced in the UI.
- [ ] **Production follow-ups (not needed for demo):** Celery-beat poll for Amazon's forced refund to flip withheld claims to fileable; barcode/FNSKU OCR at intake; SP-API returns pull + Finances reconciliation; headless/middleware SAFE-T submission (no public submit endpoint).

### END-TO-END TEST (2026-07-03): 19/19 PASS
Ran a full API e2e across the flow: queue(7 real products) · S1 buyer-damaged→GRADE_RESELL + SAFE-T eligible + LLM claim narrative + evidence bundle · S2 defective(functional fail)→DISPOSE, no SAFE-T · S3 wrong-item(face)→mismatch + evidence · S4 sealed→RESTOCK_NEW · S5 seller-refunded→SAFE-T ineligible(voluntary-refund reason) · S6 relist→live storefront listing + Health Card + evidence hash chained in ledger · S7 consumer side unchanged (87 New, grade/inspect 405). Frontend build clean (1912 modules); all seller modules transform 200 on Vite.
Fix applied during testing: `_llm_refine_fault` now only enriches the *rationale* (and may escalate to fraud), never downgrades the deterministic fault — keeps SAFE-T eligibility rule-driven + deterministic (was flipping customer→none on clean stock photos).

### ARCA is built end-to-end (Phases 1–5). Full demo path:
Returns received → Inspect a real product → capture guided angles + set functional test (Works/Faulty) → **Grade with AI** → DINOv2 integrity gate → live grade → **fault → disposition (relist/warranty/liquidate/dispose) + refund verdict + SAFE-T eligibility** (LLM-refined via OpenRouter) → tamper-evident **evidence bundle** → confirm the correct action → drafted SAFE-T claim (with evidence + deadline) lands in the SAFE-T tab. Backend runs on `:8000 --noreload` (loads `.env` OpenRouter key); frontend `:5173`.

**End-to-end now works:** Returns received → Inspect → capture angles + set functional test → Grade with AI → integrity gate → live grade + **fault → disposition + refund/SAFE-T decision** (LLM-refined via OpenRouter) → confirm the correct action (relist/warranty/liquidate/dispose) → drafted SAFE-T claim appears in the SAFE-T tab.

Files: `ml/llm.py`, `ml/seller_decision.py`, `backend/core/seller_views.py` (SellerGradeView).

## IN PROGRESS / NEXT
- **Phase A (frontend + backend relist + real ML grading with integrity gate) is DONE and verified.** The Seller Central is demoable end-to-end.
- Remaining optional work: (a) human visual click-through of every `/seller` screen in a browser; (b) Phase B Flex doorstep grading (stretch — not started, no design yet); (c) if desired, wire "Grade with AI" to the real `/api/grade/inspect/` (seam is in `GradingAssistant.runGrade`).

## MONOREPO STRUCTURE (2026-07-04 — verified working end-to-end)
Repo was restructured into npm workspaces. **Paths changed** — the seller frontend moved from
`frontend/src/seller/` to its own app:
- `apps/consumer` — consumer storefront (Vite, port **5173**) — was `frontend/`.
- `apps/seller`   — Seller Central app (Vite, port **5174**) — has all my ARCA work.
- `packages/shared` — shared API client (`src/api/client.js`, baseURL `:8000`) + `categoryProfiles.js` (`capturePrompts`), imported as `@amazon-hackon/shared`.
- `backend/` — unchanged location; merge added seller auth (`SellerRegisterView/SellerLoginView/SellerMeView/LogoutView` in `core/views.py`, routes in `core/urls/seller.py`).
- `ml/seller_decision.py` + `ml/llm.py` — ARCA engine, unchanged.
- **`frontend/` and `Seller frontend replication-handoff/` were DELETED** (2026-07-04) — `frontend/` was a superseded untracked leftover; the handoff was a tracked design bundle (its deletion needs a commit). Active frontend is `apps/consumer` + `apps/seller` only.

**Run (monorepo):** `npm install` at root once, then:
- `npm run dev:consumer` (:5173) · `npm run dev:seller` (:5174) · backend `cd backend && .venv\Scripts\python.exe manage.py runserver 8000 --noreload`
- Build all: `npm run build` (or `build:seller` / `build:consumer`).

**Post-merge verification (all green):** Django check ✓ · no unapplied migrations ✓ · seller-auth views present ✓ · backend smoke (defective→DISPOSE, evidence bundle present, auth/me 401=wired) ✓ · seller build (113 modules) ✓ · consumer build (1928 modules) ✓ · all three services serve 200 (seller :5174, consumer :5173, backend :8000) · GradingAssistant module transforms (shared-package import resolves at runtime).

## ⚠ BACKEND DB GOTCHA (2026-07-04)
`.env` now sets `DATABASE_URL=postgresql://revive:revive@localhost:5432/revive`, but ALL demo data
(users, is_seller fix, seeded catalog, migration 0011) lives in **`backend/db.sqlite3`** and there is
NO local Postgres. So starting the backend plainly will try Postgres and fail. **Start the backend with
`DATABASE_URL` overridden to sqlite** (settings uses `load_dotenv(..., override=False)`, so a process
env var wins over `.env`):
```
$env:DATABASE_URL = "sqlite:///C:/Users/dell/Desktop/amazon-hackon/backend/db.sqlite3"
.venv\Scripts\python.exe manage.py runserver 8000 --noreload
```
(Or comment out the `DATABASE_URL` line in `.env` — but it was marked intentional, so it's left as-is.)

## DEMO CREDENTIALS + a post-merge fix (2026-07-04)
- **Seller login** (http://localhost:5174/): `aarav.seller@revive.in` / `seller12345` (store AARAV RETAIL). Also ananya/diya/kabir/vivaan `.seller@revive.in`, same password.
- **Consumer login** (http://localhost:5173/): `demo@revive.in` / `demo12345`.
- **Fix required after the merge:** migration `core/0011_user_is_seller_user_store_name` was **unapplied** (User queries crashed with "no such column is_seller") — ran `manage.py migrate`. Also the seeded sellers had `is_seller=False` (seed predates the column) so seller-login (requires `is_seller=True`) rejected them — enabled `is_seller=True` + `store_name` on all `*.seller@revive.in`. Both logins verified → 200. If the DB is re-seeded, re-run these two steps (or add `is_seller=True` to the seed).

## HOW TO RUN (for the next agent / demo)
Backend (Python 3.12 venv already created at `backend/.venv`):
```
cd backend
.venv/Scripts/python.exe manage.py runserver 8000   # (migrate + seed_demo already done once)
```
Frontend (Node 24 installed):
```
cd frontend
npm run dev    # http://localhost:5173  → Seller Central at /seller
```
- If a new shell can't find node/python, refresh PATH: combine Machine + User PATH env vars (PowerShell:
  `$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")`).
- Demo money-shot: `/seller/returns` → Returns received → Inspect a case → Grade with AI → Confirm & relist → "View on storefront ↗" opens the consumer site with the item live under Shop Revive.
- Both dev servers (Vite :5173, Django :8000) were left running in the background during this session.

## NOTES / DECISIONS
- Porting design as inline-styled React components under `/seller/*` (isolated from consumer app) for pixel fidelity and zero risk to existing pages.
- Grade cases in the mock: `hp` (headphones→B/Very Good relist), `phone` (Redmi→D/warranty), `kurta` (A/relist New), `hygiene` (F/dispose-only), `wrong` (integrity mismatch→SAFE-T), `watch` (A/Open Box, already resolved).
- The design is richer than the original plan (adds SAFE-T claims, refund verdicts, return-request triage) — design wins; implement it all.
</content>
</invoke>
