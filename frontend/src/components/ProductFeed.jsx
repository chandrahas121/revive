import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Product from "./Product";

const SOURCE_TABS = [
  { label: 'All',       value: '' },
  { label: 'Revive',    value: 'p2p' },
  { label: 'Renewed',   value: 'renewed' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Returns',   value: 'return' },
];

const ProductFeed = ({ products, loading, showHeading = true }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeSource = searchParams.get('source') || '';

  const handleTabClick = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('source', value);
    else params.delete('source');
    navigate(`/?${params.toString()}`);
  };

  // Count per source — only reliable when showing all (activeSource === '')
  const sourceCounts = products.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {});
  const getCount = (value) => {
    if (activeSource !== '') return null; // don't show counts in filtered view
    if (value === '') return products.length;
    return sourceCounts[value] || 0;
  };

  return (
    <div>
      {/* Section heading */}
      {showHeading && (
        <div className="px-3 sm:px-4 pt-4 pb-1">
          <h2 className="text-lg sm:text-xl font-bold text-[#0F1111]">Fresh on Revive</h2>
        </div>
      )}

      {/* Filter tabs — Amazon underline style */}
      <div className="bg-white border-b border-[#D5D9D9] px-3 sm:px-4 overflow-x-auto scrollbar-none mt-1">
        <div className="flex min-w-max">
          {SOURCE_TABS.map((tab) => {
            const count = getCount(tab.value);
            return (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={`px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5
                  ${activeSource === tab.value
                    ? 'border-[#C7511F] text-[#C7511F] font-bold'
                    : 'border-transparent text-[#565959] hover:text-[#C7511F]'
                  }`}
              >
                {tab.label}
                {!loading && count != null && (
                  <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none
                    ${activeSource === tab.value ? 'bg-[#C7511F] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4">
          {Array(8).fill(null).map((_, i) => (
            <div key={i} className="bg-white rounded shadow-sm p-3 animate-pulse">
              <div className="h-32 sm:h-40 bg-gray-200 rounded mb-3" />
              <div className="h-3 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
              <div className="h-7 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="text-gray-500 text-sm mb-3">No listings found.</p>
          <button
            onClick={() => navigate('/sell')}
            className="text-[#007185] hover:underline text-sm font-medium"
          >
            Be the first to list an item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-4">
          {products.map((p) => (
            <Product
              key={p.id}
              id={p.id}
              title={p.title}
              price={p.price}
              description={p.description}
              category={p.category}
              image={p.image}
              grade={p.grade}
              source={p.source}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductFeed;
