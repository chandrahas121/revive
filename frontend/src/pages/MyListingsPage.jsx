import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Recycle, Eye, Heart, Tag, Plus } from 'lucide-react';
import Header from '../components/Header';
import api, { manageListing } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  listed:          { label: 'Active',          pill: 'bg-[#e6f7f0] text-[#12805f]', dot: 'bg-[#19a97e]' },
  pending:         { label: 'Pending Verify',  pill: 'bg-[#fdf3e2] text-[#a5771a]', dot: 'bg-amber-400' },
  paused:          { label: 'Paused',          pill: 'bg-[#fdf3e2] text-[#a5771a]', dot: 'bg-amber-400' },
  delisted:        { label: 'Delisted',        pill: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  sold:            { label: 'Sold',            pill: 'bg-[#e7edf6] text-[#3a5f92]', dot: 'bg-[#3a5f92]' },
  warehouse_bound: { label: 'Warehouse Bound', pill: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  awaiting_demand: { label: 'Held · awaiting demand', pill: 'bg-[#fdf3e2] text-[#a5771a]', dot: 'bg-amber-400' },
  refurbishing:    { label: 'Refurbishing',    pill: 'bg-violet-100 text-violet-700', dot: 'bg-violet-400' },
};

const GRADE_CONFIG = { A: 'bg-[#107a45]', B: 'bg-[#b06f00]', C: 'bg-[#bd4a17]', D: 'bg-[#b3261e]' };

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'listed', label: 'Active' },
  { key: 'sold', label: 'Sold' },
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

// Deterministic pseudo-engagement (no live views/watchers/offers source — hardcoded per id).
const eng = (id) => ({
  views: ((id * 37) % 380) + 40,
  watchers: ((id * 13) % 28) + 2,
  offers: (id * 7) % 6,
});

const ListingCard = ({ listing, navigate, onManage, busy }) => {
  const cfg = STATUS_CONFIG[listing.status] || STATUS_CONFIG.listed;
  const { views, watchers, offers } = eng(listing.id);
  const interest = Math.min(95, watchers * 3 + 25);
  const mrp = listing.mrp ? parseFloat(listing.mrp) : null;
  const isActive = listing.status === 'listed';
  const isPaused = listing.status === 'paused' || listing.status === 'delisted';
  const isSold = listing.status === 'sold';

  return (
    <div className="bg-white border border-[#e3e7eb] rounded-2xl overflow-hidden flex flex-col">
      {/* Top */}
      <div className="p-4 flex gap-3.5">
        <div className="relative w-[92px] h-[92px] flex-shrink-0 rounded-xl overflow-hidden bg-[#F7F8F8] border border-[#eef1f4] flex items-center justify-center">
          {listing.image
            ? <img src={listing.image} alt={listing.product?.title} className="w-full h-full object-contain p-1" onError={(e) => { e.target.style.display = 'none'; }} />
            : <span className="text-3xl text-gray-300">📦</span>}
          {listing.grade && (
            <span className={`absolute bottom-1.5 left-1.5 text-[11px] font-black text-white rounded px-1.5 py-0.5 ${GRADE_CONFIG[listing.grade] || 'bg-gray-500'}`}>{listing.grade}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            {listing.product?.category && (
              <span className="bg-[#eef1f4] text-[#565f6b] text-[11px] rounded px-2 py-0.5">{listing.product.category}</span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${cfg.pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
            </span>
          </div>
          <p className="text-[15px] font-semibold mt-2 leading-snug line-clamp-2 text-[#16181d]">{listing.product?.title || 'Untitled listing'}</p>
          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-[#16181d]">₹{parseFloat(listing.price).toLocaleString('en-IN')}</span>
            {mrp && mrp > parseFloat(listing.price) && <span className="text-xs text-[#9aa6b2] line-through">₹{mrp.toLocaleString('en-IN')}</span>}
            <span className="text-xs text-[#9aa6b2]">· {timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Interest meter */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[#9aa6b2] uppercase tracking-wide">Buyer interest</span>
          <span className="text-[11px] text-[#565f6b]">{watchers} watching</span>
        </div>
        <div className="h-1.5 bg-[#eef1f4] rounded overflow-hidden">
          <div className="h-full rounded" style={{ width: `${interest}%`, background: 'linear-gradient(90deg,#2e8b57,#007600)' }} />
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 bg-[#f7f9fb] border-t border-[#eef1f4] text-center">
        <div className="py-3 border-r border-[#eef1f4]">
          <div className="flex items-center justify-center gap-1.5 text-[15px] font-bold text-[#16181d]"><Eye className="w-3.5 h-3.5 text-[#565f6b]" />{views}</div>
          <div className="text-[11px] text-[#9aa6b2] mt-0.5">Views</div>
        </div>
        <div className="py-3 border-r border-[#eef1f4]">
          <div className="flex items-center justify-center gap-1.5 text-[15px] font-bold text-[#16181d]"><Heart className="w-3.5 h-3.5 text-[#565f6b]" />{watchers}</div>
          <div className="text-[11px] text-[#9aa6b2] mt-0.5">Watchers</div>
        </div>
        <div className="py-3">
          <div className="flex items-center justify-center gap-1.5 text-[15px] font-bold text-[#16181d]"><Tag className="w-3.5 h-3.5 text-[#565f6b]" />{offers}</div>
          <div className="text-[11px] text-[#9aa6b2] mt-0.5">Offers</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-3 border-t border-[#eef1f4]">
        <button onClick={() => navigate(`/product/${listing.id}`)} className="flex-1 bg-white border border-[#d5dbe1] hover:border-[#232F3E] rounded-full py-2 text-[13px] font-semibold transition-colors">View</button>
        {isActive && <button disabled={busy} onClick={() => onManage(listing.id, 'pause')} className="flex-1 bg-white border border-[#d5dbe1] hover:bg-[#fdf7ec] rounded-full py-2 text-[13px] text-[#a5771a] transition-colors disabled:opacity-50">Pause</button>}
        {isPaused && <button disabled={busy} onClick={() => onManage(listing.id, 'relist')} className="flex-1 bg-[#e6f7f0] border border-[#cdeee3] hover:bg-[#d8f2e7] rounded-full py-2 text-[13px] font-semibold text-[#12805f] transition-colors disabled:opacity-50">Resume</button>}
        {isSold && <button onClick={() => navigate('/orders')} className="flex-1 bg-[#e6f7f0] border border-[#cdeee3] hover:bg-[#d8f2e7] rounded-full py-2 text-[13px] font-semibold text-[#12805f] transition-colors">Relist</button>}
        {(isActive || isPaused) && <button disabled={busy} onClick={() => onManage(listing.id, 'delist')} className="bg-white border border-[#f2cfc9] hover:bg-[#fcefec] rounded-full py-2 px-3.5 text-[13px] text-[#c4360a] transition-colors disabled:opacity-50">Delist</button>}
      </div>
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
  const [busyId, setBusyId] = useState(null);

  const handleManage = async (id, action) => {
    setBusyId(id);
    try {
      const res = await manageListing(id, action);
      if (action === 'delist') setListings((prev) => prev.filter((l) => l.id !== id));
      else setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: res.data.status } : l)));
    } catch {
      setError('Could not update the listing. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => { if (!authLoading && !user) navigate('/login'); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/listings/mine/')
      .then((res) => setListings(res.data.results || []))
      .catch(() => setError('Failed to load your listings.'))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = activeTab === 'all' ? listings : listings.filter((l) => l.status === activeTab);
  const counts = {
    all: listings.length,
    listed: listings.filter((l) => l.status === 'listed').length,
    sold: listings.filter((l) => l.status === 'sold').length,
  };
  const totalEarned = listings.filter((l) => l.status === 'sold').reduce((s, l) => s + parseFloat(l.price), 0);
  const watchers = listings.reduce((s, l) => s + eng(l.id).watchers, 0);
  const co2 = (listings.length * 4.2).toFixed(0); // ~4.2 kg CO2 saved per reused item (indicative)

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#16181d]">Seller Dashboard</h1>
              <span className="inline-flex items-center gap-1.5 bg-[#e6f7f0] text-[#12805f] text-xs font-bold rounded-full px-2.5 py-1"><Recycle className="w-3.5 h-3.5" />Amazon Revive</span>
            </div>
            <p className="text-sm text-[#565f6b] mt-1">Track how your pre-loved items are performing.</p>
          </div>
          <button onClick={() => navigate('/sell')} className="flex-shrink-0 inline-flex items-center gap-1.5 bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-bold rounded-full px-4 sm:px-5 py-2.5 text-sm transition-colors">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">List an Item</span><span className="sm:hidden">List</span>
          </button>
        </div>

        {/* Dashboard band (Amazon navy) */}
        <div className="rounded-2xl p-5 sm:p-6 mb-6 text-white" style={{ background: 'linear-gradient(120deg,#131921 0%,#232F3E 60%,#37475A 100%)' }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-6">
            {[
              { l: 'Total earnings', v: `₹${totalEarned.toLocaleString('en-IN')}`, c: 'text-white' },
              { l: 'Active', v: counts.listed, c: 'text-[#5de0a0]' },
              { l: 'Sold', v: counts.sold, c: 'text-white' },
              { l: 'Watchers', v: watchers, c: 'text-white' },
            ].map((s, i) => (
              <div key={s.l} className={i > 0 ? 'sm:border-l sm:border-[#33495f] sm:pl-6' : ''}>
                <div className="text-[11px] text-[#9fb3c7] uppercase tracking-wide mb-1.5">{s.l}</div>
                <div className={`text-2xl sm:text-[28px] font-extrabold ${s.c}`}>{s.v}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#33495f] mt-5 pt-4 flex items-center gap-2.5 flex-wrap">
            <Recycle className="w-4 h-4 text-[#5de0a0] flex-shrink-0" />
            <span className="text-[13px] text-[#cdd8e3]">
              You've kept <b className="text-white">{listings.length} item{listings.length !== 1 ? 's' : ''}</b> in circulation — about <b className="text-[#5de0a0]">{co2} kg CO₂</b> saved by choosing Revive.
            </span>
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{error}</div>}

        {/* Toolbar */}
        {listings.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="inline-flex bg-white border border-[#e3e7eb] rounded-full p-1">
              {FILTER_TABS.map((tab) => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${activeTab === tab.key ? 'bg-[#232F3E] text-white font-semibold' : 'text-[#565f6b] hover:text-[#232F3E]'}`}>
                  {tab.label} <span className={activeTab === tab.key ? 'opacity-70' : 'text-[#9aa6b2]'}>{counts[tab.key]}</span>
                </button>
              ))}
            </div>
            <select className="border border-[#d5dbe1] rounded-full px-4 py-2 text-[13px] bg-white text-[#2b3440]">
              <option>Sort: Newest first</option><option>Most viewed</option><option>Price: High to low</option>
            </select>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white border border-[#e3e7eb] rounded-2xl h-64 animate-pulse" />)}
          </div>
        ) : listings.length === 0 ? (
          <div className="bg-white border border-[#e3e7eb] rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🏷️</div>
            <h2 className="text-lg font-bold text-[#16181d] mb-2">No listings yet</h2>
            <p className="text-[#9aa6b2] text-sm mb-6">List your pre-loved items on Amazon Revive — AI-verified, buyer-protected.</p>
            <button onClick={() => navigate('/sell')} className="bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-bold rounded-full px-6 py-2.5 text-sm transition-colors">List your first item</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} navigate={navigate} onManage={handleManage} busy={busyId === listing.id} />
            ))}
            {/* Ghost "list another" */}
            <button onClick={() => navigate('/sell')} className="border-2 border-dashed border-[#c3cad3] hover:border-[#232F3E] hover:bg-[#f5f7f9] rounded-2xl bg-[#fbfcfd] flex flex-col items-center justify-center gap-2.5 p-8 min-h-[220px] text-[#565f6b] transition-colors">
              <div className="w-12 h-12 rounded-full bg-[#eef1f4] flex items-center justify-center"><Plus className="w-6 h-6 text-[#232F3E]" /></div>
              <div className="text-[15px] font-bold">List another item</div>
              <div className="text-xs text-[#9aa6b2] text-center">Turn something unused into credits &amp; cash</div>
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MyListingsPage;
