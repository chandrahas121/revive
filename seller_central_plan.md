# REVIVE — Seller Central & Flex Doorstep Grading: Product Flow

## Why

REVIVE today serves the consumer side (return wizard, AI grading, disposition, local routing). The missing persona is the **small seller** (~200 returns/month) who manually reviews return requests, inspects, grades, prices, re-lists, decides refunds, and files reimbursement claims for every return. This extension adds a **Seller Central** — a separate site experience with its own seller login, mirroring real Amazon Seller Central — where the AI manages the *entire* return lifecycle end to end. If time permits, Phase B moves grading even earlier: to the delivery agent at the customer's doorstep. Both phases reuse the existing AI grading engine, disposition gate, demand routing, and the existing AI-grade **Health Card**. Seller side is built and finished first; Flex is cleanly severable. Everything fits a 5-minute demo video.

**Note on the existing "My Listings" page:** it is a consumer feature (individuals selling unused items) and stays untouched. Seller Central is a separate experience with a separate login and its own inventory view.

## How it maps to the real Amazon pipeline (research)

- **Manage Returns (seller-fulfilled)**: the real tool has exactly the three tabs in your screenshot — *Return requests*, *Returns received*, *SAFE-T claims*. Amazon **auto-authorizes** in-policy return requests; out-of-policy or exempt-category requests go to the seller, who can authorize, offer a refund/concession ("returnless refund"), or decline with an explanation. Sellers may charge up to a **20% restocking fee** on items returned used/damaged, and **refund at first scan** auto-refunds the buyer when the carrier first scans the prepaid return label. ([sell.amazon.com](https://sell.amazon.com/blog/manage-customer-returns), [Seller Central help](https://sellercentral.amazon.com/help/hub/reference/external/G200708210?locale=en-US))
- **SAFE-T claims** (Seller Assurance for E-commerce Transactions): the seller's appeal channel when *Amazon* issued a refund on the seller's behalf and the seller wasn't at fault. **Eligible**: item returned damaged / materially different (customer abuse), a *different item* returned, item never returned after a first-scan refund, return-shipping costs wrongly refunded. **Ineligible**: seller issued the refund themselves, A-to-Z claim refunds, FBA orders, damage during return transit, or seller refused the return. Must be filed **within 30 days** of the refund/receipt, with evidence attached (photos, condition documentation); capped around **$5,000** per claim; reimbursed only if Amazon judges the seller not at fault. ([salesduo.com](https://salesduo.com/blog/amazon-safe-t-claim-guide/), [Seller Central filing guide](https://sellercentral.amazon.com/seller-forums/discussions/t/cfa1fdcd-a63c-4e75-b130-75a3a39a4f92), [myamazonguy.com](https://myamazonguy.com/news/amazon-safe-t-claim-filing-window/))
- **FBA Grade and Resell**: Amazon already grades eligible FBA returns (*Used – Like New / Very Good / Good / Acceptable*) and auto-relists them **as a new SKU under the same ASIN** with condition notes. Our feature is Grade-and-Resell for small seller-fulfilled sellers, with AI as the inspector. ([sell.amazon.com](https://sell.amazon.com/blog/announcements/fba-grade-and-resell))
- **Removal dispositions / Warehouse Deals / Liquidations**: relist / liquidate (~5–10% recovery) / dispose / refurbish is Amazon's real action vocabulary for returned inventory. ([sellerassistant.app](https://www.sellerassistant.app/blog/amazon-unfulfillable-inventory-complete-guide/))
- **Doorstep verification & "I Have Space"** (Phase B): Amazon India agents already verify returns at pickup and can cancel the pickup; the kirana relay maps to Amazon's real 28,000-store I Have Space / Hub Delivery partner network. ([amazon.in](https://www.amazon.in/gp/help/customer/display.html?nodeId=202111950), [aboutamazon.in](https://www.aboutamazon.in/amazons-i-have-space-program-supports-local-stores-and-msmes))

---

# Phase A — Seller Central: the AI-managed return lifecycle

## The experience shell

- **Separate seller login** — a Seller Central sign-in page distinct from the consumer login. A seller account (e.g. the demo seller's store "AARAV RETAIL | India") lands in Seller Central, never the storefront; consumers can't enter Seller Central. "View my storefront" opens the consumer site.
- **Look and IA copied from the real thing** (your screenshots): dark top bar with the *seller central* wordmark, store chip, global search, help; a nav row with **Manage All Inventory · Manage Returns · Business Reports (dashboard) · Add Products (stub) · Fulfillment (stub)** — stubs keep the nav looking authentic.
- **Manage All Inventory** — the seller's real inventory table (not the consumer My Listings): image, title, ASIN, SKU, condition, listing status, price, inventory count, per-row actions. Relisted returns appear here as **new condition-SKUs under the same ASIN** (e.g. `MQ-KZ12-TEAL-UVG` for "Used – Very Good"), each carrying its Health Card badge.
- **Manage Returns** — the heart of the feature, with the real three tabs: **Return requests · Returns received · SAFE-T claims**, plus an "AI Grading Assistant" indicator showing the AI is managing the queue.

## The full return lifecycle — what the AI does at every step

### Step 1 · Triage, the moment a return is requested (Return requests tab)

The AI reads the return reason, policy window, category, and item value, and decides:

| Situation | AI decision |
|---|---|
| In policy | **Auto-authorize**, issue prepaid label (Amazon's real behavior) |
| Low-value item, return shipping costs more than the item | **Returnless refund** — refund without asking the item back |
| Out of policy / suspected abuse | Recommend **decline**, with a drafted explanation for the buyer |
| High-value item | Authorize + **flag for verified pickup** (Phase B tie-in) |

The refund *plan* is also set now: full refund, or partial refund with up to a 20% restocking fee if the item comes back used/damaged. If the label is refund-at-first-scan, the buyer gets refunded the moment the carrier scans the package — so the AI opens a **SAFE-T watch** on that order.

### Step 2 · In transit

The AI tracks first scan → expected arrival. If the item **never arrives** after a first-scan refund, it auto-drafts a SAFE-T claim ("item not returned").

### Step 3 · Receive & grade (Returns received tab)

When the item arrives, the seller photographs it with guided, category-specific angle prompts (a shoe asks for soles; a phone asks for a powered-on screen). In seconds the AI returns:

- **Integrity check** — is this the *same item* that was sold? A wrong or different item returned raises a fraud flag instead of a grade.
- **Grade + confidence** — A–F internally, shown as Amazon condition labels (*Like New / Very Good / Good / Acceptable / Not resellable*), with each defect boxed on the photos.
- **Auto-written, customer-facing condition note** (editable).

### Step 4 · Two decisions on one screen

The verdict screen separates the **money side** from the **inventory side** — they are independent decisions.

**A. Refund verdict:**

| Finding | Verdict |
|---|---|
| Original condition | Confirm **full refund** |
| Used / customer-damaged | **Partial refund** with up to 20% restocking fee (if refund not yet issued) |
| Already refunded (first scan) and item is damaged or wrong | Refund can't be changed — **auto-draft a SAFE-T claim** (Step 6) |

**B. Recovery action** — a ranked list, each option with estimated recovery and a one-line reason:

| AI finding | Recommended action | Typical recovery |
|---|---|---|
| Sealed, unopened, verified | Relist as **New** | 100% |
| Opened but flawless | **Open Box** listing | ~85% |
| Very Good | Relist **Used – Very Good** | ~85% |
| Good | Relist **Used – Good** | ~70% |
| Acceptable, local demand exists | Relist **Used – Acceptable** | ~50% |
| Acceptable, no demand | **Liquidate** (Warehouse-Deals-style) | 8–10% |
| Manufacturing defect | **Warranty claim** to supplier | ~60% credit |
| Dead / unsafe / opened hygiene item | **Dispose safely** — only enabled option, with the rule shown ("hygiene seal broken") | 0% |

### Step 5 · One-click relist + Health Card

On confirm, the AI:

1. Creates the **condition-SKU listing under the same ASIN** — price pre-filled from the recovery ladder (editable), condition note attached.
2. Generates the **existing AI-grade Health Card** for the relisted item — the signed, tamper-evident record of grade, defect photos, functional status, with QR — and attaches it to the listing. Buyers see "AI-inspected · view Health Card" on the product page.
3. The listing appears in **Manage All Inventory** and goes live on the storefront immediately.

### Step 6 · SAFE-T claims (SAFE-T claims tab)

A queue of **AI-drafted claims**. For each eligible case the AI has already:

- **Checked eligibility** — Amazon-issued refund, seller not at fault, within the 30-day window; it *blocks* filing when the seller refunded voluntarily or the damage happened in return transit (ineligible per policy).
- **Picked the reason code** — item materially different / different item returned / item not returned.
- **Assembled the evidence bundle** — delivery-time vs return-time photo comparison, AI grade report, defect heatmaps, condition note, Health Card hash.
- **Set the deadline countdown** — "12 days left to file".

The seller reviews and submits in one click. The demo simulates Amazon granting the reimbursement, which flows into "value recovered".

### Step 7 · Dashboard (Business Reports)

The month at a glance: returns processed, ₹ recovered (resale + restocking fees + SAFE-T reimbursements + warranty credits), hours saved, average AI confidence, grade distribution, action mix, SAFE-T win rate, recent activity.

## The three Manage Returns tabs, row by row

- **Return requests** — like your screenshot: Order ID/date, product, return reason, status chip (*Return requested → Authorized → In transit → Received / Closed*), refund amount — plus an **AI decision chip** on every row ("Auto-authorized · in policy", "Returnless refund issued · ₹180 item", "Declined · outside window"). Out-of-policy rows wait for the seller with the AI's recommendation pre-selected — accept or override.
- **Returns received** — the grading queue: every physically arrived item with an **Inspect** button opening the AI Grading Assistant (Steps 3–5). Already-inspected rows show grade badge, chosen action, recovered ₹, and a link to the relisted SKU.
- **SAFE-T claims** — the AI-drafted queue: claim reason, evidence preview, eligibility checklist, deadline countdown, status (*Draft → Submitted → Granted/Denied*), reimbursed amount.

## Edge cases the flow must handle (enforced, not just displayed)

- **Wrong/different item returned** → integrity gate blocks grading; refund verdict flips to "withhold/reverse"; SAFE-T claim auto-drafted with the photo mismatch as evidence.
- **Opened hygiene/sealed-only item** → no resale path anywhere; dispose is the only enabled action. The refund may still be full — the two decisions are independent.
- **Customer-damaged but seller already refunded voluntarily** → SAFE-T unavailable (ineligible); the AI says so and suggests restocking-fee capture next time.
- **Damaged packaging, intact product** → can never relist as "New" (Open Box at best); repack note attached.
- **High-value items** → flagged at triage for verified pickup (Phase B tie-in), excluded from any local/kirana handling.
- **AI offline** → grading falls back gracefully (conservative grade + manual-review flag); nothing dead-ends.

## Demo data

Seeded demo seller with a realistic month (~26 returns): open *Return requests* showing each triage outcome (auto-authorized, returnless refund, declined, high-value flagged), 3–4 *Returns received* ready to grade live on camera, a resolved history that fills the dashboard, and 2 SAFE-T drafts (one wrong-item, one customer-damaged after a first-scan refund). Guaranteed rows: opened hygiene item, defective phone (warranty claim), sealed apparel (relist as New), high-value phone reserved for Phase B.

---

# Phase B — Flex doorstep grading & instant routing (stretch)

A mobile-width "Amazon Flex" page framed like the agent's phone. The agent's existing manual doorstep check becomes full AI grading, so the routing decision happens **before the package travels anywhere** — and the seller's *Returns received* work is already done at pickup.

**Flow at the customer's door:**

1. Agent opens the pickup task — customer, item, return reason, the seller's triage flags.
2. Captures multi-angle photos, plus a "packaging damaged?" toggle.
3. AI grades in ~10–15 seconds and shows the routing decision:

| Verdict at the door | Route | Why |
|---|---|---|
| Like New + high local demand + low risk | **Kirana relay** ("I Have Space" store) | Stays in the neighbourhood, relists same day, return-shipping leg saved |
| Like New / Very Good + medium demand | **Amazon Hub locker** | Secure hold for seller pickup or consolidated move |
| Good / Acceptable, low demand, damaged, or wrong item | **Return to seller** | Traditional path |
| Opened hygiene item / unsafe | **Dispose safely** | No resale path exists |

4. Agent confirms handoff — the card shows grade, reasons, km and CO₂ saved.
5. The case lands in the seller's *Returns received* tab **already graded**, badged "Graded at doorstep by Flex agent".

**Guardrails** (same engine rules as Phase A): high-value/fraud-prone items are hard-blocked from kirana (a shop counter can't verify IMEI, battery, or screen) and the card says why; packaging-only damage continues with a "repack at first node" note (kirana may replace packaging only — never relist as New); hygiene seal broken → dispose at the door; wrong item → routing cancelled, traditional path, SAFE-T evidence captured at the doorstep.

---

## 5-minute video flow

1. **Seller login** → Seller Central dashboard: a month of returns, ₹ recovered (resale + SAFE-T + fees), hours saved.
2. **Manage Returns · Return requests**: AI triage chips — auto-authorized, a returnless refund on a ₹180 item, a declined out-of-policy request.
3. **Returns received** → open a case → **Grade with AI** → grade + heatmaps + condition note → refund verdict (partial, 20% restocking fee) + "Relist Used – Very Good @85%" → one click → open the live storefront listing **with its Health Card** (click the QR).
4. **SAFE-T claims**: the wrong-item return with its evidence bundle → submit → reimbursement granted → dashboard ticks up.
5. *(Phase B)* Phone-frame Flex pickup → Like New + high demand → **Kirana relay** card with km/CO₂ saved; the high-value phone → "return to seller — high-risk, kirana not eligible".
6. Dashboard close: recovery rate, sustainability line, circular-economy message.

## Build order

1. Seller auth + Seller Central shell (login, nav, Manage All Inventory)
2. Return lifecycle backend (return cases, triage rules, grading, refund verdicts, recovery actions, relist + Health Card attach, SAFE-T drafting)
3. Manage Returns UI (three tabs) + Grading Assistant screen
4. Dashboard + demo seed data
5. **Only then, if time permits:** Phase B Flex flow (reuses the same engines; nothing in Phase A depends on it)

## Verification

- End-to-end: return request → triage → received → AI grade → refund verdict + relist → condition-SKU live on the consumer storefront **with Health Card visible** → dashboard updated.
- SAFE-T: the wrong-item case drafts a claim with evidence; a voluntarily-refunded case correctly shows "ineligible".
- Guardrails: hygiene case allows dispose only; high-value never routes to kirana; wrong item produces a mismatch, not a grade.
- Consumer flows unchanged: existing return wizard, Sell-It, and My Listings behave exactly as before.
- Pre-record warm-up: grade the live-demo cases once beforehand so replays are instant from cache.