import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  listed:          { label: 'Active',          style: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-500' },
  pending:         { label: 'Pending Verify',  style: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400' },
  sold:            { label: 'Sold',            style: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
  warehouse_bound: { label: 'Warehouse Bound', style: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-400' },
  donated:         { label: 'Donated',         style: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-400' },
  recycled:        { label: 'Recycled',        style: 'bg-slate-100 text-slate-600 border-slate-200',  dot: 'bg-slate-400' },
};

const GRADE_CONFIG = {
  A: 'bg-[#e6f4ea] text-[#107a45]',
  B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]',
  D: 'bg-[#fbe5e3] text-[#b3261e]',
};

const FILTER_TABS = [
  { key: 'all',    label: 'All' },
  { key: 'listed', label: 'Active' },
  { key: 'sold',   label: 'Sold' },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const ListingRow = ({ listing, navigate }) => {
  const statusCfg = STATUS_CONFIG[listing.status] || STATUS_CONFIG.listed;
  const gradeCfg = GRADE_CONFIG[listing.grade] || '';
  const isSold = listing.status === 'sold';

  return (
    <div className={`bg-white rounded-xl border transition-shadow hover:shadow-md overflow-hidden
      ${isSold ? 'border-gray-200 opacity-80' : 'border-gray-200'}`}>
      <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
          {listing.image ? (
            <img
              src={listing.image}
              alt={listing.product?.title}
              className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">📦</div>
          )}
          {isSold && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <span className="text-white text-xs font-bold">SOLD</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-grow min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-grow pr-2">
              {listing.product?.title || 'Untitled Listing'}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Status badge */}
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusCfg.style}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Grade */}
            {listing.grade && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded ${gradeCfg}`}>
                Grade {listing.grade}
              </span>
            )}
            {/* Category */}
            {listing.product?.category && (
              <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                {listing.product.category}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-base font-bold text-gray-900">
                ₹{parseFloat(listing.price).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-gray-400 ml-2">
                Listed {timeAgo(listing.created_at)}
              </span>
            </div>

            {/* Action button */}
            {listing.status === 'listed' && (
              <button
                onClick={() => navigate(`/product/${listing.id}`)}
                className="text-xs font-semibold text-[#007185] hover:text-[#c45500] hover:underline transition-colors"
              >
                View listing →
              </button>
            )}
            {listing.status === 'sold' && (
              <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px]">✓</span>
                Sold
              </span>
            )}
            {listing.status === 'pending' && (
              <span className="text-xs text-yellow-600 font-medium">Awaiting hub verification</span>
            )}
          </div>
        </div>
      </div>

      {/* Sold banner */}
      {isSold && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">Payment released to your Amazon Pay wallet</p>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs text-[#007185] hover:underline"
          >
            View in orders →
          </button>
        </div>
      )}
    </div>
  );
};

const MyListingsPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/listings/mine/')
      .then((res) => setListings(res.data.results || []))
      .catch(() => setError('Failed to load your listings.'))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = activeTab === 'all'
    ? listings
    : listings.filter((l) => l.status === activeTab);

  const counts = {
    all: listings.length,
    listed: listings.filter((l) => l.status === 'listed').length,
    sold: listings.filter((l) => l.status === 'sold').length,
  };

  const totalEarned = listings
    .filter((l) => l.status === 'sold')
    .reduce((sum, l) => sum + parseFloat(l.price), 0);

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Items you've listed on Amazon Revive</p>
          </div>
          <button
            onClick={() => navigate('/sell')}
            className="flex-shrink-0 px-3 sm:px-4 py-2 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1"
          >
            <span>+</span> <span className="hidden sm:inline">List an Item</span><span className="sm:hidden">List</span>
          </button>
        </div>

        {/* Stats strip */}
        {listings.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5 sm:mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{counts.all}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Total</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-2.5 sm:p-4 text-center">
              <p className="text-xl sm:text-2xl font-bold text-green-600">{counts.listed}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">Active</p>
            </div>
            <div className="bg-green-50 rounded-xl border border-green-100 p-2.5 sm:p-4 text-center">
              <p className="text-base sm:text-lg font-bold text-green-700 truncate">
                {totalEarned > 0 ? `₹${totalEarned.toLocaleString('en-IN')}` : `${counts.sold}`}
              </p>
              <p className="text-[10px] sm:text-xs text-green-600 mt-0.5">
                {totalEarned > 0 ? 'Earned' : 'Sold'}
              </p>
            </div>
          </div>
        )}

        {/* Filter pills */}
        {listings.length > 0 && (
          <div className="flex gap-2 mb-4">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors
                  ${activeTab === tab.key
                    ? 'text-[#febd69] border-[#3d5166]'
                    : 'bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#565959]'
                  }`}
                style={activeTab === tab.key ? { background: '#222f3e' } : {}}
              >
                {tab.label}
                <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none
                  ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{error}</div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-grow space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="h-4 bg-gray-200 rounded w-1/4 mt-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="text-5xl mb-4">🏷️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">No listings yet</h2>
            <p className="text-gray-400 text-sm mb-6">
              List your pre-loved items on Amazon Revive — AI-verified, buyer-protected.
            </p>
            <button
              onClick={() => navigate('/sell')}
              className="px-6 py-2.5 bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold rounded-lg text-sm transition-colors"
            >
              List your first item
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">No {activeTab} listings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((listing) => (
              <ListingRow key={listing.id} listing={listing} navigate={navigate} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyListingsPage;
