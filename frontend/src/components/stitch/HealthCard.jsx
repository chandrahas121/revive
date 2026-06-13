import React from 'react';

const GRADE_CONFIG = {
  A: { label: 'Excellent',  color: '#166534', bg: '#f0fdf4', ring: '#16a34a', bar: 95, barColor: '#16a34a', headerBg: '#dcfce7', borderColor: '#86efac' },
  B: { label: 'Very Good',  color: '#92400e', bg: '#fffbeb', ring: '#d97706', bar: 75, barColor: '#d97706', headerBg: '#fef3c7', borderColor: '#fcd34d' },
  C: { label: 'Good',       color: '#7c2d12', bg: '#fff7ed', ring: '#ea580c', bar: 55, barColor: '#ea580c', headerBg: '#ffedd5', borderColor: '#fdba74' },
  D: { label: 'Acceptable', color: '#7f1d1d', bg: '#fef2f2', ring: '#dc2626', bar: 35, barColor: '#dc2626', headerBg: '#fee2e2', borderColor: '#fca5a5' },
};

const R = 26;
const CIRC = 2 * Math.PI * R;

const CheckIcon = () => (
  <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
  </svg>
);

const XIcon = () => (
  <svg className="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
  </svg>
);

const GradeRing = ({ grade, config }) => {
  const filled = (config.bar / 100) * CIRC;
  return (
    <div className="relative w-[64px] h-[64px] flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="none" stroke={config.borderColor} strokeWidth="5" />
        <circle
          cx="32" cy="32" r={R} fill="none"
          stroke={config.ring} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${filled} ${CIRC}`}
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <span className="relative z-10 text-2xl font-black" style={{ color: config.ring }}>
        {grade}
      </span>
    </div>
  );
};

const MetricBar = ({ label, value, percent, color }) => (
  <div>
    <div className="flex justify-between items-baseline mb-1">
      <span className="text-[10px] font-semibold text-[#0F1111] uppercase tracking-wide">{label}</span>
      <span className="text-[10px] font-bold text-[#0F1111]">{value}</span>
    </div>
    <div className="w-full bg-[#E3E6E6] rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percent}%`, background: color }} />
    </div>
  </div>
);

const VerifyPill = ({ text, ok = true }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border
    ${ok ? 'bg-[#F0FFF4] text-[#166534] border-[#86efac]' : 'bg-[#FEF2F2] text-[#7f1d1d] border-[#fca5a5]'}`}
  >
    {ok ? <CheckIcon /> : <XIcon />}
    {text}
  </span>
);

const QRCode = () => (
  <svg width="38" height="38" viewBox="0 0 52 52" className="flex-shrink-0 rounded">
    <rect width="52" height="52" fill="white"/>
    <rect x="2"  y="2"  width="15" height="15" rx="1.5" fill="#131921"/>
    <rect x="4"  y="4"  width="11" height="11" rx="0.5" fill="white"/>
    <rect x="6"  y="6"  width="7"  height="7"  fill="#131921"/>
    <rect x="35" y="2"  width="15" height="15" rx="1.5" fill="#131921"/>
    <rect x="37" y="4"  width="11" height="11" rx="0.5" fill="white"/>
    <rect x="39" y="6"  width="7"  height="7"  fill="#131921"/>
    <rect x="2"  y="35" width="15" height="15" rx="1.5" fill="#131921"/>
    <rect x="4"  y="37" width="11" height="11" rx="0.5" fill="white"/>
    <rect x="6"  y="39" width="7"  height="7"  fill="#131921"/>
    <rect x="20" y="2"  width="4" height="4" fill="#131921"/>
    <rect x="26" y="2"  width="4" height="4" fill="#131921"/>
    <rect x="20" y="8"  width="4" height="4" fill="#131921"/>
    <rect x="26" y="8"  width="4" height="4" fill="#131921"/>
    <rect x="20" y="20" width="4" height="4" fill="#131921"/>
    <rect x="26" y="14" width="4" height="4" fill="#131921"/>
    <rect x="32" y="20" width="4" height="4" fill="#131921"/>
    <rect x="38" y="20" width="4" height="4" fill="#131921"/>
    <rect x="44" y="26" width="4" height="4" fill="#131921"/>
    <rect x="2"  y="20" width="4" height="4" fill="#131921"/>
    <rect x="8"  y="20" width="4" height="4" fill="#131921"/>
    <rect x="14" y="26" width="4" height="4" fill="#131921"/>
    <rect x="20" y="26" width="4" height="4" fill="#131921"/>
    <rect x="26" y="32" width="4" height="4" fill="#131921"/>
    <rect x="32" y="38" width="4" height="4" fill="#131921"/>
    <rect x="38" y="44" width="4" height="4" fill="#131921"/>
    <rect x="44" y="38" width="4" height="4" fill="#131921"/>
    <rect x="20" y="38" width="4" height="4" fill="#131921"/>
    <rect x="26" y="44" width="4" height="4" fill="#131921"/>
    <rect x="32" y="26" width="4" height="4" fill="#131921"/>
    <rect x="44" y="14" width="4" height="4" fill="#131921"/>
    <rect x="44" y="2"  width="4" height="4" fill="#131921"/>
    <rect x="8"  y="26" width="4" height="4" fill="#131921"/>
    <rect x="14" y="32" width="4" height="4" fill="#131921"/>
    <rect x="2"  y="26" width="4" height="4" fill="#131921"/>
  </svg>
);

const HealthCard = ({ grade = 'B', conditionSummary, completeness = 1.0, sellerName }) => {
  const config = GRADE_CONFIG[grade] || GRADE_CONFIG.B;
  const completenessPercent = Math.round(completeness * 100);

  return (
    <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-lg w-full overflow-hidden font-sans" style={{ maxWidth: 360 }}>

      {/* ── Header: branding + pill left · QR top-right ── */}
      <div className="bg-[#131921] px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
          <span className="text-[#febd69] font-black text-sm tracking-tight">amazon</span>
          <span className="text-white/55 text-[9px] font-bold tracking-widest uppercase">revive</span>
        </div>
        <span className="text-[9px] font-bold text-[#131921] bg-[#febd69] px-2 py-0.5 rounded tracking-wide whitespace-nowrap">
          HEALTH CARD
        </span>
        <div className="border border-white/20 rounded overflow-hidden ml-1">
          <QRCode />
        </div>
      </div>

      {/* ── Body: grade column left · metrics column right ── */}
      <div className="flex border-b border-[#D5D9D9]" style={{ background: config.headerBg }}>

        {/* Left: ring + label + verified chip */}
        <div
          className="flex flex-col items-center justify-center gap-1.5 px-3 py-4 border-r border-[#D5D9D9] flex-shrink-0"
          style={{ width: 100 }}
        >
          <GradeRing grade={grade} config={config} />
          <p className="text-sm font-bold leading-tight text-center" style={{ color: config.color }}>
            {config.label}
          </p>
          <p className="text-[10px] text-gray-500 -mt-0.5">AI Grade</p>
          <div
            className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border"
            style={{ color: config.color, borderColor: config.borderColor, background: 'rgba(255,255,255,0.75)' }}
          >
            <CheckIcon />
            Verified
          </div>
        </div>

        {/* Right: metric bars + verify pills */}
        <div className="flex-1 min-w-0 px-3 py-4 flex flex-col gap-2.5">
          <MetricBar
            label="Condition"
            value={`${config.bar}/100`}
            percent={config.bar}
            color={config.barColor}
          />
          <MetricBar
            label="Completeness"
            value={`${completenessPercent}%`}
            percent={completenessPercent}
            color="#2563eb"
          />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <VerifyPill text="AI Graded" />
            <VerifyPill text="Hub Verified" />
            {sellerName
              ? <VerifyPill text="Seller Rated" />
              : <VerifyPill text="Amazon Stock" />
            }
          </div>
        </div>
      </div>

      {/* ── Footer: condition notes + eco ── */}
      <div className="px-4 py-3 bg-[#F7F8F8]">
        <p className="text-[10px] font-bold text-[#0F1111] uppercase tracking-widest mb-1">Condition Notes</p>
        <p className="text-sm text-gray-700 leading-relaxed">
          {conditionSummary || <span className="italic text-gray-400">No notes available.</span>}
        </p>
        {sellerName && (
          <p className="text-[11px] text-gray-500 mt-1.5">
            Sold by <span className="font-semibold text-[#007185]">{sellerName}</span>
          </p>
        )}
        <div className="mt-2 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded px-2 py-1">
          <svg className="w-3 h-3 text-green-600 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
          </svg>
          <p className="text-[11px] text-green-700 font-medium">Est. <strong>0.21 kg CO₂</strong> saved vs. new</p>
        </div>
      </div>

    </div>
  );
};

export default HealthCard;
