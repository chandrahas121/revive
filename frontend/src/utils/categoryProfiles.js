// utils/categoryProfiles.js
// v2 CORE CORRECTION (final_idea_v2.md §2 Axis A). Mirrors ml/category_profiles.py.
//
// A product's CATEGORY decides what photos to capture and how to grade it — NOT
// its price. This replaces the tier-keyed TIER_PHOTO_PROMPTS in utils/tier.js so
// a ₹6,000 Nike Air Max (Footwear) is asked for SOLES, never a powered-on screen.
//
// Risk tier (value × fraud-risk) is backend-only and never shown to the customer.

const DEFECTS = { key: 'defects', label: 'Any defects', hint: 'Close-up (optional)', required: false };

export const CATEGORY_PROFILES = {
  Apparel: {
    capture: [
      { key: 'front',  label: 'Front',          hint: 'Whole garment, well lit', required: true },
      { key: 'back',   label: 'Back',           hint: 'Reverse side',            required: true },
      { key: 'fabric', label: 'Fabric close-up',hint: 'Show the weave/knit',     required: true },
      { key: 'label',  label: 'Label / Tag',    hint: 'Brand, size & care tag',  required: true },
      DEFECTS,
    ],
    conditions: ['New with tags', 'Like new', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: false,
  },
  Footwear: {
    capture: [
      { key: 'top',    label: 'Top',      hint: 'Looking down at the pair', required: true },
      { key: 'side',   label: 'Side',     hint: 'Profile view',             required: true },
      { key: 'sole',   label: 'Soles',    hint: 'Underside — show wear',    required: true },
      { key: 'insole', label: 'Insole',   hint: 'Inside heel/footbed',      required: true },
      { key: 'box',    label: 'Box / Tag',hint: 'Box or brand tag (optional)', required: false },
      DEFECTS,
    ],
    conditions: ['New with tags', 'Like new', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: false,
  },
  Phone: {
    capture: [
      { key: 'front',       label: 'Front',               hint: 'Whole device',            required: true },
      { key: 'back',        label: 'Back',                hint: 'Reverse side',            required: true },
      { key: 'screen_on',   label: 'Screen (powered on)', hint: 'Show it boots',           required: true },
      { key: 'ports',       label: 'Ports',               hint: 'Charging / audio ports',  required: true },
      { key: 'accessories', label: 'Accessories',         hint: 'Charger, cable, box',     required: true },
      DEFECTS,
    ],
    conditions: ['New (sealed)', 'Open box', 'Renewed', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: true,
    extra: ['battery_screenshot'],
  },
  Laptop: {
    capture: [
      { key: 'lid',         label: 'Lid',                 hint: 'Closed, top',       required: true },
      { key: 'base',        label: 'Base',                hint: 'Underside',         required: true },
      { key: 'screen_on',   label: 'Screen (powered on)', hint: 'Show it boots',     required: true },
      { key: 'keyboard',    label: 'Keyboard',            hint: 'Keys & trackpad',   required: true },
      { key: 'ports',       label: 'Ports',               hint: 'All sides',         required: true },
      { key: 'accessories', label: 'Accessories',         hint: 'Charger, box',      required: true },
      DEFECTS,
    ],
    conditions: ['New (sealed)', 'Open box', 'Renewed', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: true,
    extra: ['battery_screenshot'],
  },
  'Home & Kitchen': {
    capture: [
      { key: 'front',       label: 'Front',       hint: 'Whole item',     required: true },
      { key: 'back',        label: 'Back',        hint: 'Reverse side',   required: true },
      { key: 'plug',        label: 'Plug / Cord', hint: 'If electrical',  required: false },
      { key: 'accessories', label: 'Accessories', hint: 'Parts & manual', required: false },
      DEFECTS,
    ],
    conditions: ['Open box', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: false,
  },
  Books: {
    capture: [
      { key: 'cover', label: 'Cover', hint: 'Front cover',        required: true },
      { key: 'spine', label: 'Spine', hint: 'Show the binding',   required: true },
      { key: 'pages', label: 'Pages', hint: 'Inside / any marks', required: true },
    ],
    conditions: ['Like new', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: false,
  },
  Beauty: {
    capture: [
      { key: 'sealed', label: 'Sealed packaging', hint: 'Show seal intact', required: true },
      { key: 'label',  label: 'Label / Expiry',   hint: 'Batch & expiry',   required: true },
    ],
    conditions: ['New (sealed)'],
    isElectronics: false,
    sealedOnly: true,
  },
  Toys: {
    capture: [
      { key: 'front', label: 'Front', hint: 'Whole toy',          required: true },
      { key: 'back',  label: 'Back',  hint: 'Reverse side',       required: true },
      { key: 'parts', label: 'Parts', hint: 'All parts laid out', required: true },
      DEFECTS,
    ],
    conditions: ['New with tags', 'Used A', 'Used B', 'Used C', 'Used D'],
    isElectronics: false,
  },
};

const DEFAULT_PROFILE = {
  capture: [
    { key: 'front', label: 'Front', hint: 'Whole item',   required: true },
    { key: 'back',  label: 'Back',  hint: 'Reverse side', required: true },
    { key: 'label', label: 'Label', hint: 'Any label',    required: false },
    DEFECTS,
  ],
  conditions: ['Like new', 'Used A', 'Used B', 'Used C', 'Used D'],
  isElectronics: false,
};

const ALIASES = {
  footwear: 'Footwear', shoes: 'Footwear', sneakers: 'Footwear', sandals: 'Footwear',
  clothing: 'Apparel', apparel: 'Apparel', fashion: 'Apparel', tops: 'Apparel',
  shirt: 'Apparel', 't-shirt': 'Apparel', dress: 'Apparel', kurta: 'Apparel',
  phone: 'Phone', smartphone: 'Phone', mobile: 'Phone', tablet: 'Phone',
  laptop: 'Laptop', notebook: 'Laptop', macbook: 'Laptop',
  electronics: 'Phone',
  'home & kitchen': 'Home & Kitchen', home: 'Home & Kitchen', kitchen: 'Home & Kitchen',
  appliance: 'Home & Kitchen', appliances: 'Home & Kitchen',
  books: 'Books', book: 'Books', media: 'Books',
  beauty: 'Beauty', cosmetics: 'Beauty', skincare: 'Beauty', grocery: 'Beauty',
  toys: 'Toys', toy: 'Toys', games: 'Toys',
};

export function canonicalCategory(category) {
  if (!category) return 'Other';
  if (CATEGORY_PROFILES[category]) return category;
  return ALIASES[String(category).toLowerCase()] || 'Other';
}

export function getProfile(category) {
  return CATEGORY_PROFILES[canonicalCategory(category)] || DEFAULT_PROFILE;
}

export function capturePrompts(category) {
  return getProfile(category).capture;
}

export function conditionLabels(category) {
  return getProfile(category).conditions;
}

export function isElectronics(category) {
  return !!getProfile(category).isElectronics;
}

// The list of categories the seller can pick from in Sell It.
export const SELLABLE_CATEGORIES = [
  'Apparel', 'Footwear', 'Phone', 'Laptop', 'Home & Kitchen', 'Books', 'Toys', 'Beauty',
];
