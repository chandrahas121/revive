import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSellerUI } from '../SellerUI';
import { mkScale, CIRC } from '../data/sellerData';
import { getSellerQueue, sellerGrade, sellerRelist } from '../../api/client';
import { adaptRealGrade } from '../gradeAdapter';
import { capturePrompts } from '../../utils/categoryProfiles';

// AI Grading Assistant — grades a returned item against ITS real catalog product.
// The integrity gate (DINOv2 vs the product's own catalog image) rejects a wrong
// item instead of grading it; a matching item gets a live grade + defects + note.
export default function GradingAssistant() {
  const { caseId } = useParams();
  const nav = useNavigate();
  const { relisted, confirmRelist, openHealthCard, addSafetClaim } = useSellerUI();
  const slotInputs = useRef({});

  const [caseInfo, setCaseInfo] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [photoSlots, setPhotoSlots] = useState({});
  const [slotPreviews, setSlotPreviews] = useState({});
  const [grading, setGrading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [real, setReal] = useState(null);
  const [mismatch, setMismatch] = useState(null);
  const [gradeErr, setGradeErr] = useState(null);
  const [storefrontUrl, setStorefrontUrl] = useState(null);
  const [decision, setDecision] = useState(null);   // ARCA {fault, disposition, financial, claim_narrative}
  const [functional, setFunctional] = useState('pass');  // seller's on-camera functional test
  const [evidence, setEvidence] = useState(null);   // tamper-evident bundle {assets, bundle_hash}

  const isRelisted = !!relisted[caseId];

  useEffect(() => {
    getSellerQueue()
      .then((r) => {
        const c = (r.data.cases || []).find((x) => x.caseId === caseId);
        if (c) setCaseInfo(c); else setLoadErr(true);
      })
      .catch(() => setLoadErr(true));
  }, [caseId]);

  const handleSlot = (key, file) => {
    if (!file) return;
    setPhotoSlots((p) => ({ ...p, [key]: file }));
    setSlotPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]);
      return { ...p, [key]: URL.createObjectURL(file) };
    });
  };

  const price = caseInfo ? Number(caseInfo.mrp) || 999 : 999;

  const runGrade = async () => {
    const slotFiles = Object.values(photoSlots);
    if (!slotFiles.length || !caseInfo) return;
    setGrading(true); setMismatch(null); setGradeErr(null);
    setScanProgress(0);
    let p = 0;
    const tick = setInterval(() => { p = Math.min(p + 3, 92); setScanProgress(p); }, 60);
    try {
      const fd = new FormData();
      Object.entries(photoSlots).forEach(([key, file]) => {
        fd.append('images', file);
        fd.append('slots', key);
      });
      fd.append('product_id', caseInfo.product_id);
      // Context the ARCA decision engine needs (fault + disposition + SAFE-T).
      fd.append('functional', functional);
      fd.append('reason_code', caseInfo.reason || '');
      fd.append('order_value', String(price));
      fd.append('sealed', caseInfo.sealed ? 'true' : 'false');
      fd.append('order_id', caseInfo.orderId || '');
      fd.append('days_since_delivered', '2');
      fd.append('refund_issued_by', 'amazon');
      const { data } = await sellerGrade(fd);
      setEvidence(data.evidence || null);
      if (data.match === false) {
        setMismatch(data);
      } else {
        setDecision(data.decision || null);
        setReal(adaptRealGrade(data, {
          product: caseInfo.product, sku: caseInfo.sku, category: caseInfo.category,
          orderId: caseInfo.orderId, isHygiene: false,
        }, price));
      }
    } catch (e) {
      setGradeErr('Live grading failed — is the backend running on :8000?');
    } finally {
      clearInterval(tick);
      setScanProgress(100);
      setGrading(false);
    }
  };

  const onConfirm = () => {
    // The real ARCA disposition decides the action; fall back to the grade-only mode.
    const dispo = decision?.disposition?.disposition;
    const isResell = dispo ? (dispo === 'GRADE_RESELL' || dispo === 'RESTOCK_NEW') : (real && real.mode === 'relist');
    if (isResell) {
      const label = decision?.disposition?.condition_label
        || (real?.gradeLabel === 'Like New' ? 'Open Box' : 'Used - ' + (real?.gradeLabel || 'Good'));
      const relistPrice = real?.relistPrice || price;
      sellerRelist({
        product_id: caseInfo.product_id, grade: real?.grade, price: relistPrice,
        condition_label: label, source: (real?.grade === 'A' && caseInfo.sealed) ? 'new' : 'return',
        evidence_hash: evidence?.bundle_hash || '',
      })
        .then((res) => { if (res?.data?.storefront_url) setStorefrontUrl(res.data.storefront_url); })
        .catch(() => {});
    }
    confirmRelist(caseId);
  };
  const openStorefront = () => {
    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    window.open(base + (storefrontUrl || '/?source=revive'), '_blank');
  };
  // Persist the ARCA-drafted SAFE-T claim into the SAFE-T tab, then jump there.
  const fileClaim = () => {
    const fin = decision?.financial;
    if (fin?.safet_eligible && caseInfo) {
      addSafetClaim({
        id: caseInfo.orderId || caseInfo.sku,
        reason: fin.safet_sub_reason === 'materially_different' ? 'Different item returned' : 'Item returned damaged / used by buyer',
        code: fin.safet_sub_reason, product: caseInfo.product, orderId: caseInfo.orderId,
        reimb: '₹' + Math.round(Number(caseInfo.mrp) || 0).toLocaleString('en-IN'),
        deadline: (fin.filing_deadline_days ?? 15) + ' days left to file',
        narrative: decision.claim_narrative,
        evidence: [`${evidence?.count || 0} hashed photos`, 'Return package + label', 'AI grade report', 'Tamper-evident bundle'],
        bundleHash: evidence?.bundle_hash,
      });
    }
    nav('/seller/returns?tab=safet');
  };

  if (loadErr) return <Shell><div style={panelErr}>Couldn't load this return — is the backend running on :8000? <span className="sc-teal" onClick={() => nav('/seller/returns?tab=received')}>Back to Returns received</span></div></Shell>;
  if (!caseInfo) return <Shell><div style={{ padding: 30, color: '#8a8f8f' }}>Loading return…</div></Shell>;

  const graded = !!real || isRelisted;
  const gc = real; // grade view is only ever the live ML result
  // Confirm action follows the real ARCA disposition when present.
  const _dispo = decision?.disposition?.disposition;
  const confirmMode = _dispo === 'WARRANTY' ? 'warranty' : _dispo === 'DISPOSE' ? 'dispose'
    : _dispo === 'LIQUIDATE' ? 'liquidate' : (real?.mode === 'warranty' || real?.mode === 'dispose' ? real.mode : 'relist');

  return (
    <Shell>
      <div onClick={() => nav('/seller/returns?tab=received')} className="sc-teal" style={{ fontSize: 13, marginBottom: 14, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>&#8592; Back to Returns received</div>

      <div style={{ background: '#131a22', borderRadius: '12px 12px 0 0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#febd69', fontWeight: 800, fontSize: 15 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8z" /><circle cx="18.5" cy="16.5" r="1.6" /></svg>
          AI Grading Assistant
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#9aa6b2' }}>{caseInfo.orderId} · {caseInfo.sku}</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #d5d9d9', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 20 }}>
        {/* Product being returned + the catalog reference the AI matches against */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <img src={caseInfo.image} alt="" style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', border: '1px solid #e3e6e6', flexShrink: 0 }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{caseInfo.product}</div>
            <div style={{ fontSize: 12, color: '#565959' }}>{caseInfo.category} · ordered by customer · returned: {caseInfo.reason}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f0f7fc', border: '1px solid #cfe3f2', borderRadius: 8, padding: '11px 14px', marginBottom: 18 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0066c0" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
          <div style={{ fontSize: 12, color: '#31414f', lineHeight: 1.5 }}>
            <b>How the integrity check works:</b> the AI compares your uploaded photos against this exact product's catalog image (shown left). If the returned item isn't this product — a wrong or fraudulent item — it's <b>flagged, not graded</b>.
            <div style={{ marginTop: 4, color: '#565959' }}>Testing without the item? Upload a photo of this product to see it pass; upload anything unrelated (e.g. a selfie) to see the mismatch guard.</div>
          </div>
        </div>

        {/* Guided capture */}
        <Cap>Guided capture · AI defect detection</Cap>
        {!graded && (() => {
          const prompts = capturePrompts(caseInfo.category);
          const filled = Object.keys(photoSlots).length;
          const requiredDone = prompts.filter((s) => s.required).every((s) => photoSlots[s.key]);
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, margin: '8px 0 10px' }}>
                {prompts.map((slot) => (
                  <div key={slot.key}>
                    <input
                      ref={(el) => { slotInputs.current[slot.key] = el; }}
                      type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={(e) => handleSlot(slot.key, e.target.files[0])}
                    />
                    <button
                      onClick={() => slotInputs.current[slot.key]?.click()}
                      style={{
                        position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 8,
                        border: slotPreviews[slot.key] ? '2px solid #febd69' : '2px dashed #d5d9d9',
                        background: slotPreviews[slot.key] ? '#000' : '#fafafa',
                        overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 8,
                      }}
                    >
                      {slotPreviews[slot.key] ? (
                        <>
                          <img src={slotPreviews[slot.key]} alt={slot.label}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .92 }} />
                          <span style={{ ...imgTag, bottom: 5, left: 5 }}>{slot.label} ✓</span>
                        </>
                      ) : (
                        <>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b6bdc4" strokeWidth="1.5" style={{ marginBottom: 4 }}>
                            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#111' }}>
                            {slot.label}{slot.required && <span style={{ color: '#b3261e' }}> *</span>}
                          </div>
                          <div style={{ fontSize: 9.5, color: '#8a8f8f', marginTop: 2, lineHeight: 1.3 }}>{slot.hint}</div>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
              {filled > 0 && (
                <div style={{ fontSize: 11.5, fontWeight: 700, color: requiredDone ? '#107a45' : '#b06f00', marginBottom: 10 }}>
                  {filled}/{prompts.length} photos captured{requiredDone ? ' · all required angles done' : ' · required angles marked *'}
                </div>
              )}
            </>
          );
        })()}

        {/* Functional test — the seller confirms the on-camera power-on/works check.
            This is a separate axis from cosmetic grade and drives warranty vs resale. */}
        {!graded && !mismatch && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f7f8f8', border: '1px solid #eaeded', borderRadius: 8, padding: '10px 14px', margin: '4px 0 12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111' }}>Functional test</span>
            <span style={{ fontSize: 11.5, color: '#8a8f8f', flex: 1, minWidth: 160 }}>Does the item power on / work as intended? (shown on camera)</span>
            {[['pass', 'Works ✓', '#107a45', '#e6f4ea', '#bfe2ca'], ['fail', 'Faulty ✕', '#b3261e', '#fbe5e3', '#f0bdb8']].map(([v, lbl, col, bg, br]) => (
              <button key={v} onClick={() => setFunctional(v)} style={{ fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: functional === v ? '#fff' : col, background: functional === v ? col : bg, border: `1px solid ${functional === v ? col : br}` }}>{lbl}</button>
            ))}
          </div>
        )}

        {/* Post-grade heatmaps */}
        {real && real.heatmaps && real.heatmaps.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, real.heatmaps.length)},1fr)`, gap: 10, margin: '8px 0 16px' }}>
            {real.heatmaps.map((b64, i) => (
              <div key={i} style={{ position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden', background: '#f0f2f2' }}>
                <img src={`data:image/jpeg;base64,${b64}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={imgTag}>AI defect map · angle {i + 1}</span>
              </div>
            ))}
          </div>
        )}

        {real && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0a6b4a', background: '#e6f4ea', border: '1px solid #bfe2ca', borderRadius: 6, padding: '4px 10px', marginBottom: 12 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad29f' }} />Graded live by on-device ML (Grounding DINO + CLIP)</div>}
        {gradeErr && <div style={{ fontSize: 12, color: '#b06f00', background: '#fbf1d9', border: '1px solid #ecd6a0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>{gradeErr}</div>}
        {mismatch && (
          <div style={{ marginBottom: 14 }}>
            {/* Mismatch alert */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fbe5e3', border: '1px solid #f0bdb8', borderRadius: 8, padding: '13px 16px', marginBottom: 12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b3261e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6A2 2 0 0022 18L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
              <div style={{ fontSize: 12.5, color: '#b3261e', lineHeight: 1.5 }}>
                <b>Integrity gate — wrong item returned. Grading halted.</b><br />
                {mismatch.message || 'The returned item does not match the ordered product.'}
                {mismatch.similarity != null && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, background: '#f0bdb8', padding: '1px 7px', borderRadius: 10 }}>Visual similarity: {Math.round(mismatch.similarity * 100)}%</span>}
              </div>
            </div>

            <EvidenceBundle evidence={evidence} />

            {/* Auto-drafted SAFE-T claim */}
            <div style={{ border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#131a22', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#febd69', fontWeight: 800, fontSize: 13 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>
                Auto-drafted SAFE-T Reimbursement Claim
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#febd69', color: '#131a22', padding: '2px 8px', borderRadius: 5 }}>DRAFT</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Reason code', 'A-to-z Guarantee — Wrong item returned'],
                  ['Expected item', caseInfo.product],
                  ['Evidence', 'AI integrity gate: DINOv2 visual mismatch' + (mismatch.similarity != null ? ` (similarity ${Math.round(mismatch.similarity * 100)}%)` : '')],
                  ['Claim value', '₹' + price.toLocaleString('en-IN')],
                  ['Filing deadline', '90 days from delivery date'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                    <span style={{ color: '#8a8f8f', minWidth: 130, flexShrink: 0 }}>{k}</span>
                    <span style={{ color: '#111', fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => nav('/seller/returns?tab=safet')} style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #c88c1a', color: '#1c1303', fontSize: 13, fontWeight: 800, borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>
                    File SAFE-T claim &rarr;
                  </button>
                  <button onClick={() => { setMismatch(null); setPhotoSlots({}); setSlotPreviews({}); }} style={{ background: '#fff', border: '1px solid #888c8c', color: '#111', fontSize: 13, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>
                    Re-scan item
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Grade CTA / progress */}
        {!graded && !mismatch && (
          grading ? (
            <div style={{ background: '#131a22', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#febd69', fontWeight: 800, fontSize: 13 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
                  AI inspecting · Grounding DINO + CLIP
                </div>
                <span style={{ fontSize: 12, color: '#9aa6b2', fontFamily: 'monospace' }}>{scanProgress}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#2a3441', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#febd69,#f0a500)', borderRadius: 4, width: `${scanProgress}%`, transition: 'width 60ms linear' }} />
              </div>
              <div style={{ fontSize: 11.5, color: '#8a95a1', marginTop: 8 }}>Verifying item integrity · detecting defects · assigning grade…</div>
            </div>
          ) : (() => {
            const prompts = caseInfo ? capturePrompts(caseInfo.category) : [];
            const hasRequired = prompts.filter((s) => s.required).every((s) => photoSlots[s.key]);
            const hasCover = Object.keys(photoSlots).length > 0;
            const ready = hasCover && hasRequired;
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: '#131a22', borderRadius: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                <div style={{ color: '#c4ccd4', fontSize: 12.5, maxWidth: 560, lineHeight: 1.5 }}>
                  {ready
                    ? <><b style={{ color: '#febd69' }}>Ready to grade.</b> The AI runs the integrity gate against the catalog image, detects defects, assigns an Amazon condition grade and drafts the condition note.</>
                    : hasCover
                      ? <><b style={{ color: '#febd69' }}>Capture all required angles (*) before grading.</b></>
                      : <><b style={{ color: '#febd69' }}>Capture the return's photos above to grade.</b> Tap each slot — required angles are marked *.</>}
                </div>
                <button onClick={runGrade} disabled={!ready} style={{ background: ready ? 'linear-gradient(180deg,#ffd99e,#febd69)' : '#3a4553', border: ready ? '1px solid #c88c1a' : '1px solid #4a5563', color: ready ? '#1c1303' : '#8a95a1', fontSize: 14, fontWeight: 800, borderRadius: 8, padding: '11px 22px', cursor: !ready ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
                  Grade with AI
                </button>
              </div>
            );
          })()
        )}

        {/* Live grade result */}
        {gc && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#e6f4ea', border: '1px solid #bfe2ca', borderRadius: 8, padding: '11px 14px', margin: '4px 0 16px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#107a45" strokeWidth="2.4"><polyline points="20 6 9 17 4 12" /></svg>
              <div style={{ fontSize: 12.5, color: '#0a6b4a' }}><b>Integrity check passed</b> — the returned item matches the ordered {caseInfo.product}.</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 22, border: '1px solid #d5d9d9', borderRadius: 10, padding: '18px 20px', marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                <svg viewBox="0 0 76 76" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}><circle cx="38" cy="38" r="32" fill="none" stroke={gc.line} strokeWidth="6" /><circle cx="38" cy="38" r="32" fill="none" stroke={gc.col} strokeWidth="6" strokeLinecap="round" strokeDasharray={((CIRC * gc.score) / 100).toFixed(1) + ' ' + CIRC} /></svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 900, color: gc.col }}>{gc.grade}</div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: gc.col }}>Amazon condition · {gc.gradeLabel}</div>
                <div style={{ fontSize: 12.5, color: '#565959', margin: '6px 0' }}>AI confidence <b style={{ color: '#111' }}>{gc.confidence}%</b> · Score <b style={{ color: '#111' }}>{gc.score}/100</b> · Functional <b style={{ color: '#111' }}>{gc.functional}</b></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(gc.defects || []).map((d, i) => <span key={i} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: '#fbf1d9', color: '#b06f00' }}>{d.t}</span>)}
                </div>
                {[['box_present', 'Original box'], ['tags_present', 'Tags attached'], ['powers_on', 'Powers on'], ['accessories_present', 'Accessories']]
                  .filter(([k]) => gc[k] === true || gc[k] === false)
                  .length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {[['box_present', 'Original box'], ['tags_present', 'Tags attached'], ['powers_on', 'Powers on'], ['accessories_present', 'Accessories']]
                      .filter(([k]) => gc[k] === true || gc[k] === false)
                      .map(([k, label]) => (
                        <span key={k} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 12, background: gc[k] ? '#e6f4ea' : '#fbe5e3', color: gc[k] ? '#107a45' : '#b3261e' }}>
                          {gc[k] ? '✓' : '✕'} {label}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 7, marginBottom: 16 }}>
              {mkScale(gc.grade).map((sc, i) => (
                <div key={i} style={{ borderRadius: 7, padding: '9px 6px', textAlign: 'center', background: sc.bg }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: sc.col }}>{sc.g}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: sc.col, marginTop: 2 }}>{sc.l}</div>
                  {sc.on && <div style={{ height: 3, background: sc.col, borderRadius: 2, marginTop: 6 }} />}
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 18 }}>
              <Cap icon>Auto-written condition note · editable</Cap>
              <textarea defaultValue={gc.note} style={{ width: '100%', minHeight: 64, border: '1px solid #888c8c', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#111', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
            </div>

            {decision
              ? <ArcaDecision decision={decision} caseInfo={caseInfo} onFile={fileClaim} />
              : (
                <>
                  <Cap>Recommended recovery · ranked by estimated value</Cap>
                  <div style={{ border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(gc.recovery || []).map((o, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 8, background: o.chosen ? '#fff8ec' : '#f7f8f8', border: o.chosen ? '2px solid #f0a500' : '1px solid #eaeded', opacity: o.disabled ? 0.55 : 1 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111' }}>{o.label}</span>
                              {o.chosen && <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: .5, background: '#f0a500', color: '#fff', padding: '2px 7px', borderRadius: 5 }}>AI PICK</span>}
                              {o.disabled && <span style={{ fontSize: 9, fontWeight: 700, background: '#eff1f1', color: '#8a8f8f', padding: '2px 7px', borderRadius: 5 }}>Blocked</span>}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#565959', marginTop: 2 }}>{o.sub}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#107a45' }}>{o.value}</div>
                            <div style={{ fontSize: 10.5, color: '#8a8f8f' }}>{o.pct} recovery</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

            <EvidenceBundle evidence={evidence} />

            {!isRelisted ? (
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: '#131a22', borderRadius: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                <div style={{ color: '#c4ccd4', fontSize: 12.5, maxWidth: 560, lineHeight: 1.5 }}>
                  {confirmMode === 'relist' && <><b style={{ color: '#febd69' }}>One-click relist.</b> Creates the condition listing under the same product, price from the recovery ladder, condition note attached, and a Health Card.</>}
                  {confirmMode === 'warranty' && <><b style={{ color: '#febd69' }}>Route to supplier warranty.</b> This defective unit goes to the supplier for credit — no consumer relist.</>}
                  {confirmMode === 'liquidate' && <><b style={{ color: '#febd69' }}>Send to liquidation.</b> Customer/carrier-damaged and not resellable — recover salvage value via Warehouse-Deals-style liquidation.</>}
                  {confirmMode === 'dispose' && <><b style={{ color: '#febd69' }}>Confirm safe disposal.</b> Not resellable and not liquidatable — dispose per policy.</>}
                </div>
                <button onClick={onConfirm} style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #c88c1a', color: '#1c1303', fontSize: 14, fontWeight: 800, borderRadius: 8, padding: '11px 22px', cursor: 'pointer' }}>
                  {confirmMode === 'relist' && 'Confirm & relist'}{confirmMode === 'warranty' && 'Route to warranty'}{confirmMode === 'liquidate' && 'Send to liquidation'}{confirmMode === 'dispose' && 'Confirm disposal'}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, background: '#e6f4ea', border: '1px solid #bfe2ca', borderRadius: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#107a45" strokeWidth="2.4"><polyline points="20 6 9 17 4 12" /></svg>
                <div style={{ fontSize: 13.5, color: '#0a6b4a', fontWeight: 700, flex: 1, minWidth: 180 }}>
                  {confirmMode === 'relist' ? <>Relisted as {decision?.disposition?.condition_label || gc.gradeLabel} — live on the storefront with an AI-grade Health Card attached.</>
                    : confirmMode === 'warranty' ? <>Routed to supplier warranty for {caseInfo.product}.</>
                    : confirmMode === 'liquidate' ? <>Sent to liquidation — salvage value recovered.</>
                    : <>Marked for safe disposal.</>}
                </div>
                {confirmMode === 'relist' && <button onClick={openStorefront} style={{ background: '#fff', border: '1px solid #107a45', color: '#107a45', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>View on storefront ↗</button>}
                <button onClick={() => nav('/seller/inventory')} style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 13, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>View in inventory</button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

const FAULT_UI = {
  none: ['No fault', '#107a45', '#e6f4ea', '#bfe2ca'],
  customer: ['Buyer-handled', '#b06f00', '#fbf1d9', '#ecd6a0'],
  fraud: ['Return fraud', '#b3261e', '#fbe5e3', '#f0bdb8'],
  carrier: ['Carrier damage', '#1d4ed8', '#e7f0fb', '#cfe0fb'],
  defective: ['Defective / DOA', '#bd4a17', '#fbe9dd', '#f0c9ac'],
  warehouse: ['Warehouse damage', '#565959', '#eff1f1', '#d5d9d9'],
};
const DISPO_LABEL = { RESTOCK_NEW: 'Restock as New', GRADE_RESELL: 'Grade & Resell (used)', LIQUIDATE: 'Liquidate', WARRANTY: 'Supplier warranty', DISPOSE: 'Dispose' };
const REFUND_LABEL = { full: 'Full refund', restocking_fee: 'Refund − restocking fee', withhold: 'Withhold refund', withhold_pending_amazon: 'Withhold — await Amazon refund' };
const ROUTE_LABEL = { SAFE_T: 'SAFE-T claim', SUPPLIER_WARRANTY: 'Supplier warranty', A_TO_Z: 'A-to-z', NONE: 'No reimbursement' };

// The ARCA two coordinated decisions: money (financial) and where-it-goes (disposition).
function ArcaDecision({ decision, caseInfo, onFile }) {
  const { fault, disposition: dp, financial: fin, claim_narrative } = decision;
  const [flabel, fcol, fbg, fbr] = FAULT_UI[fault?.fault] || FAULT_UI.customer;
  return (
    <>
      <Cap>AI decision · fault → recovery & reimbursement</Cap>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999, color: fcol, background: fbg, border: `1px solid ${fbr}` }}>Fault: {flabel}{fault?.llm ? ' · AI' : ''}</span>
        <span style={{ fontSize: 12, color: '#565959', flex: 1, minWidth: 200, lineHeight: 1.5 }}>{fault?.rationale}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Disposition */}
        <div style={{ border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: '#131a22', padding: '10px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: '#febd69', opacity: .85 }}>A · Where it goes</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{DISPO_LABEL[dp?.disposition] || dp?.disposition}</div>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12.5, color: '#111', fontWeight: 700 }}>{dp?.condition_label}</div>
            <div style={{ fontSize: 11.5, color: '#565959', marginTop: 4, lineHeight: 1.5 }}>{dp?.rationale}</div>
          </div>
        </div>

        {/* Financial */}
        <div style={{ border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(110deg,#077a52,#0a8f63)', padding: '10px 14px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: '#d6f5e6' }}>B · The money</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{REFUND_LABEL[fin?.refund_verdict] || fin?.refund_verdict}</div>
          </div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: '#565959' }}>Reimbursement route: <b style={{ color: '#111' }}>{ROUTE_LABEL[fin?.reimbursement_route] || fin?.reimbursement_route}</b></div>

            {fin?.awaiting_amazon_refund && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: '#b06f00', background: '#fbf1d9', border: '1px solid #ecd6a0', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>
                <b>Do not refund yet.</b> SAFE-T needs an Amazon-issued refund — let the 48-hour SLA lapse so Amazon auto-refunds, then file.
              </div>
            )}

            {fin?.reimbursement_route === 'SAFE_T' && fin?.safet_eligible && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#107a45' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12" /></svg>
                  SAFE-T eligible · {fin.safet_sub_reason}
                  {fin.filing_deadline_days != null && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 700, color: fin.filing_deadline_days <= 5 ? '#b3261e' : '#b06f00', background: fin.filing_deadline_days <= 5 ? '#fbe5e3' : '#fbf1d9', padding: '1px 8px', borderRadius: 10 }}>{fin.filing_deadline_days} days left</span>}
                </div>
                {claim_narrative && <div style={{ marginTop: 6, fontSize: 11, color: '#3b4042', background: '#f7f8f8', border: '1px solid #eaeded', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5, maxHeight: 92, overflow: 'auto' }}>{claim_narrative}</div>}
                <button onClick={onFile} style={{ marginTop: 8, background: '#131a22', color: '#fff', fontSize: 12.5, fontWeight: 700, borderRadius: 8, padding: '8px 16px', border: 'none', cursor: 'pointer' }}>File SAFE-T claim →</button>
              </div>
            )}

            {fin?.suppress && fin?.suppress_reason && (
              <div style={{ marginTop: 8, fontSize: 11.5, color: '#b3261e', background: '#fbe5e3', border: '1px solid #f0bdb8', borderRadius: 8, padding: '8px 10px', lineHeight: 1.5 }}>{fin.suppress_reason}</div>
            )}

            {fin?.reimbursement_route === 'SAFE_T' && !fin?.safet_eligible && !fin?.awaiting_amazon_refund && (fin?.ineligible_reasons || []).length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b3261e', marginBottom: 4 }}>SAFE-T not eligible:</div>
                {fin.ineligible_reasons.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11.5, color: '#565959', padding: '2px 0' }}><span style={{ color: '#b3261e' }}>✕</span>{r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Tamper-evident evidence bundle — each captured photo SHA-256'd, chained into a
// bundle hash. This IS the forensic evidence a SAFE-T investigator needs.
function EvidenceBundle({ evidence }) {
  if (!evidence) return null;
  return (
    <div style={{ margin: '14px 0 4px', border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f7f8f8', borderBottom: '1px solid #eaeded' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a6b4a" strokeWidth="1.8"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#111' }}>Tamper-evident evidence bundle</span>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#565959' }}>{evidence.count} assets · SHA-256 chained</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {(evidence.assets || []).map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: '#565959', padding: '2px 0' }}>
            <span style={{ color: '#107a45' }}>✓</span>
            <span style={{ minWidth: 90, color: '#111', fontWeight: 600 }}>{a.slot}</span>
            <span style={{ fontFamily: 'monospace', color: '#8a8f8f' }}>{a.sha256.slice(0, 16)}…</span>
          </div>
        ))}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #eaeded', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
          <span style={{ fontWeight: 700, color: '#111' }}>Bundle hash</span>
          <span style={{ fontFamily: 'monospace', color: '#0a6b4a' }}>{(evidence.bundle_hash || '').slice(0, 24)}…</span>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ background: '#f3f3f3', minHeight: '80vh' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '18px 20px 60px' }}>{children}</div>
    </div>
  );
}
const Cap = ({ children, icon }) => (
  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase', color: '#8a8f8f', margin: '2px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
    {icon && <svg width="12" height="12" viewBox="0 0 24 24" fill="#e7a93f"><path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14z" /></svg>}
    {children}
  </div>
);
const imgTag = { position: 'absolute', bottom: 6, left: 6, background: 'rgba(15,17,17,.72)', color: '#fff', fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5 };
const panelErr = { padding: 20, background: '#fbe5e3', border: '1px solid #f0bdb8', borderRadius: 10, color: '#b3261e', fontSize: 13 };
