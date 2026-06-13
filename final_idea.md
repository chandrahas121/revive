# PROJECT REVIVE 🔥
### Every product deserves a second life — and AI finds it the next owner.
**Amazon HackOn Final Plan · Team of 3 · Deadline: June 15, 11:59 PM**

---

## 1. The Idea in One Breath

> **REVIVE is an AI decision engine for returned and unused products. Point a camera at any item — it grades the condition in under 2 seconds, decides the most valuable second life (resell / refurbish / P2P / donate / recycle), keeps the item local instead of shipping it 600 km back to a warehouse, certifies it with a verifiable "Product Health Card" the next buyer can trust, rewards the customer with Green Credits, and — best of all — predicts and prevents bad purchases before they ever become returns.**

We are not building a resale marketplace. Marketplaces exist. We are building the **intelligent bridge** between a return and its next owner — the brain that today simply doesn't exist.

---

## 2. Why This Problem Is Worth Winning

The numbers (from our research in `idea.md`):

- **$849.9 billion** of US retail was returned in 2025 — online return rates run ~19.3%.
- Returns generate up to **24 million tonnes of CO₂ per year**; up to **22% of fashion returns end up in landfill** because the cost of processing exceeds the item's value.
- **63% of shoppers "bracket"** (buy 3 sizes, return 2). Gen Z averages **7.7 returns a year**.
- India specifically: fashion return rates of **25–30%** (Unicommerce/Redseer).

But we don't pitch numbers — we pitch **three real people the current system fails**:

| Persona | Their pain today | What REVIVE does |
|---|---|---|
| **Priya** | Returns ₹500 shoes → they travel 600 km back to a warehouse → processing costs more than the shoes → written off as waste | Two taps in the app, drop the shoes at the kirana hub 200 m away (or doorstep pickup). The hub agent's **2-second AI scan** grades them on the spot — **refund fires before she leaves the store** — and a buyer **5 km away** gets them next. The shoes never leave the city. |
| **Rahul** | Has a perfectly good baby monitor in a drawer. Classifieds = strangers, haggling, doorstep visits. So it just sits there. | Scans it once → AI grades, prices and lists it with an Amazon-verified Health Card → buyer pays through Amazon → handoff via Amazon Hub point (locker or kirana partner store). **Zero contact, zero haggling, zero effort.** |
| **Small Seller** | 200 returns/month, manually inspects, guesses prices, re-photographs each one | Bulk photo upload → all 200 graded, priced, and routed automatically in minutes. |

Customer-centric, bottom-up: every feature exists because one of these three people needs it.

---

## 3. The Five Pillars (= 100% Problem-Statement Coverage)

The problem statement asks for six things. We deliver all six:

| Problem statement asks for | REVIVE answer |
|---|---|
| AI deciding resell / refurbish / donate / recycle / exchange | Pillar 2 — Smart Routing |
| Smart quality grading via image **and video** | Pillar 1 — AI Grading |
| Personalized refurbished recommendations | Pillar 5 — "Certified Refurbished For You" rail |
| Green credits & sustainable incentives | Pillar 5 — Green Credits wallet |
| Easy P2P resale inside a trusted ecosystem | Pillar 3 — Health Card + zero-contact P2P |
| Predictive return prevention | Pillar 4 — Prevention |

### 🔍 Pillar 1 — AI Grading (photo/video → grade in <2 seconds)

**What the judge sees:** upload a photo of scuffed shoes → defect boxes light up on the image → "Grade B · light cosmetic wear · ₹312 resale value" appears in ~1.5 seconds.

**How it works (all proven, zero-training components):**
1. **Grounding DINO (zero-shot)** finds defects from text prompts like *"scratch on surface", "torn fabric", "missing part"* — no labeling, no fine-tuning, works on any product category. (Tip from our testing plan: compound phrases fire reliably; bare nouns don't. Budget 30–60 min of prompt tuning on Day 0.)
2. **A vision LLM via OpenRouter** (e.g. Claude Haiku / Gemini Flash) receives the image + the detected defects as text context and returns structured JSON: grade, defect list, completeness, one-line condition summary. The detections are injected into the prompt so the caption never contradicts the boxes on screen. The call sits behind a provider flag — **one env var switches it to Amazon Bedrock (same Claude Haiku) for production**. Offline fallback: **Qwen2.5-VL-3B** locally (same prompt, same JSON).
3. **CLIP similarity** vs. catalog reference images → flags missing accessories ("box missing", "charger missing").
4. **Grading head** fuses everything → **Grade A / B / C / D + confidence**, mapping to the industry-standard recommerce tiers (A = Like New, recovers 70–85% of value … D = Acceptable, 30–50%).

**Video grading** (the PS says "image/video" — we check it verbatim): accept a ≤15s clip, OpenCV samples 4–6 frames, each runs through the same pipeline, take max severity per defect type. ~30 lines of code.

**Who operates the camera (important — the customer doesn't have to):** the same grading component runs in three contexts: (1) **hub/delivery agent — the default for returns**: guided capture at the kirana point or the customer's doorstep, consistent angles, trusted hands, zero customer effort; (2) **seller dock** — bulk mode for the Small Seller; (3) **customer's own phone — optional express lane only** ("scan it yourself → refund before you even hand it over") and for P2P listings like Rahul's, where photos *are* the listing. Agent-side capture also kills the fraud problem: no stale or faked customer photos.

### 🧭 Pillar 2 — Smart Routing (the brain — our biggest differentiator)

Every graded item gets a millisecond decision via an **Expected Value optimizer**:

```
EV(path) = P(sell | grade, category, price) × resale_price
         − logistics_cost(distance to demand)
         − refurb_cost(defects)
         − holding_cost(days to sell)

→ pick argmax(EV);  if max(EV) < donation benefit → donate;  if hazardous/broken → recycle
```

- **Pricing model:** LightGBM trained on the **Mercari dataset (1.4M real resale listings)** — predicts resale price *conditioned on the AI grade*.
- **Sell-probability model:** GBDT on price-vs-median ratio, grade, seasonality.
- **Geohash Demand Gravity Model** — the magic ingredient: a local-demand index per (geohash cell, category). The item routes to the **nearest demand cluster**, not the central warehouse. This is the line of code that saves Priya's shoes the 600 km trip.

**Pitch framing:** this is a fast, single-formula instantiation of Multi-Criteria Decision Analysis (AHP) — the academically validated framework for reverse logistics, where studies show **up to 33% higher recovered value and 65% better environmental outcomes** than rule-based routing. We have the math (eigenvalue consistency checks, criteria weights) in `idea.md` if judges dig deep.

**Demo wow:** Leaflet map — the item pinned in Bengaluru, the demand heatmap glowing around it, and the decision animating: *"Resell locally · EV ₹312 vs Liquidate ₹–40."*

### 🛡️ Pillar 3 — Trust Layer: the Product Health Card

The PS says it directly: *"Customers struggle to trust refurbished or second-hand products."* Trust is an information problem — the buyer doesn't know what the seller knows. The Health Card erases that asymmetry:

- A **signed JSON document**: AI grade, defect photos (SHA-256 hashed, tamper-evident), grading model version, ownership-transfer log as an **append-only hash chain**.
- Rendered as a **QR code encoding a GS1 Digital Link URI** — the *exact* data-carrier standard the EU's ESPR regulation mandates for Digital Product Passports by 2027. One QR, layered access: a consumer sees condition + recycling info; a certified repair partner sees more. We're prototyping next decade's legal requirement.
- **Why a hash chain and not blockchain?** Blockchain solves consensus between distrusting parties. Here there's one trusted authority (Amazon) — we only need tamper-evidence, which a hash chain gives at zero cost. Blockchain would be theater. (Production path: **Amazon Aurora PostgreSQL with ledger semantics** — AWS's official recommendation after QLDB's discontinuation.)

**Zero-Contact P2P (Rahul's fix):** scan → auto-grade → auto-price → Health Card → matched to "47 parents within 8 km searched for baby monitors this month" → buyer pays via Amazon checkout → **handoff via an Amazon Hub point** — a locker where they exist, or one of Amazon India's tens of thousands of "I Have Space" kirana partner stores (real, existing infrastructure — REVIVE gives it a second job as the front door of reverse logistics). Item moves 8 km instead of 600. Trust isn't rebuilt — it's *borrowed* from Amazon.

### 🛑 Pillar 4 — Prevention (the best return is no return)

- **Return-risk score at checkout:** GBDT on category, size-vs-history delta, brand sizing bias, return-rate priors. Return-reason priors mined from the **Amazon Reviews 2023 dataset** ("runs small", "didn't fit").
- **Fit-intelligence nudge:** when a user adds 3 sizes of the same shoe (classic bracketing), the checkout shows: *"Customers with your purchase profile kept size 8 in this brand — size 9 was returned 3× more."* Constructive, not punitive.

### 💚 Pillar 5 — Green Credits + Refurbished Discovery

**Green Credits — one rule to earn, one rule to spend:**

> **Earn:** complete an order and don't return it. When the return window closes with nothing sent back, the credits **vest** into your wallet. Orders the model flagged high return-risk (bracketing, risky size jump) vest more — keeping those is where the real CO₂ save is.
>
> **Spend:** only on **certified refurbished items**. Never generic cashback.

Why this design wins Q&A:
- **Outcome-verified, not click-rewarded.** Credits are promised at checkout (*"Keep this order → +15 green credits"*) but land only at return-window expiry. There's no button to game — you earn by *not* acting, and time is the proof.
- **Returns are never rewarded.** A return simply means no credits vest for that order. The incentive points one direction only: keep what you buy.
- **The redemption rule creates a flywheel.** Rewards for keeping orders can only be spent on second-life inventory — so prevention (Pillar 4) funds refurb demand (Pillar 5), which consumes the graded returns from Pillars 1–3. The loop is closed by construction.

The km/CO₂ numbers (≈0.21 kg CO₂/km last-mile factor, computed by the EV optimizer) appear on the customer's **impact dashboard** ("your returns this year traveled 92% fewer km") — visible pride, not currency. Demo toast in Priya's flow: *"590 km · 4.2 kg CO₂ saved."*

**"Certified Refurbished For You" rail:** Implicit ALS collaborative filtering trained on **Amazon Reviews 2023** (real data, trains in minutes on CPU, gives a real Recall@20 metric), plus a **hybrid cold-start blend**:

```
score = α·ALS  +  β·CLIP_similarity(item, user history)  +  γ·grade_boost  +  δ·proximity_boost
```

The CLIP leg is free (embeddings already computed in Pillar 1) and solves the hard problem: a freshly graded item with zero interaction history still gets recommended the moment it enters inventory. On stage: Rahul's just-graded baby monitor **appears in a nearby parent's recommendation rail** seconds later — Pillar 5 stitched directly into the P2P story.

---

## 4. Architecture

```
                 ┌─────────────────────────────────────────────┐
                 │   React App (8 pages, persona switcher)     │
                 │  Return flow · Sell-It · Shop · Checkout · Dashboard │
                 └────────┬───────────────┬────────────────────┘
                          │ REST          │ WebSocket (live grading)
                 ┌────────▼───────────────▼────────┐
                 │   Django REST Framework API      │
                 └─┬───────┬───────┬───────┬──────┬┘
        ┌──────────▼─┐ ┌───▼────┐ ┌▼─────┐ ┌▼───────┐ ┌▼──────┐
        │ grade      │ │ route  │ │trust │ │prevent │ │green  │
        │ GDINO+Claude│ │ LGBM EV│ │Hash  │ │GBDT    │ │ALS+   │
        │ +CLIP+video│ │ +geohash│ │chain │ │risk    │ │wallet │
        └──────┬─────┘ └───┬────┘ │+QR   │ └───┬────┘ └───┬───┘
               │           │      └──┬───┘     │          │
        ┌──────▼───────────▼─────────▼─────────▼──────────▼───┐
        │  PostgreSQL (items, cards, credits, ledger) + Redis (demand) │
        └───────────────────────────────────────────────────────┘
```

**Prototype stack:** React + Tailwind + Leaflet (frontend) · **Django + Django REST Framework** (API + ORM) · PostgreSQL · Redis · Celery (async grading/batch) · Grounding DINO · vision LLM via **OpenRouter** (provider-pluggable → Amazon Bedrock in production; Qwen2.5-VL local fallback) · CLIP · OpenCV · LightGBM · `implicit` ALS · qrcode/python-jose.

### The AWS Story (judges are Amazon/AWS leaders — say this slide out loud)

Every prototype component has a **named AWS production counterpart**. This is not a prototype; it's a blueprint:

| Prototype component | AWS production service |
|---|---|
| Vision-LLM grading (demo: **OpenRouter**) | **Amazon Bedrock** (Claude is natively on Bedrock — the call is provider-abstracted, so the swap is one env var + client init; same Claude Haiku model) |
| Grounding DINO defect detection | **AWS IoT Greengrass** edge nodes — sub-200ms triage on warehouse docks and in the shopper's app |
| LightGBM / ALS / GBDT models | **Amazon SageMaker** training + Pipelines: CloudWatch monitors inference drift → auto-retrain → shadow A/B promotion |
| EV routing engine | **AWS Lambda + Step Functions** (event-driven, millisecond, infinitely horizontal) |
| Clickstream for prevention | **Amazon Kinesis** |
| Health Card hash-chain ledger | **Amazon Aurora PostgreSQL** with ledger semantics (AWS's recommended successor to the discontinued QLDB) |
| PostgreSQL / Redis | **Amazon RDS (Aurora PostgreSQL) / ElastiCache** — the DB and the Health Card ledger are the same Postgres, so the ledger story is native |
| Demo media + datasets | **S3** |

---

## 5. The Product Experience — Every Page, Every Flow

One React app. A **persona switcher** in the top bar (Priya / Hub Agent / Rahul / Buyer / Small Seller / Ops) lets us jump between roles instantly during the demo — no logins, no friction on stage. **8 pages total**, built from shared components (`GradeCard`, `HealthCard`, `MapPanel`, `CreditsToast`, `RecRail`), all owned by M3.

### The pages at a glance

| # | Page | Route | Who uses it |
|---|---|---|---|
| P1 | My Orders | `/orders` | Priya — starting point of a return |
| P2 | Return Wizard | `/return/:orderId` | Priya — reason + handover choice (hub drop / doorstep pickup); optional self-scan |
| P3 | Grading & Routing Result | `/return/:orderId/result` | Agent runs the guided scan (same grading screen, "Hub Agent" persona); Priya sees refund + impact + routing map |
| P4 | Sell-It (P2P listing) | `/sell` | Rahul — scan → AI builds the listing |
| P5 | Refurbished Marketplace | `/shop` | Any buyer — "Certified Refurbished For You" rail |
| P6 | Product Detail + Health Card | `/shop/item/:id` | Buyer — verified condition, QR, buy via Amazon checkout |
| P7 | Checkout (with prevention nudge + credits) | `/checkout` | Any customer — where Pillar 4 and credit redemption live |
| P8 | Seller / Ops Dashboard | `/dashboard` | Small Seller (bulk grading tab) + Ops (review queue + EV breakdown tab) |

### Flow A — Priya returns her ₹500 shoes (P1 → P2 → handover scan → P3)

**Priya never photographs anything.** Her total effort is two taps; the AI inspection happens at the handover point, operated by the agent.

```
P1 My Orders            P2 Return Wizard          Handover scan (AGENT app)    P3 Result (Priya's phone)
┌────────────────┐      ┌───────────────────┐     ┌───────────────────────┐    ┌──────────────────────────┐
│ Nike Shoes ₹500│      │ Reason: didn't    │     │ Guided capture at the │    │ 💸 Refund issued —       │
│ [Return item]  │ ───► │  fit ▼            │ ──► │ kirana hub / doorstep │ ──►│   before she leaves      │
│                │      │ Handover:         │     │ [defect boxes overlay]│    │   the store              │
│ Echo Dot ₹3,499│      │ ◉ Drop at hub     │     │ GRADE B · 91% · 1.4s  │    │ 🍃 590 km · 4.2 kg CO₂   │
│ [Return item]  │      │   (200 m away)    │     │ "Light wear, box      │    │   saved vs warehouse trip│
└────────────────┘      │ ○ Doorstep pickup │     │  missing"             │    │ [map: resell locally     │
                        │ ─────────────     │     │ → ROUTE: LOCAL RESALE │    │  ₹312 vs warehouse ₹–40] │
                        │ ⚡ or scan it      │     └───────────────────────┘    └──────────────────────────┘
                        │ yourself now for  │
                        │ refund before     │
                        │ handover (optional)│
                        └───────────────────┘
```

Key design points:
- **Default path = zero customer effort.** Drop at the hub → the agent's guided scan (consistent angles, good lighting, trusted hands) grades it in ~2s → refund fires on the spot. If she chooses doorstep pickup, the **delivery agent's app runs the same scan at her door** — refund on her doorstep.
- **Self-scan is an optional express lane**, never a requirement — for customers who want the refund and grade preview before handover.
- **Agent capture = fraud protection for free:** no stale or faked customer photos; the graded images are taken by a trusted operator and hashed into the Health Card at the moment of handover.
- The agent scan + Priya's P3 result are staged as a 3-beat animation (grade appears → routing map animates → refund toast on her phone) — the single most important moment in the demo.

### Flow B — Rahul sells his baby monitor, zero contact (P4 → sold)

1. **P4 Sell-It:** Rahul photographs the monitor → same grading pipeline runs → the page assembles a **complete draft listing for him**: grade A, suggested price ₹1,840 (LightGBM), auto-written condition summary, Health Card preview. His total effort: photos + one tap on "List it."
2. The demand panel shows the match: *"📍 47 parents within 8 km searched for baby monitors this month."*
3. When a buyer purchases (Flow C), Rahul gets a notification: *"Sold! Drop at your nearest Amazon Hub point (kirana partner store, HSR Layout) by Friday — or a delivery partner collects it on tomorrow's route."* No chat, no haggling, no strangers at the door.

### Flow C — A buyer discovers and trusts a second-hand item (P5 → P6 → P7)

1. **P5 Marketplace:** the "Certified Refurbished For You" rail (hybrid ALS + CLIP ranking) — and Rahul's just-listed monitor is in it, rescued from cold start by the CLIP content leg.
2. **P6 Product Detail:** the trust moment. The **Health Card** front and center: AI grade with defect photos, completeness check, ownership chain (1 owner), grading model version, scannable GS1 QR — and the price vs. new comparison (₹1,840 vs ₹3,200 new). The buyer knows *exactly* what they're getting; that's the PS's trust problem answered on one screen.
3. **P7 Checkout:** standard Amazon-style checkout + **"Redeem 220 green credits (–₹22)"** toggle + delivery via locker pickup. The circular loop closes: credits earned from returns spent on refurbished goods.

### Flow D — Prevention: the return that never happens (P7)

A customer's cart holds the same shoe in size 8 *and* 9 (bracketing). The prevent-service flags it and **P7 Checkout** renders the nudge chip:

> 👟 *"Customers with your purchase profile kept **size 8** in this brand — size 9 was returned 3× more. Remove size 9?"* — [Remove it] [Keep both]
>
> 💚 *"Keep this order → **+15 green credits** when your return window closes."*

One tap → one shipment, no return. The nudge is helpful, never blocking — and the credits **vest only when the return window expires with nothing returned**, so the reward is for the verified outcome, not the click.

### Flow E — The Small Seller clears 12 returns in 20 seconds (P8)

**P8 Dashboard, "Bulk Grade" tab:** drag 12 photos in → a table fills row by row in real time: thumbnail · grade · price · routing decision · margin recovered. Footer: *"12 items processed in 21s · ₹3,480 recovered · 0 manual inspections."* The **Ops tab** shows the EV breakdown per item and the human-review queue (low-confidence grades land here — our honest answer to "what if the AI is wrong?").

### How the flows interlock (the full circle)

```
 Pillar 4 prevents what it can ──► P7 nudge ──► order kept ──► return window closes
            │ (the rest)                                          │
            ▼                                                     ▼
 Priya returns (P1–P3) ──► graded + routed locally ──► inventory  GREEN CREDITS VEST
 Rahul lists (P4)      ──► graded + Health Card    ──► inventory       │
                                       │                              │
                                       ▼                              ▼
                    Buyer discovers (P5), trusts (P6) ◄── credits spendable ONLY on
                    and buys refurbished (P7)             refurbished items
```

### Demo scene → page mapping (for the video and stage)

| Demo scene | Pages shown | Live or cached |
|---|---|---|
| Scene 1: Priya | P1 → P2 → agent scan (persona switch to "Hub Agent") → P3 | **One live grade on stage**; cached for video |
| Scene 1b: video grading | P2 (video upload) → P3 | Cached |
| Scene 2: Rahul P2P | P4 → P5 (buyer's rail) → P6 | Cached |
| Scene 3: Small Seller | P8 bulk tab | Cached batch |
| Scene 4: Prevention | P7 nudge | Scripted cart |
| Q&A safety net | P8 ops tab (review queue, EV breakdown) | Live |

---

## 6. Datasets (all public, downloadable Day 0)

| Need | Dataset | Used for |
|---|---|---|
| Resale pricing | **Mercari Price Suggestion** (Kaggle, 1.4M listings) | LightGBM price model conditioned on grade |
| Catalog + reference images | **Amazon Berkeley Objects (ABO)** | CLIP completeness check, demo catalog |
| Defect detection | *none needed* — Grounding DINO is zero-shot | — |
| Return-reason priors **and** recommender training | **Amazon Reviews 2023 (UCSD/McAuley)** — one Electronics or Clothing 5-core subset | One download, two uses: prevention priors + ALS vectors |
| Demand index, return histories | **Synthetic generator** (geohash-distributed; clearly labeled synthetic) | Demo realism |

---

## 7. Execution Plan — June 12 evening → June 15, 11:59 PM

**Team:** M1 = ML/vision · M2 = ML/routing + data · M3 = backend + frontend. AI pair-programming assumed throughout — these are aggressive but honest targets.

### 🌙 Day 0 — Tonight, June 12 (3–4 hrs): De-risk everything
- **M1:** Run Grounding DINO on 10 sample photos (shoes, electronics, clothing). Tune prompts until boxes are clean. **Measure latency** — if CPU is over 2s, set up free Colab T4 + ngrok now, not later. Get an OpenRouter API key, test one vision-LLM call (OpenAI-compatible endpoint).
- **M2:** Start Mercari + Amazon Reviews 2023 downloads (the big one is ~1.7 GB — start it tonight). Skim features.
- **M3:** Repo scaffold: Django project + 5 apps (grade/route/trust/prevent/green), docker-compose (PostgreSQL + Redis), stub all DRF endpoints, React shell with the 8-page routing skeleton.
- ✅ **Day 0 exit check:** defect boxes render on a real photo; datasets downloading; `docker-compose up` works.

### ⚙️ Day 1 — Friday, June 13: Core ML + services
- **M1:** Full grading pipeline — GDINO defects + Claude captioning (detections injected into prompt) + CLIP completeness → Grade A–D JSON. Defect-overlay rendering. Image cache (`grade_cache.json`, SHA-256 keyed) so demo hits are instant.
- **M2:** LightGBM price model on Mercari (300k-row sample, trains in minutes — report RMSLE). Sell-probability model. EV optimizer. Geohash demand-index generator → Redis.
- **M3:** trust-service (signed JSON + hash chain + GS1-style QR). Wire the seller flow end-to-end: **upload → live grade → Health Card on screen**.
- ✅ **Day 1 exit check:** one photo goes photo → grade → price → routing decision → Health Card, end to end.

### 🔗 Day 2 — Saturday, June 14: Integration + Pillar 5 + demo scenes
- **M1:** Video frame sampler (~30 min). Then batch-grading endpoint for the Small Seller scene. Help M3 with polish.
- **M2:** ALS recommender on Amazon Reviews subset (trains <5 min on CPU; report Recall@20/NDCG@20). Hybrid scoring endpoint (ALS + CLIP + grade + proximity). Prevention GBDT + checkout-nudge API.
- **M3:** green-service (`POST /credits/vest` — fired when an order's return window closes with no return (simulated clock in the demo) — plus `GET /credits/{user}`; ~40 lines). Leaflet demand heatmap + routing animation. Buyer view: QR card, refurb rail, wallet widget. Ops console with EV breakdown.
- ✅ **Day 2 exit check:** all 4 demo scenes click through without crashing.

### 🎬 Day 3 — Sunday, June 15: Polish, record, submit (NOTHING new after noon)
- **Morning:** bug-fix pass; **pre-grade every demo item into the cache** (zero API dependency during recording); metrics slide (latency, RMSLE, Recall@20, EV uplift on a synthetic 1,000-return cohort, km/CO₂ saved).
- **Afternoon:** record the **3-minute demo video** (script below), README, architecture diagram, deck.
- **Evening:** submission package assembled by **9 PM** — a 3-hour buffer before the 11:59 PM deadline. Dry-run the pitch ×3.

### ✂️ Cut-lines (decide at Day 2 noon, in this order, no guilt)
1. ALS rail → static mock data (keep the offline Recall@20 number for the slide)
2. Video grading → skip (mention as roadmap)
3. Ops console → screenshots instead of live
4. **Never cut:** Pillar 1 grading, Pillar 2 routing + map, Health Card, the Priya scene.

---

## 8. The 3-Minute Demo Video Script

| Time | Scene | What happens on screen |
|---|---|---|
| 0:00–0:20 | Hook | "₹850 billion of products were returned last year. Most travel hundreds of km to die in a warehouse. Meet Priya." |
| 0:20–1:00 | **Priya** | Two taps to return → cut to the kirana hub: agent's guided scan → defect boxes + "Grade B, 1.4s" → map animates: local buyer 5 km away, *"Resell locally ₹312 vs Warehouse ₹–40"* → Priya's phone buzzes: instant refund + *"590 km · 4.2 kg CO₂ saved"* |
| 1:00–1:40 | **Rahul** | Baby monitor scan → Health Card with QR → "47 parents within 8 km" → Amazon checkout + locker handoff → his monitor pops up in a neighbor's "Certified Refurbished For You" rail |
| 1:40–2:10 | **Small Seller** | 12 returns bulk-uploaded → all graded/priced/routed in ~20s → "200 manual inspections per month, eliminated" |
| 2:10–2:30 | **Prevention** | Checkout with 3 shoe sizes → nudge: "Your profile keeps size 8" → return never happens |
| 2:30–3:00 | Scale + AWS | Architecture slide with the AWS mapping table → "Every component has a named AWS production counterpart. Per item routed locally: ~590 km avoided, 3–5× value recovered. Multiply by Amazon's return volume." |

---

## 9. Metrics We Quote (memorize these)

- **Grading latency: <2s per item** — demonstrated live
- **Pricing: RMSLE ≈ 0.45–0.50** on Mercari holdout (real-data number)
- **Recommendations: Recall@20 / NDCG@20** on Amazon Reviews 2023 (real-data number)
- **EV uplift: 3–5× recovered value** vs. naive liquidation (synthetic 1,000-return cohort)
- **~590 km saved per locally routed item; ~4.2 kg CO₂ each**
- **Prevention: F1-score** as the primary metric (false positives waste intervention budget; false negatives miss preventable returns — F1 balances both; AUC reported secondary)

---

## 10. Judge Q&A Cheat Sheet

| Pushback | Our answer |
|---|---|
| "It's just a resale marketplace." | The marketplace is the *output*. The product is the **decision engine** — grading + EV routing + demand gravity. That bridge doesn't exist today. |
| "Won't green credits encourage *more* returns?" | The opposite — credits are earned **only by keeping orders**: they vest when the return window closes with nothing sent back. A return means no credits, period. It's a verified outcome, not a button click, so there's nothing to game — and they're spendable only on refurbished items, so the reward feeds second-life demand. |
| "AI grading will be wrong sometimes." | Confidence-gated: low-confidence items go to a human spot-check queue (visible in our ops console). The Health Card records the model version — fully auditable. |
| "Asking customers to photograph returns is friction." | They don't — the default return is two taps. The **agent** at the hub or doorstep runs the guided scan: zero customer effort, consistent capture quality, and trusted photos (no fraud via stale images). Self-scan exists only as an optional express lane; photos are required only where they *are* the product — Rahul's P2P listing. |
| "P2P trust is unsolved." | Exactly why it runs *through* Amazon: verified Health Card + Amazon payments + locker handoff. Trust is borrowed, not rebuilt. |
| "Why not blockchain?" | Blockchain solves consensus between distrusting parties; we have one trusted authority and only need tamper-evidence. A hash chain delivers that at zero overhead. Production: Aurora PostgreSQL ledger. |
| "Will zero-shot detection work on all products?" | It generalizes by design via text prompts; we validate on shoes, electronics, clothing. Edge cases route to the human-in-the-loop queue. |
| "New refurb items have no interaction history — cold start?" | That's why the hybrid blend exists: the CLIP content leg scores an item the moment it's graded, zero interactions needed. |
| "Why ALS, not a transformer recommender?" | ALS ships in 3 days and gives interpretable vectors with competitive Recall@20. Production path is LightGCN/SASRec — the architecture is right, the model is swappable. |
| "Is this on AWS?" | The vision call is provider-abstracted — the demo routes through OpenRouter, and one env var switches it to Amazon Bedrock running the same Claude Haiku. Every component has a named AWS counterpart (Section 4 table). |

---

## 11. Judging Criteria — How We Score

| Criterion | Our play |
|---|---|
| **01 Quality of Presentation** | Story-first: three personas, four crisp demo scenes, one number per scene. No jargon walls. |
| **02 Quality of Implementation** | Working end-to-end prototype: live grading <2s, real datasets (Mercari, Amazon Reviews), real metrics (RMSLE, Recall@20), polished 3-view UI. |
| **03 Technical Architecture** | 5 microservices, stateless millisecond routing, edge-ready grading, full AWS production mapping, MLOps drift-retraining story. |
| **04 Futuristic Vision** | Health Card = Digital Product Passport, the EU-mandated standard by 2027 — Amazon becomes the *infrastructure* of global circular commerce, not just a retailer. Roadmap: Renewed API integration, drone-based 30-min P2P transfers, cross-retailer passport network. |

---

## 12. Closing Line of the Pitch

> *"Amazon's promise has always been: from need to done. REVIVE extends that promise to the product's second life — every return becomes someone's perfect purchase, 5 km away instead of 600. That's good for Priya, good for Rahul, good for sellers, good for Amazon, and good for the planet."*
