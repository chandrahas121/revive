import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSellerUI } from '../SellerUI';
import { mkScale, CIRC } from '../data/sellerData';
import { getSellerQueue, sellerGrade, sellerRelist } from '../../api/client';
import { adaptRealGrade } from '../gradeAdapter';

// AI Grading Assistant — grades a returned item against ITS real catalog product.
// The integrity gate (DINOv2 vs the product's own catalog image) rejects a wrong
// item instead of grading it; a matching item gets a live grade + defects + note.
export default function GradingAssistant() {
  const { caseId } = useParams();
  const nav = useNavigate();
  const { relisted, confirmRelist, openHealthCard } = useSellerUI();
  const fileRef = useRef(null);

  const [caseInfo, setCaseInfo] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [files, setFiles] = useState([]);
  const [grading, setGrading] = useState(false);
  const [real, setReal] = useState(null);
  const [mismatch, setMismatch] = useState(null);
  const [gradeErr, setGradeErr] = useState(null);
  const [storefrontUrl, setStorefrontUrl] = useState(null);

  const isRelisted = !!relisted[caseId];

  useEffect(() => {
    getSellerQueue()
      .then((r) => {
        const c = (r.data.cases || []).find((x) => x.caseId === caseId);
        if (c) setCaseInfo(c); else setLoadErr(true);
      })
      .catch(() => setLoadErr(true));
  }, [caseId]);

  const filePreviews = React.useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => filePreviews.forEach((u) => URL.revokeObjectURL(u)), [filePreviews]);

  const price = caseInfo ? Number(caseInfo.mrp) || 999 : 999;

  const runGrade = async () => {
    if (!files.length || !caseInfo) return;
    setGrading(true); setMismatch(null); setGradeErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('images', f));
      fd.append('product_id', caseInfo.product_id);
      const { data } = await sellerGrade(fd);
      if (data.match === false) {
        setMismatch(data.message || 'The returned item does not match the ordered product. Grading halted; a fraud flag has been raised.');
      } else {
        setReal(adaptRealGrade(data, {
          product: caseInfo.product, sku: caseInfo.sku, category: caseInfo.category,
          orderId: caseInfo.orderId, isHygiene: false,
        }, price));
      }
    } catch (e) {
      setGradeErr('Live grading failed — is the backend running on :8000?');
    } finally {
      setGrading(false);
    }
  };

  const onConfirm = () => {
    if (!gc || gc.mode === 'safet') { nav('/seller/returns?tab=safet'); return; }
    const label = gc.mode !== 'relist' ? gc.gradeLabel
      : gc.gradeLabel === 'Like New' ? 'Open Box' : 'Used - ' + gc.gradeLabel;
    sellerRelist({
      product_id: caseInfo.product_id, grade: gc.grade, price,
      condition_label: label, source: gc.grade === 'A' && caseInfo.sealed ? 'new' : 'return',
    })
      .then((res) => { if (res?.data?.storefront_url) setStorefrontUrl(res.data.storefront_url); })
      .catch(() => {});
    confirmRelist(caseId);
  };
  const openStorefront = () => {
    const base = import.meta.env.VITE_APP_URL || window.location.origin;
    window.open(base + (storefrontUrl || '/?source=revive'), '_blank');
  };

  if (loadErr) return <Shell><div style={panelErr}>Couldn’t load this return — is the backend running on :8000? <span className="sc-teal" onClick={() => nav('/seller/returns?tab=received')}>Back to Returns received</span></div></Shell>;
  if (!caseInfo) return <Shell><div style={{ padding: 30, color: '#8a8f8f' }}>Loading return…</div></Shell>;

  const graded = !!real || isRelisted;
  const gc = real; // grade view is only ever the live ML result

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
            <b>How the integrity check works:</b> the AI compares your uploaded photos against this exact product’s catalog image (shown left). If the returned item isn’t this product — a wrong or fraudulent item — it’s <b>flagged, not graded</b>.
            <div style={{ marginTop: 4, color: '#565959' }}>Testing without the item? Upload a photo of this product to see it pass; upload anything unrelated (e.g. a selfie) to see the mismatch guard.</div>
          </div>
        </div>

        {/* Capture */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <Cap>Guided capture · AI defect detection</Cap>
          {!graded && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {files.length > 0 && <span style={{ fontSize: 11.5, color: '#107a45', fontWeight: 700 }}>{files.length} photo{files.length > 1 ? 's' : ''} ready</span>}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              <button onClick={() => fileRef.current?.click()} style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                Upload photos
              </button>
            </div>
          )}
        </div>

        {real && real.heatmaps && real.heatmaps.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, real.heatmaps.length)},1fr)`, gap: 10, margin: '8px 0 16px' }}>
            {real.heatmaps.map((b64, i) => (
              <div key={i} style={{ position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden', background: '#f0f2f2' }}>
                <img src={`data:image/jpeg;base64,${b64}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={imgTag}>AI defect map · angle {i + 1}</span>
              </div>
            ))}
          </div>
        ) : filePreviews.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, filePreviews.length)},1fr)`, gap: 10, margin: '8px 0 16px' }}>
            {filePreviews.slice(0, 6).map((u, i) => (
              <div key={i} style={{ position: 'relative', height: 140, borderRadius: 8, overflow: 'hidden', background: '#f0f2f2', border: '1px solid #d5d9d9' }}>
                <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={imgTag}>Uploaded · angle {i + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ border: '2px dashed #c3cbd3', borderRadius: 10, padding: '26px 16px', textAlign: 'center', margin: '8px 0 16px', color: '#8a8f8f' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#b6bdc4" strokeWidth="1.5" style={{ marginBottom: 6 }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
            <div style={{ fontSize: 13, color: '#565959' }}>Upload the returned item’s photos to grade — front, back, label / powered-on screen.</div>
          </div>
        )}

        {real && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#0a6b4a', background: '#e6f4ea', border: '1px solid #bfe2ca', borderRadius: 6, padding: '4px 10px', marginBottom: 12 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3ad29f' }} />Graded live by on-device ML (Grounding DINO + CLIP)</div>}
        {gradeErr && <div style={{ fontSize: 12, color: '#b06f00', background: '#fbf1d9', border: '1px solid #ecd6a0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>{gradeErr}</div>}
        {mismatch && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fbe5e3', border: '1px solid #f0bdb8', borderRadius: 8, padding: '13px 16px', marginBottom: 12 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b3261e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><path d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6A2 2 0 0022 18L13.7 3.9a2 2 0 00-3.4 0z" /></svg>
            <div style={{ fontSize: 12.5, color: '#b3261e', lineHeight: 1.5 }}><b>Integrity gate — item mismatch. Grading halted.</b><br />{mismatch} A fraud flag has been raised; re-scan the correct item to continue.</div>
          </div>
        )}

        {/* Grade CTA */}
        {!graded && !mismatch && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: '#131a22', borderRadius: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
            <div style={{ color: '#c4ccd4', fontSize: 12.5, maxWidth: 560, lineHeight: 1.5 }}>
              {files.length
                ? <><b style={{ color: '#febd69' }}>Ready to grade.</b> The AI runs the integrity gate against the catalog image, detects defects, assigns an Amazon condition grade and drafts the condition note.</>
                : <><b style={{ color: '#febd69' }}>Upload the return’s photos to grade.</b> No photos, no grade — there are no defaults.</>}
            </div>
            <button onClick={runGrade} disabled={grading || !files.length} style={{ background: files.length ? 'linear-gradient(180deg,#ffd99e,#febd69)' : '#3a4553', border: files.length ? '1px solid #c88c1a' : '1px solid #4a5563', color: files.length ? '#1c1303' : '#8a95a1', fontSize: 14, fontWeight: 800, borderRadius: 8, padding: '11px 22px', cursor: (grading || !files.length) ? 'not-allowed' : 'pointer', opacity: grading ? .7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              {grading ? 'Grading…' : 'Grade with AI'}
            </button>
          </div>
        )}

        {/* Re-grade after a mismatch */}
        {mismatch && (
          <button onClick={() => { setMismatch(null); setFiles([]); }} style={{ background: '#131a22', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '9px 18px', border: 'none', cursor: 'pointer' }}>Re-scan item</button>
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

            {!isRelisted ? (
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: '#131a22', borderRadius: 10, padding: '16px 20px', flexWrap: 'wrap' }}>
                <div style={{ color: '#c4ccd4', fontSize: 12.5, maxWidth: 560, lineHeight: 1.5 }}>
                  {gc.mode === 'relist' && <><b style={{ color: '#febd69' }}>One-click relist.</b> Creates the condition listing under the same product, price from the recovery ladder, condition note attached, and a Health Card.</>}
                  {gc.mode === 'warranty' && <><b style={{ color: '#febd69' }}>Draft warranty claim.</b> Routes this defective unit to the supplier for ~60% credit — no consumer relist.</>}
                  {gc.mode === 'dispose' && <><b style={{ color: '#febd69' }}>Confirm safe disposal.</b> Not resellable — the only enabled recovery path.</>}
                </div>
                <button onClick={onConfirm} style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #c88c1a', color: '#1c1303', fontSize: 14, fontWeight: 800, borderRadius: 8, padding: '11px 22px', cursor: 'pointer' }}>
                  {gc.mode === 'relist' && 'Confirm & relist'}{gc.mode === 'warranty' && 'Draft warranty claim'}{gc.mode === 'dispose' && 'Confirm disposal'}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, background: '#e6f4ea', border: '1px solid #bfe2ca', borderRadius: 10, padding: '14px 18px', flexWrap: 'wrap' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#107a45" strokeWidth="2.4"><polyline points="20 6 9 17 4 12" /></svg>
                <div style={{ fontSize: 13.5, color: '#0a6b4a', fontWeight: 700, flex: 1, minWidth: 180 }}>
                  {gc.mode === 'relist' ? <>Relisted as {gc.gradeLabel} — live on the storefront with an AI-grade Health Card attached.</> : gc.mode === 'warranty' ? <>Warranty claim drafted for {caseInfo.product}.</> : <>Marked for safe disposal.</>}
                </div>
                {gc.mode === 'relist' && <button onClick={openStorefront} style={{ background: '#fff', border: '1px solid #107a45', color: '#107a45', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>View on storefront ↗</button>}
                <button onClick={() => nav('/seller/inventory')} style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 13, borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>View in inventory</button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
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
