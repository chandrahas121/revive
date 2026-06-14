import React, { useState } from 'react';

const GRADE_CONFIG = {
  A: { label: 'Excellent',  sub: 'Like new — no visible defects',        accent: '#16a34a', faded: '#f0fdf4', border: '#86efac', score: 95 },
  B: { label: 'Very Good',  sub: 'Light cosmetic wear, fully functional', accent: '#d97706', faded: '#fffbeb', border: '#fcd34d', score: 75 },
  C: { label: 'Good',       sub: 'Visible wear, all features work',       accent: '#ea580c', faded: '#fff7ed', border: '#fdba74', score: 55 },
  D: { label: 'Acceptable', sub: 'Heavy wear or minor defects present',   accent: '#dc2626', faded: '#fef2f2', border: '#fca5a5', score: 35 },
};

const ShieldIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clipRule="evenodd"/>
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>
);

const BadgeCheckIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);

const SectionHeader = ({ icon, title }) => (
  <div className="flex items-center gap-2 px-4 py-2.5 border-t border-b border-[#EAEDED] bg-[#F7F8F8]">
    <span className="text-[#febd69]">{icon}</span>
    <span className="text-[10px] font-bold text-[#0F1111] uppercase tracking-widest">{title}</span>
  </div>
);

const Field = ({ label, value, accent }) => (
  <div>
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
    <p className={`text-sm font-semibold ${accent ? 'text-[#007185]' : 'text-[#0F1111]'}`}>{value}</p>
  </div>
);

/* QR paths shared between small + large renders */
const QR_RECTS = [
  [2,2,15,15,'1.5'],[4,4,11,11,'.5'],[6,6,7,7,null],
  [35,2,15,15,'1.5'],[37,4,11,11,'.5'],[39,6,7,7,null],
  [2,35,15,15,'1.5'],[4,37,11,11,'.5'],[6,39,7,7,null],
  [20,2,4,4,null],[26,2,4,4,null],[20,8,4,4,null],[26,14,4,4,null],
  [32,20,4,4,null],[38,20,4,4,null],[44,26,4,4,null],
  [2,20,4,4,null],[8,20,4,4,null],[20,26,4,4,null],
  [26,32,4,4,null],[32,38,4,4,null],[44,38,4,4,null],
  [20,38,4,4,null],[26,44,4,4,null],[32,26,4,4,null],
  [44,14,4,4,null],[8,26,4,4,null],[14,32,4,4,null],
];

const QRSvg = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 52 52">
    <rect width="52" height="52" fill="white"/>
    {QR_RECTS.map(([x, y, w, h, rx], i) => (
      <rect key={i} x={x} y={y} width={w} height={h} rx={rx || 0} fill="#131921"/>
    ))}
  </svg>
);

/* ── Main component ── */
const HealthCard = ({ grade = 'B', conditionSummary, completeness = 1.0, sellerName }) => {
  const cfg = GRADE_CONFIG[grade] || GRADE_CONFIG.B;
  const completePct = Math.round(completeness * 100);
  const [qrOpen, setQrOpen] = useState(false);

  return (
    <>
      <div className="w-full rounded-lg overflow-hidden shadow-lg bg-white font-sans" style={{ maxWidth: 360 }}>

        {/* ━━━━ Header — light ━━━━ */}
        <div className="px-4 pt-4 pb-5 text-center" style={{ background: cfg.faded }}>

          {/* Brand row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[#131921] font-black text-sm tracking-tight">amazon</span>
              <span className="text-[#131921]/40 text-[9px] font-bold tracking-[2px] uppercase">revive</span>
            </div>
            {/* Clickable QR */}
            <button
              onClick={() => setQrOpen(true)}
              className="rounded overflow-hidden border border-[#D5D9D9] hover:border-[#131921] transition-colors cursor-pointer"
              title="Tap to enlarge QR"
            >
              <QRSvg size={36} />
            </button>
          </div>

          {/* Grade circle */}
          <div
            className="mx-auto mb-3 w-[60px] h-[60px] rounded-full flex items-center justify-center"
            style={{ background: 'white', border: `2.5px solid ${cfg.accent}` }}
          >
            <span className="text-[28px] font-black leading-none" style={{ color: cfg.accent }}>{grade}</span>
          </div>

          <p className="text-[#0F1111] text-lg font-bold mb-0.5">{cfg.label}</p>
          <p className="text-gray-500 text-xs">{cfg.sub}</p>

          {/* Divider line */}
          <div
            className="my-4 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${cfg.accent}, transparent)` }}
          />

          {/* Verified badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded"
            style={{ background: 'white', border: `1px solid ${cfg.border}` }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill={cfg.accent}>
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs font-bold tracking-wide" style={{ color: cfg.accent }}>
              AI VERIFIED &nbsp;·&nbsp; {cfg.score} / 100
            </span>
          </div>

        </div>

        {/* ━━━━ Body ━━━━ */}
        <div className="bg-white">

          {/* Condition Details */}
          <SectionHeader icon={<ShieldIcon />} title="Condition Details" />
          <div className="px-4 py-4 grid grid-cols-2 gap-3">
            <div className="rounded bg-[#F7F8F8] border border-[#EAEDED] px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Condition Score</p>
              <p className="text-2xl font-black text-[#0F1111] leading-none">
                {cfg.score}<span className="text-xs font-normal text-gray-400 ml-0.5">/100</span>
              </p>
              <div className="mt-2 w-full h-1 rounded-full bg-[#E3E6E6] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cfg.score}%`, background: cfg.accent }}/>
              </div>
            </div>
            <div className="rounded bg-[#F7F8F8] border border-[#EAEDED] px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Completeness</p>
              <p className="text-2xl font-black text-[#0F1111] leading-none">
                {completePct}<span className="text-xs font-normal text-gray-400 ml-0.5">%</span>
              </p>
              <div className="mt-2 w-full h-1 rounded-full bg-[#E3E6E6] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 bg-[#2563eb]" style={{ width: `${completePct}%` }}/>
              </div>
            </div>
          </div>

          {/* AI Assessment */}
          <SectionHeader icon={<SparkleIcon />} title="AI Assessment" />
          <div className="px-4 py-4">
            <p className="text-[13px] text-[#0F1111] leading-relaxed">
              {conditionSummary || <span className="italic text-gray-400">No AI notes available for this item.</span>}
            </p>
          </div>

          {/* Verification Details */}
          <SectionHeader icon={<BadgeCheckIcon />} title="Verification Details" />
          <div className="px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Graded By"     value="Amazon AI" />
            <Field label="Hub Inspected" value="Yes" />
            <Field label="Grade"         value={`${grade} — ${cfg.label}`} />
            <Field label="CO₂ Saved"     value="~0.21 kg vs. new" />
            {sellerName && <Field label="Sold By" value={sellerName} accent />}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-[#F7F8F8] border-t border-[#EAEDED] flex items-center justify-between">
            <p className="text-[10px] text-gray-400">Cryptographically signed · GS1 Digital Link</p>
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd"/>
              </svg>
              <span className="text-[10px] text-green-700 font-semibold">Eco Verified</span>
            </div>
          </div>

        </div>
      </div>

      {/* ━━━━ QR enlarge modal ━━━━ */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setQrOpen(false)}
        >
          <div
            className="bg-white rounded-xl p-6 flex flex-col items-center gap-4 shadow-2xl"
            style={{ maxWidth: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="text-sm font-bold text-[#0F1111]">Scan to Verify</p>
                <p className="text-[11px] text-gray-400 mt-0.5">GS1 Digital Link · Cryptographically signed</p>
              </div>
              <button
                onClick={() => setQrOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F7F8F8] border border-[#D5D9D9] flex items-center justify-center text-gray-500 hover:text-gray-900 text-xs font-bold flex-shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="border-2 border-[#131921] rounded-lg p-3">
              <QRSvg size={180} />
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              Tap outside or ✕ to close
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default HealthCard;
