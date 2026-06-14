# PROJECT REVIVE — Final Implementation Blueprint
### Amazon HackOn · Every product deserves a second life

---

## 1. The Idea in One Breath

> **REVIVE is an AI decision engine for returned and unused products. It grades an item's condition in under 2 seconds, decides its most economically and environmentally optimal second life (resell locally / refurbish centrally / donate / recycle), keeps items inside the city instead of shipping them 600 km back to a warehouse, certifies every item with a verifiable Product Health Card, rewards buyers who keep their orders with Green Credits, and predicts bad purchases before they happen.**

We are not building a resale marketplace. Marketplaces exist. We are building the **intelligent bridge** between a product and its next owner — the decision layer that today simply does not exist inside Amazon.

---

## 2. The Three Personas We Solve For

| Persona | Pain today | REVIVE outcome |
|---|---|---|
| **Priya** | Returns ₹500 shoes → 600 km trip to warehouse → liquidated at a loss | Two taps, drop at kirana 200 m away. Agent scans → Grade B in 1.4s → refund fires → buyer 5 km away gets the shoes. Shoes never leave the city. |
| **Rahul** | Perfectly good baby monitor sits in a drawer. Classifieds = strangers, haggling, safety risk. | Photographs it in-app → AI grade + suggested price → listed with a Health Card → buyer pays via Amazon → OTP kirana handoff. Zero contact, zero haggling. |
| **Small Seller** | 200 returns/month, manually inspects each one, guesses prices | Bulk upload → all 200 graded, priced, routed in minutes. |

---

## 3. Core Architecture Principles (from research)

Before the flow, five foundational rules that come from real-world recommerce analysis:

**Rule 1 — List before you move.** An item physically moves only when a buyer exists. Unused items (Rahul) stay at the seller's home, listed. Returned items are held short-term at a kirana. Nothing enters a warehouse until it fails to sell locally. This is the Poshmark / Cahoot / ThredUp Direct model.

**Rule 2 — Inspection is always two layers.** AI computer vision handles cosmetic grading (scratches, dents, wear). A separate step — either agent-run guided capture, a customer screenshot, or a central SPN node — handles functional verification for electronics. No platform relies on AI photos alone.

**Rule 3 — Tier determines route.** The item's value and category decide which path it takes. Tier 1 goods (apparel, books, low-value items under ₹2,000) can use any route. Tier 2 electronics (₹2,000–₹10,000) must use Route A (agent) or Route C (FC). Tier 3 high-value electronics (above ₹10,000) always go to a central SPN refurb node. Kiranas never handle Tier 2 or Tier 3 electronics — fraud prevention.

**Rule 4 — Sellers get real money, buyers earn credits.** Rahul receives a UPI transfer after the buyer's return window closes. Green Credits are exclusively a buyer-side reward for *not* returning a purchase. They are not earned by donating or recycling.

**Rule 5 — The routing algorithm is two-stage.** Stage 1 (demand gate) runs continuously while the item waits and asks: is there a buyer yet? Stage 2 (EV routing) runs once — when a buyer exists — and picks the cheapest physical path to that specific buyer. Your EV optimizer is the Stage 2 engine.

---

## 4. The Five Pillars

### Pillar 1 — AI Grading (photo/video → grade in under 2 seconds)

**The grading pipeline:**
1. **Grounding DINO (zero-shot)** detects defects from text prompts: "scratch on surface", "torn fabric", "missing part", "cracked screen", "dent on body". No fine-tuning needed — works across all product categories.
2. **Vision LLM (Claude Haiku via OpenRouter / Amazon Bedrock)** receives the image plus the detected defects as structured text context and returns JSON: grade, defect list, completeness flag, one-line condition summary. Detections are injected into the prompt so captions never contradict the visual.
3. **CLIP similarity** vs. catalog reference images flags missing accessories ("box missing", "charger missing", "manual missing").
4. **Grading head** fuses all signals → Grade A / B / C / D + confidence score.
5. **Video path** (15s clip): OpenCV samples 4–6 frames, each runs the same pipeline, max severity per defect type is taken.

**Grade definitions (mapped to industry standard):**
- Grade A — Like New. Original packaging or equivalent. No visible defects. 70–85% value recovery.
- Grade B — Very Good. Minor cosmetic marks, fully functional. 55–70% value recovery.
- Grade C — Good. Visible wear, functional. May need light cleaning. 35–55% value recovery.
- Grade D — Acceptable. Significant cosmetic damage but functional, or needs repair. 20–35% value recovery.

**Confidence gating:** Items below 70% model confidence are flagged to a human spot-check queue visible in the seller ops console. The Health Card records the model version and confidence score — fully auditable.

---

### Pillar 2 — Two-Stage Smart Routing (the EV brain)

**Stage 1 — Demand Gate (runs continuously while item waits):**
```
DemandScore(item) = GeohashDensity(location, category) × P(sell | grade, price, days_listed)
                  − HoldingCost(days_waiting) × decay_factor

if DemandScore > threshold → SELL (proceed to Stage 2)
if days_waiting > 7        → WIDEN (expand geohash radius)
if days_waiting > 21       → ESCALATE (pull to delivery station / national listing)
if days_waiting > 60       → LIQUIDATE / DONATE
```

**Stage 2 — Routing EV (runs once, when a buyer exists):**
```
EV(path) = P(sell | grade, category, price) × resale_price
         − logistics_cost(actual_buyer_distance)
         − refurb_cost(defects)
         − holding_cost(days_waiting_so_far)

→ pick argmax(EV) across: [direct_peer, kirana_relay, city_wide, central_refurb]
→ if max(EV) < donation_benefit → donate
→ if hazardous / broken beyond repair → recycle
```

**Supporting models:**
- **Pricing model:** LightGBM trained on 1.4M Mercari resale listings — predicts resale price conditioned on AI grade, category, and brand.
- **Sell-probability model:** GBDT on price-vs-median ratio, grade, seasonality, category velocity.
- **Geohash Demand Gravity Model:** local-demand index per (geohash cell, category) stored in Redis. The item routes to the nearest demand cluster. This is the line that saves Priya's shoes the 600 km trip.

**Tier-based routing hard rules (override the EV optimizer):**

| Tier | Value | Eligible routes |
|---|---|---|
| Tier 1 | Below ₹2,000 | Route A (direct peer), Route B (kirana relay), Route C (city-wide), Donate |
| Tier 2 | ₹2,000–₹10,000 | Route A (direct peer with agent) or Route C (city-wide / FC) only. Route B is BLOCKED. |
| Tier 3 | Above ₹10,000 | Route C (SPN refurb node) only. Routes A and B are BLOCKED. |

---

### Pillar 3 — Product Health Card (the trust layer)

The Health Card is generated at grading time and lives as a signed JSON record with a GS1-style QR code. It contains:

- Unique REVIVE item ID (LPN-style, internal barcode)
- Product name and catalog match confidence
- AI cosmetic grade + confidence score + defect list with bounding box photos
- For Tier 2 electronics: battery health percentage (from customer screenshot), IMEI (from photo, optional but boosts "Verified" badge)
- For Tier 3: full SPN diagnostic report (battery % via software test, IMEI clear, sensor pass/fail, functional test results)
- Who inspected: AI-only / AI + agent doorstep / AI + SPN node
- Previous owner count
- Applicable guarantee window (7-day / 30-day / 90-day)
- Guarantee holder (seller-liable via escrow / Amazon SPN-liable)
- SHA-256 hash of the record (tamper-evident; production: Aurora PostgreSQL ledger)
- Scannable QR linking to the live Health Card page

**Guarantee chain:**

| Tier | Guarantee | Liable party |
|---|---|---|
| Tier 1 | 7-day "not as described" refund | Seller, via Amazon payment escrow |
| Tier 2 | 30-day cosmetic + battery claim | Seller, via escrow; A-to-Z backstop |
| Tier 3 | 90-day full functional coverage | Amazon SPN partner |

Amazon's existing A-to-Z Guarantee is the universal backstop across all tiers.

---

### Pillar 4 — Return Prevention

At checkout, a GBDT model predicts return risk per item-user pair. If risk is high:
- Size/fit nudge: "Customers with your measurements kept size 8 in this brand."
- Bracket detection: if 3 sizes of the same shoe are in cart → "Pick your size before checkout."
- High-risk items show richer content: 360° view, measurements in cm, fabric/material detail.

At return initiation, a "keep it" nudge is shown: "Keep this order → earn 15 Green Credits in 7 days." This converts low-conviction returns without friction.

---

### Pillar 5 — Green Credits Wallet and Recommendations

**Green Credits — buyer-only, behaviour-weighted, economically bounded:**

Green Credits are exclusively a buyer-side reward. Sellers (like Rahul) receive real money (UPI transfer). Credits are never earned by sellers, donors, recyclers, or agent-pickup users.

**The earn rules — category-weighted, not flat:**

Credits are not awarded equally for every kept order. The earn rate scales with the category's return rate, because Amazon saves more logistics cost from a prevented return in high-return categories. The formula:

```
credits_earned = BASE_RATE × category_return_rate_multiplier × order_value_band
```

Category multipliers (approximate, calibrated to Amazon India return data):
- Fashion / footwear (30–35% return rate): 2.0× multiplier
- Electronics / accessories (8–12% return rate): 0.8× multiplier  
- Books / stationery (3–5% return rate): 0.5× multiplier
- Home goods / kitchen (10–15% return rate): 1.0× multiplier (baseline)

Order value bands (credits per kept order):
- Below ₹500: 5 credits
- ₹500–₹2,000: 10 credits × category multiplier
- ₹2,000–₹10,000: 20 credits × category multiplier
- Above ₹10,000: 30 credits × category multiplier (capped)

Example: Priya keeps a ₹800 pair of shoes (fashion, 2.0× multiplier) → 10 × 2.0 = **20 credits**. A buyer keeps a ₹800 phone charger (electronics, 0.8×) → 10 × 0.8 = **8 credits**. The reward is proportional to the actual cost Amazon avoids.

**Earn trigger — only self-drop, never agent pickup:**

Credits only vest when the buyer chose kirana self-drop as their return method AND the return window closes with no return initiated. If the customer scheduled an agent pickup for their return, Amazon already bore the agent cost on their behalf — giving credits on top of that would make the high-cost route the most rewarding one, which is economically backwards. Agent pickup = convenient, fast, no credits. Kirana self-drop = slightly more effort, earns credits.

This single rule aligns three incentives simultaneously: it rewards the low-cost logistics option, it rewards keeping orders, and it rewards using Amazon's existing I Have Space network.

**Credit value and redemption — calibrated to be meaningful but not margin-destroying:**

1 credit = ₹0.10, redeemable only on REVIVE second-life items. Redemption is capped at 20% of the second-life item's price per transaction. 200 credits = ₹20 off a second-life purchase. This is meaningful enough to feel rewarding (a typical fashion order earns 20 credits = ₹2, so after ~10 kept orders a customer has ₹20 to spend) but small enough that it costs Amazon a fraction of what a prevented return saves (average Indian e-commerce return costs ₹80–₹150 in logistics; 20 credits = ₹2 cost, so Amazon keeps ₹78–₹148 of the saving).

**Spend rules:**
- Only on REVIVE second-life items (S5 storefront). Not on new goods. Not as cashback or bank transfer.
- Cap: 20% of purchase price per transaction.
- Expiry: 12 months rolling from earning date.
- Alternative: Donate credits to a verified NGO partner (e-waste recycling, tree planting). Minimum 50 credits to donate.

**Vesting rules (anti-gaming):**
- Credits are shown as "pending" at checkout when the customer opts for kirana self-drop.
- They vest only at `POST /credits/vest` fired when the return window closes with no return recorded.
- If a return is initiated before window close → pending credits are cancelled immediately.
- Credits vest per order line, not per order — if a customer keeps 3 items and returns 1, they earn credits only for the 2 kept items.

Anti-gaming table: [unchanged in Section 13]

**"Certified Refurbished For You" rail:**
Hybrid ALS + CLIP + grade + proximity recommender. ALS captures collaborative patterns; CLIP handles cold-start for new items (zero interactions needed — scored from the graded images immediately). Surfaced on the Amazon homepage and search results page.

---

## 5. The Three Physical Routes — Complete Detail

### Route A — Direct Peer (Cahoot Model)

**Trigger:** Demand gate finds a buyer within approximately 5 km, within 48 hours of listing.

**Who this is for:** Tier 1 all items, Tier 2 electronics (mandatory for Tier 2 — no kirana option).

**Physical flow:**
1. Buyer checks out on the REVIVE storefront. Payment held in escrow.
2. REVIVE engine generates a smart shipping label addressed to the buyer's address (not a warehouse).
3. A Flex agent is dispatched to the seller/returner's address.
4. **Doorstep verification (mandatory for all Route A):** The REVIVE agent app guides the Flex agent through a structured capture sequence before sealing the box:
   - Photograph: front of item (4 seconds)
   - Photograph: back of item
   - Photograph: any noted defects (from the Health Card defect list)
   - Photograph: all accessories present (matched against CLIP catalog check)
   - For Tier 2 electronics: device powered on (screenshot of lock screen, confirming it boots)
   - For Tier 2 electronics: battery health screenshot (iOS Settings or Android About Phone)
   - Agent confirms each checklist item in the app. If anything fails the check → item is flagged, routed to Route C instead, buyer notified with revised ETA.
5. Agent seals the item in a flat-pack box or poly mailer carried in the agent kit.
6. Item ships directly to buyer. No warehouse, no kirana.
7. Buyer receives item, has their guarantee window to raise a dispute.
8. On window close: payment released to seller, credits vest for buyer.

**Who packs:** Flex agent. Agent carries standardised Amazon-branded flat-pack boxes (S/M/L), poly mailers, bubble wrap pads, and tape. The agent app guides the packaging type based on item category and size from the grading data.

**Packaging rule:** The agent app auto-selects packaging type from the grading metadata. A book gets a poly mailer. A phone gets bubble wrap inside a rigid small box. A monitor gets a medium flat-pack with corner pads. The agent cannot override the packaging type.

**Cost and speed:** Estimated 64% cheaper and 4x faster than warehouse round-trip (Cahoot real-world data). CO₂ saving shown to buyer on confirmation screen.

---

### Route B — Kirana Relay (Light goods only)

**Trigger:** Buyer exists within 5–25 km (same city zone), Tier 1 items only.

**Hard block:** Tier 2 electronics (phones, laptops, monitors) are NEVER routed to a kirana relay. The REVIVE routing engine enforces this as an immutable rule — not an EV decision, a hard constraint. Reason: fraud prevention. A kirana counter cannot verify IMEI, battery health, or screen integrity. A bad actor could swap a device at the counter.

**Physical flow (returns, Priya):**
1. Priya initiates return (any reason) → AI grading fires automatically.
2. Grade result + routing decision shown on screen. Refund confirmed immediately.
3. Priya is shown two handover options:
   - **"Drop it yourself at [Kirana name] 200 m away → Earn Green Credits"** — the item moves when Priya does. Credits vest when her next kept order's window closes (if she also chose kirana drop for that order).
   - **"Schedule a home pickup → No Green Credits"** — convenient, costs Priya nothing extra, but earns no credits because Amazon bears the Flex agent cost.
   The credit difference is the policy lever that steers customers toward the lower-cost logistics option without mandating it.
4. Priya drops the item at the nearest I Have Space kirana partner (2–4 km max, shown on map).
5. Kirana partner scans the QR code on the REVIVE label using the I Have Space app (existing Amazon tool, no new app needed for kirana).
6. Kirana holds item for up to 5 days.
7. **Kirana's role is limited to:** scan QR on receipt, apply a new REVIVE label if needed (from the small packing kit Amazon supplies), hold in a designated shelf area, scan QR on release. No inspection, no grading, no opening the package.
8. When a buyer is matched and collects (OTP shown on buyer's phone, entered at kirana) → kirana scans release QR → payment released.
9. If no buyer in 5 days → item consolidates onto the next daily Amazon delivery station truck run (existing middle-mile route, no new logistics).

**Repackaging at kirana:** Amazon supplies each I Have Space kirana with a small REVIVE kit: 5 poly mailers (S/M/L), 1 roll of tape, 10 REVIVE QR labels. The kirana applies a fresh label only if the existing packaging is damaged beyond holding. They do not open items, do not inspect, do not grade.

**Physical flow (unused items, Rahul):**
1. Rahul lists item via "Sell It" in the Amazon app. Item stays at his home.
2. Buyer checks out. Payment escrowed.
3. Rahul receives app notification with a prepaid shipping label addressed to the buyer (or to a kirana if buyer chose kirana collection).
4. Rahul drops at the kirana or schedules Flex pickup — his choice.
5. Kirana scan-in → buyer OTP collection → payment released to Rahul.

---

### Route C — City-Wide / Central Node

**Trigger:** No local buyer found after 7 days (returned items) / national listing needed; OR Tier 2 or Tier 3 item that is blocked from Route B.

**Sub-route C1 — City-wide delivery station (day 7–21):**
- Unsold kirana-held returns are consolidated onto the daily delivery station truck.
- At the delivery station, the item goes through basic repackaging (the delivery station has a proper repack area) and is listed as Amazon Resale nationally.
- Sell-probability model re-runs at the wider radius. Price may auto-adjust downward to reflect wider logistics cost.

**Sub-route C2 — SPN refurb node (Tier 3 or Grade C electronics):**
- High-value items above ₹10,000, or items with significant defects where refurb is economically viable, are routed to an Amazon SPN refurb partner.
- This applies to BOTH returned items AND Rahul's self-listed unused item (if above ₹10,000): "We'll arrange a pickup for a full inspection to issue you a 90-day Health Card and get you a higher listing price."
- SPN node performs: functional testing (all sensors, ports, camera, speaker, battery cycle count), data wipe (electronics), OEM-compliant minor repair, full repackaging.
- Item re-enters the marketplace as Amazon Renewed (90-day guarantee, SPN-liable).
- Seller receives payout after the 90-day window at the Renewed price minus SPN service fee.

**Sub-route C3 — National FC listing (day 21+):**
- Item reaches an Amazon FC for the first time.
- This is explicitly the last resort — not the default. The FC sees this item only because it failed to sell locally and city-wide.
- Listed as Amazon Resale at national pricing.
- If unsold at day 60 → liquidation (B-Stock / FBA Liquidations) or donation (registered NGO partner).

---

## 6. Demand Clock — Escalation Timeline

| Day | State | What happens |
|---|---|---|
| 0 | Item graded and listed | Held at home (unused) or kirana (returned). Visible to buyers within 5–25 km geohash. |
| 0–7 | Local window | Demand gate runs every 6 hours. Route A or B fires if buyer found. |
| 7 | No local buyer | Listing widens to city-wide. National Amazon Resale listing activated. Price auto-drops 10%. Kirana sends item to delivery station. |
| 7–21 | City window | City-wide demand gate. Route C1 active. |
| 21 | No city buyer | Item enters Amazon FC. Price auto-drops another 10%. Last-resort national listing. |
| 60 | Disposition clock | Liquidation via FBA Liquidations or donation to NGO partner. Item exits the system. |

**Unused items only:** Rahul's item never enters a warehouse on its own. If it does not sell by day 60, the listing simply expires. The item stays at his home. He receives a notification offering to relist at a lower price or to schedule a kirana drop for donation. The warehouse does not fill with unsold junk from C2C sellers — only items that have already been graded, listed, and proven unsellable flow through the escalation ladder.

---

## 7. AI Grading — What Each Tier Requires

### Tier 1 — Apparel, books, toys, home goods, accessories (below ₹2,000)

**For a return (agent-captured):**
- 4 photos taken by the Flex agent or kirana-adjacent agent: front, back, label/tag, defect close-up (if any)
- 1 optional short video (15s) of the item laid flat, panning across it
- Agent confirms: original packaging present (yes/no), all accessories present (yes/no)
- AI runs cosmetic grade. No functional test needed.
- Health Card: cosmetic grade + defect photos + "AI-only" inspection tag + 7-day guarantee

**For a self-listed unused item (Rahul / Sell It flow):**
- Customer takes 4 guided photos (in-app prompts with silhouette overlays): front, back, label, any defects
- Customer declares: "I confirm this item is as described." (Logged with timestamp.)
- Customer sets asking price (AI suggests based on LightGBM model; customer can adjust ±30%)
- AI runs grade. Health Card generated.
- 7-day "not as described" guarantee, seller liable via escrow.

---

### Tier 2 — Phones, laptops, monitors, speakers, tablets (₹2,000–₹10,000)

**For a return (agent at doorstep — Route A mandatory):**
- 6 photos: front, back, screen (powered on), all ports, any defects, accessories laid out
- 1 video (15s): screen-on with the item rotating slowly to show all sides
- Battery health screenshot: iOS (Settings → Battery → Battery Health) or Android (Settings → About Phone or third-party diagnostic)
- IMEI photo (Settings → About Phone or *#06# dialled on screen)
- Agent confirms: device powers on (yes/no); all accessories present (yes/no); original charger present (yes/no)
- AI runs cosmetic grade. Battery % extracted from screenshot via OCR. IMEI logged.
- Health Card: cosmetic grade + battery % + IMEI + "Agent-verified at doorstep" tag + 30-day guarantee
- **Fraud check:** if agent's live photos differ significantly from CLIP catalog reference (e.g., wrong model, wrong colour), item is immediately flagged to SPN node for investigation.

**For a self-listed unused item:**
- 6 guided photos: front, back, screen (powered on), all ports visible, all accessories laid out, any defects
- Battery health screenshot (mandatory for phones/laptops)
- IMEI photo (optional, but unlocks "IMEI Verified" badge on the Health Card which increases sell probability)
- Device age declared (purchase year from dropdown)
- Seller declaration (logged)
- AI grade + battery OCR + 30-day guarantee, seller liable via escrow.
- If battery below 80% → AI automatically adds a note on the Health Card: "Battery below 80% — may need replacement." Cannot be suppressed by seller.

---

### Tier 3 — High-value electronics, cameras, laptops above ₹10,000

**For both returns AND self-listed items:**
- Customer provides 4 standard photos (front, back, screen, accessories) for the preliminary listing.
- REVIVE system immediately schedules a Flex agent pickup for SPN node delivery.
- Customer is told: "For items above ₹10,000, we arrange a professional inspection to issue you a 90-day Health Card — this typically increases your sale price by 20–35%."
- SPN node performs full diagnostic: battery cycle count (software test, not screenshot), IMEI / IMEI2 check, blacklist check, all sensors tested, screen dead-pixel scan, all ports tested, data wiped (factory reset or certified wipe with proof).
- SPN node re-photographs the item on a clean background (becomes the listing image).
- Health Card: full SPN diagnostic report + "Professionally inspected" badge + 90-day guarantee, SPN liable.
- Item listed as Amazon Renewed or Amazon REVIVE Certified.

---

## 8. Page-by-Page Amazon App Integration

### Existing pages — modified

**S1 — My Orders page**
- No "Give it a second life" button added (this was a previous design error).
- The existing "Return or Replace Items" button is unchanged.
- One addition: a Green Credits balance chip in the account header — "🌿 220 credits" — tapping opens the Credits Wallet (S8).

**S2 — Return Wizard (reason selection)**
- Existing screen. Unchanged. Customer selects return reason as today.
- One addition at the bottom of the reason screen: a "keep it" nudge card — "Keep this order instead → earn [N] Green Credits when the return window closes" (N is pre-calculated by the credits engine based on item category and value). CTA: "Keep it — I changed my mind." If tapped → return cancelled, credits queued to vest at window close.
- If customer proceeds with return → next screen is S3 (AI grading), not the existing packaging/shipping screen.

**S7 — Checkout**
- Existing screen. Two additions:
  - Return-risk nudge (if prevention model fires): "Customers with your measurements kept size 8 in this brand." Non-intrusive, below the size selector.
  - Green Credits toggle: "Use 220 credits (−₹22)". Applies only to REVIVE second-life items, not new goods. Toggle off by default, opt-in.

---

### New pages — built for REVIVE

**S3 — AI Grading Result (new — the core demo screen)**

Triggered: automatically after S2 reason selection for any return. Also shown after photo upload in the Sell It flow (S4).

Contents shown to the customer:
- Product photo with defect bounding boxes overlaid in orange
- Grade badge (A / B / C / D) with confidence percentage
- Grading time shown ("1.4s") — builds trust in the AI
- Defect list in plain language: "Light scuff on left toe — cosmetic only", "Original box missing"
- Simple routing outcome message (not internal EV numbers): "Your item will be resold to someone nearby" / "Your item will be refurbished" / "Your item will be donated to [NGO name]" — no EV figures, no logistics math, no heatmap
- For returns: Refund confirmation banner: "Refund of ₹499 initiated — arrives in 2–3 hours"
- For returns: a simple environmental message (personal and warm, not a data dashboard): "This item will stay in your city instead of travelling to a warehouse." One sentence. No km numbers, no CO₂ figures — those are meaningful to Amazon's internal reporting, not to Priya's experience.
- Handover choice (for returns, Tier 1 only): two options shown as cards:
  - "Drop it yourself at [Kirana Name] · 200 m away · Open till 9 PM → Earn Green Credits"
  - "Schedule a pickup from your home → No credits (convenient option)"
  - Kirana shown with name, distance, and today's hours. No map. No heatmap.
- For Tier 2 returns: only the agent option is shown (Route B blocked). Message: "A Flex agent will collect this from your doorstep — we'll schedule that now."
- For self-list (Sell It): "Your item is now listed. Keep it at home — we'll notify you the moment someone purchases it."

What S3 does NOT show (internal only, visible in the ops console):
- The EV formula breakdown
- The demand heatmap
- CO₂ savings in kg
- Kilometres avoided
- Logistics cost comparison

The ops console (Amazon internal / hackathon demo screen) shows all of the above — the heatmap, the EV breakdown, the routing animation. That is the demo wow moment for judges and for Amazon's product team. It is not the customer experience.

**S4 — Sell It (new — Rahul's entry point)**

Entry: Account menu → "Sell unused items" (new tab, positioned next to "Buy Again" in the account navigation).

Step 1 — Item identification:
- Search bar with catalog auto-complete: "Start typing your product name…" (matched to Amazon catalog via product search API)
- Or scan barcode / QR on the product box
- Once matched: product name, model, catalog image confirmed by customer

Step 2 — Photos and details (varies by tier, auto-detected from catalog price):
- Tier 1: 4 photo prompts with silhouette overlays (front, back, label, any defects)
- Tier 2: 6 photo prompts + battery screenshot prompt + optional IMEI prompt + video prompt (15s)
- Tier 3: 4 preliminary photos + message: "A Flex agent will be scheduled to complete the inspection."
- For all tiers: purchase year (dropdown), reason for selling (dropdown: outgrown / upgraded / gift duplicate / other), condition self-assessment (cross-referenced with AI grade)

Step 3 — AI grade result (same as S3 display) + price suggestion
- AI suggests price based on LightGBM model
- Customer can adjust price within a band (±30% of AI suggestion)
- "Demand signal": "47 buyers in your area searched for this in the last 30 days"
- Seller declaration checkbox: "I confirm this item is as described and I am its legal owner." (Logged with timestamp and user ID.)

Step 4 — Listing confirmation
- Health Card preview (shows what the buyer will see)
- Guarantee shown: "7-day buyer protection" / "30-day battery + cosmetic" / "90-day full coverage"
- "Your item is live. Keep it at home. We'll notify you when someone buys it."

**S5 — REVIVE Storefront (new — the buyer-side shelf)**

Entry: Main Amazon navigation bar → "Second Life" tab (between "Today's Deals" and "Customer Service"). Also reachable from the "Certified Refurbished For You" rail on the homepage.

Layout:
- Filter chips row: Grade (A / B / C / D) · Near me (toggle, uses location) · Category dropdown · Price range · Guarantee length (7 / 30 / 90 day)
- Sort options: Nearest first / Best value / Newest listed / Price low–high
- Product tiles: product photo, grade badge, seller rating, guarantee badge, distance ("4.2 km away"), price with discount vs. new

"Certified Refurbished For You" AI rail (top of page):
- Personalised recommendations from the ALS + CLIP + grade + proximity hybrid model
- Cold-start items (new listings, zero interactions) scored by CLIP content similarity to the user's purchase history

**S6 — Product Health Card page (new — the trust page)**

Entry: "View Health Card" button on every product tile in S5. Also accessible via QR code scan from the physical item.

Contents:
- Product name + model
- Grade badge + confidence
- Defect photos with bounding boxes (same as grading output)
- Inspection details: who inspected (AI-only / AI + Agent doorstep / AI + SPN node), when
- Functional data (if Tier 2 or 3): battery %, IMEI status, sensor test results
- Previous owner count
- Guarantee badge (7 / 30 / 90 day) with guarantee holder named
- Amazon A-to-Z Guarantee universal backstop badge
- "Verified by REVIVE" QR code (scannable by the buyer once received to confirm authenticity)
- SHA-256 hash of the record (shown as truncated hash for transparency)
- Buy button

**S8 — Green Credits Wallet (new — in account menu)**

Entry: Account → Green Credits (below "Your Orders" and "Returns & Orders").

Contents:
- Total balance: "220 credits = ₹22 discount on second-life items"
- How credits work (one-line explainer, always visible): "Earn credits by keeping orders and dropping returns at a kirana yourself. Spend them on REVIVE second-life items."
- Pending credits: orders in their return window with kirana self-drop chosen, showing countdown: "Air Fryer — window closes in 4 days → 16 credits pending"
- Earning history with category context: "Kept ₹1,200 kurta (fashion) + kirana drop → +24 credits · Jun 10", "Kept ₹800 phone case (electronics) + kirana drop → +8 credits · Jun 8"
- Spending history: "Used 100 credits on REVIVE refurb headphones → −₹10 · Jun 8"
- Earn rate explainer (collapsible): shows the category multiplier table so customers understand why fashion earns more than electronics
- Redemption: "Use on REVIVE second-life items — up to 20% off any purchase" → link to S5
- Donate option: "Donate 50+ credits to [NGO name]" — converts credits to a verified environmental action
- Expiry: "Credits expire 12 months after earning. Your oldest credits expire [date]."
- What does NOT earn credits (visible, honest): "Agent pickup returns, donations, recycling, selling items"

**S9 — Ops Console (Amazon internal / hackathon demo screen)**

Not customer-facing. This is the screen that demonstrates REVIVE's intelligence to judges and to Amazon's product team.

Contents:
- Live item feed: every graded item with its grade, EV breakdown, and assigned route
- Leaflet demand heatmap: item pins across the city, demand density glowing per geohash cell, route animations showing items flowing toward nearby buyers instead of a distant warehouse
- EV breakdown per item: "Resell locally ₹312 vs Warehouse ₹–40 vs Liquidate ₹18"
- Routing decision log: Stage 1 demand gate outputs + Stage 2 route selection per item
- Metrics dashboard: average km saved per item, CO₂ avoided this week, local match rate, items escalated to FC vs. sold locally
- Confidence queue: items below 70% grading confidence flagged for human review
- Disposition summary: items by route (P2P / Kirana / City-wide / SPN / FC / Donated)

This is the "brain" screen — the one that proves REVIVE is a decision engine, not just a resale listing tool.

Not a customer-facing page, but required for Route A and Route B:

For Flex agents:
- Job appears in Flex app: "REVIVE pickup — [address] — [item category]"
- On arrival: guided photo capture sequence (6 structured prompts with camera overlays, specific to tier)
- Checklist confirmation (powers on, accessories present, packaging type auto-selected)
- Flag item button (if real condition doesn't match Health Card → reroutes to C)
- Seal confirmation: agent scans the newly affixed REVIVE label to confirm handoff

For kirana partners (I Have Space app — existing app, new REVIVE section):
- "REVIVE Drop-off" tab
- Scan incoming QR label → item registered as received
- Shelf assignment (REVIVE designated shelf)
- Buyer collection: scan buyer OTP barcode → item released
- Day 5 alert: "This REVIVE item has not been collected — consolidate to next delivery station run"

---

## 9. Complete Customer Journey Maps

### Journey 1 — Priya returns shoes (Tier 1, Route B)

1. My Orders (S1) → taps "Return or Replace Items"
2. Return Wizard (S2) → selects "Doesn't fit". Sees keep-it nudge card: "Keep this → earn 20 Green Credits in 7 days." Ignores it, proceeds.
3. AI Grading (S3) fires automatically. Grade B in 1.4s. Defect boxes shown. Simple message: "Your shoes will be resold to someone nearby." Refund ₹499 initiated.
4. Handover choice shown: "Drop at [Kirana name] 200 m away → Earn Green Credits" vs "Schedule home pickup → No credits." Priya chooses kirana drop (to earn credits).
5. Priya drops shoes at kirana. Kirana scans QR. Item registered.
6. Within 5 days, a buyer 4 km away purchases the shoes on S5.
7. Buyer collects from the kirana using OTP. Kirana scans release.
8. Day 14 (Priya's original return window close — separate event): Priya's credits vest. She kept her previous order AND used the kirana drop → **20 credits** (fashion tier multiplier 2.0× on ₹800 kept order, tracked from her last non-returned purchase). The returned shoes themselves do not earn her credits — credits are earned by keeping, not by returning.
9. Buyer's 7-day guarantee window runs. No dispute → Health Card closed.

Note: Priya earns credits from orders she kept, not from returning these shoes. The keep-it nudge on S2 was the opportunity she passed up.

### Journey 2 — Rahul lists unused baby monitor (Tier 2, Route A)

1. Account menu → "Sell unused items" → S4 Sell It.
2. Searches "Motorola baby monitor" → catalog match confirmed.
3. 6 photo prompts + battery screenshot (device at 91%) + optional IMEI.
4. Grade A result. Price suggested: ₹2,340. Rahul adjusts to ₹2,200. Demand signal: "47 parents searched for this nearby."
5. Item listed. Rahul keeps it at home. Nothing moves.
6. 3 days later: buyer 3.8 km away purchases. Rahul gets app notification: "Your item has been sold — a Flex agent will collect it tomorrow."
7. Since Tier 2: Route A (agent doorstep) mandatory. Flex agent dispatched to Rahul.
8. Agent performs doorstep verification: 6 photos + powers-on check + battery screenshot re-confirmed.
9. Agent seals in bubble-wrapped rigid box (auto-selected by agent app for electronics category).
10. Item ships directly to buyer. No kirana, no warehouse.
11. Buyer receives, has 30-day guarantee window.
12. Day 31 (window close, no dispute): **Rahul receives UPI transfer of ₹2,200 minus REVIVE platform commission (e.g., 8%).** Rahul gets money. Rahul does not get Green Credits.
13. Buyer's Green Credits vest: buyer kept a ₹2,200 electronics purchase and used kirana self-drop (or did they schedule agent delivery here? — buyer chose home delivery from Rahul, so no kirana self-drop involved, therefore no credits for the buyer either on this transaction). Credits vest for buyers only when they choose kirana self-drop for their own returns on separately kept orders.

### Journey 3 — Buyer purchases from REVIVE storefront

1. Homepage "Certified Refurbished For You" rail shows baby monitor (Rahul's).
2. Buyer taps → sees product page with Health Card badge.
3. Taps "View Health Card" → S6 Health Card page: Grade A, battery 91%, IMEI verified, agent-verified at doorstep, 30-day guarantee, Amazon A-to-Z backstop.
4. Buys. Checkout (S7) shows Green Credits toggle (if they have credits) and return-risk nudge.
5. Selects delivery to home address. Flex agent delivers directly from Rahul's home.
6. Buyer accepts item → guarantee window starts.
7. No dispute within 30 days → credits vest in buyer's wallet.

### Journey 4 — Small seller bulk upload

1. Seller Central / REVIVE API integration (or seller-facing web portal).
2. Bulk photo upload: 12 return photos uploaded in one batch.
3. All 12 graded in ~20s total. Each returns a JSON record.
4. Routing assigned: 7 to local P2P, 3 to city-wide, 2 to SPN refurb.
5. Health Cards generated for all 12. Auto-listed on REVIVE storefront.
6. Seller sees a disposition dashboard: item IDs, grades, routes, expected recovery values, listing prices.

---

## 10. Routing Algorithm — Corrected Final Form

### Stage 1 — Demand Gate (polling loop, runs every 6 hours)

```python
def demand_gate(item_id, location_geohash, category, grade, asking_price, days_listed):
    demand_score = geohash_demand_index(location_geohash, category)
    sell_prob = gbdt_sell_probability(grade, asking_price, category, days_listed)
    holding_cost = BASE_HOLDING_COST * (1 + DECAY_FACTOR * days_listed)
    
    expected_local_value = sell_prob * asking_price - holding_cost
    
    if expected_local_value > SELL_THRESHOLD:
        return "SELL"  # Proceed to Stage 2 when buyer appears
    elif days_listed >= 21:
        return "ESCALATE_FC"  # Pull to Amazon FC
    elif days_listed >= 7:
        return "ESCALATE_CITY"  # Widen to city-wide / national listing
    elif days_listed >= 60:
        return "LIQUIDATE"
    else:
        return "HOLD"  # Keep listed, check again in 6 hours
```

### Stage 2 — Routing EV (fires once, when a buyer checks out)

```python
def routing_ev(item, buyer_location, tier):
    buyer_distance_km = haversine(item.location, buyer_location)
    
    # Hard tier blocks (override EV)
    if tier == 3:
        return "ROUTE_C_SPN"
    if tier == 2 and buyer_distance_km > 5:
        return "ROUTE_C_CITY"  # Route A only for Tier 2
    
    # EV calculation for eligible routes
    routes = {}
    
    if buyer_distance_km <= 5:
        routes["A_direct"] = (
            sell_prob(item) * item.asking_price
            - flex_cost(buyer_distance_km)
            - item.refurb_cost
            - item.holding_cost_so_far
        )
    
    if buyer_distance_km <= 25 and tier == 1:  # Route B: Tier 1 only
        routes["B_kirana"] = (
            sell_prob(item) * item.asking_price
            - kirana_logistics_cost(buyer_distance_km)
            - item.refurb_cost
            - item.holding_cost_so_far
        )
    
    routes["C_city"] = (
        sell_prob(item) * item.asking_price * 0.85  # price discount for wider listing
        - delivery_station_cost(buyer_distance_km)
        - item.refurb_cost
        - item.holding_cost_so_far
    )
    
    best_route = max(routes, key=routes.get)
    
    if routes[best_route] < DONATION_BENEFIT:
        return "DONATE"
    
    return best_route
```

**Note on the algorithm approach:** This two-stage structure is a fast instantiation of Multi-Criteria Decision Analysis (AHP), the academically validated framework for reverse logistics decision-making. Studies show this approach yields up to 33% higher recovered value and 65% better environmental outcomes than rule-based routing. The geohash demand-gravity model (local demand index per geohash cell and category) is the key differentiator — it routes items to nearest demand clusters, not to central warehouses, at the level of a single line of logic.

---

## 11. Technology Stack

| Component | Technology | AWS production equivalent |
|---|---|---|
| Defect detection | Grounding DINO (zero-shot) | SageMaker endpoint (custom container) |
| Vision captioning | Claude Haiku via OpenRouter | Amazon Bedrock (Claude Haiku, one env var switch) |
| Accessory check | CLIP similarity vs. catalog | SageMaker + S3 image store |
| Grading head | Lightweight fusion classifier | SageMaker |
| Pricing model | LightGBM on Mercari 1.4M listings | SageMaker |
| Sell-probability | GBDT | SageMaker |
| Demand index | Geohash → Redis sorted set | ElastiCache Redis |
| EV optimizer | Python, runs in memory, ~2ms | Lambda (stateless) |
| Recommender | ALS (collaborative) + CLIP (content) | SageMaker + Personalize |
| Prevention model | GBDT on user + item features | SageMaker |
| Health Card store | Signed JSON + SHA-256 hash chain | Aurora PostgreSQL ledger mode |
| Green Credits | Event-driven vest on window close | Lambda + DynamoDB |
| Routing map | Leaflet.js + geohash tiles | CloudFront + S3 |
| Demand heatmap | Redis geohash index → client render | ElastiCache + CloudFront |
| Backend API | Django REST Framework | ECS Fargate |
| Frontend | React | CloudFront + S3 |
| Offline grading | Qwen2.5-VL-3B (same JSON schema) | Edge device / Lambda@Edge |

---

## 12. Metrics

- **Grading latency:** under 2 seconds per item — demonstrated live
- **Pricing accuracy:** RMSLE ~0.45–0.50 on Mercari holdout (real-data number)
- **Recommendations:** Recall@20 / NDCG@20 on Amazon Reviews 2023 subset
- **EV uplift:** 3–5× recovered value vs. naive liquidation (synthetic 1,000-return cohort)
- **Distance saved:** ~590 km per locally routed item; ~4.2 kg CO₂ per item
- **Prevention F1:** primary metric (false positives waste intervention budget; false negatives miss preventable returns; F1 balances both)
- **Industry benchmark (Cahoot, real-world):** 64% cost reduction and 4× speed improvement for P2P vs. warehouse round-trip

---

## 13. Green Credits Anti-Gaming Design

| Potential exploit | How it's blocked |
|---|---|
| Schedule agent pickup, then claim credits | Agent pickup earns zero credits by design. Only kirana self-drop earns credits. No override. |
| Return an item then immediately relist it for credits | Credits are earned by keeping orders, not by any return action. Returning earns nothing. |
| Drop at kirana but then initiate return within window | Return initiation cancels pending credits immediately at the same event trigger. |
| Donate junk to earn credits | Donate and recycle earn zero credits. |
| List an item, claim it sold, farm credits | Sellers get money, not credits. Credits are buyer-only, on their own separate purchases. |
| Game the keep-it nudge by accepting then returning the next day | Credits vest only at window close. Return before window close → credits cancelled, no partial vest. |
| Buy cheap items repeatedly just to earn credits | Earn rate is low (₹0.10 per credit; fashion ₹800 order earns 20 credits = ₹2). The economics don't reward churn. Return window closure is the only verified trigger. |
| Inflate category to get higher multiplier | Category is auto-detected from the Amazon product catalog at purchase, not self-declared. |

---

## 14. Judge Q&A Cheat Sheet

| Pushback | Answer |
|---|---|
| "It's just a resale marketplace." | The marketplace is the output. The product is the decision engine — grading + two-stage EV routing + demand-gravity model. That bridge doesn't exist inside Amazon today. |
| "Won't green credits encourage more returns?" | Credits vest only when a purchase's return window closes with nothing sent back. A return means zero credits. It rewards the opposite behaviour. |
| "AI grading will be wrong sometimes." | Confidence-gated: below 70% confidence → human spot-check queue in the ops console. The Health Card records the model version. Fully auditable. |
| "Asking customers to photograph returns is friction." | They don't. The Flex agent runs the guided scan at the doorstep. Customer effort = zero. Self-scan is optional express lane only. |
| "Kiranas can't inspect electronics." | Correct — and by design they never do. Hard routing rule: Tier 2 and Tier 3 electronics are blocked from Route B. They always go to a Flex agent (Route A) or SPN node (Route C). |
| "What if there's no local demand?" | The demand clock escalates: local (0–7 days) → city-wide (7–21 days) → national FC listing (21+ days) → liquidation at day 60. The warehouse is the last resort, not the default. |
| "Who repackages the item?" | Tiered by route. Flex agent carries packing materials and seals at doorstep for Route A. Kirana applies a label swap only (light touch) for Route B Tier 1. Delivery station does full repack for Route C. The grading step already separated items by repack complexity before they reach any node. |
| "Will P2P trust hold?" | The trust comes from Amazon's existing rails: verified Health Card, Amazon payments (held in escrow), Amazon A-to-Z Guarantee backstop, and two-sided seller/buyer ratings. Trust is borrowed from Amazon's existing infrastructure, not rebuilt from scratch. |
| "P2P only works if there's local demand — what's the real match rate?" | Cahoot reports 30–40% of returns route peer-to-peer in real deployments. We don't claim 100%. The escalation ladder handles the rest — that's exactly why the demand clock exists. |
| "Is this on AWS?" | The vision call is provider-abstracted. Demo routes through OpenRouter; one environment variable switches it to Amazon Bedrock running the same Claude Haiku model. Every component in the stack has a named AWS production counterpart. |

---

## 15. Closing Pitch Line

> *"Amazon's promise has always been: from need to done. REVIVE extends that promise to the product's second life — every return becomes someone's perfect purchase, 5 km away instead of 600. That's good for Priya. Good for Rahul. Good for sellers. Good for Amazon. And good for the planet."*