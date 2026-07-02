# REVIVE — Seller Central & Flex Doorstep Grading: Product Flow

## Why

REVIVE today serves the consumer side (return wizard, AI grading, disposition, local routing). The missing persona is the **small seller** (~200 returns/month) who manually inspects, grades, prices, and re-lists every return. This extension adds a Seller Central experience that automates that work, and — if time permits — moves grading even earlier, to the delivery agent at the customer's doorstep. Both reuse the existing AI grading engine, disposition gate, and demand-based routing; the seller side is built and finished first, Flex is a cleanly severable second phase. Everything is scoped to fit a 5-minute demo video.

## How it maps to the real Amazon pipeline (research)

- **FBA Grade and Resell**: Amazon already inspects eligible FBA returns, assigns *Used – Like New / Very Good / Good / Acceptable*, and auto-relists them with condition notes under the same ASIN. Our feature is "Grade and Resell for small self-fulfilled sellers", with AI replacing the warehouse inspector. ([sell.amazon.com](https://sell.amazon.com/blog/announcements/fba-grade-and-resell))
- **Removal-order dispositions**: Amazon's real action vocabulary for returned/unfulfillable inventory is relist / liquidate (~5–10% recovery) / dispose / refurbish; Warehouse Deals is Amazon reselling graded returns. These become our recommended actions. ([sellerassistant.app](https://www.sellerassistant.app/blog/amazon-unfulfillable-inventory-complete-guide/))
- **Doorstep verification already exists**: Amazon India delivery agents already check a return at pickup (original condition, tags — they can cancel the pickup). Phase B upgrades this manual check into full AI grading + instant routing. ([amazon.in](https://www.amazon.in/gp/help/customer/display.html?nodeId=202111950))
- **"I Have Space" kirana program**: Amazon India's real partnership with 28,000+ neighborhood stores for delivery/pickup — the kirana relay route plugs into it directly. ([aboutamazon.in](https://www.aboutamazon.in/amazons-i-have-space-program-supports-local-stores-and-msmes))

---

## Phase A — Seller Central (primary)

A dark, dense, Amazon-Seller-Central-style section of the same website, reached from a "Seller Central" link in the existing header. It has three screens: **Dashboard**, **Manage Returns**, and a **Return Case detail (AI Grading Assistant)**. Inventory links back to the existing My Listings.

### Flow 1 — Seller Dashboard

Seller logs in → lands on the dashboard showing the month at a glance:
- Returns processed this month, ₹ value recovered, hours saved (vs. manual inspection), average AI confidence
- Grade distribution (A–F bars), action mix (relisted / open box / warranty / liquidated / disposed), recovery rate
- Recent activity feed linking into individual return cases

### Flow 2 — Manage Returns queue

One table of every incoming return, filterable by stage:

```
Return initiated by customer
        │
   PENDING  (in transit to seller)
        │  item arrives / photos available
   RECEIVED (ready to grade)  ──►  "Grade with AI" button
        │
   GRADED   (AI verdict + recommended action awaiting seller decision)
        │  seller confirms an action (one click)
   RESOLVED (relisted / open box / warranty claim / liquidated / disposed)
```

Each row shows: product, RMA id, customer, return reason, age, status, grade badge, and the suggested next action.

### Flow 3 — AI Grading Assistant (the core)

1. Seller opens a "received" case → sees the return's photos (or uploads their own, guided by category-specific angle prompts — a shoe asks for sole shots, a phone asks for a powered-on screen).
2. Clicks **Grade with AI** → in a few seconds the assistant returns:
   - **Grade + confidence** (A–F internally, shown as Amazon condition labels: Like New / Very Good / Good / Acceptable / Not resellable)
   - Defects found, marked visually on each photo (heatmaps)
   - Integrity check — if the customer returned the *wrong item*, the assistant flags the mismatch instead of grading it
   - An **auto-written, customer-facing condition note** (editable)
3. Next to the verdict, a **ranked action panel** appears — each option with estimated recovery value and a one-line reason:

| AI verdict | Recommended action | Typical recovery |
|---|---|---|
| Sealed, unopened, verified | **Relist as New** at full price | 100% |
| Opened but flawless (Like New) | **Create Open Box listing** | ~85% |
| Very Good | **Relist Used – Very Good** | ~85% |
| Good | **Relist Used – Good** | ~70% |
| Acceptable + local demand exists | **Relist Used – Acceptable** | ~50% |
| Acceptable + low demand | **Liquidate** (Warehouse-Deals-style) | 8–10% |
| Functional defect + returned as "defective" | **File warranty claim with supplier** | ~60% credit |
| Dead / unsafe / opened hygiene item | **Dispose safely** (only option, others locked) | 0% |

4. Seller adjusts price/note if desired → **one click** → the listing goes live on the existing storefront immediately, with the AI condition note attached. Dashboard counters update.

**What this saves the seller:** inspection, grading, condition-writing, pricing, and relisting collapse from ~12 minutes of manual work per return to under a minute of review.

### Demo data

A seeded demo seller arrives with a realistic month: ~26 return cases across categories — some in transit, a few ready to grade live on camera, and a resolved history rich enough that the dashboard tells a story. Guaranteed edge cases in the queue: an opened hygiene item (dispose-only), a defective phone (warranty claim), a sealed apparel item (relist as New), and one high-value phone reserved for the Flex demo.

---

## Phase B — Flex doorstep grading & instant routing (stretch)

A mobile-width "Amazon Flex" page, framed like the agent's phone. Instead of the agent's existing manual doorstep check, the AI grades at pickup and routes the package **before it travels anywhere**.

### Flow — at the customer's door

```
Agent opens pickup task (customer, item, return reason)
        │
Captures multi-angle photos (+ "packaging damaged?" toggle)
        │
AI grades in ~10-15 seconds
        │
        ▼
┌─────────────── Instant routing decision ───────────────┐
│                                                         │
│ Like New + high local demand + low risk                 │
│   → KIRANA RELAY ("I Have Space" store)                 │
│     item stays in the neighbourhood, relists same day,  │
│     saves the return-shipping leg                       │
│                                                         │
│ Like New / Very Good + medium demand                    │
│   → AMAZON HUB LOCKER                                   │
│     secure hold for seller pickup / consolidated move   │
│                                                         │
│ Good / Acceptable, low demand, damaged, or wrong item   │
│   → RETURN TO SELLER (traditional path)                 │
│                                                         │
│ Opened hygiene item / unsafe                            │
│   → DISPOSE safely                                      │
└─────────────────────────────────────────────────────────┘
        │
Agent confirms handoff → decision card shows grade,
reasons, km & CO₂ saved
        │
The case appears in the seller's queue ALREADY GRADED,
badged "Graded at doorstep by Flex agent"
```

### Guardrails (your point 4, all enforced by rules that already exist in the engine)

- **High-value / fraud-prone items never go to kirana.** Phones, laptops, jewellery and anything above the low-risk value band are hard-blocked from the kirana route — a shop counter can't verify IMEI, battery health, or screen condition. They fall back to the seller/SPN path, and the decision card says why.
- **Damaged packaging ≠ damaged product.** If only the packaging is damaged and the category isn't hygiene-sealed, the item continues on its graded route with a "repack at first node" instruction — kirana stores may replace *packaging only*. But a damaged-packaging item can never be relisted as "New" (Open Box at best).
- **Hygiene / sealed-only categories** (beauty, personal care, consumables): once the seal is broken, no resale path exists anywhere in the flow — dispose is the only outcome, at the door or in Seller Central.
- **Wrong-item fraud**: the same integrity gates used on the consumer side run at the door — a mismatched item cancels local routing and goes back on the traditional path.

---

## 5-minute video flow

1. Login as the demo seller → **Dashboard**: a month of returns, ₹ recovered, hours saved.
2. **Manage Returns** queue → a realistic month of cases at different stages.
3. Open a ready-to-grade case → **Grade with AI** → grade + confidence + defect heatmaps + auto condition note → one click → **the listing is live on the storefront** (switch to the consumer site to show it).
4. Show the guardrails fast: defective phone → warranty-claim recommendation; opened hygiene item → dispose-only.
5. (Phase B) Phone-frame **Flex pickup**: photos at the door → "Like New + high local demand" → **Kirana relay** card with km/CO₂ saved; then the high-value phone → "return to seller — high-risk, kirana not eligible".
6. Back to the dashboard — counters have ticked up. Close on the circular-economy message.

## Build order

1. Seller Central backend flow (return cases, grading assistant, recommendations, one-click relist, dashboard)
2. Demo seed data
3. Seller Central screens
4. **Only then**, if time permits: Flex doorstep flow (reuses the same grading and routing engines — nothing in Phase A depends on it)

## Verification

- Grade a seeded case end-to-end: queue → grade → recommendation → one-click relist → the listing is visible and purchasable on the consumer storefront.
- Confirm the existing consumer return wizard and Sell-It flows still behave exactly as before (they share the grading engine).
- Confirm guardrails: hygiene case only allows dispose; high-value case never routes to kirana; wrong-item photos produce a mismatch, not a grade.
- Pre-record warm-up: grade the two live-demo cases once beforehand so the demo replays instantly from cache.
