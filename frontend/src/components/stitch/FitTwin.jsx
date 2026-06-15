import React, { useEffect, useState } from 'react';
import api from '../../api/client';

/**
 * Pillar 4 — Fit-Twin (measurement-free).
 * Tells the shopper in plain language how an item fit people like them and which
 * size to get — no height/weight asked. When there aren't enough similar shoppers
 * it falls back to the item's review summary. Also shows known brand sizing bias.
 *
 * Props:
 *   category : catalogue category (e.g. "dress", "clothing")
 *   itemId   : optional dataset item id (Product.fit_item_id) for item-level match
 *   brand    : optional brand name (for the brand sizing-bias line)
 *   size     : optional — a size the shopper is choosing
 *   onTryOn  : optional callback to launch virtual try-on
 */
const DIRECTION = {
  runs_small: { label: 'Runs small', cls: 'bg-orange-100 text-orange-700' },
  runs_large: { label: 'Runs large', cls: 'bg-purple-100 text-purple-700' },
  true_to_size: { label: 'True to size', cls: 'bg-green-100 text-green-700' },
};

// Tendency phrasing — describes the item's sizing skew, NOT a majority claim
// ("true to size" here means no strong lean to small/large, not ">50% perfect").
const TENDENCY = {
  runs_small: 'tends to run small',
  runs_large: 'tends to run large',
  true_to_size: 'fits true to size',
};

// Review-mined sizing skew → plain sentence (matches the card / nudge wording).
const REVIEW_FIT_LINE = {
  runs_small: 'Buyers report this runs small.',
  runs_large: 'Buyers report this runs large.',
}

const FitTwin = ({ category, itemId, brand, size, availableSizes, sizeSystem, onTryOn, fitSignal }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const sizesKey = availableSizes ? availableSizes.join(',') : '';

  useEffect(() => {
    if (!category && !itemId) return;
    let alive = true;
    setLoading(true);
    api
      .post('/api/prevent/fit-twin/', {
        category,
        item_id: itemId || undefined,
        brand: brand || undefined,
        available_sizes: availableSizes || undefined,
        size_system: sizeSystem || undefined,
      })
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // Intentionally NOT keyed on `size`: the recommendation is the same whichever
    // size the shopper clicks, so the card stays stable and never re-fetches.
  }, [category, itemId, brand, sizesKey]);

  if (loading) {
    return <div className="mt-3 h-20 rounded-lg bg-gray-50 border border-gray-100 animate-pulse" />;
  }
  if (!data || !data.available) return null;

  // The product's OWN review-mined skew (fitSignal) is the source of truth and is
  // shared with the "What buyers say" card + checkout nudge — prefer it over the
  // cross-dataset FitTwin direction so the three surfaces never contradict.
  const effectiveDirection = (fitSignal && fitSignal.direction) || data.direction;
  const dir = DIRECTION[effectiveDirection] || DIRECTION.true_to_size;
  const rec = data.recommended_size;          // stable, data-driven best fit
  // does the shopper's currently-picked size match the recommendation? (client-side,
  // so the badge updates instantly without re-fetching or changing the headline)
  const matchesPick = size != null && rec != null && String(size) === String(rec);

  // Stable, size-independent message, always framed as "shoppers similar to you".
  const who = 'Shoppers similar to you';
  let headline;
  if (rec != null) {
    headline = data.recommended_verdict === 'fit'
      ? <>{who} found <span className="font-medium">size {rec} a true fit</span>.</>
      : <>{who} fit best in <span className="font-medium">size {rec}</span>.</>;
  } else {
    headline = <>{who} found this <span className="font-medium">{TENDENCY[data.direction]}</span>.</>;
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#007185]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z" />
            <path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2" />
          </svg>
          <h4 className="text-sm font-semibold text-gray-900">How this fits</h4>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dir.cls}`}>
          {dir.label}
        </span>
      </div>

      {/* plain-language verdict / review summary */}
      <p className="mt-2 text-sm text-gray-700 leading-snug">{headline}</p>

      {/* recommended size */}
      {rec != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Best size for you:</span>
          <span className="text-sm font-semibold text-white bg-[#007185] rounded-md px-2.5 py-1">
            Size {rec}
          </span>
          {matchesPick && (
            <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
              that's your pick
            </span>
          )}
          {size != null && !matchesPick && (
            <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2 py-0.5">
              you picked size {size}
            </span>
          )}
        </div>
      )}

      {/* review-mined sizing skew (real reviews on THIS product) */}
      {fitSignal && REVIEW_FIT_LINE[fitSignal.direction] && (
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-600 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#bd4a17]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span>{REVIEW_FIT_LINE[fitSignal.direction]}</span>
        </div>
      )}

      {/* brand sizing bias */}
      {data.brand_bias && (
        <div className="mt-3 flex items-start gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v5.5a2 2 0 0 0 .6 1.4l7.5 7.5a2 2 0 0 0 2.8 0l4.5-4.5a2 2 0 0 0 0-2.8L11 6.6a2 2 0 0 0-1.4-.6H4a1 1 0 0 0-1 1Z" />
            <circle cx="7.5" cy="10.5" r="1.2" />
          </svg>
          <span>{data.brand_bias.label}</span>
        </div>
      )}

      {onTryOn && (
        <button
          onClick={onTryOn}
          className="mt-3 w-full text-xs font-semibold text-[#007185] border border-[#007185] rounded-md py-1.5 hover:bg-[#007185] hover:text-white transition"
        >
          See it on you →
        </button>
      )}

      <p className="mt-2 text-[10px] text-gray-400">
        Based on real fit outcomes from other shoppers — no measurements needed.
      </p>
    </div>
  );
};

export default FitTwin;
