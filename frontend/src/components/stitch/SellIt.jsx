import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import api, { generateHealthCard } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { getTier, TIER_INFO, TIER_PHOTO_PROMPTS } from '../../utils/tier';
// v2: photo prompts come from the CATEGORY profile, not the price tier (Q1/Q7).
import { capturePrompts, isElectronics, SELLABLE_CATEGORIES } from '../../utils/categoryProfiles';

// Free-form sell: the seller types the product name + original price (no catalogue).
// Categories map 1:1 to the capture/grading profiles.
const CATEGORIES = SELLABLE_CATEGORIES;

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

      <ConditionChecks result={result} />

      {result.defects && result.defects.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t flex flex-wrap gap-1.5">
          {result.defects.slice(0, 6).map((d, i) => (
            <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
              ${d.severity === 'severe' || d.severity === 'major' ? 'bg-red-50 text-red-700 border-red-200'
              : d.severity === 'moderate' ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {d.type} · {d.severity}{d.angle_label ? ` · ${d.angle_label}` : ''}
            </span>
          ))}
        </div>
      )}

      <AngleDefectMaps result={result} />
    </div>
  );
};

// Category condition checks the grader confirmed across angles (tags / box / powers-on / accessories).
const ConditionChecks = ({ result }) => {
  const items = [
    ['tags_present', 'Original tags'],
    ['box_present', 'Original box'],
    ['powers_on', 'Powers on'],
    ['accessories_present', 'Accessories'],
  ].filter(([k]) => result[k] === true || result[k] === false);
  if (!items.length) return null;
  return (
    <div className="px-3 py-2 bg-white border-t flex flex-wrap gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1 self-center">Condition checks</span>
      {items.map(([k, label]) => (
        <span key={k} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
          ${result[k] ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {result[k] ? '✓' : '✕'} {label}
        </span>
      ))}
    </div>
  );
};

// Per-angle defect maps — proves every angle was inspected, not just the cover.
const AngleDefectMaps = ({ result }) => {
  const maps = result.angle_heatmaps && result.angle_heatmaps.length
    ? result.angle_heatmaps
    : (result.heatmap_b64 ? [{ angle_label: 'Item', b64: result.heatmap_b64, n_defects: (result.defects || []).length }] : []);
  if (!maps.length) return null;
  return (
    <div className="px-3 py-2 bg-gray-50 border-t">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
        Defect map · {maps.length} angle{maps.length > 1 ? 's' : ''} inspected
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {maps.map((m, i) => (
          <div key={i} className="flex-shrink-0 w-28">
            <img src={`data:image/jpeg;base64,${m.b64}`} alt={m.angle_label}
              className="w-28 h-28 rounded object-cover border border-gray-200" />
            <p className="text-[9px] text-center text-gray-500 mt-0.5 truncate">
              {m.angle_label}{m.n_defects ? ` · ${m.n_defects}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Success screen — tier-aware. Sellers get money, NOT credits (final_idea Rule 4).
const ListingSuccess = ({ listing, routeResult, tier, onViewListing }) => {
  const tierInfo = TIER_INFO[tier];
  // The refurbish + listing status is the "advanced" stage — it only makes sense once
  // the agent has actually collected the item. So after publishing we first show the
  // regular "agent pickup scheduled" state and reveal that status only after pickup.
  const [pickupDone, setPickupDone] = useState(false);

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
  const price = listing?.price || routeResult?.price;   // the actual listed (seller-adjusted) price
  const needsRefurb = path === 'refurbish';

  // ── Stage 1 — agent pickup scheduled (regular flow, before any status) ─────────
  if (!pickupDone) {
    return (
      <div className="space-y-4">
        <div className="bg-[#232F3E] rounded-lg px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center text-xl">🚚</div>
            <div>
              <p className="font-black text-lg">Agent pickup scheduled</p>
              <p className="text-gray-300 text-xs mt-0.5">An Amazon agent will collect your item from your doorstep in 1–2 days</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 shadow-sm space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
              {listing?.image ? <img src={listing.image} alt="" className="w-full h-full object-contain" /> : '📦'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#0F1111] leading-snug line-clamp-1">{listing?.title || 'Your item'}</p>
              <p className="text-xs text-gray-500">Pickup window · 1–2 days · {tierInfo.label}</p>
            </div>
          </div>
          <p className="text-gray-600 leading-relaxed border-t border-[#f0f0f0] pt-3">
            Once the agent collects and verifies it, we'll {needsRefurb ? 'send it for refurbishment and then' : ''} list
            it on Revive and show you its live status here. You'll get a UPI transfer after the buyer's return window closes.
          </p>
        </div>

        <div className="flex gap-3">
          {/* Demo control: simulate the agent completing the pickup. */}
          <button onClick={() => setPickupDone(true)}
            className="flex-1 py-3 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold text-sm rounded-lg">
            Agent collected the item →
          </button>
          <button onClick={() => (window.location.href = '/')}
            className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50">
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  // ── Stage 2 — pickup done → refurbish + listing status ─────────────────────────
  return (
    <div className="space-y-4">
      <div className="bg-green-600 rounded-lg px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">✓</div>
          <div>
            <p className="font-black text-lg">{needsRefurb ? 'Picked up — refurbishment in progress' : 'Picked up — your item is live!'}</p>
            <p className="text-green-100 text-xs mt-0.5">
              {needsRefurb
                ? 'It will list on Revive as soon as refurbishment completes'
                : 'We\'ll notify you the moment someone buys it'}
            </p>
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
  const [category, setCategory] = useState('Phone');
  const [mrp, setMrp] = useState('');            // original / retail price (typed by seller)
  const [price, setPrice] = useState('');         // asking price (model-suggested, adjustable ±20%)
  // After grading, the trained price model suggests a resale price (no catalogue).
  const [suggestedPrice, setSuggestedPrice] = useState(null);
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

  // Risk tier (value-based) still drives guarantee/inspection wording, but is
  // NOT shown to the customer as "Tier N" (Q5). Photo prompts are category-driven.
  // Tier follows the actual SELLING price (current value), not the original MRP —
  // before grading there's no price yet, so we fall back to the MRP as an estimate.
  const tier = getTier(price || suggestedPrice || mrp);
  const tierInfo = TIER_INFO[tier];
  const electronics = isElectronics(category);
  const hasBattery = category === 'Phone' || category === 'Laptop';   // monitors have no battery/IMEI
  const prompts = capturePrompts(category);
  const coverFile = photoSlots.front || Object.values(photoSlots)[0] || null;

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  // Price band: the seller may adjust the model's suggested resale price ±20%.
  const priceBand = suggestedPrice
    ? [Math.round(suggestedPrice * 0.8), Math.round(suggestedPrice * 1.2)]
    : null;

  // v2 (point 2): which required angles are still missing for this category.
  const requiredKeys = prompts.filter((p) => p.required).map((p) => p.key);
  const missingRequired = requiredKeys.filter((k) => !photoSlots[k]);
  const canGrade = missingRequired.length === 0;

  // Grade the FULL set of uploaded photos (not just the front image).
  const runGradingMulti = async () => {
    if (!canGrade) {
      setGradeError(`Please add all required photos first: ${missingRequired.join(', ')}`);
      return;
    }
    setGrading(true);
    setGradeResult(null);
    setGradeError('');
    try {
      const fd = new FormData();
      // Send every captured angle WITH its slot key, so the grader inspects the
      // right thing per photo (soles/tag/screen-on) and the defect map is per-angle.
      const ordered = Object.entries(photoSlots).sort(([a], [b]) =>
        (a === 'front' ? -1 : b === 'front' ? 1 : 0));
      ordered.forEach(([slotKey, file]) => { fd.append('images', file); fd.append('slots', slotKey); });
      fd.append('category', category);
      fd.append('operator', 'seller');
      fd.append('skip_match', 'true');   // seller's own item — no fraud/instance gate
      fd.append('expected_title', title.trim());      // feeds the trained price model's text
      fd.append('mrp', mrp || '0');                    // original price → resale price anchor
      fd.append('geohash5', 'tbxx1');                  // demo location for the demand signal
      const res = await api.post('/api/grade/inspect/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // The endpoint can return a non-grade gate response (mismatch / duplicate photos)
      // with no `grade` field. Never render that as a fake "B / 0%" card — surface it.
      if (!res.data?.grade) {
        setGradeError(res.data?.message
          || 'AI could not grade these photos — please retake clear, well-lit angles and try again.');
        return;
      }
      setGradeResult(res.data);
      if (!conditionSummary && res.data.condition_summary) setConditionSummary(res.data.condition_summary);
      // The trained model (+ per-defect deductions) returns a resale price via route.price.
      const modelPrice = res.data?.route?.price;
      if (modelPrice && modelPrice > 0) {
        const rounded = Math.round(modelPrice);
        setSuggestedPrice(rounded);
        setPrice(String(rounded));                     // pre-fill; seller adjusts ±20%
      }
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
    // v2: do NOT grade per-image; the user grades the whole set once all required
    // angles are uploaded (see the "Grade my item" button).
    setGradeResult(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Surface validation failures where the user is looking (next to the button),
    // not just at the top of a long form — a silent block looked like "nothing happens".
    const fail = (msg) => { setError(msg); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} };
    if (!title.trim())  { fail('Please add a title.'); return; }
    if (!mrp)           { fail('Original price is required — it anchors the AI price estimate.'); return; }
    if (!price)         { fail('Asking price is required.'); return; }
    if (parseFloat(price) <= 0) { fail('Asking price must be greater than 0.'); return; }
    if (missingRequired.length) { fail(`Please add all required photos: ${missingRequired.join(', ')}`); return; }
    if (!gradeResult)   { fail('Please tap "Grade my item" so the AI can assess all your photos first.'); return; }
    if (hasBattery && tier >= 2 && !batteryPct) { fail('Battery health is required for phones and laptops.'); return; }
    if (!declared)      { fail('Please confirm the ownership & condition declaration.'); return; }

    // Keep the asking price within ±20% of the model's suggested resale price.
    let finalPrice = parseFloat(price);
    if (priceBand) {
      finalPrice = Math.min(priceBand[1], Math.max(priceBand[0], finalPrice));
    }

    try {
      setSubmitting(true);
      setError('');

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('price', String(finalPrice));
      formData.append('mrp', mrp);
      formData.append('condition_summary', conditionSummary.trim());
      formData.append('image', coverFile);
      // v2 (point 2): reuse the multi-image grade instead of re-grading one image
      if (gradeResult?.grade) {
        formData.append('grade_override', gradeResult.grade);
        formData.append('completeness_override', String(gradeResult.completeness ?? 1.0));
      }

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

  const lowBattery = electronics && batteryPct && parseInt(batteryPct, 10) < 80;
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
              <input type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony WH-1000XM4 Wireless Headphones"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-sm" />
              <p className="mt-1 text-[11px] text-gray-400">Just type it in — no catalogue match needed.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button"
                    onClick={() => { setCategory(c); }}
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
                <span className="text-gray-400 font-normal ml-1">— helps the AI price your item</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-500">₹</span>
                <input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)}
                  placeholder="0.00" min="1" step="0.01"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-base" />
              </div>
            </div>

            {/* v2: buyer-protection badge — guarantee + inspection only, NO "Tier N" (Q5) */}
            {mrp && (
              <div className="rounded-lg p-3 border" style={{ background: tierInfo.bg, borderColor: tierInfo.color + '40' }}>
                <div className="flex items-center justify-between">
                  <p className="font-black text-sm" style={{ color: tierInfo.color }}>Buyer protection</p>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70" style={{ color: tierInfo.color }}>
                    {tierInfo.guarantee}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{tierInfo.inspection}</p>
              </div>
            )}
          </div>

          {/* Step 2 — Tier-specific guided photos */}
          {mrp && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
                Step 2 — Photos <span className="text-gray-400 font-normal text-xs">({category} — {prompts.filter(p => p.required).length} required)</span>
              </h2>
              <p className="text-xs text-gray-400 mb-3">
                Grading as <span className="font-semibold text-[#232F3E]">{category}</span> — upload all required angles, then tap <b>Grade my item</b>.
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

              {/* v2 (point 2): grade the whole set; gated on all required angles */}
              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={runGradingMulti} disabled={!canGrade || grading}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors
                    ${canGrade && !grading ? 'bg-[#232F3E] text-[#febd69] hover:opacity-90' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  {grading ? 'Grading…' : gradeResult ? 'Re-grade' : 'Grade my item'}
                </button>
                {!canGrade && (
                  <span className="text-xs text-amber-600">
                    Add required photos: {missingRequired.join(', ')}
                  </span>
                )}
                {canGrade && !gradeResult && !grading && (
                  <span className="text-xs text-gray-400">All required photos added — ready to grade.</span>
                )}
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

          {/* Step 2b — functional details (electronics only — v2 Q7: a shoe never sees this) */}
          {mrp && electronics && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
              <h2 className="text-sm sm:text-base font-bold text-gray-800">
                Step 2b — Device details
                <span className="text-gray-400 font-normal text-xs ml-1">(required for electronics)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {hasBattery && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      Battery health %<span className="text-red-500"> *</span>
                    </label>
                    <input type="number" value={batteryPct} onChange={(e) => setBatteryPct(e.target.value)}
                      placeholder="e.g. 91" min="0" max="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm" />
                  </div>
                )}
                {hasBattery && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      IMEI <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={imei} onChange={(e) => setImei(e.target.value)}
                      placeholder="*#06# to find it"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm" />
                  </div>
                )}
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

          {/* Step 4 — Pricing (trained model suggests resale price after grading) */}
          {mrp && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">Step 4 — Your asking price</h2>

              {suggestedPrice && (
                <div className="mb-3 rounded-lg border border-[#febd69]/60 bg-[#fff8ec] px-3 py-2.5">
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold text-[#232F3E]">AI suggested resale price</span>
                    {gradeResult && <> — based on grade <b>{gradeResult.grade}</b>
                      {gradeResult.defects?.length ? ` + ${gradeResult.defects.length} defect(s)` : ''}</>}
                  </p>
                  <p className="text-2xl font-black text-[#0F1111] mt-0.5">₹{suggestedPrice.toLocaleString('en-IN')}</p>
                </div>
              )}

              <div className="flex items-center gap-2 max-w-xs">
                <span className="text-lg font-bold text-gray-500">₹</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  min={priceBand ? priceBand[0] : 1}
                  max={priceBand ? priceBand[1] : undefined}
                  step="1"
                  className="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-base font-bold" />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {!gradeResult
                  ? 'Grade your item first (Step 2) to get a trained-model price suggestion.'
                  : priceBand
                    ? `You can adjust between ₹${priceBand[0].toLocaleString('en-IN')} and ₹${priceBand[1].toLocaleString('en-IN')} (±20%).`
                    : 'Price set from the AI grade.'}
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
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
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
