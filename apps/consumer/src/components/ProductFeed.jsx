import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Product from "./Product";

// v2: All = the normal Amazon NEW catalog. Revive = AI-graded second-life
// (seller listings + returns). Renewed = Amazon authorized-center refurbished.
const SOURCE_TABS = [
  { label: 'All',     value: '' },
  { label: 'Shop Revive',  value: 'revive' },
  { label: 'Renewed', value: 'renewed' },
];
const HEADINGS = {
  '':        'Featured',
  revive:    'Shop Revive — AI-graded second-life',
  renewed:   'Amazon Renewed — certified refurbished',
};

// Build a compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

const ProductFeed = ({ products, loading, showHeading = true, page = 1, numPages = 1, total = 0, onPageChange }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSource = searchParams.get('source') || '';

  const handleTabClick = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('source', value);
    else params.delete('source');
    params.delete('page');   // changing tabs resets to page 1
    navigate(`/?${params.toString()}`);
  };

  return (
    <div>
      {showHeading && (
        <div className="px-3 sm:px-4 pt-4 pb-1">
          <h2 className="text-lg sm:text-xl font-bold text-[#0F1111]">{HEADINGS[activeSource] || 'Featured'}</h2>
        </div>
      )}

      <div className="bg-white border border-[#D5D9D9] rounded-lg mx-3 sm:mx-4">
        <div className="px-3 sm:px-4 overflow-x-auto no-scrollbar border-b border-[#D5D9D9]">
          <div className="flex min-w-max">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                  ${activeSource === tab.value
                    ? 'border-[#C7511F] text-[#C7511F] font-bold'
                    : 'border-transparent text-[#565959] hover:text-[#C7511F]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4">
            {Array(8).fill(null).map((_, i) => (
              <div key={i} className="bg-white border border-[#D5D9D9] rounded-lg p-3 animate-pulse">
                <div className="h-32 sm:h-40 bg-gray-200 rounded mb-3" />
                <div className="h-3 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
                <div className="h-7 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500 text-sm mb-3">No items found.</p>
            <button onClick={() => navigate('/sell')} className="text-[#007185] hover:underline text-sm font-medium">
              Be the first to list an item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 p-3 sm:p-4">
            {products.map((p) => (
              <Product
                key={p.id}
                id={p.id}
                title={p.title}
                price={p.price}
                image={p.image}
                grade={p.grade}
                source={p.source}
                isNew={p.is_new}
                mrp={p.mrp}
                secondLife={p.second_life}
                rating={p.rating}
                ratingCount={p.rating_count}
                lifecycle={p.lifecycle}
                fitSignal={p.fit_signal}
                reviewSummary={p.review_summary}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && products.length > 0 && numPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-6 px-3 flex-wrap">
          <button
            onClick={() => onPageChange && onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm rounded border border-[#D5D9D9] bg-white text-[#0F1111] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            ‹ Prev
          </button>
          {pageWindow(page, numPages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-2 text-sm text-gray-400">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange && onPageChange(p)}
                className={`min-w-[34px] px-2.5 py-1.5 text-sm rounded border transition-colors
                  ${p === page
                    ? 'border-[#C7511F] bg-[#C7511F] text-white font-bold'
                    : 'border-[#D5D9D9] bg-white text-[#0F1111] hover:bg-gray-50'}`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange && onPageChange(Math.min(numPages, page + 1))}
            disabled={page >= numPages}
            className="px-3 py-1.5 text-sm rounded border border-[#D5D9D9] bg-white text-[#0F1111] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductFeed;
