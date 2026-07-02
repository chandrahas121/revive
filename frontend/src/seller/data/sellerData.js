// Mock data for Seller Central — ported 1:1 from the Claude Design handoff
// (Seller Central.dc.html inline script). Phase A wires the grade cases + relist
// to the real backend; everything else stays presentational demo data.

export const RUP = (n) => '₹' + Number(n).toLocaleString('en-IN');
export const CIRC = 201.06; // 2*pi*r for the grade ring (r=32)

// ── Grade color system (A–F) ────────────────────────────────────────────────
export const gCol = {
  A: { ink: '#107a45', bg: '#e6f4ea', line: '#bfe2ca' },
  B: { ink: '#b06f00', bg: '#fbf1d9', line: '#ecd6a0' },
  C: { ink: '#bd4a17', bg: '#fbe9dd', line: '#f0c9ac' },
  D: { ink: '#b3261e', bg: '#fbe5e3', line: '#f0bdb8' },
  F: { ink: '#7a2622', bg: '#f1dede', line: '#e2b8b4' },
};

export const scaleDef = [
  { g: 'A', l: 'Like New', col: '#107a45', bg: '#e6f4ea' },
  { g: 'B', l: 'Very Good', col: '#b06f00', bg: '#fbf1d9' },
  { g: 'C', l: 'Good', col: '#bd4a17', bg: '#fbe9dd' },
  { g: 'D', l: 'Acceptable', col: '#b3261e', bg: '#fbe5e3' },
  { g: 'F', l: 'Not resellable', col: '#7a2622', bg: '#f1dede' },
];
export const mkScale = (a) => scaleDef.map((x) => ({ ...x, on: x.g === a }));
export const sevC = (sv) =>
  sv === 'major' ? { dbg: '#fbe5e3', dink: '#b3261e' }
  : sv === 'moderate' ? { dbg: '#fbe9dd', dink: '#bd4a17' }
  : { dbg: '#fbf1d9', dink: '#b06f00' };

// ── Dashboard (Business Reports / home) ─────────────────────────────────────
export const hours = ['12AM','1AM','2AM','3AM','4AM','5AM','6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM'];
export const chart = {
  u_today: [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  u_yest:  [0,0,0,0,0,0,1,2,1,1,2,3,1,2,2,1,1,1,0,1,1,1,1,1],
  u_week:  [0,0,0,0,0,2,4,5,2,1,1,3,3,1,0,1,2,4,1,0,2,1,0,1],
  u_year:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  s_today: [0,0,0,0,40,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  s_yest:  [0,0,0,0,10,20,60,110,70,60,120,150,90,170,120,60,80,60,20,90,60,40,50,30],
  s_week:  [0,0,0,0,20,60,180,240,90,40,60,120,110,40,10,40,90,150,40,20,90,40,10,40],
  s_year:  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};
export const legend = [
  { name: 'Today so far', color: '#24b0c9', check: '#24b0c9', when: 'So far', units: '6 Units', money: '₹8,940' },
  { name: 'Yesterday', color: '#d0491f', check: '#d0491f', when: 'By end of day', units: '34 Units', money: '₹48,210' },
  { name: 'Same day last week', color: '#f0a500', check: '#f0a500', when: 'By end of day', units: '41 Units', money: '₹57,880' },
  { name: 'Same day last year', color: '#9aa0a0', check: '#9aa0a0', when: 'By end of day', units: '0 Units', money: '₹0' },
];
export const widgets = [
  { label: 'Buyer Messages', value: '0', sub: 'Cases requiring attention', plain: true },
  { label: 'Seller Feedback', value: '4.8', sub: 'Past Year (61)', stars: true },
  { label: 'Payments', value: '₹1,24,860', sub: 'Total Balance', plain: true },
  { label: 'Inventory Performance', value: '612', sub: 'Current IPI', plain: true },
  { label: 'Ad Sales', value: '₹4,120', sub: 'Today so far', plain: true },
  { label: 'Ad Impressions', value: '3,180', sub: 'Today so far', plain: true },
];
export const deepCards = [
  { title: 'boAt Rockerz 550 Bluetooth Headphones (Black)', asin: 'B09XYZ1234', decline: '₹18,400', tint: '#3b6fb5' },
  { title: 'Insta Men Cotton Kurta, Full Sleeve (Off-White)', asin: 'B0KUR9012', decline: '₹6,990', tint: '#c96a99' },
];

// ── Inventory (Manage All Inventory) ────────────────────────────────────────
export const products = [
  { status: 'Active', date: 'Feb 14, 2025, 11:04 AM', tint: '#dbeafe', ink: '#3b6fb5',
    title: 'boAt Rockerz 550 Over-Ear Bluetooth Headphones with 20 Hours Playback, 50mm Drivers, ASAP Charge (Black)',
    asin: 'B09XYZ1234', sku: 'BR550-BLK', sales: '₹42,376', units: '236', views: '—', rank: '412', category: '(Electronics)',
    fba: '142', inbound: '0', unfulfillable: '0', reserved: '9', price: '1799', comp: '₹1,799 + ₹0', low: '₹1,749 + ₹0', biz: '₹1,699 + ₹0', totalFees: '₹312', fbaFee: '₹78' },
  { status: 'Active', date: 'Jun 30, 2025, 09:12 AM', tint: '#dbeafe', ink: '#3b6fb5', cond: 'Used – Very Good', hcCase: 'hp', hcGrade: 'B',
    title: 'boAt Rockerz 550 Over-Ear Bluetooth Headphones (Blue) — AI-inspected via Amazon Revive',
    asin: 'B09XYZ1234', sku: 'BR550-BLU-UVG', sales: '₹0', units: '0', views: '—', rank: '—', category: '(Electronics · Revive)',
    fba: '1', inbound: '0', unfulfillable: '0', reserved: '0', price: '1299', comp: '₹1,799 + ₹0', low: '₹1,299 + ₹0', biz: '—', totalFees: '₹236', fbaFee: '₹78' },
  { status: 'Active', date: 'Mar 2, 2025, 03:41 PM', tint: '#e6fbf4', ink: '#0a8f63',
    title: 'Noise ColorFit Pulse 2 Smart Watch with 1.85" Display, Bluetooth Calling, 100 Sports Modes (Jet Black)',
    asin: 'B0ABC5678', sku: 'NCF-P2', sales: '₹28,481', units: '190', views: '—', rank: '689', category: '(Electronics)',
    fba: '96', inbound: '12', unfulfillable: '0', reserved: '4', price: '1499', comp: '₹1,499 + ₹0', low: '₹1,499 + ₹0', biz: '₹1,449 + ₹0', totalFees: '₹268', fbaFee: '₹72' },
  { status: 'Active', date: 'Jun 26, 2025, 05:22 PM', tint: '#e6fbf4', ink: '#0a8f63', cond: 'Open Box', hcCase: 'watch', hcGrade: 'A',
    title: 'Noise ColorFit Pulse 2 Smart Watch (Jet Black) — AI-inspected via Amazon Revive',
    asin: 'B0ABC5678', sku: 'NCF-P2-OB', sales: '₹0', units: '0', views: '—', rank: '—', category: '(Electronics · Revive)',
    fba: '1', inbound: '0', unfulfillable: '0', reserved: '0', price: '1274', comp: '₹1,499 + ₹0', low: '₹1,274 + ₹0', biz: '—', totalFees: '₹232', fbaFee: '₹72' },
  { status: 'Active', date: 'Jan 20, 2025, 10:15 AM', tint: '#fdeef4', ink: '#c96a99',
    title: 'Insta Men’s Cotton Straight Kurta, Full Sleeve, Mandarin Collar (Off-White, L)',
    asin: 'B0KUR9012', sku: 'KURTA-L', sales: '₹18,780', units: '142', views: '—', rank: '1,204', category: '(Clothing)',
    fba: '64', inbound: '0', unfulfillable: '0', reserved: '3', price: '1199', comp: '₹1,199 + ₹0', low: '₹1,149 + ₹0', biz: '₹1,099 + ₹0', totalFees: '₹214', fbaFee: '₹66' },
  { status: 'Active', date: 'Apr 5, 2025, 02:08 PM', tint: '#e2e4e6', ink: '#4a4f55',
    title: 'Redmi Note 13 5G (Midnight Black, 8GB RAM, 128GB Storage) — 108MP Camera, Snapdragon 6 Gen 1',
    asin: 'B0RMI3456', sku: 'RN13-128', sales: '₹6,39,960', units: '40', views: '—', rank: '58', category: '(Electronics)',
    fba: '23', inbound: '0', unfulfillable: '0', reserved: '2', price: '15999', comp: '₹15,999 + ₹0', low: '₹15,999 + ₹0', biz: '₹15,499 + ₹0', totalFees: '₹1,120', fbaFee: '₹0' },
];

// ── Menu flyout ─────────────────────────────────────────────────────────────
export const catNames = ['Catalog','Inventory','Pricing','Orders','Advertising','Stores','Growth','Reports','Payments','Performance','Brands','Learn'];
// menuMap values: [label, targetRoute|null, pinned]
export const menuMap = {
  Catalog: [['Add Products', '/seller/inventory', true], ['Add Products via Upload'], ['Complete Your Drafts'], ['View Selling Applications'], ['Improve listing quality'], ['Upload images'], ['Upload and Manage Videos']],
  Inventory: [['Manage All Inventory', '/seller/inventory', true], ['Manage Seller Fulfilled Products', null, true], ['Sell Globally'], ['__H__ Fulfillment by Amazon (FBA)'], ['FBA Inventory'], ['Shipments'], ['Opportunities'], ['Remote Fulfillment with FBA']],
  Pricing: [['Pricing Health'], ['Manage Pricing'], ['Automate Pricing'], ['Fees Discounts']],
  Orders: [['Manage Orders'], ['Order Reports'], ['Manage Returns', '/seller/returns'], ['Manage SAFE-T Claims', '/seller/returns?tab=safet'], ['Create MCF Order', '/seller/mcf']],
  Advertising: [['Campaign Manager'], ['Advertising Reports'], ['Deals'], ['Coupons'], ['Prime Exclusive Discounts']],
  Stores: [['Manage Stores'], ['Posts']],
  Growth: [['Explore Programs'], ['Growth Opportunities'], ['Restock Inventory'], ['Selling Coach']],
  Reports: [['Business Reports', '/seller'], ['Returns Analytics', '/seller/returns/dashboard'], ['Manage Returns', '/seller/returns'], ['Payments'], ['Fulfillment'], ['Tax Document Library']],
  Payments: [['Payments Dashboard'], ['Transaction View'], ['All Statements'], ['Disbursements']],
  Performance: [['Account Health'], ['Feedback'], ['A-to-z Guarantee Claims'], ['Chargeback Claims'], ['Performance Notifications']],
  Brands: [['Brand Dashboard'], ['Brand Analytics'], ['A+ Content Manager'], ['Manage Experiments'], ['Brand Registry']],
  Learn: [['Seller University'], ['Help'], ['New Seller Guide']],
};

// ── Returns workflow ────────────────────────────────────────────────────────
export const reqRows = [
  { orderId: '402-1156743-8890231', date: 'Jun 28, 2025', product: 'boAt Rockerz 550 (Blue)', asin: 'B09XYZ1234', tint: '#dbeafe', ink: '#3b6fb5', reason: 'No longer needed', ai: 'Auto-authorized · in policy', aiBg: '#e6f4ea', aiInk: '#107a45', status: 'Authorized', statusBg: '#e6f4ea', statusInk: '#107a45', refund: '₹1,799', action: 'View', normalAction: true },
  { orderId: '407-9921044-1120765', date: 'Jun 27, 2025', product: 'Noise ColorFit Pulse 2', asin: 'B0ABC5678', tint: '#e6fbf4', ink: '#0a8f63', reason: 'Found a better price', ai: 'Auto-authorized · in policy', aiBg: '#e6f4ea', aiInk: '#107a45', status: 'In transit', statusBg: '#e7f0fb', statusInk: '#1d4ed8', refund: '₹1,499', action: 'Track', normalAction: true },
  { orderId: '405-3320981-4432107', date: 'Jun 26, 2025', product: 'boAt Type-C Charging Cable', asin: 'B0CBL0099', tint: '#eff1f1', ink: '#6b7076', reason: 'No longer needed', ai: 'Returnless refund · ₹149 item', aiBg: '#e7f0fb', aiInk: '#1d4ed8', status: 'Closed', statusBg: '#eff1f1', statusInk: '#565959', refund: '₹149', action: 'View', normalAction: true },
  { orderId: '408-7745120-9980142', date: 'Jun 25, 2025', product: 'Redmi Note 13 5G (128GB)', asin: 'B0RMI3456', tint: '#e2e4e6', ink: '#4a4f55', reason: 'Item defective — screen', ai: 'Authorized · verified pickup', aiBg: '#efe9fb', aiInk: '#6d28d9', status: 'Pickup scheduled', statusBg: '#efe9fb', statusInk: '#6d28d9', refund: '₹15,999', action: 'View', normalAction: true, flag: 'High-value · Phase B' },
  { orderId: '404-1180765-2231098', date: 'Jun 22, 2025', product: 'boAt Wireless Mouse', asin: 'B0MSE0021', tint: '#fbe9dd', ink: '#bd4a17', reason: 'No longer needed · 46 days', ai: 'Recommend decline · outside 30-day window', aiBg: '#fbe5e3', aiInk: '#b3261e', status: 'Needs review', statusBg: '#fbf1d9', statusInk: '#b06f00', refund: '₹699', needsReview: true, reviewId: 'rev1' },
  { orderId: '403-6650129-7781234', date: 'Jun 21, 2025', product: 'Oral-B Vitality Toothbrush', asin: 'B0ORB7890', tint: '#e7f0fb', ink: '#1d4ed8', reason: 'Changed my mind', ai: 'Auto-authorized · hygiene flag', aiBg: '#fbf1d9', aiInk: '#b06f00', status: 'Authorized', statusBg: '#e6f4ea', statusInk: '#107a45', refund: '₹1,899', action: 'View', normalAction: true },
];

export const recvRows = [
  { caseId: 'hp', orderId: '402-1156743-8890231', date: 'Received Jun 30', product: 'boAt Rockerz 550 (Blue)', sku: 'BR550-BLU', tint: '#dbeafe', ink: '#3b6fb5', note: 'Arrived · opened, used', flagged: false },
  { caseId: 'phone', orderId: '408-7745120-9980142', date: 'Received Jun 29', product: 'Redmi Note 13 5G (128GB)', sku: 'RN13-128', tint: '#e2e4e6', ink: '#4a4f55', note: 'Arrived · defect reported', flagged: false },
  { caseId: 'kurta', orderId: '406-2231087-5540912', date: 'Received Jun 29', product: 'Insta Men Cotton Kurta (L)', sku: 'KURTA-L', tint: '#fdeef4', ink: '#c96a99', note: 'Arrived · sealed, unopened', flagged: false },
  { caseId: 'hygiene', orderId: '403-6650129-7781234', date: 'Received Jun 28', product: 'Oral-B Vitality Toothbrush', sku: 'ORB-VIT', tint: '#e7f0fb', ink: '#1d4ed8', note: 'Arrived · hygiene seal broken', flagged: true, flagText: 'Hygiene' },
  { caseId: 'wrong', orderId: '409-8841200-1123045', date: 'Received Jun 27', product: 'Ordered: boAt Rockerz 550', sku: 'BR550-BLK', tint: '#fbe5e3', ink: '#b3261e', note: 'Integrity flag · item mismatch', flagged: true, flagText: 'Integrity' },
  { caseId: 'watch', orderId: '407-5540982-3320167', date: 'Graded Jun 26', product: 'Noise ColorFit Pulse 2', sku: 'NCF-P2', tint: '#e6fbf4', ink: '#0a8f63', note: 'Open Box · relisted', done: true, grade: 'A', gradeLabel: 'Open Box', gradeColor: '#107a45', gradeBg: '#e6f4ea', recovered: '₹1,274', relistSku: 'NCF-P2-OB' },
];

export const gradeCases = {
  hp: { product: 'boAt Rockerz 550 (Blue)', sku: 'BR550-BLU', orderId: '402-1156743-8890231', category: 'Over-ear headphones', mlCategory: 'Electronics', expectedTitle: 'boAt Rockerz 550 over-ear headphones', tint: '#dbeafe', ink: '#3b6fb5',
    photos: [{ label: 'Ear cups', tint: '#dbeafe', ink: '#3b6fb5', box: { t: 'Scuff', x: 56, y: 30, w: 26, h: 22 } }, { label: 'Headband', tint: '#e7f0fb', ink: '#3b6fb5', box: { t: 'Wear', x: 28, y: 14, w: 44, h: 16 } }, { label: 'Powered on', tint: '#e6fbf4', ink: '#0a8f63' }],
    integrity: { ok: true, sold: 'boAt Rockerz 550 (Blue)', got: 'boAt Rockerz 550 (Blue)' },
    blocked: false, grade: 'B', gradeLabel: 'Very Good', col: '#b06f00', bg: '#fbf1d9', line: '#ecd6a0',
    confidence: 92, score: 84, completeness: 100, functional: 'Pass',
    defects: [{ t: 'Minor scuffs · left ear cup', s: 'minor' }, { t: 'Light headband wear', s: 'minor' }],
    note: 'Fully functional with strong Bluetooth pairing. Minor cosmetic scuffs on the left ear cup and light headband wear consistent with light use. All accessories and original box included.',
    refund: { type: 'full', amount: '₹1,799', headline: 'Confirm full refund', sub: 'Item in returnable condition · refund not yet issued' },
    recovery: [
      { label: 'Relist as New', sub: 'Item opened — path unavailable', pct: '100%', value: '—', disabled: true, reason: 'Item opened' },
      { label: 'Open Box', sub: 'Requires flawless cosmetic', pct: '85%', value: '₹1,529', disabled: true, reason: 'Cosmetic scuffs present' },
      { label: 'Relist Used – Very Good', sub: 'Matches AI grade · condition note attached', pct: '85%', value: '₹1,299', chosen: true },
      { label: 'Relist Used – Good', sub: 'Lower ladder rung', pct: '70%', value: '₹1,079' },
      { label: 'Liquidate', sub: 'Warehouse-Deals-style', pct: '9%', value: '₹162' },
    ],
    mode: 'relist', relistLabel: 'Used – Very Good', relistSku: 'BR550-BLU-UVG' },
  phone: { product: 'Redmi Note 13 5G (128GB)', sku: 'RN13-128', orderId: '408-7745120-9980142', category: 'Smartphone', mlCategory: 'Electronics', expectedTitle: 'Redmi Note 13 5G smartphone', tint: '#e2e4e6', ink: '#4a4f55',
    photos: [{ label: 'Rear', tint: '#e2e4e6', ink: '#4a4f55' }, { label: 'Powered-on screen', tint: '#fbe5e3', ink: '#b3261e', box: { t: 'Flicker', x: 18, y: 18, w: 64, h: 48 } }, { label: 'Ports', tint: '#eff1f1', ink: '#6b7076' }],
    integrity: { ok: true, sold: 'Redmi Note 13 5G', got: 'Redmi Note 13 5G' },
    blocked: false, grade: 'D', gradeLabel: 'Defective', col: '#b3261e', bg: '#fbe5e3', line: '#f0bdb8',
    confidence: 96, score: 41, completeness: 100, functional: 'Fail — display flicker',
    defects: [{ t: 'Display flicker on power-on', s: 'major' }, { t: 'Cosmetically clean', s: 'minor' }],
    note: 'Powers on but the display exhibits intermittent flicker — a functional / manufacturing fault, not customer-inflicted damage. Cosmetically clean; all accessories present. Not resellable to a consumer; eligible for supplier warranty recovery.',
    refund: { type: 'full', amount: '₹15,999', headline: 'Confirm full refund', sub: 'Defective on arrival · buyer not at fault' },
    recovery: [
      { label: 'Warranty claim to supplier', sub: 'Manufacturing defect · ~60% credit', pct: '60%', value: '₹9,600', chosen: true },
      { label: 'Relist (any condition)', sub: 'Blocked — unit is non-functional', pct: '—', value: '—', disabled: true, reason: 'Functional check failed' },
      { label: 'Liquidate for parts', sub: 'Salvage channel', pct: '8%', value: '₹1,280' },
    ],
    mode: 'warranty', relistLabel: 'Warranty claim', relistSku: null },
  kurta: { product: 'Insta Men Cotton Kurta (L)', sku: 'KURTA-L', orderId: '406-2231087-5540912', category: 'Apparel · sealed', mlCategory: 'Clothing', expectedTitle: 'cotton kurta apparel', tint: '#fdeef4', ink: '#c96a99',
    photos: [{ label: 'Sealed poly-bag', tint: '#fdeef4', ink: '#c96a99' }, { label: 'Tags attached', tint: '#fbf1d9', ink: '#b06f00' }, { label: 'Seal intact', tint: '#e6f4ea', ink: '#107a45' }],
    integrity: { ok: true, sold: 'Insta Cotton Kurta (L)', got: 'Insta Cotton Kurta (L)' },
    blocked: false, grade: 'A', gradeLabel: 'Like New', col: '#107a45', bg: '#e6f4ea', line: '#bfe2ca',
    confidence: 98, score: 97, completeness: 100, functional: 'N/A',
    defects: [],
    note: 'Returned sealed and unopened. Factory poly-bag intact, all tags attached. No handling detected. Eligible to relist as New.',
    refund: { type: 'full', amount: '₹1,199', headline: 'Confirm full refund', sub: 'Unopened · fully returnable' },
    recovery: [
      { label: 'Relist as New', sub: 'Sealed, unopened, verified', pct: '100%', value: '₹1,199', chosen: true },
      { label: 'Open Box', sub: 'Not needed — item is sealed', pct: '85%', value: '₹1,019' },
      { label: 'Liquidate', sub: 'Unnecessary for New stock', pct: '9%', value: '₹108' },
    ],
    mode: 'relist', relistLabel: 'New', relistSku: 'KURTA-L' },
  hygiene: { product: 'Oral-B Vitality Toothbrush', sku: 'ORB-VIT', orderId: '403-6650129-7781234', category: 'Personal care · hygiene', mlCategory: 'Beauty', expectedTitle: 'Oral-B toothbrush', isHygiene: true, tint: '#e7f0fb', ink: '#1d4ed8',
    photos: [{ label: 'Brush head', tint: '#fbe5e3', ink: '#b3261e', box: { t: 'Seal broken', x: 22, y: 24, w: 56, h: 36 } }, { label: 'Handle', tint: '#e7f0fb', ink: '#1d4ed8' }, { label: 'Box opened', tint: '#eff1f1', ink: '#6b7076' }],
    integrity: { ok: true, sold: 'Oral-B Vitality Toothbrush', got: 'Oral-B Vitality Toothbrush' },
    blocked: false, grade: 'F', gradeLabel: 'Not resellable', col: '#7a2622', bg: '#f1dede', line: '#e2b8b4',
    confidence: 99, score: 0, completeness: 100, functional: 'Pass (cosmetic)', hygiene: true,
    defects: [{ t: 'Hygiene seal broken', s: 'major' }],
    note: 'Hygiene seal broken — the brush-head compartment has been opened. The item is cosmetically fine and functional, but cannot be resold under hygiene policy. The refund decision is independent and remains full.',
    refund: { type: 'full', amount: '₹1,899', headline: 'Confirm full refund', sub: 'Refund independent of resale · buyer entitled' },
    recovery: [
      { label: 'Dispose safely', sub: 'Rule: hygiene seal broken', pct: '0%', value: '₹0', chosen: true },
      { label: 'Relist (any condition)', sub: 'Blocked — opened hygiene item', pct: '—', value: '—', disabled: true, reason: 'Hygiene seal broken' },
      { label: 'Liquidate', sub: 'Blocked — hygiene category', pct: '—', value: '—', disabled: true, reason: 'Hygiene seal broken' },
    ],
    mode: 'dispose', relistLabel: 'Safe disposal', relistSku: null },
  wrong: { product: 'Ordered: boAt Rockerz 550 (Black)', sku: 'BR550-BLK', orderId: '409-8841200-1123045', category: 'Integrity mismatch', mlCategory: 'Electronics', expectedTitle: 'boAt Rockerz 550 over-ear headphones', tint: '#fbe5e3', ink: '#b3261e',
    photos: [{ label: 'Sold: headphones', tint: '#dbeafe', ink: '#3b6fb5' }, { label: 'Returned: power bank', tint: '#fbe5e3', ink: '#b3261e', box: { t: 'Mismatch', x: 14, y: 14, w: 72, h: 62 } }],
    integrity: { ok: false, sold: 'boAt Rockerz 550 (Black) headphones', got: 'Anker 10000mAh power bank' },
    blocked: true, grade: null, confidence: 97,
    note: 'The returned item does not match the item sold. Delivery-time and return-time photos show a different product (power bank vs. headphones). Grading is halted and a fraud flag has been raised.',
    refund: { type: 'blocked', amount: '₹1,799', headline: 'Refund already issued at first scan', sub: 'Refund-at-first-scan cannot be reversed automatically' },
    mode: 'safet', safetId: 'wrong' },
  watch: { product: 'Noise ColorFit Pulse 2', sku: 'NCF-P2', orderId: '407-5540982-3320167', category: 'Smartwatch', mlCategory: 'Electronics', expectedTitle: 'Noise ColorFit smartwatch', tint: '#e6fbf4', ink: '#0a8f63',
    photos: [{ label: 'Face', tint: '#e6fbf4', ink: '#0a8f63' }, { label: 'Strap', tint: '#eff1f1', ink: '#6b7076' }, { label: 'Powered on', tint: '#e7f0fb', ink: '#1d4ed8' }],
    integrity: { ok: true, sold: 'Noise ColorFit Pulse 2', got: 'Noise ColorFit Pulse 2' },
    blocked: false, grade: 'A', gradeLabel: 'Like New', col: '#107a45', bg: '#e6f4ea', line: '#bfe2ca',
    confidence: 95, score: 93, completeness: 100, functional: 'Pass',
    defects: [{ t: 'Opened but flawless', s: 'minor' }],
    note: 'Opened but flawless. Screen, buttons and sensors all functional. Original box and charging cable present. Best routed as Open Box.',
    refund: { type: 'full', amount: '₹1,499', headline: 'Full refund issued', sub: 'Original condition confirmed' },
    recovery: [
      { label: 'Relist as New', sub: 'Box opened', pct: '100%', value: '—', disabled: true, reason: 'Box opened' },
      { label: 'Open Box', sub: 'Opened but flawless · chosen', pct: '85%', value: '₹1,274', chosen: true },
      { label: 'Relist Used – Very Good', sub: 'Lower rung', pct: '70%', value: '₹1,049' },
    ],
    mode: 'relist', relistLabel: 'Open Box', relistSku: 'NCF-P2-OB' },
};

export const safetRows = [
  { id: 'wrong', reason: 'Different item returned', code: 'Item materially different / different item returned',
    orderId: '409-8841200-1123045', product: 'boAt Rockerz 550 (Black)', tint: '#fbe5e3', ink: '#b3261e',
    eligible: true, checks: [{ t: 'Amazon-issued refund (first scan)', ok: true }, { t: 'Seller not at fault', ok: true }, { t: 'Within 30-day filing window', ok: true }, { t: 'Evidence bundle complete', ok: true }],
    evidence: ['Delivery photo', 'Return photo', 'AI grade report', 'Condition note', 'Health Card hash'],
    deadline: '12 days left to file', reimb: '₹1,799' },
  { id: 'notret', reason: 'Item not returned', code: 'Item not returned',
    orderId: '407-5540982-9980771', product: 'boAt Airdopes 141 (first-scan refund)', tint: '#e7f0fb', ink: '#1d4ed8',
    eligible: true, checks: [{ t: 'Refund-at-first-scan issued', ok: true }, { t: 'No carrier delivery scan after 14 days', ok: true }, { t: 'Within 30-day filing window', ok: true }, { t: 'Tracking evidence attached', ok: true }],
    evidence: ['First-scan record', 'Carrier tracking', 'Refund record'],
    deadline: '8 days left to file', reimb: '₹1,299' },
  { id: 'voluntary', reason: 'Customer-damaged · seller refunded voluntarily', code: 'Not eligible per policy',
    orderId: '404-3320981-7745002', product: 'boAt Stone 350 Speaker', tint: '#eff1f1', ink: '#6b7076',
    eligible: false, checks: [{ t: 'Refund issued voluntarily by seller', ok: false }, { t: 'Damage occurred in buyer possession', ok: true }, { t: 'Amazon-issued refund required', ok: false }],
    ineligReason: 'SAFE-T requires an Amazon-issued refund. This refund was issued voluntarily by the seller, so the claim is not eligible.',
    suggestion: 'Next time, capture up to a 20% restocking fee at grading instead of refunding in full.' },
];

export const dash = {
  processed: '26', recovered: '₹34,970', hours: '38', confidence: '94%', safetWin: '80%', safetWinSub: '4 of 5 granted',
  breakdown: [
    { k: 'Resale (relist / open box / liquidate)', v: '₹19,800', c: '#107a45' },
    { k: 'Restocking fees captured', v: '₹2,400', c: '#b06f00' },
    { k: 'SAFE-T reimbursements', v: '₹9,970', c: '#1d4ed8' },
    { k: 'Warranty credits', v: '₹2,800', c: '#6d28d9' },
  ],
  activity: [
    { t: 'Relisted boAt Rockerz 550 (Blue) as Used – Very Good', m: '₹1,299 recovered', when: '2h ago', c: '#107a45' },
    { t: 'SAFE-T claim granted · different item returned', m: '₹1,799 reimbursed', when: '5h ago', c: '#1d4ed8' },
    { t: 'Warranty claim drafted · Redmi Note 13 defective', m: '₹9,600 est. credit', when: '1d ago', c: '#6d28d9' },
    { t: 'Disposed Oral-B toothbrush · hygiene seal broken', m: '₹0 · full refund issued', when: '1d ago', c: '#b3261e' },
    { t: 'Open Box relist · Noise ColorFit Pulse 2', m: '₹1,274 recovered', when: '2d ago', c: '#0a8f63' },
  ],
};
export const dashGrades = [{ g: 'A', n: 7, c: '#107a45' }, { g: 'B', n: 9, c: '#b06f00' }, { g: 'C', n: 5, c: '#bd4a17' }, { g: 'D', n: 3, c: '#b3261e' }, { g: 'F', n: 2, c: '#7a2622' }].map((x) => ({ ...x, h: ((x.n / 9) * 100).toFixed(0) }));
export const dashActions = [{ k: 'Relist Used', n: 11, c: '#107a45' }, { k: 'Open Box', n: 4, c: '#0a8f63' }, { k: 'Relist New', n: 3, c: '#1d4ed8' }, { k: 'Liquidate', n: 3, c: '#b06f00' }, { k: 'Warranty', n: 2, c: '#6d28d9' }, { k: 'Dispose', n: 3, c: '#b3261e' }].map((x) => ({ ...x, w: ((x.n / 11) * 100).toFixed(0) }));

export const hcMap = {
  hp: { grade: 'B', label: 'Very Good', col: '#b06f00', bg: '#fbf1d9', line: '#ecd6a0', score: 84, completeness: 100, functional: 'Pass', note: 'Fully functional. Minor cosmetic scuffs on left ear cup, light headband wear. All accessories and original box included.', item: 'boAt Rockerz 550 (Blue)', sku: 'BR550-BLU-UVG', asin: 'B09XYZ1234', hash: '0x9f2a…c41b' },
  watch: { grade: 'A', label: 'Open Box', col: '#107a45', bg: '#e6f4ea', line: '#bfe2ca', score: 93, completeness: 100, functional: 'Pass', note: 'Opened but flawless. Screen, buttons and sensors functional. Original box and charging cable present.', item: 'Noise ColorFit Pulse 2', sku: 'NCF-P2-OB', asin: 'B0ABC5678', hash: '0x71c8…9d0e' },
  kurta: { grade: 'A', label: 'Like New', col: '#107a45', bg: '#e6f4ea', line: '#bfe2ca', score: 97, completeness: 100, functional: 'N/A', note: 'Returned sealed and unopened. Tags attached, seal intact. Relisted as New.', item: 'Insta Men Cotton Kurta (L)', sku: 'KURTA-L', asin: 'B0KUR9012', hash: '0x3ad4…7f22' },
  phone: { grade: 'D', label: 'Defective', col: '#b3261e', bg: '#fbe5e3', line: '#f0bdb8', score: 41, completeness: 100, functional: 'Fail — display flicker', note: 'Functional fault (display flicker) confirmed. Routed to supplier warranty, not consumer resale.', item: 'Redmi Note 13 5G (128GB)', sku: 'RN13-128', asin: 'B0RMI3456', hash: '0x5b90‒12ac' },
};

export const SVG = {
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10',
  shoe: 'M8 21h8a2 2 0 002-2l1-11H5l1 11a2 2 0 002 2z',
};
