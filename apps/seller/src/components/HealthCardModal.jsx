import React from 'react';
import { useSellerUI } from '../SellerUI';
import { hcMap, CIRC } from '../data/sellerData';

// Tamper-evident Product Health Card — the same trust artifact the consumer side
// generates, shown here as a modal after a seller relists a graded return.
export default function HealthCardModal() {
  const { hcOpen, closeHealthCard } = useSellerUI();
  const hc = hcOpen ? hcMap[hcOpen] : null;
  if (!hc) return null;
  const ringDash = ((CIRC * hc.score) / 100).toFixed(1) + ' ' + CIRC;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={closeHealthCard}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: '100%', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 60px -16px rgba(15,17,17,.34)' }}>
        <div style={{ background: '#131a22', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#febd69', fontWeight: 800, fontSize: 15 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>
            Product Health Card
          </div>
          <span onClick={closeHealthCard} style={{ color: '#9aa6b2', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>
              <svg viewBox="0 0 76 76" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="38" cy="38" r="32" fill="none" stroke={hc.line} strokeWidth="6" />
                <circle cx="38" cy="38" r="32" fill="none" stroke={hc.col} strokeWidth="6" strokeLinecap="round" strokeDasharray={ringDash} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: hc.col }}>{hc.grade}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: hc.col }}>Amazon condition · {hc.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{hc.item}</div>
              <div style={{ fontSize: 12, color: '#565959', marginTop: 2 }}>SKU {hc.sku} · ASIN {hc.asin}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, margin: '16px 0' }}>
            {[['Score', hc.score + '/100'], ['Completeness', hc.completeness + '%'], ['Functional', hc.functional]].map(([k, v]) => (
              <div key={k} style={{ background: '#f7f8f8', border: '1px solid #eaeded', borderRadius: 8, padding: '9px 10px' }}>
                <div style={{ fontSize: 10.5, color: '#8a8f8f', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .4 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: '#3b4042', lineHeight: 1.5, background: '#f7f8f8', border: '1px solid #eaeded', borderRadius: 8, padding: '10px 12px' }}>{hc.note}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11.5, color: '#565959' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#107a45" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
            Tamper-evident hash <span style={{ fontFamily: 'monospace', color: '#111' }}>{hc.hash}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
