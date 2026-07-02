// Normalizes a real /api/grade/inspect/ response into the shape GradingAssistant
// renders (same fields the curated mock uses), so live ML grades and demo cases
// share one render path. Also derives the recovery ladder from the grade.
import { gCol, scaleDef } from './data/sellerData';

const LABELS = { A: 'Like New', B: 'Very Good', C: 'Good', D: 'Acceptable', E: 'For parts', F: 'Not resellable' };
const rup = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// grade → ranked recovery actions with estimated value off the item's price.
function recoveryFor(grade, price, opened = true) {
  const p = Number(price) || 1000;
  const row = (label, sub, pct, chosen, disabled, reason) =>
    ({ label, sub, pct: pct === null ? '—' : pct + '%', value: disabled ? '—' : rup(p * (pct / 100)), chosen: !!chosen, disabled: !!disabled, reason });
  switch (grade) {
    case 'A':
      return opened
        ? [row('Open Box', 'Opened but flawless', 85, true), row('Relist as New', 'Item opened — unavailable', 100, false, true, 'Item opened'), row('Relist Used – Very Good', 'Lower rung', 70)]
        : [row('Relist as New', 'Sealed, verified', 100, true), row('Open Box', 'Not needed — sealed', 85), row('Liquidate', 'Unnecessary', 9)];
    case 'B':
      return [row('Relist Used – Very Good', 'Matches AI grade · note attached', 85, true), row('Open Box', 'Requires flawless cosmetic', 85, false, true, 'Cosmetic wear present'), row('Relist Used – Good', 'Lower rung', 70), row('Liquidate', 'Warehouse-Deals-style', 9)];
    case 'C':
      return [row('Relist Used – Good', 'Matches AI grade', 70, true), row('Relist Used – Acceptable', 'Lower rung', 50), row('Liquidate', 'Warehouse-Deals-style', 9)];
    case 'D':
      return [row('Relist Used – Acceptable', 'If local demand exists', 50, true), row('Liquidate', 'Warehouse-Deals-style', 9), row('Warranty claim to supplier', 'If functional defect', 60)];
    case 'E':
      return [row('Warranty claim to supplier', 'Functional defect · ~60% credit', 60, true), row('Relist (any condition)', 'Blocked — non-functional', null, false, true, 'Functional check failed'), row('Liquidate for parts', 'Salvage channel', 8)];
    default: // F
      return [row('Dispose safely', 'Not resellable', 0, true), row('Relist (any condition)', 'Blocked', null, false, true, 'Not resellable'), row('Liquidate', 'Blocked', null, false, true, 'Not resellable')];
  }
}

// Map an inspect response onto the curated case, keeping the case's product /
// category / photos but replacing grade, note, defects, recovery with live ML.
export function adaptRealGrade(resp, baseCase, price) {
  const grade = (resp.grade || 'B').toUpperCase();
  const c = gCol[grade] || gCol.B;
  const conf = resp.confidence != null ? Math.round(resp.confidence * 100) : 90;
  const score = resp.score != null ? Math.round(resp.score)
    : resp.completeness != null ? Math.round(resp.completeness * 100) : conf;
  const functional = resp.functional === false ? 'Fail'
    : resp.functional === true ? 'Pass' : 'N/A';
  const defects = (resp.defects || []).map((d) => ({
    t: d.label || d.type || d.name || 'Defect',
    s: d.severity || d.sev || 'minor',
  }));
  // Hygiene / sealed-only categories: once returned/opened there is no resale path
  // anywhere in the flow — dispose is the only outcome, regardless of cosmetic grade.
  const hygiene = !!baseCase.isHygiene;
  let mode = hygiene ? 'dispose' : grade === 'F' ? 'dispose' : grade === 'E' ? 'warranty' : 'relist';
  const recovery = hygiene
    ? [
        { label: 'Dispose safely', sub: 'Rule: hygiene / sealed-only category', pct: '0%', value: '₹0', chosen: true },
        { label: 'Relist (any condition)', sub: 'Blocked — opened hygiene item', pct: '—', value: '—', disabled: true, reason: 'Hygiene policy' },
        { label: 'Liquidate', sub: 'Blocked — hygiene category', pct: '—', value: '—', disabled: true, reason: 'Hygiene policy' },
      ]
    : recoveryFor(grade, price);
  const sc = scaleDef.find((x) => x.g === grade) || scaleDef[1];
  return {
    ...baseCase,
    live: true,
    grade,
    gradeLabel: hygiene ? 'Not resellable · hygiene' : (LABELS[grade] || sc.l),
    col: c.ink, bg: c.bg, line: c.line,
    confidence: conf,
    score,
    functional,
    defects,
    note: resp.condition_summary || baseCase.note || '',
    integrity: { ok: true, sold: baseCase.product, got: baseCase.product },
    blocked: false,
    recovery,
    mode,
    relistLabel: mode === 'relist' ? (grade === 'A' ? 'Open Box' : 'Used – ' + (LABELS[grade] || '')) : baseCase.relistLabel,
    relistSku: mode === 'relist' ? baseCase.sku + '-' + grade : null,
    heatmaps: (resp.angle_heatmaps || []).map((h) => h.b64).filter(Boolean),
  };
}
