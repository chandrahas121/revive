# PROJECT REVIVE — Final Implementation Blueprint **v2**
### Amazon HackOn · Every product deserves a second life

> **This is version 2 of `final_idea.md`.** It keeps the winning core — AI grading, two-stage EV routing, demand-gravity model, Health Card, Green Credits — and fixes the architectural flaws found while building v1. The biggest change: **"tier" is gone as a single customer-facing number.** It is replaced by two independent things — a **Category Profile** (what to capture and how to grade, driven by product type) and a backend-only **Risk Tier** (how much to verify and guarantee, driven by value). A second major change: a returned item no longer flows blindly into "Revive." A **Disposition Gate** decides — exactly as real retailers do — whether it goes back as *New*, becomes *Open-box/Used*, is *Refurbished (Renewed)*, or is *recycled/donated*.

---

## 0. What Changed in v2 (Changelog)

| # | v1 problem | v2 fix | Section |
|---|------------|--------|---------|
| Q1, Q7 | Tier (price band) drove photo prompts → a ₹6,000 shoe was asked for a "powered-on screen" photo | Photo prompts come from the **Category Profile**, never from price | §2, §5, §8 |
| Q5 | Risk tier was shown to the customer; valuable items mis-tiered from typed price | Risk tier is **backend-only**; value comes from the **catalog-matched MRP** | §2, §3 |
| Q2 | Seller typed any "original price"; no catalog | **Catalog match → anchored MRP & suggested price**; bounded seller input; no need to host Amazon's catalog | §4.1 |
| Q3 | No way to delist | **Delist / pause** control + listing status lifecycle | §8 (S4b) |
| Q4 | Wrong-image check passed a *different* shoe for a shoe return | Two-stage match: **VLM/CLIP category gate + DINOv2 instance gate** vs the catalog reference | §4.2 |
| Q6 | Same photo could fill every angle slot | **Perceptual-hash dedup + per-slot view validation** | §4.2 |
| Q8 | Single A–D scale, no category-specific checklist | **Per-category rubric**, **cosmetic grade *and* functional status**, scale extended to **E (repair/parts)** and **F (recycle)** | §4.3 |
| Q9 | Trained price model not wired to serving; pricing ignored catalog & defects | Wire the model end-to-end; price = f(catalog MRP, grade, functional status, **per-defect deductions**, demand) | §4.1 |
| Q10 | Demand index was synthetic | Same gravity algorithm, fed from **real order/search history**, refreshed on schedule | §4.4 |
| Q11 | Three browse silos (Revive/Renewed/Warehouse); unclear "as-is" and broken-seal handling | **Disposition Gate** + **one unified catalog** with **category-aware condition labels** shown as buying options | §3, §6, §8 |

---

## 1. The Idea in One Breath

> **REVIVE is an AI decision engine for returned and unused products. It identifies the exact product from Amazon's catalog, grades its condition in under 2 seconds against a category-specific rubric, decides the item's most economically and environmentally optimal second life — restock as new, resell locally, refurbish centrally, donate, or recycle — keeps items inside the city instead of shipping them 600 km back to a warehouse, certifies every item with a verifiable Product Health Card, rewards buyers who keep their orders with Green Credits, and predicts bad purchases before they happen.**

We are not building a resale marketplace. Marketplaces exist. We are building the **intelligent bridge** between a product and its next owner — the decision layer that today simply does not exist inside Amazon.

---

## 2. The Core Correction — Two Independent Axes

v1's mistake was a single number, `tier`, derived only from price, that tried to answer three unrelated questions at once: *what is this thing, how risky is it, and how should we verify it?* That fused product type with value, so a ₹6,000 Nike Air Max (mid-price) was treated as "electronics" and asked for a screen-on photo.

v2 splits this into two axes that never touch each other:

### Axis A — Category Profile (product type) → *customer-facing, drives capture & grading*

Derived from the catalog match (§4.1). Decides:
- which **photos/evidence** to capture (the prompts the customer or agent sees),
- the **grading rubric** (what to inspect),
- the available **condition labels**.

| Category Profile | Capture prompts | Rubric (what's graded) | Condition labels available |
|---|---|---|---|
| **Apparel** | front, back, fabric close-up, label/tag, defects? | pilling, stains, holes/tears, fading/shrinkage, zippers & buttons, **tags present**, alterations | New w/ tags · Like new · Used A–D |
| **Footwear** | top, side, **sole**, insole, box/tag, defects? | sole wear/separation, insole, upper creasing, scuffs, odor, box & laces | New w/ tags · Like new · Used A–D |
| **Phone / Tablet** | front, back, **screen powered on**, ports, accessories, defects? | screen (cracks/dead pixels), **boots/powers on**, **battery %**, ports, dents, accessories | New (sealed) · Open box · Renewed · Used A–D |
| **Laptop** | lid, base, **screen powered on**, keyboard, ports, accessories | screen, boots, battery health, keyboard/trackpad, hinges, ports | New (sealed) · Open box · Renewed · Used A–D |
| **Home & Kitchen / Appliance** | front, back, plug/cord, **power-on if electrical**, accessories | dents, cracks, electrical function, completeness, hygiene | Open box · Used A–D |
| **Books / Media** | cover, spine, inside pages | binding, page wear, markings, water damage | Like new · Used A–D |
| **Beauty / Hygiene** | sealed packaging, label, expiry | **seal intact (mandatory)**, expiry date, packaging | New (sealed only) — else **reject** |
| **Toys** | front, back, parts laid out, defects? | completeness, function, safety, packaging | New w/ tags · Used A–D |

> A ₹6,000 Nike Air Max is **Footwear** → it gets *sole/insole/box* prompts and is graded on *sole wear & creasing*. It is **never** asked for a powered-on screen, no matter what it costs.

### Axis B — Risk Tier (value × fraud-risk) → *backend-only, drives verification & guarantee*

Computed from the **catalog-matched MRP** and the category's fraud-risk, never from the seller's typed price, and **never shown to the customer.**

```python
def risk_tier(catalog_mrp, category_profile):
    high_fraud = category_profile in {"Phone","Tablet","Laptop","Camera","Jewelry","Watch"}
    if catalog_mrp > 10000 or (high_fraud and catalog_mrp > 4000):
        return "HIGH"     # AI + SPN node / agent; 90-day; SPN- or seller-liable
    if catalog_mrp > 2000 or high_fraud:
        return "MEDIUM"   # AI + agent doorstep; 30-day; seller-liable + A-to-Z
    return "LOW"          # AI-only; 7-day; seller-liable via escrow
```

| Risk Tier | Inspection path | Guarantee | Liable party | Route eligibility |
|---|---|---|---|---|
| LOW | AI cosmetic grading only | 7-day "not as described" | Seller (escrow) | A, B, C, Donate |
| MEDIUM | AI + Flex-agent doorstep / functional check | 30-day cosmetic + functional | Seller (escrow) + A-to-Z backstop | A or C (B blocked for electronics) |
| HIGH | AI + SPN node professional inspection | 90-day full functional | Amazon SPN partner | C (SPN) only |

**The customer never sees "Tier." They see plain prompts ("Add a photo of the soles") and a guarantee badge ("90-day coverage").** Risk Tier lives only in the routing engine, the ops console, and the Health Card metadata.

> Why a *fraud-risk* term and not pure price? A ₹4,500 phone is cheap but highly fraud-prone (IMEI swap, dead battery) and warrants agent verification; a ₹4,500 cast-iron pan does not. Pure-price tiering can't tell them apart — that was the Q5 mis-tiering.

---

## 3. Core Architecture Principles (v2)

**Rule 1 — List before you move.** An item physically moves only when a buyer exists. Unused items stay at the seller's home, listed. Returned items are held short-term at a kirana. Nothing enters a warehouse until it fails to sell locally. (Poshmark / Cahoot / ThredUp Direct model.)

**Rule 2 — Inspection is always two layers.** AI computer vision handles cosmetic grading. A second layer — agent guided capture, customer screenshot, or SPN node — handles functional verification. The depth of layer 2 is set by **Risk Tier**, the content of both layers by **Category Profile**.

**Rule 3 — Category and value are separate (the v2 correction).** *Category Profile* decides what to capture and how to grade. *Risk Tier* decides how hard to verify and how long to guarantee. Neither is ever collapsed into the other, and Risk Tier is never shown to the customer. (§2)

**Rule 4 — Not every return becomes "second-life." A Disposition Gate decides.** Mirroring how Amazon and major retailers actually handle returns: a verified unopened item goes back to the **New** catalog; only opened/used items become Open-box / Used / Renewed; broken items go to parts or recycling. (§6)

**Rule 5 — Sellers get money, buyers earn credits.** Sellers receive a UPI transfer after the buyer's return window closes. Green Credits are exclusively a buyer-side reward for *keeping* a purchase, only via kirana self-drop.

**Rule 6 — The routing algorithm is two-stage.** Stage 1 (demand gate) runs continuously while the item waits. Stage 2 (EV routing) runs once, when a buyer exists, and picks the cheapest path to that buyer.

---

## 4. The Engine — Five Capabilities

### 4.1 Catalog Match & Pricing (fixes Q2, Q5, Q9)

**You do not download Amazon's catalog. You match against it.** Most second-life inventory was *bought on Amazon*, so the ASIN is already known. Identification, in order of confidence:

1. **From the order** — returns and "unused" listings created from a past order already carry the ASIN. (Most common path.)
2. **Barcode / ASIN / EAN scan** of the box.
3. **Catalog search API** — text query against Amazon's product search (you call it; you don't host it).
4. **Image search** — visual lookup as a last resort.

Once matched, the system **auto-fills** the canonical MRP, brand, model, and spec, and **the seller never types the original price.** This:
- gives Risk Tier a trustworthy value (fixes the Q5 mis-tier),
- gives the pricing model real features (brand/model/MRP), and
- supplies the **catalog reference image** used by the instance-match check (§4.2).

**Pricing.** The system computes a **suggested resale price**; the seller may nudge it within a **bounded band (±15%)**, not type an arbitrary number.

```
suggested_price = f(catalog_MRP, category, cosmetic_grade, functional_status,
                    per_defect_deductions, local_demand, brand, model, age)
```

- Anchored on the **catalog MRP**, then a **grade/condition recovery curve** is applied, then **specific per-defect deductions** (a cracked screen subtracts a fixed amount, not just a letter), then a small demand adjustment.
- The trained model (`train_price_model.py`, Mercari TF-IDF + MLP ensemble, RMSLE ≈ 0.42) supplies the market-relative resale signal. **v2 fixes the serving gap:** v1 trained Keras models but the server loaded a pickle — these are now the same artifact, wired end-to-end.

**Long-tail / no catalog match.** Fall back to seller-declared MRP **with guardrails**: cap against market comparables, require a receipt photo above a value threshold, and flag for light manual review. Minority path.

### 4.2 Image Integrity & Product Verification (fixes Q4, Q6)

Three checks run on every uploaded/captured image set:

1. **Category gate (VLM / CLIP)** — *is this even the right kind of thing?* (Headphones are not shoes.) Cheap and robust; this is v1's existing `verify.py` behaviour.
2. **Instance gate (DINOv2)** — *is this the right model?* Cosine similarity between the upload and the **catalog reference image** (now available from §4.1). DINOv2 is the right tool: on fine-grained visual tasks it vastly outperforms CLIP, so it can tell a *different* shoe from *this* shoe — which the category gate cannot. Below a calibrated threshold → flag "doesn't match the listed model." Where no catalog reference exists, the gate falls back to cross-angle consistency against the seller's own first photo.
   - *Honest scope:* two plain black t-shirts are indistinguishable to any model; the instance gate matters most for branded/high-value items with a catalog reference — which is exactly where fraud risk concentrates.
3. **Angle / duplicate gate (fixes Q6)** — a **perceptual hash (pHash/dHash)** rejects near-identical uploads ("this looks like the same photo — please capture the soles"), and the VLM confirms each image matches the **requested view** for its slot (front vs back vs sole).

### 4.3 AI Grading — per-category rubric, two axes, A–F (fixes Q8)

The pipeline (Grounding DINO defect detection → vision-LLM caption → CLIP completeness → fusion head) is retained. v2 adds:

1. **A per-category rubric (checklist of *what* to inspect),** taken from the Category Profile (§2). v1 already had category-aware severity *thresholds*; v2 adds the category-specific *inspection points* (soles for shoes, tags for clothing, boots/battery for phones).
2. **Two separate output fields** (the Back Market model — "a grade describes cosmetic condition, not functionality"):
   - **Cosmetic grade:** A / B / C / D
   - **Functional status:** Pass / Fail / Untested (+ key metrics, e.g. battery %)
3. **Extended terminal grades** so routing and pricing have clean states:

| Grade | Meaning | Routing / pricing |
|---|---|---|
| A | Like new | Resell as-is · highest recovery |
| B | Very good (minor wear) | Resell as-is |
| C | Good (visible wear) | Resell as-is · discounted |
| D | Heavy cosmetic damage, still functional | Refurbish or steep discount |
| **E** | **Functional defect — needs repair / for parts** | SPN refurb or parts · salvage price |
| **F** | **Not resellable — recycle / donate only** | Recycle / donate · price ≈ 0 |

**Confidence gating** (unchanged): below 70% model confidence → human spot-check queue in the ops console; model version + confidence recorded on the Health Card.

### 4.4 Two-Stage Smart Routing & Demand Index (fixes Q10)

The two-stage structure (demand gate + EV routing) and the **geohash demand-gravity model** are retained — they are the differentiator. v1 already implements a real geohash decode, haversine, and gravity decay (`demand / (1 + dist²/25)`).

**v2 fix:** the demand index is no longer seeded-random synthetic. The same pipeline (`build_demand_index.py`) is fed from **real order + search history** aggregated per `(geohash5, category)` over a trailing window, **refreshed every 6 hours**, stored in Redis (`HSET demand:{geohash5} {category}`), with the JSON artifact as offline fallback. Geohash precision is configurable (geohash-5 ≈ 5 km for cities; geohash-6 for dense metros). For the demo we label it a seeded index honestly and showcase the *gravity routing*, which is the contribution.

**Live location → local demand (new in v2).** Two distinct locations feed the index:
- **Seller / return location** drives *routing* (where the item physically is). Captured at listing/return time.
- **Buyer location** drives *discovery* (the "Near me" storefront and the "X buyers near you searched for this" demand signal). v2 **asks the buyer for their current location** (browser Geolocation API, with a manual pincode fallback if denied), converts the `(lat, lng)` to a **geohash cell via a `geohash_encode()` function**, and uses that cell to (a) sort/filter the storefront by proximity and (b) look up the local demand score for that cell + category. The captured location is stored on the user profile (`lat`, `lng`, `geohash5`) so it persists across sessions and is reused by the demand gate. Location is requested once, with a clear reason ("to show second-life deals near you and estimate local demand"), and can be changed anytime.

### 4.5 Return Prevention & Green Credits

Unchanged from v1 in mechanism (see §11–§13). Return-risk GBDT at checkout drives size/fit nudges and bracket detection; a "keep it → earn credits" nudge at return initiation. Green Credits are buyer-only, category-weighted, vest only on kirana self-drop + window close. (Full rules retained in §11.)

---

## 5. The Trust Layer — Product Health Card

Generated at grading time as a signed JSON record with a GS1-style QR code. v2 contents:

- Unique REVIVE item ID (LPN-style internal barcode)
- **Catalog match:** product name, model, ASIN, match confidence
- **Cosmetic grade (A–F)** + confidence + defect list with bounding-box photos
- **Functional status** (Pass/Fail/Untested) + key metrics (battery %, IMEI for phones; sensor/port results for HIGH tier)
- **Condition label** (category-aware: New w/ tags · Open box · Renewed · Used A–D · For parts) — §6
- Who inspected: AI-only / AI + agent doorstep / AI + SPN node (set by Risk Tier)
- Previous owner count
- Guarantee window (7 / 30 / 90 day) + guarantee holder
- SHA-256 hash (tamper-evident; production: Aurora PostgreSQL ledger)
- Scannable QR to the live Health Card page

Amazon's A-to-Z Guarantee is the universal backstop across all tiers. **Risk Tier is stored as metadata but is not rendered as a customer-facing badge** — the customer sees the guarantee and the inspection wording, not "Tier 3."

---

## 6. The Disposition Gate — what actually happens to a returned item (Q11, made concrete)

**This is how real retailers operate, and v1 got it wrong by funnelling everything into "Revive."** In reality (Amazon FBA returns, Amazon's own Grade-and-Resell program, Apple, general retail), a returned unit is inspected and routed down a **disposition tree** — and a return *can* be sold as new, but **only if it is verified unopened and in original condition.** Once opened or used, it can never be "New" again; it becomes Open-box, Used, or Refurbished.

### The decision tree (runs immediately after grading + verification)

```
Returned / listed item
        │
        ▼
 Is it sealed / unopened / unused AND passes verification?
        │
   ┌────┴─────┐
  YES         NO
   │           │
   ▼           ▼
RESTOCK     Was it opened but is functionally new (grade A, all accessories)?
AS NEW          │
(normal     ┌───┴────┐
 catalog,  YES       NO
 full price)│         │
            ▼         ▼
        OPEN BOX   Functional with cosmetic wear (grade B–D)?
        (unused,       │
         seal     ┌────┴─────┐
         broken) YES         NO
                  │           │
                  ▼           ▼
            USED / REVIVE   Grade E (needs repair) → SPN REFURB → relist as RENEWED
            (grade-labeled)  Grade F (dead)       → RECYCLE / DONATE
                             Unsafe / hygiene / expired → DISPOSE (often returnless)
                             High-value defective → RETURN TO VENDOR (optional)
```

### The five disposition outcomes

| Outcome | When | Where it lists | Price |
|---|---|---|---|
| **Restock as New** | Sealed/unopened, verified original condition | Normal catalog as **New** | Full price |
| **Open box** | Opened but unused, grade A, complete | Unified catalog, **"Open box"** offer | Slight discount |
| **Used (Revive)** | Used, grade B–D | Unified catalog, **"Used – Like New/Very Good/Good/Acceptable"** offer | Grade-adjusted |
| **Renewed (refurbished)** | Grade D–E electronics, refurb economical, or HIGH tier | Unified catalog, **"Renewed"** offer (SPN-tested, 90-day) | Renewed price |
| **Recycle / Donate** | Grade F, unsafe, expired, hygiene | Exits marketplace → NGO / e-waste | ₹0 |

### Sealed vs broken seal — handled by the **category-aware condition taxonomy**

There is no single rule across categories — the Category Profile decides which "top" states exist:

| | Top ("best") state | After opening | Used grades |
|---|---|---|---|
| **Electronics** | New (factory sealed) | **Open box** (seal broken, unused) → **Renewed** (tested/refurbished) | Used A–D · For parts (E) |
| **Apparel / Footwear** | **New with tags** | Like new (tags removed) | Used A–D |
| **Beauty / Hygiene / Grocery** | New (sealed) | *cannot be resold once opened* → recycle/dispose | — |

So: a phone whose **seal is broken is no longer "New" — it becomes "Open box"** if unused (functionally new, priced below new) or "Used/Renewed" if used. Clothing has no seal, so **"New with tags"** is the equivalent top state; removing tags drops it to "Like new." Hygiene-sensitive categories cannot be resold once opened at all.

### Resell-as-is goes into the **same** unified pool

An "as-is" item is **not** relisted as new. It joins the one unified catalog with its true condition label (set by the grade) attached to the product page. The router (§4.4) then decides whether it sells locally as-is (grade A–C) or is pulled to refurb (grade D–E).

### 6.1 FINALIZED storefront + two trust models (Renewed vs Revive)

We drop the **Warehouse** and **Returns** browse tabs entirely. There are exactly **two second-life surfaces**, because they have genuinely different trust models and therefore different Health Cards:

| | **Amazon Renewed** | **Revive** |
|---|---|---|
| What's in it | High-value items professionally refurbished/inspected at an **Amazon-authorized center (SPN)** | Everything else second-life: **seller-listed personal items** + **returns resold as-is**, scanned & graded by **AI** |
| Typical tier | HIGH (and grade D–E electronics routed to SPN) | LOW / MEDIUM |
| Who certifies | Amazon-authorized refurb center (human, professional) | REVIVE AI grading + seller declaration |
| Tag shown | **"Renewed by Amazon"** | **"Revive"** (+ condition label: Open box / Used – Very Good …) |
| Health Card | **Professional Renewed card** (see below) — *no AI grade shown* | **AI Revive card** (see below) |

A returned item that's only **resold as-is** goes into **Revive**; a returned item that is **refurbished by an authorized center** goes into **Renewed**. A verified **sealed/unopened** return is **restocked as New** and does **not** appear in either (it returns to the normal catalog).

So the storefront ("Shop Revive") has two filters/sections — **Renewed** and **Revive** — and nothing else.

### 6.2 FINALIZED: two Health Card designs

**A. Renewed Health Card (professional — high-value, authorized-center refurb).** No AI description; this is a human/center-certified record:
- Product name, model, ASIN + canonical product description (from catalog)
- **"Renewed by Amazon · certified at an authorized center"** badge
- **Refurbishment report:** what was inspected, **repairs/parts replaced**, functional test results (battery cycle, sensors, ports), data wipe certificate
- **Usage history:** approx. age / how long previously used, previous-owner count
- **Warranty:** Amazon Renewed guarantee window (e.g., 90-day / 1-year), Amazon-liable
- Final inspected photos taken by the center (clean background)
- No AI cosmetic letter grade is surfaced — the professional certification supersedes it

**B. Revive Health Card (AI — personal listings & as-is returns).** Transparent, seller + AI sourced:
- Product name + catalog match + canonical product description
- **AI cosmetic grade + condition summary + defect photos (bounding boxes)** + how long the seller used it (declared) + reason for selling
- **Seller-uploaded photos** of the actual item (all the angle shots they captured)
- **Seller rating** + verified-purchase/ownership declaration
- Functional self-check for electronics (battery %, powers-on) where applicable
- **Guarantee:** 7-/30-day buyer protection (seller-liable via escrow) + Amazon A-to-Z backstop
- "Verified by REVIVE" QR + tamper-evident hash

This directly answers the trust question: **expensive refurbished goods get a professional, human-certified card; cheap AI-scanned personal goods get an honest, transparent AI card with the seller's own photos and rating.**

### 6.3 Personal listing vs Return — finalized flows

- **Personal item listing (seller, "Sell It"):** catalog-match the product → **category-driven** photo capture (all required angles) → upload **all** photos → AI grades the **full set** (not one image) → disposition (almost always USED → **Revive**, AI Health Card) → suggested price from catalog+grade (seller adjusts within band) → live in **Revive**.
- **Return listing (buyer returns an item):** return reason → **category-driven** capture (agent or self) → product-match fraud gate (category + instance) → AI grade of full set → **Disposition Gate**: sealed-verified → **Restock as New** (exit); as-is good → **Revive** (AI card); refurb-worthy/HIGH → authorized center → **Renewed** (professional card); dead → recycle.

---

## 7. The Three Physical Routes (value/category-gated by Risk Tier)

Routes are unchanged in mechanics from v1; the only change is that **eligibility is gated by Risk Tier, not by a customer-visible "tier number."**

- **Route A — Direct Peer (Cahoot model).** Buyer within ~5 km within 48 h. For LOW-tier all items, and **mandatory** for MEDIUM/HIGH electronics (no kirana option). Flex agent does doorstep guided capture (content from Category Profile, depth from Risk Tier), seals, ships directly to buyer. ~64% cheaper, 4× faster than a warehouse round-trip.
- **Route B — Kirana Relay (light goods only).** Buyer 5–25 km, **LOW tier only.** Kirana scans QR, holds ≤5 days, releases on buyer OTP. **Hard block:** MEDIUM/HIGH electronics never touch a kirana (fraud prevention — a counter can't verify IMEI/battery/screen).
- **Route C — City-wide / Central Node.** No local buyer after 7 days, or any item blocked from A/B. C1 city-wide delivery-station relisting; **C2 SPN refurb node** for HIGH tier or grade D–E electronics → relists as **Renewed** (90-day, SPN-liable); C3 national FC listing (last resort) → liquidation/donation at day 60.

---

## 8. Page-by-Page Screens (v2 — complete, corrected set)

Every screen below reflects the v2 corrections: **no tier shown to the customer**, **catalog match sets the price**, **category-driven prompts**, **delist control**, **duplicate-photo rejection**, **condition labels**, **unified storefront**, and a **disposition outcome** message.

Legend: 🆕 new in v2 · ✏️ modified from v1 · ✅ unchanged.

### New — location capture

**S0 — Location prompt** 🆕 *(feeds local demand + "Near me")*
- A lightweight, dismissible prompt shown the first time the customer opens the Second-Life storefront (S5) or starts Sell It (S4): **"Share your location to see second-life deals near you and what buyers nearby are looking for."**
- **"Use my current location"** → triggers the browser Geolocation API → `(lat, lng)` → `geohash_encode()` → stored on the user profile.
- **Fallback:** if permission is denied, a pincode/city field ("Enter your area") maps to an approximate geohash cell.
- Once set, a small chip shows the active area ("📍 Koramangala · change") on S5 and S4; tapping it re-opens S0.
- The location feeds: storefront proximity sort/filter (S5 "Near me"), the demand signal on S4 ("47 buyers near you searched for this"), and the routing demand gate.

### Existing Amazon pages — modified

**S1 — My Orders** ✅/✏️
- "Return or Replace Items" unchanged.
- Account header gains a Green Credits chip: "🌿 220 credits" → opens Credits Wallet (S8).
- For items the customer bought *and still owns*, a subtle "Sell it on Amazon" entry routes to S4. (No tier wording anywhere.)

**S2 — Return Wizard (reason selection)** ✏️
- Existing reason flow unchanged.
- **Keep-it nudge card** at the bottom: "Keep this order instead → earn [N] Green Credits when the return window closes." CTA "Keep it — I changed my mind" cancels the return and queues credits.
- Proceeding leads to **S3 (grading + disposition)**, not the old packaging screen.

**S7 — Checkout** ✏️
- **Return-risk nudge** (if prevention model fires): "Customers with your measurements kept size 8 in this brand." Sits below the size selector.
- **Green Credits toggle:** "Use 220 credits (−₹22)" — applies only to second-life items, opt-in, off by default.
- **Buying options block** 🆕: on any product with second-life stock, the buy box shows condition options — "New ₹X · Renewed ₹Y · Open box ₹Z · Used–Very Good ₹W (4.2 km away)" — each linking to its Health Card (S6). *This is the unified-catalog fix; there is no separate "Warehouse" page.*

### New / rebuilt REVIVE pages

**S3 — Grading & Disposition Result** ✏️🆕 *(the core demo screen)*
Triggered automatically after S2 for a return, and after photo upload in Sell It (S4).
- Product photo with **defect bounding boxes** overlaid in orange.
- **Cosmetic grade badge (A–F)** + confidence, plus **grading time** ("1.4s").
- **Functional status line** when relevant ("Powers on · Battery 89%") — for electronics, from the Category Profile.
- **Defect list in plain language:** "Light scuff on left toe — cosmetic only", "Original box missing".
- **Disposition outcome message** 🆕 (the v2 addition — plain language, no internal math):
  - sealed/verified → "Good news — this is unused, so it goes back as new."
  - opened/used → "Your item will be resold to someone nearby."
  - grade D–E electronics → "Your item will be professionally refurbished."
  - grade F → "Your item will be responsibly recycled."
- **Refund banner** (returns): "Refund of ₹499 initiated — arrives in 2–3 hours."
- **Warm environmental line:** "This item will stay in your city instead of travelling to a warehouse." (No km/CO₂ numbers.)
- **Handover choice** (returns, LOW tier only): two cards — "Drop at [Kirana] · 200 m · open till 9 PM → Earn Green Credits" vs "Schedule home pickup → No credits." For MEDIUM/HIGH electronics, only the agent option shows: "A Flex agent will collect this from your doorstep."
- **What S3 hides** (ops-console only): EV breakdown, demand heatmap, CO₂ in kg, km saved, logistics cost — **and the Risk Tier number.**

**S4 — Sell It (seller entry)** ✏️🆕
- **Step 1 — Identify the product (catalog match, Q2 fix):** search with catalog auto-complete, **or scan barcode/QR**, **or pick from a past order**. On match, the canonical product name, model, image, **and MRP are confirmed and locked** — *the seller does not type an original price.* If no match → guarded manual-entry fallback (receipt required above a value threshold).
- **Step 2 — Photos & details (category-driven, Q1/Q7 fix):** prompts come from the **Category Profile**, not price. A shoe shows top/side/**sole**/insole/box; a phone shows front/back/**screen-on**/ports/accessories; a shirt shows front/back/fabric/**tag**. **Duplicate/angle guard (Q6):** uploading the same image twice is rejected ("please capture the soles"); each slot is view-validated. Plus purchase year, reason for selling, condition self-assessment.
- **Step 3 — Grade + suggested price:** S3-style grade display; **system-suggested price** the seller can nudge **within ±15%** (not free-type); demand signal "47 buyers nearby searched for this in 30 days"; ownership/as-described declaration (logged).
- **Step 4 — Confirmation:** Health Card preview (what the buyer sees), guarantee badge ("7-/30-/90-day"), "Your item is live. Keep it at home — we'll notify you when it sells."

**S4b — My Listings / Manage Listing** 🆕 *(Q3 fix — delisting)*
- List of the seller's active second-life items with status: **Active · Paused · Sold · Delisted.**
- Per item: views, demand signal, current price, edit price (within band), Health Card link.
- **"Pause listing"** (temporarily hide) and **"Delist"** (remove from storefront) controls. Delist is a **soft status change** — the record is retained for history/payout/audit, the item drops out of the storefront query and the demand-gate loop, and the seller can relist later.

**S5 — REVIVE / Second-Life Storefront** ✏️ *(Q11 fix — one unified surface)*
- Single discovery storefront for **all** second-life inventory (returns *and* unused listings).
- **Location chip** at the top ("📍 Koramangala · change") set from S0. If no location yet, a "Near me" tap triggers the S0 prompt.
- **"Near me" uses the captured location** — listings are sorted by haversine distance from the buyer's geohash cell, and a banner shows live local demand ("🔥 High demand for Footwear near you — 47 buyers searched in 30 days").
- **Filter chips:** Condition (New w/ tags · Open box · Renewed · Used A–D) · Grade · Near me · Category · Price · Guarantee length. *("Renewed"/"Warehouse" are filters here, not separate tabs.)*
- **Sort:** Nearest · Best value · Newest · Price.
- **Product tiles:** photo, **condition label + grade badge**, seller rating, guarantee badge, distance ("4.2 km away"), price vs. new.
- **"Second Life For You" rail** at top — ALS + CLIP + grade + proximity hybrid; CLIP handles cold-start.

**S6 — Product Health Card page** ✏️
- Product name + model + **ASIN/catalog match confidence.**
- **Cosmetic grade (A–F) + functional status** (battery %, IMEI, sensor/port results for HIGH tier).
- **Condition label** (category-aware) and **how it was inspected** (AI-only / AI+agent / AI+SPN).
- Defect photos with bounding boxes · previous owner count · guarantee badge + holder · A-to-Z backstop · "Verified by REVIVE" QR · truncated SHA-256 · Buy button.
- **No "Tier N" badge** — guarantee and inspection wording only.

**S8 — Green Credits Wallet** ✅
- Balance ("220 credits = ₹22 off second-life items"), one-line explainer, pending credits with countdown, category-aware earn history, spend history, collapsible earn-rate table, redemption link to S5, donate-to-NGO option, expiry, and an honest "what does NOT earn credits" note.

**S9 — Ops Console (internal / demo)** ✏️
- Live item feed with grade, **disposition outcome**, EV breakdown, assigned route, **and Risk Tier (internal only).**
- Leaflet **demand heatmap** with geohash density + route animations toward nearby buyers.
- EV breakdown per item ("Resell locally ₹312 vs Warehouse ₹–40 vs Liquidate ₹18").
- **Disposition summary** 🆕: items by outcome (Restock-New / Open-box / Used-P2P / Renewed-SPN / Recycle / Donate) and by route.
- Confidence queue (<70% grade) for human review; metrics (km saved, CO₂, local match rate, FC-escalation rate).

**S10 — Flex Agent app (Route A/B support)** ✅/✏️
- Job card "REVIVE pickup — [address] — [category]."
- **Guided capture sequence whose prompts come from the Category Profile and whose depth (functional checks) comes from Risk Tier.**
- Checklist (powers on / accessories / packaging auto-selected), **flag-item** button (reroutes to C on mismatch), seal-scan handoff.

**S11 — Kirana app (I Have Space — new REVIVE section)** ✅
- "REVIVE Drop-off" tab: scan incoming QR → register; shelf assignment; buyer-OTP release; day-5 consolidate alert. No inspection, no grading.

---

## 9. Customer Journeys (v2)

**Journey 1 — Priya returns shoes (Footwear, LOW tier, Route B).**
My Orders → "Doesn't fit" → keep-it nudge ignored → **S3**: Footwear grade B in 1.4s, soles graded, "your shoes will be resold nearby," refund ₹499 fired → handover: kirana drop (earn credits) → kirana scans QR → buyer 4 km away buys on S5 → OTP collection → credits vest from her *kept* orders. No "tier," no screen-on prompt.

**Journey 2 — Rahul lists a baby monitor (Phone/Electronics profile, MEDIUM tier, Route A).**
Sell It → **catalog match** "Motorola baby monitor" auto-fills MRP (he doesn't type a price) → **electronics prompts**: front/back/screen-on/ports/accessories + battery screenshot; duplicate-photo attempt rejected → grade A, functional Pass → suggested ₹2,340, he nudges to ₹2,200 (within band) → listed, stays home. Buyer 3.8 km away buys → MEDIUM electronics ⇒ Route A agent doorstep verification → ships to buyer → day 31 window closes → **Rahul gets UPI ₹2,200 − commission.** He can **delist/pause** anytime from S4b before it sells.

**Journey 3 — Buyer purchases.**
Homepage "Second Life For You" → product page shows **buying options** (New / Renewed / Open box / Used) → taps Used–Very Good → **S6 Health Card**: grade, battery 91%, IMEI verified, agent-verified, 30-day guarantee → buys (S7, credits toggle) → delivered → no dispute → done.

**Journey 4 — A sealed return goes back as New (the Disposition Gate in action).**
Customer returns an unopened sealed blender → S3 verification confirms factory seal intact + matches catalog → **disposition = Restock as New** → "Good news — this is unused, so it goes back as new" → it re-enters the **normal catalog at full price**, *not* the Revive storefront. (If the seal had been broken but unused → "Open box"; if used → "Used"; if dead → recycle.)

**Journey 5 — Small seller bulk upload.**
12 returns uploaded → catalog-matched, graded, **dispositioned** (2 restock-new, 6 used-P2P, 3 renewed-SPN, 1 recycle), Health Cards generated, auto-listed → disposition dashboard with item IDs, grades, outcomes, routes, recovery values.

---

## 10. Routing Algorithm — v2 form

```python
# Stage 0 — Disposition Gate (new in v2; runs after grading + verification)
def disposition(item):
    if item.sealed and item.verified_unopened:           return "RESTOCK_NEW"
    if item.cosmetic == "A" and item.complete and item.opened: return "OPEN_BOX"
    if item.cosmetic in ("B","C","D") and item.functional == "Pass": return "USED_P2P"
    if item.cosmetic in ("D","E") and item.refurb_economical:  return "RENEWED_SPN"
    if item.cosmetic == "F" or not item.safe:            return "RECYCLE_DONATE"
    return "USED_P2P"

# Stage 1 — Demand Gate (unchanged; polls every 6h while listed)
# Stage 2 — Routing EV (unchanged mechanics; eligibility uses risk_tier, not price)
def routing_ev(item, buyer_location):
    tier = risk_tier(item.catalog_mrp, item.category_profile)   # backend only
    if tier == "HIGH":   return "ROUTE_C_SPN"
    if tier == "MEDIUM" and item.is_electronics and dist(item, buyer_location) > 5:
        return "ROUTE_C_CITY"                                   # Route B blocked
    # else EV over [A_direct, B_kirana(LOW only), C_city]; donate if max(EV) < donation_benefit
```

The two-stage EV core and the geohash demand-gravity model are unchanged; v2 adds the **Disposition Gate** ahead of them and swaps price-tier for **risk_tier**.

### 10.1 Routing algorithm — verification against v2 (what was checked & fixed)

Audited the live `ml/route.py` against this plan. The EV optimizer, sell-probability model, geohash gravity model, and demand gate are **sound and retained**. Six gaps were found and fixed in the v2 implementation:

| # | v1 routing behaviour | v2 correction |
|---|----------------------|---------------|
| R1 | `_get_tier(mrp)` used **price only** → a ₹4,500 phone and a ₹4,500 pan tier identically | `risk_tier(mrp, category)` adds a fraud-risk term so electronics escalate correctly |
| R2 | **No disposition step** — every item went to resell/refurb/donate/recycle; "restock as new" was impossible | **Stage 0 Disposition Gate** runs first: sealed-verified → `RESTOCK_NEW`; opened grade-A → `OPEN_BOX`; etc. |
| R3 | `_apply_tier_rules` blocked long-distance P2P (Route B) for **all** Tier-2 items, including a ₹6,000 shoe | Route B is blocked only for **electronics / fraud-prone** MEDIUM-HIGH items; a premium shoe keeps kirana relay |
| R4 | Grades limited to **A–D**; `route/views.py` rejected anything else | Grades **E (parts/repair)** and **F (recycle)** accepted and routed (E→SPN/refurb, F→recycle) |
| R5 | Demand looked up only by a **pre-set geohash string**; no way to derive a cell from live coordinates | Added `geohash_encode(lat, lng, precision)` so the buyer's/ seller's live location maps to a cell |
| R6 | Tier 3 → always `refurbish`; correct, but keyed on price | Same outcome, now keyed on `risk_tier == "HIGH"` (SPN node) |

Backward compatibility: `route_item()` still returns the integer `tier` (mapped LOW/MEDIUM/HIGH → 1/2/3) for existing callers, and adds `risk_tier`, `disposition`, and `condition_label` fields.

---

## 11. Green Credits (retained from v1, unchanged)

Buyer-only; `credits = BASE × category_return_rate_multiplier × order_value_band`; fashion 2.0× / electronics 0.8× / books 0.5× / home 1.0×; 1 credit = ₹0.10; spend only on second-life items, capped 20%/txn, 12-month expiry. Vest **only** on kirana self-drop + return-window close with no return; return initiation cancels pending credits. Sellers get money, not credits. (Full anti-gaming table in §14.)

---

## 12. Technology Stack (v2 additions in bold)

| Component | Technology | AWS equivalent |
|---|---|---|
| **Catalog match** | **Order-ASIN lookup → barcode → Catalog search API → image search** | **Product Advertising API / SP-API + OpenSearch** |
| Defect detection | Grounding DINO (zero-shot) | SageMaker |
| Vision captioning | Claude Haiku via OpenRouter | Amazon Bedrock |
| **Category gate** | **VLM / CLIP** | SageMaker |
| **Instance gate (Q4)** | **DINOv2 cosine vs catalog reference** | **SageMaker + S3 image store** |
| **Duplicate/angle gate (Q6)** | **pHash/dHash + VLM view check** | Lambda |
| Grading head | Fusion classifier (cosmetic A–F + functional) | SageMaker |
| Pricing model | Mercari MLP/LGBM, **wired end-to-end (Q9)** | SageMaker |
| Sell-probability | GBDT | SageMaker |
| Demand index | Geohash → Redis, **fed from real order/search history (Q10)** | ElastiCache Redis |
| EV optimizer | Python in-memory | Lambda |
| Recommender | ALS + CLIP | SageMaker + Personalize |
| Health Card store | Signed JSON + SHA-256 | Aurora PostgreSQL ledger |
| Green Credits | Event-driven vest | Lambda + DynamoDB |
| Backend / Frontend | Django REST / React | ECS Fargate / CloudFront+S3 |

---

## 13. Metrics

- Grading latency < 2s · Pricing RMSLE ≈ 0.42 (Mercari holdout) · Recall@20 / NDCG@20 (recs) · EV uplift 3–5× vs naive liquidation · ~590 km / ~4.2 kg CO₂ saved per locally routed item · Prevention F1 · Cahoot benchmark: 64% cheaper, 4× faster P2P.
- **New v2 metrics:** disposition mix (% restock-new / open-box / used / renewed / recycle), instance-match precision/recall (DINOv2), duplicate-photo rejection rate, catalog-match rate.

---

## 14. Anti-Gaming (retained) + v2 integrity additions

All v1 Green-Credits anti-gaming rules hold (agent pickup earns nothing; returns earn nothing; donate/recycle earn nothing; category auto-detected from catalog; vest only at window close). v2 adds **listing integrity**: catalog-anchored MRP prevents price manipulation; DINOv2 instance gate blocks "photograph an expensive lookalike" fraud; pHash blocks recycled photos; the Disposition Gate prevents a used item being relisted as new.

---

## 15. Judge Q&A — v2 deltas

| Pushback | Answer |
|---|---|
| "Why was a shoe asked for a screen photo before?" | v1 fused price and category into one tier. v2 separates them: a **Category Profile** sets the prompts (shoes get soles), a backend **Risk Tier** sets verification depth. The two never mix. |
| "Can the seller fake the price?" | No — the original price is **anchored from the catalog match**, not typed. The seller only nudges resale price ±15%. |
| "How do you catch a wrong-model photo?" | Category gate (VLM) + **DINOv2 instance gate** against the catalog reference image — fine-grained enough to tell a different shoe from this shoe. |
| "Do all returns become used items?" | No. A **Disposition Gate** restocks verified sealed returns **as new**; only opened/used items become Open-box/Used/Renewed; dead items are recycled. This mirrors Amazon FBA Grade-and-Resell and general retail. |
| "Why one storefront instead of Renewed/Warehouse tabs?" | Because that's how Amazon actually does it — one catalog, condition shown as buying options. Renewed/Open-box/Used are **labels**, not silos. |

---

## 16. Closing Pitch Line

> *"Amazon's promise has always been: from need to done. REVIVE extends that promise to the product's second life — it knows exactly what each item is, grades it on its own terms, decides whether it deserves to go back as new or forward to a new home 5 km away instead of 600, and proves it with a Health Card. Good for Priya. Good for Rahul. Good for sellers. Good for Amazon. And good for the planet."*
