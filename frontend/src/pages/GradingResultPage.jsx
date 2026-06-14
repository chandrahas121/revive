import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';

// Tier system: grade → routing path (Pillar 2 EV optimizer logic)
const TIER_MAP = {
  A: {
    label: 'Like New',
    desc: 'No visible defects — all accessories present.',
    route: 'Local Resale (P2P)',
    routeColor: '#15803d',
    routeBg: '#dcfce7',
    routeDesc: 'Best EV: sell to a verified buyer near you via Amazon Revive.',
    ev: 3200,
    refundPct: 1.0,
    ring: '#16a34a',
    gradeBg: '#dcfce7',
    score: 95,
  },
  B: {
    label: 'Very Good',
    desc: 'Light cosmetic wear only — fully functional.',
    route: 'Local Resale',
    routeColor: '#15803d',
    routeBg: '#dcfce7',
    routeDesc: 'Best EV: list on marketplace — strong local demand for this category.',
    ev: 1840,
    refundPct: 0.9,
    ring: '#d97706',
    gradeBg: '#fef3c7',
    score: 78,
  },
  C: {
    label: 'Good',
    desc: 'Visible defects but fully functional.',
    route: 'Refurbish',
    routeColor: '#1d4ed8',
    routeBg: '#dbeafe',
    routeDesc: 'EV routing: send to Amazon Refurb centre — repair cost < resale uplift.',
    ev: 890,
    refundPct: 0.75,
    ring: '#ea580c',
    gradeBg: '#ffedd5',
    score: 55,
  },
  D: {
    label: 'Acceptable',
    desc: 'Heavy wear or significant missing parts.',
    route: 'Donate / Recycle',
    routeColor: '#6b7280',
    routeBg: '#f3f4f6',
    routeDesc: 'EV optimizer: resale value below logistics cost — donate to partner NGO.',
    ev: 0,
    refundPct: 0.5,
    ring: '#dc2626',
    gradeBg: '#fee2e2',
    score: 30,
  },
};

const CIRCUMFERENCE = 2 * Math.PI * 36;

const GradingResultPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { order, reason, handover } = location.state || {};

  // Simulate grade B for demo (Pillar 1 — in real flow this comes from ml.grade_image)
  const grade = 'B';
  const tier = TIER_MAP[grade];
  const refundAmount = order?.listing_price
    ? Math.round(parseFloat(order.listing_price) * tier.refundPct)
    : 312;

  const [phase, setPhase] = useState('scanning'); // scanning → revealed
  const [showRoute, setShowRoute] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    // Simulate agent scan progress bar
    let p = 0;
    const tick = setInterval(() => {
      p += 4;
      setScanProgress(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(tick);
        setTimeout(() => {
          setPhase('revealed');
          setTimeout(() => setShowRoute(true), 500);
          setTimeout(() => setShowRefund(true), 1000);
          setTimeout(() => setShowImpact(true), 1500);
        }, 300);
      }
    }, 55);
    return () => clearInterval(tick);
  }, []);

  const filled = (tier.score / 100) * CIRCUMFERENCE;

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        <button
          onClick={() => navigate('/orders')}
          className="text-[#007185] hover:underline text-sm mb-4 inline-flex items-center gap-1"
        >
          ← Back to Your Orders
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111] mb-1">AI Grading Result</h1>
        <p className="text-sm text-gray-500 mb-5">
          {handover === 'hub' ? 'Amazon Hub agent scan' : 'Doorstep agent scan'} ·{' '}
          Return reason: <span className="text-[#0F1111] font-medium">{reason || '—'}</span>
        </p>

        {/* ── SCANNING PHASE ── */}
        {phase === 'scanning' && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-8 text-center shadow-sm">
            <div className="flex justify-center mb-4">
              <svg className="w-10 h-10 text-[#FF9900] animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
            <p className="font-bold text-[#0F1111] text-lg mb-1">AI scanning your item…</p>
            <p className="text-sm text-gray-500 mb-5">
              Grounding DINO + CLIP + Vision LLM · usually under 2 seconds
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mb-2">
              <div
                className="h-full bg-[#FF9900] rounded-full transition-all duration-100"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">{scanProgress}% — detecting defects, checking completeness</p>
          </div>
        )}

        {/* ── RESULT PHASE ── */}
        {phase === 'revealed' && (
          <div className="space-y-4">

            {/* Grade card */}
            <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
              <div className="bg-[#232F3E] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#febd69] font-bold text-sm">AI Grade Result</span>
                <span className="text-xs text-gray-400">1.4s · Pillar 1</span>
              </div>
              <div className="p-5 flex items-center gap-6">
                {/* Grade ring */}
                <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="36" fill="none"
                      stroke={tier.ring}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
                      style={{ transition: 'stroke-dasharray 0.8s ease' }}
                    />
                  </svg>
                  <div
                    className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-3xl shadow"
                    style={{ background: tier.gradeBg, color: tier.ring }}
                  >
                    {grade}
                  </div>
                </div>

                <div>
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-0.5"
                    style={{ color: tier.ring }}
                  >
                    {tier.label}
                  </p>
                  <p className="text-[#0F1111] font-semibold text-base">{tier.desc}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Confidence: <strong className="text-[#0F1111]">88%</strong> · 0 manual review flags
                  </p>
                </div>
              </div>

              {/* Grade tier scale */}
              <div className="border-t border-[#f0f0f0] px-4 py-3 bg-[#F7F8F8]">
                <p className="text-[10px] text-gray-400 mb-2 font-bold uppercase tracking-widest">Grade Scale</p>
                <div className="flex gap-1">
                  {['A', 'B', 'C', 'D'].map((g) => (
                    <div
                      key={g}
                      className={`flex-1 rounded-md py-2 text-center text-[11px] font-bold transition-all
                        ${g === grade ? 'ring-2 shadow-sm' : 'opacity-35'}`}
                      style={{
                        background: TIER_MAP[g].gradeBg,
                        color: TIER_MAP[g].ring,
                        ringColor: g === grade ? TIER_MAP[g].ring : 'transparent',
                        outline: g === grade ? `2px solid ${TIER_MAP[g].ring}` : 'none',
                      }}
                    >
                      <div className="text-base font-black leading-none mb-0.5">{g}</div>
                      <div className="text-[9px] font-semibold opacity-80">{TIER_MAP[g].label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Routing decision */}
            <div className={`transition-all duration-500 ${showRoute ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
                <div className="bg-[#232F3E] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[#febd69] font-bold text-sm">AI Routing Decision</span>
                  <span className="text-xs text-gray-400">EV Optimizer · Pillar 2</span>
                </div>
                <div className="p-4 sm:p-5">
                  {/* Chosen path */}
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg border-2 mb-4"
                    style={{ borderColor: tier.routeColor, background: tier.routeBg }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: tier.routeColor }}
                    />
                    <div>
                      <p className="font-black text-lg" style={{ color: tier.routeColor }}>
                        {tier.route}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">{tier.routeDesc}</p>
                    </div>
                  </div>

                  {/* EV comparison table */}
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Expected Value (EV) breakdown
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { path: 'Local Resale',    ev: grade === 'D' ? -20 : 1840, bar: grade === 'D' ? 0 : 100 },
                      { path: 'Refurbish',        ev: grade === 'D' ? 200 : 890,  bar: grade === 'D' ? 11 : 48  },
                      { path: 'Donate',           ev: 0,                           bar: 0                         },
                      { path: 'Warehouse Return', ev: -40,                         bar: 0                         },
                    ].map((row) => {
                      const isChosen = (grade === 'A' || grade === 'B') && row.path === 'Local Resale'
                        || grade === 'C' && row.path === 'Refurbish'
                        || grade === 'D' && row.path === 'Donate';
                      return (
                        <div
                          key={row.path}
                          className={`px-3 py-2.5 rounded-lg text-sm
                            ${isChosen ? 'bg-[#FFF8EE] border border-[#FF9900]' : 'bg-gray-50'}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="flex items-center gap-2 text-gray-700">
                              <span className={isChosen ? 'font-bold text-[#0F1111]' : ''}>{row.path}</span>
                              {isChosen && <span className="text-[10px] font-bold bg-[#FF9900] text-white px-1.5 py-0.5 rounded">CHOSEN</span>}
                            </span>
                            <span className={`font-bold ${row.ev > 0 ? 'text-green-700' : row.ev === 0 ? 'text-gray-400' : 'text-red-500'}`}>
                              {row.ev > 0 ? `₹${row.ev.toLocaleString('en-IN')}` : row.ev === 0 ? '—' : `₹${row.ev}`}
                            </span>
                          </div>
                          {row.bar > 0 && (
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isChosen ? 'bg-[#FF9900]' : 'bg-gray-400'}`}
                                style={{ width: `${row.bar}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Refund confirmation */}
            <div className={`transition-all duration-500 delay-100 ${showRefund ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(110deg, #077a52, #0a8f63)' }}>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Refund Issued!</p>
                    <p className="text-green-100 text-xs">
                      ₹{refundAmount.toLocaleString('en-IN')} credited to your Amazon Pay wallet
                    </p>
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Refund amount</span>
                  <span className="font-bold text-green-700">₹{refundAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="px-4 py-2 border-t border-[#f0f0f0] flex items-center justify-between text-sm">
                  <span className="text-gray-500">Typically credited within</span>
                  <span className="font-semibold text-[#0F1111]">Instant · Amazon Pay</span>
                </div>
                <div className="px-4 py-2 border-t border-[#f0f0f0] flex items-center justify-between text-sm">
                  <span className="text-gray-500">Green Credits earned</span>
                  <span className="font-bold text-green-600">+10 Green Credits</span>
                </div>
              </div>
            </div>

            {/* Impact stats */}
            <div className={`transition-all duration-500 delay-200 ${showImpact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 sm:p-5 shadow-sm">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Your Environmental Impact</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-2xl font-black text-green-700">590 km</p>
                    <p className="text-[11px] text-green-600 font-semibold mt-0.5">saved vs. warehouse return</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-2xl font-black text-green-700">4.2 kg</p>
                    <p className="text-[11px] text-green-600 font-semibold mt-0.5">CO₂ avoided</p>
                  </div>
                </div>

                {/* Map placeholder */}
                <div className="bg-[#F0F2F2] border border-dashed border-gray-300 rounded-lg h-32 flex flex-col items-center justify-center gap-1.5">
                  <p className="text-sm font-bold text-gray-500">Demand Map</p>
                  <p className="text-xs text-gray-400">Item matched to buyer 5 km away · EV routing map coming soon</p>
                </div>
              </div>
            </div>

            {/* Next steps */}
            <div className={`transition-all duration-500 delay-300 ${showImpact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className="bg-[#232F3E] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[#febd69] font-bold text-sm">Your item has a second life</p>
                  <p className="text-gray-300 text-xs mt-0.5 leading-snug">
                    {grade === 'A' || grade === 'B'
                      ? 'It will be listed on Amazon Revive marketplace — a local buyer already matched.'
                      : grade === 'C'
                        ? 'It will be shipped to the nearest Amazon Refurb centre for repair and relisting.'
                        : 'It will be donated to an Amazon NGO partner in your city.'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold text-xs rounded-lg whitespace-nowrap"
                  >
                    Shop Revive
                  </button>
                  <button
                    onClick={() => navigate('/orders')}
                    className="px-4 py-2 bg-transparent border border-gray-500 text-gray-300 hover:border-gray-300 font-bold text-xs rounded-lg whitespace-nowrap"
                  >
                    My Orders
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
