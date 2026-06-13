# PROJECT REVIVE — Detailed Implementation Plan
### React + Django · AWS-hosted · 3 people working in parallel · Deadline June 15, 11:59 PM

> Companion to `final_idea.md` (the concept/pitch). This is the **engineering build plan**. It is organised so **3 people build at the same time without blocking each other**, using a contract-first approach: we agree on the API shapes and mock data in the first 2 hours, then each person owns one layer and works against mocks until the real pieces land.

---

## 0. Where REVIVE fits in Amazon's *existing* second-hand ecosystem

(Answers "doesn't Amazon already do this?" — judges will ask.)

### Amazon's existing umbrella — "Amazon Second Chance"

| Existing program | What it is | Who supplies the item |
|---|---|---|
| **Amazon Renewed** | Certified refurbished, inspected, warrantied (90 days / up to 1 yr Premium) | **Professional refurbishers / sellers** |
| **Amazon Warehouse / Resale** | Open-box & used-good deals from customer returns | **Amazon itself** (graded returns) |
| **Amazon Trade-In** | Hand in old devices → gift card | Customer → Amazon |
| **Second Chance Deal Days** | Promo event (Europe, Sep 2025, 60M+ items, up to 50% off) | Aggregates the above |
| **GlowRoad** (acquired 2022, India) | Social/reseller C2C network | Resellers, not the item's owner |

### The gap REVIVE fills

**There is no true individual-to-individual resale inside Amazon.** Selling used today needs a *seller account*, is **category-restricted**, and targets professionals — you cannot list the baby monitor in your drawer like on OLX/Facebook Marketplace. Warehouse is fed only by Amazon's own returns; Renewed only by professional refurbishers.

So our two novel contributions:
1. **The decision/grading/trust engine** that auto-feeds all of the above (today grading is manual + centralized).
2. **The verified P2P lane** — letting individuals (Rahul) supply *into* the Second Chance umbrella with Amazon as trust intermediary.

**Positioning line:** *"REVIVE isn't a competitor to Renewed/Warehouse — it's the missing intelligence layer that auto-feeds them, plus a brand-new supply source (verified individual P2P) Amazon has never had. One 'Second Life' discovery surface, three supply sources: Amazon returns, certified refurbishers, and verified individuals."*

### How we implement the P2P network (so it's *trusted*, unlike classifieds)

P2P is **a `source="p2p"` flag on the same inventory**, with Amazon inserted as trust intermediary at every risky step:

```
Rahul lists (P4) → AI grade + price + Health Card → Listing row, source="p2p"
       → shown in the SAME discovery feed (P5) beside Warehouse/Renewed, "Amazon-Verified" badge
       → buyer pays via Amazon checkout → funds held in ESCROW (not yet released)
       → Rahul drops at hub/kirana → agent re-scans, confirms match to Health Card
       → buyer collects → ownership transfer appended to Health Card ledger
       → escrow releases to Rahul (minus commission)
```

Every classifieds pain (strangers, haggling, fraud, no-shows) is gone because Amazon owns payment + verification + handoff. Reuses grade/trust/hub-handoff we already build — the only net-new piece is the **escrow state machine**.

---

## 1. Architecture — Django modular monolith

One Django project; the 5 pillars are Django **apps** (clean separation, single deploy — microservices are wrong for a 3-person hackathon).

```
┌──────────────────────────────────────────────────────────────┐
│  React SPA (Vite + Tailwind + Leaflet) — S3 + CloudFront       │  ← TRACK C (M3)
│  8 pages · persona switcher · Amazon-styled UI                 │
└───────────────┬────────────────────────────────────────────────┘
                │ REST (axios), poll for grade status
┌───────────────▼────────────────────────────────────────────────┐
│  Django + DRF — Elastic Beanstalk (EC2)                         │  ← TRACK B (M2)
│  apps: grade · route · trust · prevent · green · recommend      │
│  core: Listing · Order · User · Product · demand index          │
│  Celery worker (batch grading, credit vesting) + Redis broker   │
└───────┬───────────────────────────┬──────────────────┬─────────┘
        │ imports Python functions   │ boto3            │ ORM
┌───────▼─────────────────────┐  ┌───▼─────────────┐  ┌─▼──────────────────────┐
│ ML modules (importable)     │  │ OpenRouter      │  │ PostgreSQL (RDS)        │
│ grade/route/prevent/recommend│ │ vision LLM      │  │ items·cards·orders·     │
│                             │  │ (→Bedrock prod) │  │                         │
│ GDINO·CLIP·LightGBM·ALS·GBDT │ └─────────────────┘  │ credits·LEDGER          │
└──────────────────────────────┘  ← TRACK A (M1)       │ + Redis (demand,cache)  │
                                                       │ + S3 (photos,artifacts) │
                                                       └─────────────────────────┘
```

**Single-item grading runs synchronously** in the view (must feel <2s on stage). **Batch grading + credit vesting run async** via Celery. Heavy CV models (GDINO/CLIP) are lazy-loaded singletons inside the ML modules; the vision LLM is an HTTP call to OpenRouter (OpenAI-compatible, no local weights) — provider-abstracted so production swaps to Bedrock via one env var.

---

## 2. The parallelization strategy (read this first)

The whole point: **nobody waits.** We achieve it with three rules.

### Rule 1 — Three layer-owned tracks

| Track | Owner | Owns | Language/tools |
|---|---|---|---|
| **A — Intelligence** | **M1** | All ML: grade pipeline, EV optimizer, pricing, prevention, recommender. Pure Python modules + serialized artifacts. **Zero Django dependency.** | Python, notebooks, GDINO/CLIP/OpenRouter, LightGBM, ALS |
| **B — Backend/API/Infra** | **M2** | Django project, models, DRF endpoints, Celery, trust/ledger, green/credits, P2P escrow, demand index, synthetic data, **AWS deploy** | Django, DRF, Postgres, Redis, boto3, EB |
| **C — Frontend** | **M3** | All 8 React pages, shared components, Amazon styling, persona switcher, Leaflet map, animations | React, Vite, Tailwind, Leaflet, axios |

### Rule 2 — Contract-first (the 2-hour kickoff, all 3 together)

Before anyone builds features, the team agrees on **§4 the API contract** (exact request/response JSON for every endpoint) and writes **`fixtures/*.json`** — canned sample responses for each endpoint. These fixtures are committed to the repo and are the shared source of truth.

### Rule 3 — Build against mocks, swap to real

- **M3 (frontend)** points axios at a **mock server** (`json-server` or MSW serving `fixtures/*.json`) from hour 1. Builds all 8 pages fully without any backend running. Flips a base-URL env var to hit the real Django API as endpoints land.
- **M2 (backend)** implements each DRF view returning the contract shape, initially calling **stub ML functions** (`return json.load(fixture)`). Swaps stubs for M1's real modules as they land. So B never waits for A.
- **M1 (ML)** develops + validates each model standalone in notebooks against the **same fixture schema**, then exposes one importable function per model (`grade_image()`, `route_item()`, `score_risk()`, `recommend()`). When done, M2 changes one import line.

Result: from hour 3, all three are building real work in parallel; integration is just deleting stubs.

### Integration checkpoints (the only sync points)

| When | Checkpoint | Who |
|---|---|---|
| Kickoff +2h | Contract + fixtures committed; repo scaffold pushed; everyone can `git pull` and run their layer | All |
| End of Day 1 | M1's `grade_image()` + `route_item()` importable; M2 has wired them into `/api/grade` + `/api/route`; M3's P3 page renders a real grade | All (30-min merge) |
| Day 2 midday | All ML functions live; all endpoints real; **deploy to AWS**; M3 flips to AWS base URL | All |
| Day 2 eve | Full dress rehearsal of all 5 flows end-to-end | All |

---

## 3. Coverage map — every `final_idea.md` element → who builds it

So nothing is dropped. (Pillars, pages, and flows from `final_idea.md` §3/§5.)

| `final_idea.md` element | Track A (ML) | Track B (API/data) | Track C (UI) |
|---|---|---|---|
| **Pillar 1 — Grading** (GDINO+CLIP+OpenRouter LLM, video) | grade pipeline + video sampler | `/api/grade`, `/api/grade/batch`, S3 upload, cache | P3 grade view, defect-box overlay |
| **Pillar 2 — Routing** (EV optimizer, demand gravity) | EV optimizer, LightGBM price, sell-prob | `/api/route`, demand index → Redis, `/api/demand/heatmap` | Leaflet `MapPanel`, routing animation |
| **Pillar 3 — Trust** (Health Card, ledger, GS1 QR) | — | trust app, signed JSON, append-only ledger, QR, `/api/card` | `HealthCard` component, QR render |
| **Pillar 3 — P2P** (zero-contact) | price suggestion for listing | escrow state machine, `Order.is_p2p`, ownership transfer | P4 Sell-It, P6 buy, source badges |
| **Pillar 4 — Prevention** (risk + nudge) | GBDT risk model, review-mined priors | `/api/prevent/risk` | P7 nudge chip |
| **Pillar 5 — Green Credits** (earn/vest/spend) | — | green app, promise/vest (Celery clock), redeem | P7 credit promise, `CreditsWidget` wallet |
| **Pillar 5 — Refurb rail** (ALS + hybrid) | ALS train, hybrid scorer | `/api/recommend/{user}` | P5 `RecRail` |
| **8 pages P1–P8** | — | listings/orders/checkout APIs | all 8 pages + `PersonaSwitcher` |
| **Personas** Priya/Rahul/SmallSeller/Agent/Buyer/Ops | — | seed data per persona | persona switcher + per-persona views |
| **Datasets** (Mercari/ABO/Reviews/synthetic) | train models | synthetic generator, seed DB | — |
| **Metrics** (RMSLE/Recall@20/EV uplift/F1) | compute + notebook | — | metrics slide (shared) |
| **AWS hosting** (RDS/S3/EB/CloudFront; LLM via OpenRouter, Bedrock-ready) | provider-flag call in grade module | **deploy everything** | React build → S3 |
| **Demo video / deck / Q&A** | metrics input | — | record (shared, M3 leads) |

---

## 4. The API Contract (agree on this at kickoff; write fixtures for each)

All responses JSON. `operator ∈ {agent, seller, self}`. Sample fixtures committed under `fixtures/`.

| App | Endpoint | Method | Request | Response (shape) |
|---|---|---|---|---|
| grade | `/api/grade/` | POST | `{image_ids[], product_id, operator}` | `{listing_id, grade, confidence, defects[{type,severity,bbox,location}], completeness, condition_summary, latency_ms, model_version, image_hashes[]}` |
| grade | `/api/grade/batch/` | POST | `{items:[{image_ids,product_id}]}` | `{task_id}` |
| grade | `/api/grade/status/{task}` | GET | — | `{done, results:[grade objects]}` |
| route | `/api/route/` | POST | `{listing_id}` | `{chosen_path, ev_breakdown:{resell,refurbish,p2p,donate,recycle}, price, km_saved, co2_saved, demand_note}` |
| route | `/api/demand/heatmap` | GET | `?category&geohash` | `{cells:[{geohash5, lat, lng, demand}]}` |
| trust | `/api/card/{listing}/` | GET | — | `{gs1_uri, grade, defects[], owners[], model_version, signature, ledger_valid}` |
| trust | `/api/card/{listing}/verify` | GET | — | `{valid:true, chain_length}` |
| prevent | `/api/prevent/risk/` | POST | `{user_id, cart:[{product_id,size}]}` | `{risk, flagged_item_id, nudge_text, credit_promise}` |
| green | `/api/credits/promise/` | POST | `{user_id, order_id}` | `{pending_credits, vest_at}` |
| green | `/api/credits/{user}/` | GET | — | `{balance, pending, history[]}` |
| core | `/api/listings/` | GET | `?source&grade&geohash` | `{results:[Listing]}` |
| core | `/api/recommend/{user}/` | GET | — | `{items:[{listing_id, score, reason}]}` |
| core | `/api/orders/` `/api/checkout/` | POST | `{user_id, listing_id, redeem_credits}` | `{order_id, status, escrow}` |

---

## 5. Data Model (Track B builds; Track A only reads schemas)

```python
# core
class Product:  asin, title, category, brand, mrp, reference_image_url
class User(AbstractUser):  return_rate, geohash5
class Listing:  product FK, source[return|p2p|warehouse|renewed], grade[A-D],
                condition_summary, completeness, price, geohash5, clip_embedding(JSON),
                status[grading|listed|refurbishing|sold|donated|recycled|warehouse_bound],
                seller FK(null)            # set for P2P
class Order:    user FK, listing FK(null), product FK, status, is_p2p,
                escrow_released(bool), return_window_closes(datetime)

# grade
class GradingResult:  listing FK, defects(JSON), confidence, latency_ms, model_version, image_hashes(JSON)
# route
class RoutingDecision: listing FK, chosen_path, ev_breakdown(JSON), km_saved, co2_saved
# trust  — THE LEDGER (append-only DPP)
class HealthCard:  listing O2O, gs1_uri, payload(JSON), signature
class LedgerEntry: card FK, event[graded|repaired|owner_transfer|...], data(JSON),
                   prev_hash, this_hash, created_at      # UPDATE/DELETE revoked at DB level
# prevent
class ReturnRiskScore: order FK, score, nudge_text
# green
class CreditEntry: user FK, order FK, amount, status[pending|vested|expired], vest_at
```

**Ledger integrity (the QLDB-replacement story, native in Postgres):** `LedgerEntry` is append-only — revoke UPDATE/DELETE grants + `this_hash = sha256(prev_hash + data)`. Verify = recompute the chain. On AWS this is **Aurora PostgreSQL**; identical semantics.

---

## 6. Grading pipeline (Track A core) — implementation detail

```
grade_image(image_bytes, product_id, operator) -> dict   # importable, no Django
  1. sha256(image) → image_hashes; check Redis grade_cache → hit? return  [demo safety]
  2. Grounding DINO zero-shot, prompts = ["scratch on surface","dent on surface",
       "stain on fabric","torn fabric","missing part","damaged area"]
       → boxes(score>0.30), bbox→3×3 grid location
  3. CLIP cosine(uploaded, Product.reference_image) → completeness
  4. caption(image, dino_context) via the configured provider → image + DINO context text
       → {grade, confidence, defects[], completeness, condition_summary, functional}
  5. write grade_cache; return dict (target <2s)
```

**Provider abstraction (`LLM_PROVIDER` env: `openrouter` | `bedrock` | `local`):** one `caption()` function, three backends behind it:
- **`openrouter` (demo default):** OpenAI SDK pointed at `https://openrouter.ai/api/v1`, `OPENROUTER_API_KEY`, a vision model id (e.g. `anthropic/claude-3.5-haiku` or `google/gemini-flash-1.5`). Image passed as a base64 `data:` URL in the message content.
- **`bedrock` (production):** `boto3.client("bedrock-runtime").invoke_model(...)`, same Claude Haiku.
- **`local` (offline fallback):** Qwen2.5-VL-3B.

All three return the identical JSON schema, so nothing downstream changes — switching providers is one env var. No AWS approval needed for the demo path. **Video:** OpenCV samples 4–6 frames → loop pipeline → max severity per defect type (~30 lines).

---

## 7. AWS Deployment (Track B; free-tier-first, then deploy Day 2)

| Layer | Service | Free-tier note |
|---|---|---|
| React build | **S3 static + CloudFront** | Free tier |
| Django API | **Elastic Beanstalk** (t3.micro/t4g.micro) | 750 hrs/mo free |
| Database | **RDS PostgreSQL** db.t4g.micro | 750 hrs/mo free 12 mo |
| Redis + Celery | on the same EC2 (ElastiCache not reliably free) | — |
| Vision-LLM grading | **OpenRouter** (demo) → Bedrock-ready for prod | pay-per-call (cents); no AWS approval needed; set a small OpenRouter spend cap |
| Photos/artifacts | **S3** | Free tier |
| Heavy CV (GDINO/CLIP) | too heavy for free EC2 → dev on local/Colab T4+ngrok; **demo serves pre-cached grades** | Honest pitch: prod = IoT Greengrass / SageMaker endpoint |

**Deploy order:** local docker-compose Days 0–1 → Day 2 AM `eb create`, point Django at RDS, `collectstatic`→S3, React build→S3/CloudFront. Vision LLM stays on OpenRouter (no AWS model-access approval needed) — Bedrock is the documented production swap. Keep local docker stack as demo fallback; record video against whichever is stable. **Gotchas:** RDS security group must allow EB; `ALLOWED_HOSTS`/`DATABASE_URL` via EB env; `django-cors-headers` for the S3 SPA.

---

## 8. Per-person plan (parallel, June 13 → June 15)

> It is **June 13** now — effectively **~2.5 working days**. Phase 0 is the shared kickoff; after it, the three tracks run concurrently and only meet at the checkpoints in §2.

### 🟢 PHASE 0 — Shared kickoff (first ~2 hours, all 3 together)
- Agree on the §4 contract; write `fixtures/*.json` for every endpoint (canned Priya/Rahul/SmallSeller data).
- M2 pushes repo scaffold: Django project + 6 apps + `core`, docker-compose (Postgres+Redis), empty DRF views returning fixtures.
- M3 pushes React scaffold: Vite+Tailwind, 8 routed pages (empty), `PersonaSwitcher`, axios client pointed at mock server.
- M1 pushes `ml/` package with stub functions returning fixture JSON + notebook skeletons.
- **Get an OpenRouter API key + test one vision call now** (M1) and **set the AWS Budget alarm** (M2). (No Bedrock approval needed for the demo; the provider flag keeps Bedrock as a one-line prod swap.)
- ✅ Exit: everyone can run their own layer in isolation against mocks.

### 🔵 TRACK A — M1 (Intelligence)
- **Day 1 (Jun 13):** GDINO prompt-tuning on 10 sample photos + **latency check** (Colab fallback if >2s); `grade_image()` complete (GDINO+CLIP+OpenRouter LLM, cache); LightGBM price model on Mercari (report RMSLE); EV optimizer + `route_item()`.
- **Day 2 (Jun 14):** video sampler; ALS recommender (Recall@20/NDCG@20) + hybrid `recommend()`; prevention GBDT + review-mined priors → `score_risk()`. Hand all functions to M2 (one import line each).
- **Day 3 (Jun 15):** pre-grade every demo item into the cache; finalize metrics numbers for the slide; support integration bugfixes.
- **Unblocked because:** works in notebooks/modules against the fixture schema; never needs Django or React running.

### 🟣 TRACK B — M2 (Backend / API / Infra)
- **Day 1 (Jun 13):** all Django models + migrations + DRF endpoints returning contract shapes (calling M1 stubs); `core` Listing/Order/User/Product; **trust app** (signed Health Card + append-only ledger + GS1 QR + `/api/card`); synthetic data generator + demand index → Redis; seed DB with persona data.
- **Day 2 (Jun 14):** swap M1 stubs → real modules as they land; **green app** (promise + Celery vest clock + redeem); **P2P escrow state machine** (`is_p2p`, escrow_released, ownership-transfer ledger append); `/api/prevent/risk`, `/api/recommend`. **Deploy to AWS** (EB + RDS + S3 + CloudFront; LLM via OpenRouter).
- **Day 3 (Jun 15):** harden endpoints, fixtures→DB consistency, support M3 integration; keep local fallback green.
- **Unblocked because:** stubs return fixture JSON, so every endpoint is "done" on Day 1 regardless of M1; M3 sees a working API immediately.

### 🟠 TRACK C — M3 (Frontend)
- **Day 1 (Jun 13):** Amazon visual theme (`#232F3E` navy header, `#FF9900` accent, smile arrow, Ember-like font); build **P1, P2, P3** (grade view + defect-box `<canvas>` overlay + Leaflet `MapPanel` + refund/impact toast) and **P8** bulk table — all against the mock server.
- **Day 2 (Jun 14):** **P4 Sell-It**, **P5 discovery + RecRail + source badges**, **P6 Health Card + QR**, **P7 checkout (nudge + credit promise + redeem)**; routing animation polish; flip axios base URL to the real/AWS API as endpoints land.
- **Day 3 (Jun 15):** end-to-end polish, persona-switch demo choreography, **record the 3-min video** (script: `final_idea.md` §8), deck + architecture diagram.
- **Unblocked because:** mock server serves all `fixtures/*.json` from hour 1 — every page is buildable before any real endpoint exists.

### Cut-lines (decide Day 2 midday, in order)
1. ALS rail → static mock (keep offline Recall@20 number)
2. Video grading → skip (roadmap)
3. AWS deploy → demo from local + ngrok (still keep S3 + RDS so "runs on AWS" is true)
4. **Never cut:** grade pipeline, EV routing + map, Health Card, P2P escrow, Priya + Rahul scenes.

---

## 9. Repo Structure

```
revive/
├── fixtures/                     # ← shared contract truth (Phase 0): grade.json, route.json, card.json, ...
├── backend/                      # TRACK B
│   ├── revive/                  # settings, urls, celery.py
│   ├── core/  grade/  route/  trust/  prevent/  green/  recommend/   # Django apps
│   ├── requirements.txt · Dockerfile · .ebextensions/
├── ml/                           # TRACK A — importable, Django-free
│   ├── grade.py (grade_image, video) · captioner.py (provider flag: openrouter|bedrock|local) · inference/ (GDINO+CLIP)
│   ├── route.py (ev_optimizer, pricing) · prevent.py (risk, priors) · recommend.py (als, hybrid)
│   └── artifacts/ (LightGBM, ALS vectors, GBDT)  ·  notebooks/ (train+eval)
├── frontend/                     # TRACK C
│   ├── src/pages/ (P1–P8) · src/components/ (GradeCard, HealthCard, MapPanel, RecRail, CreditsWidget, PersonaSwitcher)
│   ├── src/api/ (axios) · src/theme/ (Amazon styling) · src/mocks/ (MSW/json-server)
├── data/                         # download scripts + synthetic generators
├── docker-compose.yml            # django + postgres + redis (local dev)
└── README.md
```

---

## 10. Definition of Done (submission checklist)

- [ ] Live: agent scans an item → grade A–D in <2s (one live on stage, rest cached)
- [ ] Live: EV routing decision + Leaflet demand-map animation
- [ ] Live: Health Card with QR + `/verify` returning "chain valid"
- [ ] Live: P2P — Rahul lists → appears in discovery with Verified badge → escrow checkout → ownership transfer logged
- [ ] Live: checkout prevention nudge + credit promise; wallet shows pending→vested
- [ ] Live: Small Seller bulk-grades 12 items in one action
- [ ] Hosted on an AWS URL (S3 + RDS + EB minimum; LLM via OpenRouter, Bedrock-ready); local fallback ready
- [ ] 3-min demo video + README + architecture diagram + metrics slide + deck
- [ ] All 6 PS bullets demonstrably covered (map them on a slide); 4 judging criteria addressed (`final_idea.md` §11)
