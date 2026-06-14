import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import api, { generateHealthCard } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getTier, TIER_INFO, TIER_PHOTO_PROMPTS } from '../../utils/tier';

const CATEGORIES = [
  'Electronics', 'Footwear', 'Clothing', 'Home & Kitchen',
  'Books', 'Toys', 'Sports', 'Beauty', 'Jewelry', 'Other',
];

const GRADE_CONFIG = {
  A: { label: 'Like New',   ring: '#16a34a', bg: '#dcfce7', bar: 95 },
  B: { label: 'Very Good',  ring: '#d97706', bg: '#fef3c7', bar: 75 },
  C: { label: 'Good',       ring: '#ea580c', bg: '#ffedd5', bar: 55 },
  D: { label: 'Acceptable', ring: '#dc2626', bg: '#fee2e2', bar: 35 },
};

const PATH_CONFIG = {
  resell_p2p:       { label: 'Resell Nearby (P2P)',    color: '#15803d', bg: '#dcfce7', icon: '📍' },
  resell_warehouse: { label: 'Resell City-Wide',       color: '#1d4ed8', bg: '#dbeafe', icon: '🏪' },
  refurbish:        { label: 'Refurbish & Resell',     color: '#7c3aed', bg: '#ede9fe', icon: '🔧' },
  donate:           { label: 'Donate to NGO',          color: '#b45309', bg: '#fef3c7', icon: '🤝' },
  recycle:          { label: 'Responsible Recycling',  color: '#6b7280', bg: '#f3f4f6', icon: '♻️' },
};

const GradePreview = ({ result, onDismiss }) => {
  const cfg = GRADE_CONFIG[result.grade] || GRADE_CONFIG.B;
  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: cfg.ring + '40' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: cfg.bg }}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg"
            style={{ background: cfg.ring, color: '#fff' }}>
            {result.grade}
          </span>
          <div>
            <p className="text-xs font-bold" style={{ color: cfg.ring }}>AI Grade: {cfg.label}</p>
            <p className="text-[10px] text-gray-500">
              {Math.round((result.confidence || 0) * 100)}% confidence
              {result.from_cache ? ' · cached' : ''}
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {result.condition_summary && (
        <div className="px-3 py-2 bg-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">AI Condition Notes</p>
          <p className="text-xs text-gray-700 leading-relaxed">{result.condition_summary}</p>
        </div>
      )}

      {result.defects && result.defects.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t flex flex-wrap gap-1.5">
          {result.defects.slice(0, 4).map((d, i) => (
            <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
              ${d.severity === 'severe' || d.severity === 'major' ? 'bg-red-50 text-red-700 border-red-200'
              : d.severity === 'moderate' ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {d.type} · {d.severity}
            </span>
          ))}
        </div>
      )}

      {result.heatmap_b64 && (
        <div className="px-3 py-2 bg-gray-50 border-t">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Defect Map</p>
          <img src={`data:image/jpeg;base64,${result.heatmap_b64}`} alt="Defect heatmap"
            className="w-full rounded object-contain max-h-40" />
        </div>
      )}
    </div>
  );
};

// Success screen — tier-aware. Sellers get money, NOT credits (final_idea Rule 4).
const ListingSuccess = ({ listing, routeResult, tier, onViewListing }) => {
  const tierInfo = TIER_INFO[tier];

  // Tier 3 — scheduled for professional SPN inspection, not instantly live
  if (tier === 3) {
    return (
      <div className="space-y-4">
        <div className="bg-[#7c3aed] rounded-lg px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">🔬</div>
            <div>
              <p className="font-black text-lg">Professional Inspection Scheduled</p>
              <p className="text-purple-100 text-xs mt-0.5">A Flex agent will pick up your item</p>
            </div>
          </div>
        </div>
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 shadow-sm space-y-3 text-sm">
          <p className="text-gray-700 leading-relaxed">
            For items above ₹10,000, we arrange a full SPN diagnostic — battery cycle count, IMEI &
            blacklist check, all sensors and ports tested, certified data wipe. This issues you a
            <span className="font-bold"> 90-day Health Card</span> and typically increases your sale
            price by <span className="font-bold">20–35%</span>.
          </p>
          <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
            <span className="text-gray-500">Guarantee</span>
            <span className="font-semibold text-[#0F1111]">{tierInfo.guarantee}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Inspection by</span>
            <span className="font-semibold text-[#0F1111]">Amazon SPN partner</span>
          </div>
        </div>
        <button onClick={() => (window.location.href = '/')}
          className="w-full py-3 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold text-sm rounded-lg">
          Back to Marketplace
        </button>
      </div>
    );
  }

  // Tier 1 / Tier 2 — listed live
  const path = routeResult?.chosen_path;
  const pathCfg = PATH_CONFIG[path] || PATH_CONFIG.resell_p2p;
  const price = routeResult?.price || listing?.price;

  return (
    <div className="space-y-4">
      <div className="bg-green-600 rounded-lg px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">✓</div>
          <div>
            <p className="font-black text-lg">Your item is live!</p>
            <p className="text-green-100 text-xs mt-0.5">Keep it at home — we'll notify you the moment someone buys it</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
        <div className="bg-[#232F3E] px-4 py-2.5 flex items-center justify-between">
          <span className="text-[#febd69] font-bold text-sm">Listing Summary</span>
          <span className="text-xs text-gray-400">{tierInfo.label}</span>
        </div>
        <div className="p-4 space-y-3">
          {path && (
            <div className="flex items-center gap-3 p-3 rounded-lg border-2"
              style={{ borderColor: pathCfg.color, background: pathCfg.bg }}>
              <span className="text-xl">{pathCfg.icon}</span>
              <div>
                <p className="font-black text-base" style={{ color: pathCfg.color }}>{pathCfg.label}</p>
                {routeResult?.customer_message && (
                  <p className="text-xs text-gray-600 mt-0.5">{routeResult.customer_message}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {price && (
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-black text-[#0F1111]">₹{Math.round(price).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">AI-optimised list price</p>
              </div>
            )}
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-sm font-black text-blue-700 leading-tight">{tierInfo.guarantee}</p>
              <p className="text-[10px] text-blue-600 mt-0.5">Buyer protection</p>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed border-t border-[#f0f0f0] pt-3">
            You'll receive a UPI transfer after the buyer's return window closes.
            {tier === 2 && ' A Flex agent will collect and verify the device at your doorstep when it sells.'}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onViewListing}
          className="flex-1 py-3 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold text-sm rounded-lg">
          View Your Listing
        </button>
        <button onClick={() => (window.location.href = '/')}
          className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50">
          Back to Marketplace
        </button>
      </div>
    </div>
  );
};

const SellIt = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [mrp, setMrp] = useState('');            // original price → drives tier
  const [price, setPrice] = useState('');         // asking price
  const [description, setDescription] = useState('');
  const [conditionSummary, setConditionSummary] = useState('');

  // Tier-specific extras
  const [batteryPct, setBatteryPct] = useState('');
  const [imei, setImei] = useState('');
  const [purchaseYear, setPurchaseYear] = useState('');
  const [declared, setDeclared] = useState(false);

  // Photos keyed by slot
  const [photoSlots, setPhotoSlots] = useState({});   // { slotKey: File }
  const [previews, setPreviews] = useState({});       // { slotKey: objectURL }
  const slotInputs = useRef({});

  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [gradeError, setGradeError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [createdListing, setCreatedListing] = useState(null);
  const [routeResult, setRouteResult] = useState(null);

  const tier = getTier(mrp);
  const tierInfo = TIER_INFO[tier];
  const prompts = TIER_PHOTO_PROMPTS[tier];
  const coverFile = photoSlots.front || Object.values(photoSlots)[0] || null;

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const runGrading = async (file, cat) => {
    setGrading(true);
    setGradeResult(null);
    setGradeError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('category', cat);
      fd.append('operator', 'seller');
      fd.append('include_heatmap', 'true');
      const res = await api.post('/api/grade/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setGradeResult(res.data);
      if (!conditionSummary && res.data.condition_summary) setConditionSummary(res.data.condition_summary);
    } catch {
      setGradeError('AI grading unavailable — you can still submit manually.');
    } finally {
      setGrading(false);
    }
  };

  const handleSlotUpload = (slotKey, file) => {
    if (!file) return;
    setPhotoSlots((prev) => ({ ...prev, [slotKey]: file }));
    setPreviews((prev) => {
      if (prev[slotKey]) URL.revokeObjectURL(prev[slotKey]);
      return { ...prev, [slotKey]: URL.createObjectURL(file) };
    });
    // The cover/front photo drives the AI grade
    if (slotKey === 'front' || (!photoSlots.front && Object.keys(photoSlots).length === 0)) {
      runGrading(file, category);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim())  { setError('Please add a title.'); return; }
    if (!mrp)           { setError('Original price is required — it determines the inspection tier.'); return; }
    if (!price)         { setError('Asking price is required.'); return; }
    if (parseFloat(price) <= 0) { setError('Asking price must be greater than 0.'); return; }
    if (!coverFile)     { setError('Please add at least the front photo so the AI can grade your item.'); return; }
    if (tier === 2 && !batteryPct) { setError('Battery health is required for electronics in this tier.'); return; }
    if (!declared)      { setError('Please confirm the ownership & condition declaration.'); return; }

    try {
      setSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('price', price);
      formData.append('mrp', mrp);
      formData.append('condition_summary', conditionSummary.trim());
      formData.append('image', coverFile);

      const res = await api.post('/api/listings/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const listing = res.data;
      const rr = res.data.route_result || null;
      setCreatedListing(listing);
      setRouteResult(rr);

      if (listing.id) {
        const inspectedBy = tier === 3 ? 'ai_spn' : tier === 2 ? 'ai_agent' : 'ai_only';
        generateHealthCard({
          listing_id: listing.id,
          grade_result: res.data.grade_result
            || { grade: gradeResult?.grade || listing.grade, confidence: gradeResult?.confidence || 0.8,
                 defects: gradeResult?.defects || [], completeness: listing.completeness,
                 condition_summary: conditionSummary.trim() },
          route_result: rr || {},
          inspected_by: inspectedBy,
          battery_pct: batteryPct ? parseInt(batteryPct, 10) : undefined,
          imei: imei || undefined,
        }).catch(() => {});
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})[0]?.[0] ||
        'Failed to create listing. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  if (createdListing) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
          <ListingSuccess
            listing={createdListing}
            routeResult={routeResult}
            tier={tier}
            onViewListing={() => navigate(`/product/${createdListing.id}`)}
          />
        </main>
      </div>
    );
  }

  const lowBattery = tier >= 2 && batteryPct && parseInt(batteryPct, 10) < 80;
  const submitLabel = grading ? 'Grading photo…'
    : submitting ? 'Publishing…'
    : tier === 3 ? 'Schedule Professional Inspection'
    : 'Publish Listing';

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sell Unused Item</h1>
          <p className="text-gray-500 text-sm mt-1">List your item on Amazon Revive — AI-verified, buyer-protected.</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">

          {/* Step 1 — Identify item */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-800">Step 1 — What are you selling?</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Product name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Start typing your product name… e.g. Sony WH-1000XM4"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-sm" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { setCategory(c); if (coverFile) runGrading(coverFile, c); }}
                    className={`py-2 px-3 rounded-lg border text-xs sm:text-sm font-medium transition-colors text-center
                      ${category === c ? 'bg-[#232F3E] text-[#febd69] border-[#232F3E]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Original price (MRP) <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">— sets your inspection tier</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-500">₹</span>
                <input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)}
                  placeholder="0.00" min="1" step="0.01"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-base" />
              </div>
            </div>

            {/* Tier badge — appears once MRP entered */}
            {mrp && (
              <div className="rounded-lg p-3 border" style={{ background: tierInfo.bg, borderColor: tierInfo.color + '40' }}>
                <div className="flex items-center justify-between">
                  <p className="font-black text-sm" style={{ color: tierInfo.color }}>{tierInfo.label} · {tierInfo.range}</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70" style={{ color: tierInfo.color }}>
                    {tierInfo.guarantee}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{tierInfo.blurb} · {tierInfo.inspection}</p>
              </div>
            )}
          </div>

          {/* Step 2 — Tier-specific guided photos */}
          {mrp && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
                Step 2 — Photos <span className="text-gray-400 font-normal text-xs">({tierInfo.label} requires {prompts.filter(p => p.required).length})</span>
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Grading as <span className="font-semibold text-[#232F3E]">{category}</span> — the front photo is graded by AI instantly.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {prompts.map((slot) => (
                  <div key={slot.key}>
                    <input
                      ref={(el) => (slotInputs.current[slot.key] = el)}
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleSlotUpload(slot.key, e.target.files[0])}
                    />
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
                          <span className="text-xs font-semibold text-gray-700">
                            {slot.label}{slot.required && <span className="text-red-400"> *</span>}
                          </span>
                          <span className="text-[10px] text-gray-400 px-1 leading-tight mt-0.5">{slot.hint}</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {grading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span>AI is analysing your photo — grading defects, completeness…</span>
                </div>
              )}
              {gradeError && <p className="mt-2 text-xs text-amber-600">{gradeError}</p>}
              {gradeResult && !grading && <GradePreview result={gradeResult} onDismiss={() => setGradeResult(null)} />}
            </div>
          )}

          {/* Step 2b — Tier 2/3 functional details */}
          {mrp && tier >= 2 && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <h2 className="text-sm sm:text-base font-bold text-gray-800">
                Step 2b — Device details
                <span className="text-gray-400 font-normal text-xs ml-1">(required for electronics)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Battery health %{tier === 2 && <span className="text-red-500"> *</span>}
                  </label>
                  <input type="number" value={batteryPct} onChange={(e) => setBatteryPct(e.target.value)}
                    placeholder="e.g. 91" min="0" max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    IMEI <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input type="text" value={imei} onChange={(e) => setImei(e.target.value)}
                    placeholder="*#06# to find it"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase year</label>
                  <input type="number" value={purchaseYear} onChange={(e) => setPurchaseYear(e.target.value)}
                    placeholder="e.g. 2023" min="2000" max="2026"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm" />
                </div>
              </div>

              {imei && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded px-3 py-2">
                  ✓ IMEI provided — unlocks the "IMEI Verified" badge on your Health Card (boosts sell probability).
                </p>
              )}
              {lowBattery && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Battery below 80% — a "may need replacement" note will be added to the Health Card. This cannot be removed.
                </p>
              )}
            </div>
          )}

          {/* Step 3 — Details */}
          {mrp && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <h2 className="text-sm sm:text-base font-bold text-gray-800">Step 3 — Item details</h2>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Age, usage, accessories included…" rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm resize-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Condition notes
                  {gradeResult && <span className="text-[10px] text-blue-500 font-normal ml-1">(auto-filled by AI — edit if needed)</span>}
                </label>
                <textarea value={conditionSummary} onChange={(e) => setConditionSummary(e.target.value)}
                  placeholder="Note any scratches, dents, or missing parts honestly…" rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm resize-none" />
              </div>
            </div>
          )}

          {/* Step 4 — Pricing */}
          {mrp && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">Step 4 — Your asking price</h2>
              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-lg font-bold text-gray-500">₹</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00" min="1" step="0.01"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-base font-bold" />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {gradeResult
                  ? `Grade ${gradeResult.grade} detected — the EV optimiser suggests a fair price on publish (you can adjust ±30%).`
                  : 'Add the front photo to get an AI price suggestion.'}
              </p>
            </div>
          )}

          {/* Seller declaration */}
          {mrp && (
            <label className="flex items-start gap-3 bg-white rounded-lg shadow-sm p-4 cursor-pointer">
              <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[#FF9900] flex-shrink-0" />
              <span className="text-sm text-gray-700">
                I confirm this item is as described and I am its legal owner.
                <span className="text-gray-400"> (Logged with timestamp and your account ID.)</span>
              </span>
            </label>
          )}

          {/* Tier 3 SPN note */}
          {mrp && tier === 3 && (
            <div className="bg-[#ede9fe] border border-purple-200 rounded-lg p-3 sm:p-4 flex gap-3">
              <span className="text-xl sm:text-2xl">🔬</span>
              <div>
                <p className="font-semibold text-purple-800 text-xs sm:text-sm">Professional inspection required</p>
                <p className="text-xs text-purple-700 mt-1">
                  A Flex agent will be scheduled to deliver this to an Amazon SPN node for a full diagnostic
                  and a 90-day Health Card before it goes live — this typically raises your sale price 20–35%.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/')}
              className="flex-1 py-2.5 sm:py-3 border border-gray-300 rounded text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting || grading || !mrp}
              className={`flex-1 py-2.5 sm:py-3 rounded font-bold text-sm transition-colors
                ${submitting || grading || !mrp ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#febd69] hover:bg-[#f3a847] text-[#131921]'}`}>
              {submitLabel}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SellIt;
