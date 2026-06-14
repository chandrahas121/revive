// utils/tier.js
// Tier logic + Green Credits estimation — mirrors final_idea.md §3 Rule 3,
// §4 Pillar 2 tier table, §5 Green Credits formula, and the ml/route.py backend.
//
// Tier is derived from the item's value (MRP, or asking price as a proxy):
//   Tier 1 — below ₹2,000   — apparel, books, toys, home goods, accessories
//   Tier 2 — ₹2,000–₹10,000 — phones, laptops, monitors, speakers, tablets
//   Tier 3 — above ₹10,000  — high-value electronics, cameras

export const TIER1_LIMIT = 2000;
export const TIER2_LIMIT = 10000;

export function getTier(value) {
  const v = parseFloat(value) || 0;
  if (v < TIER1_LIMIT) return 1;
  if (v <= TIER2_LIMIT) return 2;
  return 3;
}

export const TIER_INFO = {
  1: {
    label: 'Tier 1',
    range: 'Under ₹2,000',
    blurb: 'Apparel, books, toys, home goods & accessories',
    guarantee: '7-day buyer protection',
    guaranteeDays: 7,
    guaranteeHolder: 'Seller, via Amazon payment escrow',
    inspection: 'AI cosmetic grading',
    color: '#15803d',
    bg: '#dcfce7',
  },
  2: {
    label: 'Tier 2',
    range: '₹2,000 – ₹10,000',
    blurb: 'Phones, laptops, monitors, speakers & tablets',
    guarantee: '30-day cosmetic + battery claim',
    guaranteeDays: 30,
    guaranteeHolder: 'Seller, via escrow · A-to-Z backstop',
    inspection: 'AI + agent doorstep verification',
    color: '#1d4ed8',
    bg: '#dbeafe',
  },
  3: {
    label: 'Tier 3',
    range: 'Above ₹10,000',
    blurb: 'High-value electronics, cameras & laptops',
    guarantee: '90-day full functional coverage',
    guaranteeDays: 90,
    guaranteeHolder: 'Amazon SPN partner',
    inspection: 'AI + professional SPN node inspection',
    color: '#7c3aed',
    bg: '#ede9fe',
  },
};

// ── Tier-specific photo prompts for the Sell It flow (final_idea §7 / S4) ──────
export const TIER_PHOTO_PROMPTS = {
  1: [
    { key: 'front',   label: 'Front',          hint: 'Whole item, well lit', required: true },
    { key: 'back',    label: 'Back',           hint: 'Reverse side',          required: true },
    { key: 'label',   label: 'Label / Tag',    hint: 'Brand or size label',   required: true },
    { key: 'defects', label: 'Any defects',    hint: 'Close-up (optional)',   required: false },
  ],
  2: [
    { key: 'front',       label: 'Front',             hint: 'Whole device',              required: true },
    { key: 'back',        label: 'Back',              hint: 'Reverse side',              required: true },
    { key: 'screen',      label: 'Screen (powered on)', hint: 'Show it boots',           required: true },
    { key: 'ports',       label: 'All ports',         hint: 'Charging / audio ports',    required: true },
    { key: 'accessories', label: 'Accessories',       hint: 'Charger, cable, box',       required: true },
    { key: 'defects',     label: 'Any defects',       hint: 'Close-up (optional)',       required: false },
  ],
  3: [
    { key: 'front',       label: 'Front',       hint: 'Whole device',     required: true },
    { key: 'back',        label: 'Back',        hint: 'Reverse side',     required: true },
    { key: 'screen',      label: 'Screen',      hint: 'Powered on',       required: true },
    { key: 'accessories', label: 'Accessories', hint: 'Everything in box', required: true },
  ],
};

// ── Green Credits estimator (final_idea §5) ───────────────────────────────────
// credits = value_band × category_return_rate_multiplier
// Buyer-side only, awarded for KEEPING an order (shown as the keep-it nudge).
const CATEGORY_MULTIPLIER = {
  Footwear: 2.0, Clothing: 2.0, Fashion: 2.0,
  Electronics: 0.8, Beauty: 0.8, Jewelry: 0.8,
  Books: 0.5, Toys: 0.5, Stationery: 0.5,
  'Home & Kitchen': 1.0, Sports: 1.0, Other: 1.0,
};

export function estimateGreenCredits(category, value) {
  const v = parseFloat(value) || 0;
  const mult = CATEGORY_MULTIPLIER[category] ?? 1.0;
  let band;
  if (v < 500) return 5;                 // flat, no multiplier
  else if (v < 2000) band = 10;
  else if (v <= 10000) band = 20;
  else band = 30;                        // capped
  return Math.round(band * mult);
}

export function categoryMultiplier(category) {
  return CATEGORY_MULTIPLIER[category] ?? 1.0;
}
