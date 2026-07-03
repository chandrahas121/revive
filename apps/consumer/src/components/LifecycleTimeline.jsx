import React from 'react';

// Renders the backend `listing.lifecycle` payload (core/lifecycle.py) as a compact
// vertical stepper, so the return → second-life journey is visible and narratable.
// A returned item is NOT instantly live: Renewed items refurbish first; Revive items
// are held locally until nearby demand activates them.

const TRACK_STYLE = {
  renewed: { accent: '#007185', chip: 'bg-[#007185] text-white', soft: 'bg-[#e6f6f8]' },
  revive:  { accent: '#232F3E', chip: 'bg-[#232F3E] text-[#febd69]', soft: 'bg-[#f3f4f6]' },
  restock: { accent: '#107a45', chip: 'bg-[#e6f4ea] text-[#107a45]', soft: 'bg-[#e6f4ea]' },
  exit:    { accent: '#6b7280', chip: 'bg-gray-200 text-gray-700', soft: 'bg-gray-100' },
};

const LifecycleTimeline = ({ lifecycle, onAdvance, advancing, showAdvance = false }) => {
  if (!lifecycle || !lifecycle.stages?.length) return null;
  const t = TRACK_STYLE[lifecycle.track] || TRACK_STYLE.revive;

  return (
    <div className="rounded-lg border border-[#D5D9D9] bg-white overflow-hidden">
      <div className={`px-3 py-2 flex items-center justify-between ${t.soft}`}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.chip}`}>
            {lifecycle.track_label}
          </span>
          <span className="text-xs font-semibold text-gray-600">
            {lifecycle.sold ? 'Sold' : lifecycle.live ? 'Live now' : 'In progress'}
          </span>
        </div>
        {showAdvance && lifecycle.can_advance && (
          <button onClick={onAdvance} disabled={advancing}
            className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-[#febd69] hover:bg-[#f3a847] text-[#131921] disabled:opacity-50">
            {advancing ? 'Advancing…' : '▸ Demo: advance stage'}
          </button>
        )}
      </div>

      <ol className="px-3 py-3 space-y-0">
        {lifecycle.stages.map((s, i) => {
          const last = i === lifecycle.stages.length - 1;
          return (
            <li key={s.key} className="flex gap-3">
              {/* rail */}
              <div className="flex flex-col items-center">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0
                  ${s.done ? 'bg-green-500 text-white'
                    : s.current ? 'text-white' : 'bg-gray-200 text-gray-400'}`}
                  style={s.current ? { background: t.accent } : {}}>
                  {s.done ? '✓' : ''}
                </span>
                {!last && <span className={`w-0.5 flex-grow my-0.5 ${s.done ? 'bg-green-400' : 'bg-gray-200'}`} style={{ minHeight: 18 }} />}
              </div>
              {/* text */}
              <div className={`pb-3 ${last ? 'pb-0' : ''}`}>
                <p className={`text-xs font-bold leading-tight ${s.current ? 'text-[#0F1111]' : s.done ? 'text-gray-600' : 'text-gray-400'}`}>
                  {s.label}
                  {s.current && <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wide" style={{ color: t.accent }}>● now</span>}
                </p>
                <p className={`text-[11px] leading-snug mt-0.5 ${s.current ? 'text-gray-600' : 'text-gray-400'}`}>{s.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default LifecycleTimeline;
