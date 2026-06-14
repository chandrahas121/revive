import React, { useEffect, useState } from 'react';
import api from '../../api/client';

/**
 * Pillar 4 — Fit-Twin (measurement-free).
 * Shows how an item really fit other shoppers and recommends a size, without
 * asking for height/weight. Personalised by the shopper's usual size when known
 * (from their order history); otherwise shows the item's aggregate fit signal.
 *
 * Props:
 *   category : catalogue category (e.g. "dress", "clothing")
 *   itemId   : optional dataset item id (Product.fit_item_id) for item-level match
 *   size     : optional — a size the shopper is choosing (overrides their profile)
 *   onTryOn  : optional callback to launch virtual try-on
 */
const DIRECTION = {
  runs_small: { label: 'Runs small', cls: 'bg-orange-100 text-orange-700' },
  runs_large: { label: 'Runs large', cls: 'bg-purple-100 text-purple-700' },
  true_to_size: { label: 'True to size', cls: 'bg-green-100 text-green-700' },
};

const fitDot = (fit) =>
  fit === 'fit' ? 'bg-green-500' : fit === 'small' ? 'bg-orange-400' : 'bg-purple-400';

const FitTwin = ({ category, itemId, size, availableSizes, onTryOn }) => {
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
        size,
        available_sizes: availableSizes || undefined,
      })
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [category, itemId, size, sizesKey]);

  if (loading) {
    return <div className="mt-3 h-20 rounded-lg bg-gray-50 border border-gray-100 animate-pulse" />;
  }
  if (!data || !data.available) return null;

  const dir = DIRECTION[data.direction] || DIRECTION.true_to_size;
  const sel = data.selected_size;          // the size the shopper picked (or null)
  const rec = data.recommended_size;       // stable, data-driven best fit
  const body = data.twin_mode === 'body';  // drawn from shoppers who size like you
  const who = body ? 'shoppers who size like you' : 'shoppers';

  // headline subtext mirrors exactly what the percentage is measured over,
  // so we never claim "shoppers who bought size N" when it's really an overall rate.
  const subtext = data.basis === 'size'
    ? <>of {data.twins_found} {who} who bought <span className="font-medium">size {sel}</span> found it a <span className="font-medium">true fit</span>.</>
    : data.basis === 'near'
      ? <>of {data.twins_found} {who} who bought <span className="font-medium">around size {sel}</span> found it a <span className="font-medium">true fit</span>.</>
      : body
        ? <>of {data.twins_found} shoppers who <span className="font-medium">size like you</span> found this <span className="font-medium">true to size</span>.</>
        : <>of {data.twins_found} buyers found this <span className="font-medium">true to size</span>{data.scope === 'item' ? '' : ' in similar pieces'}.</>;

  const title = body
    ? 'How this fits people like you'
    : (data.personalised ? `How size ${sel} fits` : 'How this fits');

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📐</span>
          <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${dir.cls}`}>
          {dir.label}
        </span>
      </div>

      {/* headline */}
      <div className="mt-2 flex items-end gap-3">
        <div className="text-3xl font-bold text-gray-900 leading-none">{data.good_fit_pct}%</div>
        <p className="text-xs text-gray-600 pb-0.5">{subtext}</p>
      </div>

      {/* recommended size — stable, data-driven; flagged when it differs from the pick */}
      {rec != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Best-fitting size:</span>
          <span className="text-sm font-semibold text-white bg-[#007185] rounded-md px-2.5 py-1">
            Size {rec}
          </span>
          {size != null && !data.matches_pick && (
            <span className="text-[11px] text-orange-700 bg-orange-50 border border-orange-200 rounded-md px-2 py-0.5">
              you picked size {size}
            </span>
          )}
          {size != null && data.matches_pick && (
            <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-md px-2 py-0.5">
              that's your pick ✓
            </span>
          )}
        </div>
      )}

      {/* size-twin chips */}
      {data.twins?.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5">
            {data.twins.map((t, i) => (
              <span
                key={i}
                title={`size ${t.size}: ${t.fit_pct ?? ''}% true fit · ${t.count} shoppers`}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${fitDot(t.fit)}`} />
                Size {t.size}
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> true fit
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> ran small
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> ran large
            </span>
          </div>
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
