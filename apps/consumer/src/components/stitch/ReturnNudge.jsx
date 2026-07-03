import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Pillar 4 — checkout return-prevention nudges.
 * Renders the bracket banner, the size/fit nudge, and (for high-risk items)
 * a richer-content panel (360° view / measurements / fabric).
 *
 * Props: risk = response object from POST /api/prevent/risk/
 */
const ReturnNudge = ({ risk }) => {
  const navigate = useNavigate();
  if (!risk) return null;

  const { bracket_nudge, bracket_listing_id } = risk;
  if (!bracket_nudge) return null;

  return (
    <div className="space-y-2 mb-3">
      {bracket_nudge && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 items-start">
          <span className="text-amber-600 text-base leading-none mt-0.5">⚠</span>
          <div>
            <p className="text-xs sm:text-sm text-amber-800 font-medium">{bracket_nudge}</p>
            {bracket_listing_id && (
              <button
                onClick={() => navigate(`/product/${bracket_listing_id}`)}
                className="mt-1 text-xs font-semibold text-[#007185] hover:underline"
              >
                View fit guide →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnNudge;
