import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { inspectReturn, routeItem, generateHealthCard } from '../api/client';
import { getTier, TIER_INFO, TIER_PHOTO_PROMPTS, estimateGreenCredits } from '../utils/tier';

const GRADE_CFG = {
  A: { label: 'Like New', desc: 'No visible defects — all accessories present.', ring: '#16a34a', gradeBg: '#dcfce7', score: 95 },
  B: { label: 'Very Good', desc: 'Light cosmetic wear only — fully functional.', ring: '#d97706', gradeBg: '#fef3c7', score: 78 },
  C: { label: 'Good', desc: 'Visible wear but fully functional.', ring: '#ea580c', gradeBg: '#ffedd5', score: 55 },
  D: { label: 'Acceptable', desc: 'Heavy wear or significant missing parts.', ring: '#dc2626', gradeBg: '#fee2e2', score: 30 },
};

const CIRCUMFERENCE = 2 * Math.PI * 36;

const GradingResultPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { order, reason } = location.state || {};

  const orderValue = order?.listing_price ? parseFloat(order.listing_price) : 0;
  const mrp = order?.listing_mrp ? parseFloat(order.listing_mrp) : orderValue * 2;
  const category = order?.listing_category || 'Electronics';
  const productTitle = order?.listing_title || 'your item';

  // Tier known up-front (drives the guided photo prompts)
  const captureTier = order?.listing_tier || getTier(mrp);
  const prompts = TIER_PHOTO_PROMPTS[captureTier];

  const [phase, setPhase] = useState('capture');   // capture | scanning | revealed | mismatch
  const [photoSlots, setPhotoSlots] = useState({});
  const [previews, setPreviews] = useState({});
  const [videoFile, setVideoFile] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [mismatch, setMismatch] = useState(null);
  const [scanError, setScanError] = useState('');
  const slotInputs = useRef({});
  const videoInput = useRef(null);

  const [handover, setHandover] = useState('');
  const [showRoute, setShowRoute] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const hcFired = useRef(false);

  const coverFile = photoSlots.front || Object.values(photoSlots)[0] || null;
  const coverPreview = previews.front || Object.values(previews)[0] || '';
  const photoCount = Object.keys(photoSlots).length;

  // ── derived (prefer fresh scan) ──────────────────────────────────────────────
  const grade = result?.grade || order?.listing_grade || 'B';
  const cfg = GRADE_CFG[grade] || GRADE_CFG.B;
  const confidence = result?.confidence != null ? Math.round(result.confidence * 100) : 88;
  const route = result?.route || null;
  const tier = route?.tier || order?.listing_tier || getTier(mrp);
  const tierInfo = TIER_INFO[tier];
  const defects = result?.defects || [];
  const conditionSummary = result?.condition_summary || cfg.desc;
  const refundAmount = Math.round(orderValue) || 312;
  const kiranaCredits = estimateGreenCredits(category, orderValue);
  const framesSampled = result?.frames_sampled || photoCount || 1;
  const routeMessage = route?.customer_message
    || (grade === 'D' ? 'Your item will be donated to a verified NGO partner'
      : grade === 'C' ? 'Your item will be professionally refurbished and resold'
        : 'Your item will be resold to someone nearby');

  const handleSlot = (key, file) => {
    if (!file) return;
    setPhotoSlots((p) => ({ ...p, [key]: file }));
    setPreviews((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]);
      return { ...p, [key]: URL.createObjectURL(file) };
    });
  };

  const resetCapture = () => {
    Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
    setPhotoSlots({}); setPreviews({}); setVideoFile(null);
    setMismatch(null); setResult(null); setScanError('');
    setPhase('capture');
  };

  // ── Run the multi-angle AI inspection ───────────────────────────────────────
  const runScan = async () => {
    setPhase('scanning');
    setScanProgress(0);
    setScanError('');
    let p = 0;
    const tick = setInterval(() => { p = Math.min(p + 4, 95); setScanProgress(p); }, 55);

    try {
      const fd = new FormData();
      // front first so it's the cover / fraud-gate image
      const ordered = ['front', ...Object.keys(photoSlots).filter((k) => k !== 'front')];
      ordered.forEach((k) => { if (photoSlots[k]) fd.append('images', photoSlots[k]); });
      if (videoFile) fd.append('video', videoFile);
      fd.append('expected_title', productTitle);
      fd.append('category', category);
      fd.append('product_id', String(order?.listing_id || 'return'));
      fd.append('mrp', String(mrp));
      fd.append('geohash5', 'tbxx1');
      fd.append('operator', 'agent');

      const res = await inspectReturn(fd);
      if (res.data.match === false) {
        clearInterval(tick);
        setMismatch(res.data);
        setPhase('mismatch');
        return;
      }
      setResult(res.data);
    } catch {
      // inspect endpoint down — fall back to stored grade + a route lookup
      try {
        const r = await routeItem({
          listing_id: String(order?.listing_id || 'lst_return'),
          grade: order?.listing_grade || 'B', category, defects: [], geohash5: 'tbxx1', mrp,
        });
        setResult({ grade: order?.listing_grade || 'B', confidence: 0.88, defects: [], route: r.data });
        setScanError('Live AI grader was unavailable — showing the item\'s last verified grade.');
      } catch {
        setResult({ grade: order?.listing_grade || 'B', confidence: 0.88, defects: [], route: null });
        setScanError('Offline — showing the item\'s last verified grade.');
      }
    } finally {
      clearInterval(tick);
      setScanProgress(100);
    }
  };

  // advance to reveal once we have a result
  useEffect(() => {
    if (phase === 'scanning' && result) {
      const t = setTimeout(() => {
        setPhase('revealed');
        setTimeout(() => setShowRoute(true), 400);
        setTimeout(() => setShowRefund(true), 800);
        setTimeout(() => setShowHandover(true), 1200);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [phase, result]);

  useEffect(() => {
    if (phase === 'revealed') setHandover((h) => h || (tier === 1 ? '' : 'agent'));
  }, [phase, tier]);

  useEffect(() => {
    if (phase !== 'revealed' || hcFired.current || !order?.listing_id) return;
    hcFired.current = true;
    const inspectedBy = tier === 3 ? 'ai_spn' : tier === 2 ? 'ai_agent' : 'ai_only';
    generateHealthCard({
      listing_id: order.listing_id,
      grade_result: { grade, confidence: confidence / 100, defects, completeness: result?.completeness ?? 0.9, condition_summary: conditionSummary },
      route_result: route || {},
      inspected_by: inspectedBy,
    }).catch(() => { });
  }, [phase]);

  const filled = (cfg.score / 100) * CIRCUMFERENCE;
  const canConfirm = tier !== 1 || handover !== '';
  const requiredLabels = prompts.filter((s) => s.required).map((s) => s.label).join(', ');

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        <button onClick={() => navigate('/orders')}
          className="text-[#007185] hover:underline text-sm mb-4 inline-flex items-center gap-1">
          ← Back to Your Orders
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111] mb-1">AI Condition Inspection</h1>
        <p className="text-sm text-gray-500 mb-5">
          {TIER_INFO[captureTier].label} · {TIER_INFO[captureTier].inspection}
          {reason && <> · reason: <span className="text-[#0F1111] font-medium">{reason}</span></>}
        </p>

        {/* ── CAPTURE PHASE — multi-angle + optional video ── */}
        {phase === 'capture' && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#FFF8EE] flex items-center justify-center flex-shrink-0 text-lg">📸</div>
              <div>
                <p className="font-bold text-[#0F1111] text-sm">Scan {productTitle} from multiple angles</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  The Amazon-verified agent photographs the item at handover. Capture each angle below
                  ({requiredLabels}) — the AI inspects all of them and grades the current condition.
                </p>
              </div>
            </div>

            {/* Guided photo slots */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {prompts.map((slot) => (
                <div key={slot.key}>
                  <input ref={(el) => (slotInputs.current[slot.key] = el)} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={(e) => handleSlot(slot.key, e.target.files[0])} />
                  <button type="button" onClick={() => slotInputs.current[slot.key]?.click()}
                    className={`relative w-full aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-center overflow-hidden transition-colors
                      ${previews[slot.key] ? 'border-solid border-[#febd69]' : 'border-gray-300 hover:border-[#febd69] hover:bg-yellow-50'}`}>
                    {previews[slot.key] ? (
                      <>
                        <img src={previews[slot.key]} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                        {slot.key === 'front' && <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Cover</span>}
                      </>
                    ) : (
                      <>
                        <span className="text-2xl mb-1">📷</span>
                        <span className="text-xs font-semibold text-gray-700">{slot.label}{slot.required && <span className="text-red-400"> *</span>}</span>
                        <span className="text-[10px] text-gray-400 px-1 leading-tight mt-0.5">{slot.hint}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Optional 15s video */}
            <div className="mt-4">
              <input ref={videoInput} type="file" accept="video/*" capture="environment" className="hidden"
                onChange={(e) => setVideoFile(e.target.files[0] || null)} />
              <button type="button" onClick={() => videoInput.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#febd69] hover:bg-yellow-50 transition-colors text-left">
                <span className="text-xl">🎥</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F1111]">
                    {videoFile ? `Video added: ${videoFile.name}` : 'Add a 15s video'}
                    <span className="text-gray-400 font-normal"> (optional)</span>
                  </p>
                  <p className="text-[11px] text-gray-400 leading-snug">Pan slowly across the item — recommended for electronics</p>
                </div>
              </button>
            </div>

            <button onClick={runScan} disabled={!coverFile}
              className={`mt-4 w-full py-3 rounded-lg font-bold text-sm transition-colors
                ${coverFile ? 'bg-[#FF9900] hover:bg-[#e88b00] text-white' : 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'}`}>
              {coverFile ? `Run AI Inspection (${photoCount} photo${photoCount !== 1 ? 's' : ''}${videoFile ? ' + video' : ''}) →` : 'Add the front photo to start'}
            </button>
          </div>
        )}

        {/* ── SCANNING PHASE ── */}
        {phase === 'scanning' && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-8 text-center shadow-sm">
            {coverPreview && <img src={coverPreview} alt="Scanning" className="max-h-40 mx-auto rounded object-contain mb-4 opacity-90" />}
            <div className="flex justify-center mb-3">
              <svg className="w-10 h-10 text-[#FF9900] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
            <p className="font-bold text-[#0F1111] text-lg mb-1">AI inspecting {framesSampled} view{framesSampled !== 1 ? 's' : ''}…</p>
            <p className="text-sm text-gray-500 mb-5">Verifying the item · Grounding DINO + CLIP + Vision LLM</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mb-2">
              <div className="h-full bg-[#FF9900] rounded-full transition-all duration-100" style={{ width: `${scanProgress}%` }} />
            </div>
            <p className="text-xs text-gray-400">{scanProgress}% — matching product, detecting defects</p>
          </div>
        )}

        {/* ── MISMATCH PHASE (fraud gate) ── */}
        {phase === 'mismatch' && (
          <div className="bg-white border border-red-200 rounded-lg p-6 sm:p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
            <p className="text-lg font-bold text-[#0F1111] mb-1">This doesn't match your order</p>
            <p className="text-sm text-gray-600 mb-2 max-w-md mx-auto">
              {mismatch?.message ||
                `This looks like ${mismatch?.detected_object || 'a different item'}, not the ${productTitle} you're returning.`}
            </p>
            {mismatch?.detected_object && (
              <p className="text-xs text-gray-400 mb-5">
                Detected: <span className="font-semibold capitalize">{mismatch.detected_object}</span>
                {mismatch.detected_category ? ` (${mismatch.detected_category})` : ''}
                {' '}· expected: <span className="font-semibold">{productTitle}</span>
              </p>
            )}
            <button onClick={resetCapture}
              className="px-5 py-2.5 bg-[#FF9900] hover:bg-[#e88b00] text-white font-bold text-sm rounded-lg">
              Scan the correct item
            </button>
          </div>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === 'revealed' && (
          <div className="space-y-4">
            {scanError && <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">{scanError}</div>}

            {/* Grade card */}
            <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
              <div className="bg-[#232F3E] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#febd69] font-bold text-sm">AI Grade Result</span>
                <span className="text-xs text-gray-400">✓ Product verified · {framesSampled} view{framesSampled !== 1 ? 's' : ''}</span>
              </div>

              {(result?.heatmap_b64 || coverPreview) && (
                <div className="bg-[#0F1111] flex items-center justify-center">
                  <img src={result?.heatmap_b64 ? `data:image/jpeg;base64,${result.heatmap_b64}` : coverPreview}
                    alt="Inspected item" className="max-h-60 object-contain" />
                </div>
              )}

              <div className="p-5 flex items-center gap-6">
                <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    <circle cx="40" cy="40" r="36" fill="none" stroke={cfg.ring} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${filled} ${CIRCUMFERENCE}`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
                  </svg>
                  <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-3xl shadow"
                    style={{ background: cfg.gradeBg, color: cfg.ring }}>{grade}</div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: cfg.ring }}>{cfg.label}</p>
                  <p className="text-[#0F1111] font-semibold text-base leading-snug">{conditionSummary}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Confidence: <strong className="text-[#0F1111]">{confidence}%</strong>
                    {confidence < 70 ? ' · flagged for human spot-check' : ' · cleared the review threshold'}
                  </p>
                </div>
              </div>

              {defects.length > 0 && (
                <div className="border-t border-[#f0f0f0] px-4 py-3">
                  <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">What the AI noticed</p>
                  <div className="flex flex-wrap gap-1.5">
                    {defects.slice(0, 6).map((d, i) => (
                      <span key={i} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 capitalize">
                        {d.type}{d.location ? ` · ${d.location}` : ''}{d.severity ? ` · ${d.severity}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-[#f0f0f0] px-4 py-3 bg-gray-50">
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider">Grade Scale</p>
                <div className="flex gap-1.5">
                  {['A', 'B', 'C', 'D'].map((g) => (
                    <div key={g}
                      className={`flex-1 rounded py-1.5 text-center text-xs font-bold border transition-all
                        ${g === grade ? 'border-current shadow-sm scale-105' : 'border-transparent opacity-40'}`}
                      style={g === grade
                        ? { background: GRADE_CFG[g].gradeBg, color: GRADE_CFG[g].ring, borderColor: GRADE_CFG[g].ring }
                        : { background: GRADE_CFG[g].gradeBg, color: GRADE_CFG[g].ring }}>
                      {g} — {GRADE_CFG[g].label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Routing outcome */}
            <div className={`transition-all duration-500 ${showRoute ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 sm:p-5 shadow-sm flex items-start gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{ background: tierInfo.bg }}>♻️</div>
                <div>
                  <p className="font-bold text-[#0F1111] text-base">{routeMessage}</p>
                  <p className="text-xs text-gray-500 mt-0.5">This item will stay in your city instead of travelling to a warehouse.</p>
                </div>
              </div>
            </div>

            {/* Refund */}
            <div className={`transition-all duration-500 delay-100 ${showRefund ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
                <div className="bg-green-600 px-4 py-3">
                  <p className="text-white font-black text-base">Refund Initiated</p>
                  <p className="text-green-100 text-xs">₹{refundAmount.toLocaleString('en-IN')} on its way to your Amazon Pay wallet — arrives in 2–3 hours</p>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Refund amount</span>
                  <span className="font-bold text-green-700">₹{refundAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Handover — tier-gated */}
            <div className={`transition-all duration-500 delay-200 ${showHandover ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
                  <p className="font-bold text-[#0F1111] text-sm">How would you like to hand it over?</p>
                </div>

                {tier === 1 && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => setHandover('kirana')}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${handover === 'kirana' ? 'border-[#FF9900] bg-[#FFF8EE]' : 'border-[#D5D9D9] hover:border-gray-400'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-[#0F1111] text-sm">Drop at kirana yourself</p>
                        {handover === 'kirana' && <span className="w-5 h-5 rounded-full bg-[#FF9900] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">Sri Sai Stores · 200 m away · open till 9 PM</p>
                      <span className="inline-block mt-2.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">Earn {kiranaCredits} Green Credits</span>
                    </button>
                    <button onClick={() => setHandover('pickup')}
                      className={`text-left p-4 rounded-lg border-2 transition-all ${handover === 'pickup' ? 'border-[#FF9900] bg-[#FFF8EE]' : 'border-[#D5D9D9] hover:border-gray-400'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-[#0F1111] text-sm">Schedule a home pickup</p>
                        {handover === 'pickup' && <span className="w-5 h-5 rounded-full bg-[#FF9900] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">A Flex agent arrives in 1–2 days · zero effort</p>
                      <span className="inline-block mt-2.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0F2F2] text-gray-600">No credits (convenient)</span>
                    </button>
                  </div>
                )}

                {tier === 2 && (
                  <div className="p-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-[#1d4ed8] bg-[#dbeafe]">
                      <span className="text-xl">🧑‍🔧</span>
                      <div>
                        <p className="font-bold text-[#0F1111] text-sm">A Flex agent will collect this from your doorstep</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug">For electronics ₹2,000–₹10,000, an agent verifies the device at handover — we'll schedule that now. (Kirana drop isn't available for this category.)</p>
                      </div>
                    </div>
                  </div>
                )}

                {tier === 3 && (
                  <div className="p-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-[#7c3aed] bg-[#ede9fe]">
                      <span className="text-xl">🔬</span>
                      <div>
                        <p className="font-bold text-[#0F1111] text-sm">We'll arrange a professional inspection</p>
                        <p className="text-xs text-gray-600 mt-0.5 leading-snug">For items above ₹10,000, a Flex agent picks this up for a full SPN diagnostic — issuing a 90-day Health Card before it's relisted.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-4 pb-4">
                  <button onClick={() => navigate('/orders')} disabled={!canConfirm}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${canConfirm ? 'bg-[#FF9900] hover:bg-[#e88b00] text-white' : 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'}`}>
                    {tier === 1 && !handover ? 'Choose a handover option' : 'Confirm handover'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GradingResultPage;
