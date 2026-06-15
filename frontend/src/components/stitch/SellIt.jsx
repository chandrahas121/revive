import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
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
  resell_p2p: { 
    label: 'Resell Nearby (P2P)', color: '#15803d', bg: '#dcfce7', 
    icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
  },
  resell_warehouse: { 
    label: 'Resell City-Wide', color: '#1d4ed8', bg: '#dbeafe', 
    icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
  },
  refurbish: { 
    label: 'Refurbish & Resell', color: '#7c3aed', bg: '#ede9fe', 
    icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
  },
  donate: { 
    label: 'Donate to NGO', color: '#b45309', bg: '#fef3c7', 
    icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
  },
  recycle: { 
    label: 'Responsible Recycling', color: '#6b7280', bg: '#f3f4f6', 
    icon: <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
  },
};

const GradePreview = ({ result, onDismiss }) => {
  const cfg = GRADE_CONFIG[result.grade] || GRADE_CONFIG.B;
  const numAngles = result.angle_heatmaps?.length || 1;
  return (
    <div className="border border-[#D5D9D9] rounded-lg overflow-hidden fade-in">
      <div className="flex items-center gap-3 px-4 py-3.5" style={{ backgroundColor: cfg.bg }}>
        <span className="w-10 h-10 rounded-xl text-white flex items-center justify-center text-xl font-black flex-shrink-0" style={{ backgroundColor: cfg.ring }}>
          {result.grade}
        </span>
        <div className="flex-grow min-w-0">
          <p className="font-bold" style={{ color: cfg.ring }}>AI Grade: {cfg.label}</p>
          <p className="text-xs opacity-70 mt-0.5" style={{ color: cfg.ring }}>
            {Math.round((result.confidence || 0) * 100)}% confidence · {numAngles} angle{numAngles > 1 ? 's' : ''} inspected
          </p>
        </div>
        <button onClick={onDismiss}
          className="w-7 h-7 rounded-full bg-white/60 hover:bg-white flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors"
          style={{ color: cfg.ring }}>✕</button>
      </div>

      {result.condition_summary && (
        <div className="px-4 py-3 border-t border-[#D5D9D9]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">AI Condition Notes</p>
          <p className="text-sm text-gray-700 leading-relaxed">{result.condition_summary}</p>
        </div>
      )}

      <ConditionChecks result={result} />

      {result.defects && result.defects.length > 0 && (
        <div className="px-4 py-3 border-t border-[#D5D9D9]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Defects</p>
          <div className="flex flex-wrap gap-2">
            {result.defects.map((d, i) => (
              <span key={i} className={`text-xs font-semibold px-3 py-1 rounded-full border
                ${d.severity === 'severe' || d.severity === 'major' ? 'bg-[#fbe5e3] text-[#b3261e] border-[#e8b4b0]'
                : d.severity === 'moderate' ? 'bg-[#fff8ec] text-[#d97706] border-[#f0d9a0]'
                : 'bg-[#fffae6] text-[#b45309] border-[#f0c040]'}`}>
                {d.type} · {d.severity}{d.angle_label ? ` · ${d.angle_label}` : ''}
              </span>
            ))}
          </div>
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
    <div className="px-4 py-3 border-t border-[#D5D9D9]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Condition checks</p>
      <div className="flex flex-wrap gap-2">
        {items.map(([k, label]) => (
          <span key={k} className={`text-xs font-semibold px-3 py-1 rounded-full border whitespace-nowrap
            ${result[k] ? 'bg-[#e6f4ea] text-[#107a45] border-[#a8d5b0]' : 'bg-[#fbe5e3] text-[#b3261e] border-[#e8b4b0]'}`}>
            {result[k] ? '✓' : '✕'} {label}
          </span>
        ))}
      </div>
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
    <div className="px-4 py-3 border-t border-[#D5D9D9] bg-[#F7F8F8]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
        Defect map · {maps.length} angle{maps.length > 1 ? 's' : ''} inspected
      </p>
      <div className="grid grid-cols-4 gap-2">
        {maps.map((m, i) => (
          <div key={i}>
            <div className="aspect-square rounded border border-[#D5D9D9] bg-white overflow-hidden">
              <img src={`data:image/jpeg;base64,${m.b64}`} alt={m.angle_label}
                className="w-full h-full object-cover" />
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-1 leading-tight">
              {m.angle_label}{m.n_defects ? ` · ${m.n_defects}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ListingSuccess = ({ listing, routeResult, tier, onViewListing }) => {
  const navigate = useNavigate();
  const tierInfo = TIER_INFO[tier];

  // Tier 3 — scheduled for professional SPN inspection, not instantly live
  if (tier === 3) {
    return (
      <div className="space-y-4 fade-up">
        {/* ── Success banner ── */}
        <div className="bg-[#131921] rounded-xl overflow-hidden mb-4 pop-in">
          <div className="px-5 py-6 sm:px-6 flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#febd69]/20 border-2 border-[#febd69] flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#febd69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white leading-tight">Professional Inspection Scheduled</h1>
              <p className="text-[#febd69]/80 text-xs sm:text-sm mt-1">A Flex agent will pick up your item within 24 hours</p>
            </div>
          </div>
          {/* progress bar */}
          <div className="px-5 sm:px-6 pb-5">
            <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/60 mb-2">
              <span className="text-white/90 font-semibold">Pickup scheduled</span>
              <div className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-[#febd69] rounded-full" style={{ width: '25%' }}></div>
              </div>
              <span>SPN diagnostic</span>
              <span>·</span>
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* ── Details card ── */}
        <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden mb-4">
          {/* item summary */}
          <div className="px-4 py-4 sm:px-5 border-b border-[#D5D9D9] flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#f7f7f7] border border-[#D5D9D9] overflow-hidden flex-shrink-0 flex items-center justify-center">
              {listing?.image ? (
                <img src={listing.image} className="w-full h-full object-cover" alt={listing?.product?.title} />
              ) : '📦'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#0F1111] text-xs sm:text-sm leading-tight">{listing?.product?.title || 'Unknown Item'}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Grade {listing?.grade || 'A'} · {listing?.product?.category || 'Item'}</p>
            </div>
            <div className="ml-auto flex-shrink-0 text-right">
              <p className="text-[10px] sm:text-xs text-gray-400">Asking price</p>
              <p className="font-bold text-[#0F1111]">₹{listing?.price?.toLocaleString('en-IN')}</p>
            </div>
          </div>

          {/* what happens next */}
          <div className="px-4 py-4 sm:px-5 border-b border-[#D5D9D9]">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">What happens next</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#0F1111]">Flex agent pickup</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Scheduled within 24 hours — you'll get an SMS with the slot.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#0F1111]">SPN full diagnostic</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Battery cycle count, IMEI & blacklist check, all sensors and ports tested, certified data wipe.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-xs sm:text-sm font-semibold text-[#0F1111]">90-day Health Card issued</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Your listing goes live with a Health Card — typically raises sale price by <strong className="text-[#0F1111]">20–35%</strong>.</p>
                </div>
              </div>
            </div>
          </div>

          {/* guarantee table */}
          <div className="px-4 py-4 sm:px-5">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Inspection details</p>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Guarantee</span>
                <span className="font-semibold text-[#0F1111]">{tierInfo.guarantee}</span>
              </div>
              <div className="border-t border-[#D5D9D9] pt-2 flex items-center justify-between">
                <span className="text-gray-500">Inspection by</span>
                <span className="font-semibold text-[#0F1111]">Amazon SPN partner</span>
              </div>
              <div className="border-t border-[#D5D9D9] pt-2 flex items-center justify-between">
                <span className="text-gray-500">Pickup window</span>
                <span className="font-semibold text-[#007600]">Within 24 hours</span>
              </div>
              <div className="border-t border-[#D5D9D9] pt-2 flex items-center justify-between">
                <span className="text-gray-500">Payment release</span>
                <span className="font-semibold text-[#0F1111]">On buyer delivery confirmation</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => (window.location.href = '/')}
            className="flex-1 py-3 rounded-lg text-sm font-bold text-[#131921] text-center shadow-sm active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #f0c040' }}>
            Back to Marketplace
          </button>
          <a href="/my-listings"
            className="flex-1 py-3 rounded-lg border border-[#D5D9D9] text-sm font-semibold text-[#0F1111] bg-white hover:bg-[#f0f2f2] text-center transition-colors block">
            View My Listings
          </a>
        </div>
      </div>
    );
  }

  // Tier 1 / Tier 2 — listed live
  const path = routeResult?.chosen_path;
  const pathCfg = PATH_CONFIG[path] || PATH_CONFIG.resell_p2p;
  const price = listing?.price || routeResult?.price;

  return (
    <div className="space-y-4 fade-up">
      {/* ── Success banner ── */}
      <div className="bg-[#131921] rounded-xl overflow-hidden mb-4 pop-in">
        <div className="px-5 py-6 sm:px-6 flex items-center gap-4 sm:gap-5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#febd69]/20 border-2 border-[#febd69] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-[#febd69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white leading-tight">Your item is live!</h1>
            <p className="text-[#febd69]/80 text-xs sm:text-sm mt-1">Keep it at home — we'll notify you the moment someone buys it</p>
          </div>
        </div>
        {/* progress bar */}
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-white/60 mb-2">
            <span>Listed</span>
            <div className="flex-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#febd69] rounded-full" style={{ width: '100%' }}></div>
            </div>
            <span className="text-[#febd69] font-semibold">Live</span>
          </div>
        </div>
      </div>

      {/* ── Details card ── */}
      <div className="bg-white border border-[#D5D9D9] rounded-xl overflow-hidden mb-4 shadow-sm">
        {/* item summary */}
        <div className="px-4 py-4 sm:px-5 border-b border-[#D5D9D9] flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-[#f7f7f7] border border-[#D5D9D9] overflow-hidden flex-shrink-0 flex items-center justify-center">
            {listing?.image ? (
              <img src={listing.image} className="w-full h-full object-cover" alt={listing?.product?.title} />
            ) : '📦'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#0F1111] text-xs sm:text-sm leading-tight">{listing?.product?.title || 'Unknown Item'}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">Grade {listing?.grade || 'A'} · {listing?.product?.category || 'Item'}</p>
          </div>
          <div className="ml-auto flex-shrink-0 text-right">
            <p className="text-[10px] sm:text-xs text-gray-400">Asking price</p>
            <p className="font-bold text-[#0F1111]">₹{price?.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* routing & badges */}
        <div className="px-4 py-4 sm:px-5 border-b border-[#D5D9D9]">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Fulfillment & Protection</p>
          
          {path && (
            <div className="flex items-center gap-3 p-3 rounded-lg border mb-3"
              style={{ borderColor: pathCfg.color + '40', background: pathCfg.bg }}>
              <span className="text-xl flex-shrink-0">{pathCfg.icon}</span>
              <div>
                <p className="font-black text-sm" style={{ color: pathCfg.color }}>{pathCfg.label}</p>
                {routeResult?.customer_message && (
                  <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 leading-relaxed">{routeResult.customer_message}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg p-3 text-center">
              <p className="text-sm font-black text-[#0F1111] leading-tight">{tierInfo.label}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Buyer protection</p>
            </div>
            <div className="bg-[#e6f4ea] border border-[#a8d5b0] rounded-lg p-3 text-center">
              <p className="text-sm font-black text-[#107a45] leading-tight">Instant Payout</p>
              <p className="text-[10px] text-[#107a45] mt-0.5">After return window</p>
            </div>
          </div>
        </div>

        {/* guarantee table */}
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Listing details</p>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Guarantee</span>
              <span className="font-semibold text-[#0F1111]">{tierInfo.guarantee}</span>
            </div>
            <div className="border-t border-[#D5D9D9] pt-2 flex items-center justify-between">
              <span className="text-gray-500">Inspection by</span>
              <span className="font-semibold text-[#0F1111]">{tier === 2 ? 'Flex agent at pickup' : 'AI only'}</span>
            </div>
            <div className="border-t border-[#D5D9D9] pt-2 flex items-center justify-between items-start">
              <span className="text-gray-500">Payment release</span>
              <span className="font-semibold text-[#0F1111] text-right">
                UPI transfer after buyer return window closes
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onViewListing}
          className="flex-1 py-3 rounded-lg text-sm font-bold text-[#131921] text-center shadow-sm active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #f0c040' }}>
          View Your Listing
        </button>
        <button onClick={() => (window.location.href = '/')}
          className="flex-1 py-3 rounded-lg border border-[#D5D9D9] text-sm font-semibold text-[#0F1111] bg-white hover:bg-[#f0f2f2] text-center transition-colors">
          Marketplace
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
  const tier = getTier(mrp);
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
    if (!mrp)           { fail('Original price is required — it determines the inspection tier.'); return; }
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
      <div className="min-h-screen bg-[#eaeded]">
        <Header />
        <main className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
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

  return (
    <div className="min-h-screen bg-[#eaeded] text-[#0F1111]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6">

        {/* back nav */}
        <a href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F1111] bg-white border border-[#D5D9D9] rounded-lg px-3 py-1.5 hover:bg-[#f0f2f2] hover:border-[#565959] transition-colors mb-5 shadow-sm">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
          Back to Marketplace
        </a>

        {/* page title */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Sell Unused Item</h1>
          <p className="text-sm text-gray-500 mt-1">List your item on Amazon Revive — AI-verified, buyer-protected.</p>
        </div>

        {/* step progress */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg px-6 py-4 mb-5">
          <div className="flex items-start">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-sm font-black">1</div>
              <p className="text-[10px] font-semibold text-[#131921] mt-1 text-center whitespace-nowrap">Item Info</p>
            </div>
            <div className="flex-1 h-0.5 mt-4 mx-2" style={{ backgroundColor: mrp ? '#131921' : '#D5D9D9' }}></div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${mrp ? 'bg-[#131921] text-[#febd69]' : 'bg-[#f7f8f8] text-gray-400 border border-[#D5D9D9]'}`}>2</div>
              <p className={`text-[10px] font-semibold mt-1 text-center whitespace-nowrap ${mrp ? 'text-[#131921]' : 'text-gray-400'}`}>Photos</p>
            </div>
            <div className="flex-1 h-0.5 mt-4 mx-2" style={{ backgroundColor: gradeResult ? '#131921' : '#D5D9D9' }}></div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${gradeResult ? 'bg-[#131921] text-[#febd69]' : 'bg-[#f7f8f8] text-gray-400 border border-[#D5D9D9]'}`}>3</div>
              <p className={`text-[10px] font-semibold mt-1 text-center whitespace-nowrap ${gradeResult ? 'text-[#131921]' : 'text-gray-400'}`}>Details</p>
            </div>
            <div className="flex-1 h-0.5 mt-4 mx-2" style={{ backgroundColor: gradeResult ? '#FF9900' : '#D5D9D9' }}></div>
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${gradeResult ? 'bg-[#FF9900] text-white' : 'bg-[#f7f8f8] text-gray-400 border border-[#D5D9D9]'}`}>4</div>
              <p className={`text-[10px] font-semibold mt-1 text-center whitespace-nowrap ${gradeResult ? 'text-[#FF9900]' : 'text-gray-400'}`}>Price</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-[#fbe5e3] border border-[#e8b4b0] rounded-lg text-[#b3261e] text-sm font-medium fade-in">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Step 1 — What are you selling? ── */}
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#D5D9D9]">
              <span className="w-7 h-7 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-sm font-black flex-shrink-0">1</span>
              <h2 className="text-base font-bold">What are you selling?</h2>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">Product name <span className="text-[#b3261e]">*</span></label>
              <input type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony WH-1000XM4 Wireless Headphones"
                className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900] transition-colors" />
              <p className="mt-1.5 text-xs text-gray-400">Just type it in — no catalogue match needed.</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 text-sm font-semibold rounded border transition-colors whitespace-nowrap
                      ${category === c ? 'bg-[#131921] text-[#febd69] border-[#131921]' : 'bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#565959]'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-1.5">
                Original price (MRP) <span className="text-[#b3261e]">*</span>
                <span className="text-gray-400 font-normal text-xs ml-1">— sets your inspection tier</span>
              </label>
              <div className="flex items-center border border-[#D5D9D9] rounded bg-white overflow-hidden transition-colors focus-within:ring-2 focus-within:ring-[#FF9900] focus-within:border-[#FF9900]">
                <span className="px-3 py-2.5 text-sm font-semibold text-gray-500 bg-[#F7F8F8] border-r border-[#D5D9D9] select-none">₹</span>
                <input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)}
                  placeholder="0" min="0" step="0.01"
                  className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none" />
              </div>
            </div>

            {mrp && (
              <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-4 transition-all fade-in" style={{ background: tierInfo.bg, border: `1px solid ${tierInfo.color}40` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: tierInfo.color }}>Buyer protection</p>
                  <p className="text-xs mt-0.5" style={{ color: tierInfo.color + '99' }}>{tierInfo.inspection}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap flex-shrink-0" style={{ background: tierInfo.color + '18', color: tierInfo.color, border: `1px solid ${tierInfo.color}30` }}>
                  {tierInfo.guarantee}
                </span>
              </div>
            )}
          </div>

          {/* ── Step 2 — Photos ── */}
          {mrp && (
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 fade-up">
              <div className="flex items-start gap-3 mb-4 pb-4 border-b border-[#D5D9D9]">
                <span className="w-7 h-7 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5">2</span>
                <div>
                  <h2 className="text-base font-bold">Photos <span className="text-sm font-normal text-gray-400 ml-1">({category} — {prompts.filter(p => p.required).length} required)</span></h2>
                  <p className="text-xs text-gray-500 mt-0.5">Grading as <strong className="text-[#0F1111]">{category}</strong> — upload all required angles, then tap <strong>Grade my item</strong>.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mb-4">
                {prompts.map((slot) => {
                  const isFilled = !!previews[slot.key];
                  return (
                    <div key={slot.key}>
                      <input
                        ref={(el) => (slotInputs.current[slot.key] = el)}
                        type="file" accept="image/*" className="hidden"
                        onChange={(e) => handleSlotUpload(slot.key, e.target.files[0])}
                      />
                      <button type="button" onClick={() => slotInputs.current[slot.key]?.click()}
                        className={`relative w-full aspect-square rounded-lg overflow-hidden flex flex-col items-center justify-center gap-1 text-center transition-colors
                          ${isFilled ? 'border-2 border-[#FF9900]' : 'border-2 border-dashed border-[#D5D9D9] hover:border-[#FF9900] bg-[#f7f8f8]'}`}>
                        {isFilled ? (
                          <>
                            <img src={previews[slot.key]} alt={slot.label} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20"></div>
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF9900] flex items-center justify-center shadow-sm">
                              <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                            </div>
                            <span className="relative text-[11px] font-bold text-white drop-shadow-sm leading-tight px-1 text-center">{slot.label}</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-6 h-6 text-gray-300 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span className="text-[11px] font-semibold text-gray-500 leading-tight px-1">{slot.label}{slot.required && <span className="text-red-400">*</span>}</span>
                            <span className="text-[10px] text-gray-400 leading-tight px-1">{slot.hint}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mb-4">
                {!gradeResult && (
                  <button type="button" onClick={runGradingMulti} disabled={!canGrade || grading}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors
                      ${canGrade && !grading ? 'bg-[#131921] text-[#febd69] border border-[#3d5166] hover:bg-[#1a2a3a]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    Grade my item
                  </button>
                )}
                {gradeResult && (
                  <button type="button" onClick={runGradingMulti} disabled={!canGrade || grading}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-white border border-[#D5D9D9] text-[#0F1111] hover:border-[#565959] transition-colors">
                    Re-grade
                  </button>
                )}
                {!canGrade && (
                  <span className="text-xs text-amber-600">
                    Add required photos: {missingRequired.join(', ')}
                  </span>
                )}
              </div>

              {grading && (
                <div className="flex items-center gap-2.5 text-sm bg-[#EBF5FB] border border-[#AED6F1] rounded-lg px-3 py-2.5 mb-4">
                  <span className="w-4 h-4 border-2 border-[#6fa8da] border-t-transparent rounded-full animate-spin flex-shrink-0"></span>
                  <span className="text-[#2d6da0]">AI is analysing your photos — detecting defects and grading condition…</span>
                </div>
              )}
              {gradeError && <p className="mb-4 text-xs text-amber-600">{gradeError}</p>}
              {gradeResult && !grading && <GradePreview result={gradeResult} onDismiss={() => setGradeResult(null)} />}
            </div>
          )}

          {/* ── Step 2b — Device details (electronics only) ── */}
          {mrp && electronics && (
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 fade-up">
              <h2 className="text-base font-bold mb-4">
                Device details
                <span className="text-gray-400 font-normal text-xs ml-1">(required for electronics)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {hasBattery && (
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">
                      Battery health %<span className="text-[#b3261e]"> *</span>
                    </label>
                    <input type="number" value={batteryPct} onChange={(e) => setBatteryPct(e.target.value)}
                      placeholder="e.g. 91" min="0" max="100"
                      className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900]" />
                  </div>
                )}
                {hasBattery && (
                  <div>
                    <label className="block text-sm font-semibold mb-1.5">
                      IMEI <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input type="text" value={imei} onChange={(e) => setImei(e.target.value)}
                      placeholder="*#06# to find it"
                      className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900]" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold mb-1.5">Purchase year</label>
                  <input type="number" value={purchaseYear} onChange={(e) => setPurchaseYear(e.target.value)}
                    placeholder="e.g. 2023" min="2000" max="2026"
                    className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900]" />
                </div>
              </div>

              {imei && (
                <p className="mt-4 text-xs text-[#107a45] bg-[#e6f4ea] border border-[#a8d5b0] rounded px-3 py-2">
                  ✓ IMEI provided — unlocks the "IMEI Verified" badge on your Health Card (boosts sell probability).
                </p>
              )}
              {lowBattery && (
                <p className="mt-4 text-xs text-[#b45309] bg-[#fffae6] border border-[#f0c040] rounded px-3 py-2">
                  Battery below 80% — a "may need replacement" note will be added to the Health Card. This cannot be removed.
                </p>
              )}
            </div>
          )}

          {/* ── Step 3 — Item Details ── */}
          {mrp && gradeResult && (
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 fade-up">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#D5D9D9]">
                <span className="w-7 h-7 rounded-full bg-[#131921] text-[#febd69] flex items-center justify-center text-sm font-black flex-shrink-0">3</span>
                <h2 className="text-base font-bold">Item Details</h2>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Age, usage, accessories included..." rows={3}
                  className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900]" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Condition notes
                  <span className="text-[#007185] text-xs font-normal ml-1">(auto-filled by AI — edit if needed)</span>
                </label>
                <textarea value={conditionSummary} onChange={(e) => setConditionSummary(e.target.value)}
                  placeholder="Note any scratches, dents, or missing parts honestly…" rows={4}
                  className="w-full px-3 py-2.5 border border-[#D5D9D9] rounded text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-[#FF9900] focus:border-[#FF9900]" />
              </div>
            </div>
          )}

          {/* ── Step 4 — Asking price ── */}
          {mrp && gradeResult && (
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 mb-4 fade-up">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[#D5D9D9]">
                <span className="w-7 h-7 rounded-full bg-[#FF9900] text-white flex items-center justify-center text-sm font-black flex-shrink-0">4</span>
                <h2 className="text-base font-bold">Your asking price</h2>
              </div>

              {suggestedPrice && (
                <div className="bg-[#FFFBF0] border border-[#f0d9a0] rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500">AI suggested resale price — based on grade <strong className="text-[#0F1111]">{gradeResult.grade}</strong></p>
                    <p className="text-2xl font-bold text-[#0F1111] mt-0.5">₹{suggestedPrice.toLocaleString('en-IN')}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#107a45] text-white whitespace-nowrap flex-shrink-0">Grade {gradeResult.grade}</span>
                </div>
              )}

              <div className="flex items-center border border-[#D5D9D9] rounded bg-white overflow-hidden mb-2 transition-colors focus-within:ring-2 focus-within:ring-[#FF9900] focus-within:border-[#FF9900]">
                <span className="px-3 py-2.5 text-sm font-semibold text-gray-500 bg-[#F7F8F8] border-r border-[#D5D9D9] select-none">₹</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
                  min={priceBand ? priceBand[0] : 1}
                  max={priceBand ? priceBand[1] : undefined} step="1"
                  className="flex-1 px-3 py-2.5 text-base font-bold bg-white focus:outline-none" />
              </div>
              <p className="text-xs text-gray-400">
                {priceBand
                  ? <>You can adjust between <span className="font-semibold text-[#0F1111]">₹{priceBand[0].toLocaleString('en-IN')}</span> and <span className="font-semibold text-[#0F1111]">₹{priceBand[1].toLocaleString('en-IN')}</span> (±20%).</>
                  : 'Price set from the AI grade.'}
              </p>
            </div>
          )}

          {/* ── Legal confirm ── */}
          {mrp && gradeResult && (
            <div className="bg-white border border-[#D5D9D9] rounded-lg px-5 py-4 mb-4 flex items-start gap-3 fade-up">
              <input type="checkbox" id="legal" checked={declared} onChange={(e) => setDeclared(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#D5D9D9] flex-shrink-0 cursor-pointer" style={{ accentColor: '#FF9900' }} />
              <label htmlFor="legal" className="text-sm text-[#0F1111] cursor-pointer leading-relaxed select-none">
                I confirm this item is as described and I am its legal owner.
                <span className="text-gray-400"> (Logged with timestamp and your account ID.)</span>
              </label>
            </div>
          )}

          {/* ── Professional inspection notice ── */}
          {mrp && gradeResult && tier === 3 && (
            <div className="bg-[#f0f4f9] border border-[#c5d0e0] rounded-lg px-4 py-4 mb-6 flex items-start gap-3 fade-up">
              <div className="w-10 h-10 rounded-lg bg-[#131921] flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#febd69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="6"/><path d="m21 21-4.3-4.3" strokeLinecap="round"/></svg>
              </div>
              <div>
                <p className="text-sm font-bold text-[#131921]">Professional inspection required</p>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">A Flex agent will be scheduled to deliver this to an Amazon SPN node for a full diagnostic and a 90-day Health Card before it goes live — this typically raises your sale price <strong className="text-[#131921]">20–35%</strong>.</p>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {mrp && gradeResult && (
            <div className="flex gap-3 fade-up">
              <a href="/" className="flex-1 py-3 rounded-lg border border-[#D5D9D9] text-sm font-semibold text-[#0F1111] bg-white hover:bg-[#f0f2f2] text-center transition-colors">Cancel</a>
              <button type="submit" disabled={submitting || grading}
                className={`flex-1 py-3 rounded-lg text-sm font-bold text-[#131921] text-center shadow-sm active:scale-95 transition-transform
                  ${submitting || grading ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #f0c040' }}>
                {submitting ? 'Publishing…' : tier === 3 ? 'Schedule Professional Inspection' : 'Publish Listing'}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  );
};

export default SellIt;
