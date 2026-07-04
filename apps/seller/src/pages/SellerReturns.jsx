import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSellerUI } from '../SellerUI';
import { reqRows, safetRows, SVG } from '../data/sellerData';
import { getSellerQueue } from '@amazon-hackon/shared';

export default function SellerReturns() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'requests';
  const setTab = (t) => setParams(t === 'requests' ? {} : { tab: t });

  const tabs = [
    { key: 'requests', label: 'Return requests', count: '(6)' },
    { key: 'received', label: 'Returns received', count: '(6)' },
    { key: 'safet', label: 'SAFE-T claims', count: '(3)' },
  ];

  return (
    <div style={{ background: '#fff', minHeight: '80vh' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '18px 20px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 400, margin: 0 }}>Manage Returns</h1>
            <div style={{ fontSize: 12.5, color: '#565959', marginTop: 4 }}>View and manage customer return requests for your FBA and seller-fulfilled orders. <span className="sc-teal">Learn more</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#131a22', color: '#febd69', borderRadius: 999, padding: '8px 15px', fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ad29f', boxShadow: '0 0 0 3px rgba(58,210,159,.25)', flexShrink: 0 }} />
              AI Grading Assistant · Active
            </div>
            <button onClick={() => nav('/seller/returns/dashboard')} style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 13, borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>Returns analytics</button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, background: 'linear-gradient(180deg,#fffdf6,#fdf6e6)', border: '1px solid #ecd6a0', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'radial-gradient(120% 120% at 30% 20%,#fbe3a8,#febd69 55%,#e7a93f)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#1c2a16"><path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8l4.4-1.4L12 2z" /><circle cx="18.5" cy="16.5" r="1.8" /><circle cx="5.5" cy="15.5" r="1.3" /></svg>
          </div>
          <div style={{ fontSize: 13, color: '#4a4540' }}><b>The AI is managing this queue.</b> Every request has been triaged against policy window, category and item value. Rows that need your decision are marked <b>Needs review</b>.</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #d5d9d9', marginTop: 16 }}>
          {tabs.map((t) => (
            <span key={t.key} onClick={() => setTab(t.key)} style={{ position: 'relative', padding: '11px 18px', fontSize: 14, cursor: 'pointer', color: '#111' }}>
              {t.label} <span style={{ color: '#565959', fontWeight: 400 }}>{t.count}</span>
              {tab === t.key && <span style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, background: '#e77600', borderRadius: 2 }} />}
            </span>
          ))}
        </div>

        {tab === 'requests' && <RequestsTab nav={nav} />}
        {tab === 'received' && <ReceivedTab nav={nav} />}
        {tab === 'safet' && <SafetTab />}
      </div>
    </div>
  );
}

const REQ_GRID = '170px 1fr 155px 200px 130px 90px 150px';
function RequestsTab({ nav }) {
  const { reviewDecision, decideReview } = useSellerUI();
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex' }}>
          <input placeholder="Search by Order ID, ASIN, or RMA" style={{ width: 300, height: 34, border: '1px solid #888c8c', borderRadius: '8px 0 0 8px', padding: '0 10px', fontSize: 13 }} />
          <button style={{ width: 40, height: 34, background: '#f0f2f2', border: '1px solid #888c8c', borderLeft: 'none', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg></button>
        </div>
        <select style={selS}><option>Return date: Last 30 days</option></select>
        <select style={selS}><option>Status: All</option></select>
      </div>
      <div style={{ border: '1px solid #d5d9d9', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: REQ_GRID, gap: 12, padding: '12px 16px', background: '#f7f8f8', borderBottom: '1px solid #d5d9d9', fontSize: 12, fontWeight: 700, color: '#111' }}>
          <div>Order ID / Date</div><div>Product</div><div>Return reason</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#e7a93f"><path d="M12 2l1.6 4.6L18 8l-4.4 1.4L12 14l-1.6-4.6L6 8z" /></svg>AI decision</div>
          <div>Status</div><div>Refund</div><div>Action</div>
        </div>
        {reqRows.map((r, i) => {
          const rd = r.reviewId ? reviewDecision[r.reviewId] : null;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: REQ_GRID, gap: 12, padding: '14px 16px', borderBottom: '1px solid #eaeded', fontSize: 12.5, alignItems: 'center' }}>
              <div><div className="sc-teal">{r.orderId}</div><div style={{ color: '#565959', fontSize: 11.5, marginTop: 2 }}>{r.date}</div></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Thumb tint={r.tint} ink={r.ink} />
                <div><div style={{ color: '#111' }}>{r.product}</div><div style={{ color: '#565959', fontSize: 11.5 }}>{r.asin}</div></div>
              </div>
              <div style={{ color: '#111' }}>{r.reason}</div>
              <div><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 12, background: r.aiBg, color: r.aiInk, lineHeight: 1.35 }}>{r.ai}</span></div>
              <div><span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: r.statusBg, color: r.statusInk }}>{r.status}</span></div>
              <div style={{ color: '#111', fontWeight: 700 }}>{r.refund}</div>
              <div>
                {r.normalAction && <button style={{ background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 12, borderRadius: 16, padding: '5px 14px', cursor: 'pointer' }}>{r.action}</button>}
                {r.needsReview && !rd && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => decideReview(r.reviewId, 'accept')} style={{ background: '#131a22', color: '#fff', fontSize: 12, borderRadius: 16, padding: '6px 12px', border: 'none', cursor: 'pointer' }}>Accept · decline</button>
                    <button onClick={() => decideReview(r.reviewId, 'override')} style={{ background: '#fff', border: '1px solid #888c8c', color: '#111', fontSize: 12, borderRadius: 16, padding: '6px 12px', cursor: 'pointer' }}>Authorize anyway</button>
                  </div>
                )}
                {r.needsReview && rd === 'accept' && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#b3261e' }}>Declined ✓</span>}
                {r.needsReview && rd === 'override' && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#107a45' }}>Authorized ✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const RECV_GRID = '150px 1.4fr 180px 120px 1fr 130px';
function ReceivedTab({ nav }) {
  const { relisted } = useSellerUI();
  const [cases, setCases] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    getSellerQueue().then((r) => setCases(r.data.cases || [])).catch(() => setErr(true));
  }, []);

  return (
    <>
      <div style={{ fontSize: 12.5, color: '#565959', margin: '16px 0 10px' }}>Physically arrived items — each is a real returned product. Click <b style={{ color: '#111' }}>Inspect</b> to open the AI Grading Assistant.</div>
      {err && <div style={{ fontSize: 12.5, color: '#b06f00', background: '#fbf1d9', border: '1px solid #ecd6a0', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>Couldn’t load the returns queue — is the backend running on :8000?</div>}
      <div style={{ border: '1px solid #d5d9d9', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: RECV_GRID, gap: 12, padding: '12px 16px', background: '#f7f8f8', borderBottom: '1px solid #d5d9d9', fontSize: 12, fontWeight: 700, color: '#111' }}>
          <div>Order ID / Date</div><div>Returned product</div><div>Arrival note</div><div>Status</div><div>AI grade / outcome</div><div>Action</div>
        </div>
        {cases === null && !err && <div style={{ padding: '20px 16px', color: '#8a8f8f', fontSize: 13 }}>Loading returns…</div>}
        {(cases || []).map((r, i) => {
          const complete = !!relisted[r.caseId];
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: RECV_GRID, gap: 12, padding: '14px 16px', borderBottom: '1px solid #eaeded', fontSize: 12.5, alignItems: 'center' }}>
              <div><div className="sc-teal">{r.orderId}</div><div style={{ color: '#565959', fontSize: 11.5, marginTop: 2 }}>{r.date}</div></div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <ProductImg src={r.image} />
                <div><div style={{ color: '#111' }}>{r.product}</div><div style={{ color: '#565959', fontSize: 11.5 }}>{r.sku} · {r.category}</div></div>
              </div>
              <div style={{ color: '#565959' }}>
                {r.note}
                {r.defect && <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fbe5e3', color: '#b3261e' }}>⚠ Defect reported</div>}
                {r.sealed && <div style={{ display: 'inline-block', marginTop: 4, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#e6f4ea', color: '#107a45' }}>Sealed</div>}
              </div>
              <div>
                {complete
                  ? <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#e6f4ea', color: '#107a45' }}>Complete</span>
                  : <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: '#e7f0fb', color: '#1d4ed8' }}>Ready to grade</span>}
              </div>
              <div>
                {complete
                  ? <span style={{ color: '#107a45', fontWeight: 700 }}>Graded &amp; relisted</span>
                  : <span style={{ color: '#8a8f8f' }}>— awaiting inspection —</span>}
              </div>
              <div>
                <button onClick={() => nav(`/seller/returns/grade/${r.caseId}`)} style={complete
                  ? { background: '#fff', border: '1px solid #007185', color: '#007185', fontSize: 12, borderRadius: 16, padding: '6px 12px', cursor: 'pointer' }
                  : { background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #c88c1a', color: '#1c1303', fontSize: 12.5, fontWeight: 700, borderRadius: 16, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  {!complete && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>}
                  {complete ? 'Review' : 'Inspect'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ProductImg({ src }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return <Thumb tint="#eef1f2" ink="#8a8f8f" />;
  return <img src={src} alt="" onError={() => setOk(false)} style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid #e3e6e6' }} />;
}

function SafetTab() {
  const { safetSubmitted, submitSafet, safetClaims } = useSellerUI();
  return (
    <>
      <div style={{ fontSize: 12.5, color: '#565959', margin: '16px 0 12px' }}>AI-drafted SAFE-T reimbursement claims. Eligibility, reason code, evidence bundle and filing deadline are prepared — review and submit in one click.</div>

      {/* Claims drafted live by the AI Grading Assistant this session */}
      {safetClaims.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase', color: '#b06f00', marginBottom: 8 }}>⚡ Drafted just now by the AI Grading Assistant</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {safetClaims.map((c) => {
              const done = !!safetSubmitted[c.id];
              return (
                <div key={c.id} style={{ border: '1px solid #ecd6a0', borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(180deg,#fffdf6,#fdf6e6)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{c.reason}</div>
                      <div style={{ fontSize: 11.5, color: '#565959' }}>Reason code: {c.code} · {c.product} · Order {c.orderId}</div>
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 12, background: done ? '#e6f4ea' : '#fbf1d9', color: done ? '#107a45' : '#b06f00' }}>{done ? 'Submitted' : 'Draft ready'}</span>
                  </div>
                  {c.narrative && <div style={{ margin: '0 16px', fontSize: 11.5, color: '#3b4042', background: '#fff', border: '1px solid #eaeded', borderRadius: 8, padding: '9px 11px', lineHeight: 1.5 }}>{c.narrative}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(c.evidence || []).map((e, i) => <span key={i} style={{ fontSize: 11, background: '#eff1f1', color: '#3b4042', borderRadius: 6, padding: '3px 9px' }}>{e}</span>)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#b06f00' }}>{c.deadline}</span>
                      {done
                        ? <span style={{ fontSize: 12.5, fontWeight: 700, color: '#107a45' }}>Submitted · {c.reimb} claimed</span>
                        : <button onClick={() => submitSafet(c.id)} style={{ background: '#131a22', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '8px 18px', border: 'none', cursor: 'pointer' }}>Review &amp; submit</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {safetRows.map((c) => {
          const done = !!safetSubmitted[c.id];
          const statusText = done ? 'Granted' : c.eligible ? 'Draft' : 'Ineligible';
          const statusBg = done ? '#e6f4ea' : c.eligible ? '#fbf1d9' : '#eff1f1';
          const statusInk = done ? '#107a45' : c.eligible ? '#b06f00' : '#565959';
          return (
            <div key={c.id} style={{ border: '1px solid #d5d9d9', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 18px', background: '#f7f8f8', borderBottom: '1px solid #eaeded', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: c.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth="1.6"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg></div>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{c.reason}</div><div style={{ fontSize: 11.5, color: '#565959' }}>Reason code: {c.code} · {c.product}</div></div>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 12px', borderRadius: 12, background: statusBg, color: statusInk }}>{statusText}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr' }}>
                <div style={{ padding: '14px 18px', borderRight: '1px solid #eaeded' }}>
                  <Cap>Eligibility check</Cap>
                  {c.checks.map((k, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#111', padding: '3px 0' }}>
                      <span style={{ color: k.ok ? '#107a45' : '#b3261e', fontWeight: 900 }}>{k.ok ? '✓' : '✗'}</span><span>{k.t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 18px' }}>
                  <Cap>Evidence bundle</Cap>
                  {c.eligible ? (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                        {c.evidence.map((e, i) => (
                          <span key={i} style={{ fontSize: 11, background: '#eff1f1', color: '#3b4042', borderRadius: 6, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 5 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>{e}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: '#b06f00', fontWeight: 700 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{c.deadline}</div>
                        {!done ? <button onClick={() => submitSafet(c.id)} style={{ background: '#131a22', color: '#fff', fontSize: 13, fontWeight: 700, borderRadius: 8, padding: '8px 18px', border: 'none', cursor: 'pointer' }}>Review &amp; submit</button>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#107a45' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12" /></svg>Granted · {c.reimb} reimbursed</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12.5, color: '#b3261e', lineHeight: 1.5, background: '#fbe5e3', border: '1px solid #f0bdb8', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>{c.ineligReason}</div>
                      <div style={{ fontSize: 12, color: '#565959', lineHeight: 1.5 }}><b>AI suggestion:</b> {c.suggestion}</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const Thumb = ({ tint, ink }) => <div style={{ width: 38, height: 38, borderRadius: 4, background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.5"><path d={SVG.box} /></svg></div>;
const Cap = ({ children }) => <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase', color: '#8a8f8f', marginBottom: 8 }}>{children}</div>;
const selS = { height: 34, border: '1px solid #888c8c', borderRadius: 8, fontSize: 13, padding: '0 8px' };
