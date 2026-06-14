import React, { useState } from 'react';

/**
 * Pillar 4 — checkout return-prevention nudges.
 * Renders the bracket banner, the size/fit nudge, and (for high-risk items)
 * a richer-content panel (360° view / measurements / fabric).
 *
 * Props: risk = response object from POST /api/prevent/risk/
 */
const ReturnNudge = ({ risk }) => {
  const [showRich, setShowRich] = useState(false);
  if (!risk) return null;

  const { nudge_text, bracket_nudge, show_rich_content } = risk;
  if (!nudge_text && !bracket_nudge && !show_rich_content) return null;

  return (
    <div className="space-y-2 mb-3">
      {/* Bracket detection */}
      {bracket_nudge && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start">
          <span className="text-amber-600 text-base leading-none mt-0.5">⚠</span>
          <p className="text-xs sm:text-sm text-amber-800 font-medium">{bracket_nudge}</p>
        </div>
      )}

      {/* Size / fit nudge */}
      {nudge_text && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-blue-800">{nudge_text}</p>

          {/* High-risk items get richer content to reduce uncertainty */}
          {show_rich_content && (
            <div className="mt-2">
              <button
                onClick={() => setShowRich((s) => !s)}
                className="text-xs font-semibold text-[#007185] hover:underline"
              >
                {showRich ? 'Hide details' : 'View 360°, measurements & fabric →'}
              </button>
              {showRich && (
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white border rounded p-2">
                    <div className="text-xl">🔄</div>
                    <p className="text-[10px] text-gray-500 mt-1">360° view</p>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <div className="text-xl">📏</div>
                    <p className="text-[10px] text-gray-500 mt-1">Measurements (cm)</p>
                  </div>
                  <div className="bg-white border rounded p-2">
                    <div className="text-xl">🧵</div>
                    <p className="text-[10px] text-gray-500 mt-1">Fabric & material</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReturnNudge;
