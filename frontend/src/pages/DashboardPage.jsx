import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { getHeatmap } from '../api/client';

const DUMMY_ITEMS = [
  { id: 1,  thumb: '👟', title: 'Nike Air Max 270 — Size 9',       grade: 'B', price: 2400, route: 'Local Resale', margin: '₹2,400', latency: '1.3s' },
  { id: 2,  thumb: '📱', title: 'Samsung Galaxy A32 (64GB)',        grade: 'C', price: 5800, route: 'Refurbish',   margin: '₹5,800', latency: '1.7s' },
  { id: 3,  thumb: '👕', title: 'H&M Crewneck Sweatshirt (M)',      grade: 'A', price: 680,  route: 'Local Resale', margin: '₹680',   latency: '1.1s' },
  { id: 4,  thumb: '🎮', title: 'PS5 DualSense Controller',         grade: 'B', price: 3200, route: 'Local Resale', margin: '₹3,200', latency: '1.9s' },
  { id: 5,  thumb: '📚', title: 'NCERT Physics Class 12',           grade: 'C', price: 120,  route: 'Donate',      margin: '₹0',     latency: '1.0s' },
  { id: 6,  thumb: '🎒', title: 'Wildcraft Backpack 45L',           grade: 'B', price: 1200, route: 'Local Resale', margin: '₹1,200', latency: '1.4s' },
  { id: 7,  thumb: '🍳', title: 'Prestige Non-stick Pan 24cm',      grade: 'D', price: 0,    route: 'Recycle',     margin: '₹0',     latency: '1.6s' },
  { id: 8,  thumb: '💻', title: 'Dell XPS 13 Charger 65W',          grade: 'A', price: 2100, route: 'Local Resale', margin: '₹2,100', latency: '1.2s' },
  { id: 9,  thumb: '👗', title: 'Zara Midi Dress — Blue (S)',        grade: 'B', price: 890,  route: 'Local Resale', margin: '₹890',   latency: '1.8s' },
  { id: 10, thumb: '🔌', title: 'boAt Bluetooth Speaker',           grade: 'C', price: 1400, route: 'Refurbish',   margin: '₹1,400', latency: '1.3s' },
  { id: 11, thumb: '🕶️', title: 'Ray-Ban Aviator Sunglasses',       grade: 'A', price: 3800, route: 'Local Resale', margin: '₹3,800', latency: '1.1s' },
  { id: 12, thumb: '🧴', title: 'Dyson Airwrap Attachment Set',     grade: 'B', price: 4200, route: 'Local Resale', margin: '₹4,200', latency: '1.5s' },
];

const GRADE_STYLE = {
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  C: 'bg-orange-100 text-orange-800 border-orange-200',
  D: 'bg-red-100 text-red-800 border-red-200',
};

const ROUTE_STYLE = {
  'Local Resale': 'bg-emerald-50 text-emerald-700',
  'Refurbish':    'bg-blue-50 text-blue-700',
  'Donate':       'bg-purple-50 text-purple-700',
  'Recycle':      'bg-gray-100 text-gray-500',
};

const HEATMAP_CATEGORIES = ['Electronics', 'Footwear', 'Clothing', 'Home & Kitchen', 'Toys', 'Books', 'Sports'];

const DashboardPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Bulk Grade');
  const [visible, setVisible] = useState(0);
  const [running, setRunning] = useState(false);

  // Heatmap state
  const [heatmapCategory, setHeatmapCategory] = useState('Electronics');
  const [heatmapData, setHeatmapData] = useState(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  const totalRecovered = DUMMY_ITEMS.filter((_, i) => i < visible).reduce((s, i) => s + i.price, 0);

  const handleBulkGrade = () => {
    setRunning(true);
    setVisible(0);
    let count = 0;
    const tick = setInterval(() => {
      count++;
      setVisible(count);
      if (count >= DUMMY_ITEMS.length) { clearInterval(tick); setRunning(false); }
    }, 180);
  };

  // Fetch heatmap when Ops Console tab is active
  useEffect(() => {
    if (activeTab !== 'Ops Console') return;
    setHeatmapLoading(true);
    getHeatmap(heatmapCategory)
      .then((res) => setHeatmapData(res.data))
      .catch(() => setHeatmapData(null))
      .finally(() => setHeatmapLoading(false));
  }, [activeTab, heatmapCategory]);

  const demandBar = (score) => {
    const pct = Math.round(score * 100);
    const color = pct > 70 ? '#16a34a' : pct > 45 ? '#d97706' : '#dc2626';
    return { pct, color };
  };

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0F1111]">Seller / Ops Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bulk-grade returns · demand heatmap · EV breakdown</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
            Pillar 1 + 2 + 3 Live
          </span>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Items Processed', val: visible > 0 ? visible : '—', sub: `of ${DUMMY_ITEMS.length}` },
            { label: 'Value Recovered', val: totalRecovered > 0 ? `₹${totalRecovered.toLocaleString('en-IN')}` : '—', sub: 'across all items' },
            { label: 'Avg Latency',     val: '1.4s',  sub: 'per item' },
            { label: 'Manual Reviews',  val: '0',     sub: 'needed today' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg border border-[#D5D9D9] p-3 sm:p-4">
              <p className="text-xl sm:text-2xl font-black text-[#0F1111]">{stat.val}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
              <p className="text-[10px] text-gray-400">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 bg-white rounded-lg border border-[#D5D9D9] p-1 w-fit">
          {['Bulk Grade', 'Ops Console', 'EV Breakdown'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors
                ${activeTab === tab ? 'bg-[#232F3E] text-[#febd69]' : 'text-gray-500 hover:text-gray-800'}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* ── Bulk Grade tab ── */}
        {activeTab === 'Bulk Grade' && (
          <div className="bg-white rounded-lg border border-[#D5D9D9] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#f0f0f0] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-gray-800 text-sm">12 Return Items</p>
                <p className="text-xs text-gray-400">Drag photos → AI grades, prices, and routes all at once</p>
              </div>
              <button onClick={handleBulkGrade} disabled={running}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors
                  ${running ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#FF9900] hover:bg-[#e88b00] text-white'}`}>
                {running ? 'Grading…' : visible > 0 ? 'Re-run Bulk Grade' : '▶ Run Bulk Grade'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-[#f0f0f0]">
                  <tr>
                    {['#', 'Item', 'Grade', 'Price', 'Route', 'Margin', 'Latency'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f0f0]">
                  {DUMMY_ITEMS.map((item, i) => {
                    const shown = i < visible;
                    return (
                      <tr key={item.id} className={`transition-all duration-300 ${shown ? 'opacity-100' : 'opacity-0'}`}>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{item.id}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.thumb}</span>
                            <span className="font-medium text-gray-900 text-xs leading-snug line-clamp-1">{item.title}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${GRADE_STYLE[item.grade]}`}>
                            Grade {item.grade}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-gray-900 text-xs">
                          {item.price > 0 ? `₹${item.price.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROUTE_STYLE[item.route] || 'bg-gray-100 text-gray-500'}`}>
                            {item.route}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-green-700">{item.margin}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{shown ? item.latency : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {visible >= DUMMY_ITEMS.length && (
              <div className="bg-emerald-50 border-t border-emerald-100 px-4 py-3 text-xs text-emerald-700 font-semibold">
                ✓ {DUMMY_ITEMS.length} items processed · ₹{totalRecovered.toLocaleString('en-IN')} recovered · 0 manual inspections
              </div>
            )}
          </div>
        )}

        {/* ── Ops Console tab — Demand Heatmap ── */}
        {activeTab === 'Ops Console' && (
          <div className="space-y-4">
            {/* Human review queue */}
            <div className="bg-white rounded-lg border border-[#D5D9D9] p-5">
              <p className="font-bold text-[#0F1111] mb-1 text-sm">Human Review Queue</p>
              <p className="text-xs text-gray-400 mb-3">
                Low-confidence grades (&lt;70%) and flagged items appear here for spot-checking.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Queue empty · all items above confidence threshold today
              </div>
            </div>

            {/* Demand heatmap */}
            <div className="bg-white rounded-lg border border-[#D5D9D9] overflow-hidden">
              <div className="bg-[#232F3E] px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#febd69] font-bold text-sm">Demand Heatmap · Bengaluru</span>
                <span className="text-xs text-gray-400">Pillar 2 Geohash Gravity Model · Live</span>
              </div>
              <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">Category:</span>
                {HEATMAP_CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setHeatmapCategory(cat)}
                    className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors
                      ${heatmapCategory === cat
                        ? 'bg-[#232F3E] text-[#febd69] border-[#232F3E]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {heatmapLoading && (
                <div className="px-4 py-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
                  <div className="w-4 h-4 border-2 border-[#FF9900] border-t-transparent rounded-full animate-spin" />
                  Loading demand data…
                </div>
              )}

              {!heatmapLoading && heatmapData && (
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {(heatmapData.features || []).map((f) => {
                      const { geohash, label, demand_score, local_buyers } = f.properties;
                      const bar = demandBar(demand_score);
                      return (
                        <div key={geohash} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: bar.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-[#0F1111] truncate">{label}</span>
                              <span className="text-[10px] font-bold flex-shrink-0" style={{ color: bar.color }}>
                                {local_buyers} buyers
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${bar.pct}%`, background: bar.color }} />
                            </div>
                            <span className="text-[10px] text-gray-400">{bar.pct}% demand · {geohash}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    {heatmapData.features?.length || 0} Bengaluru demand zones · refreshes every 6h
                  </p>
                </div>
              )}

              {!heatmapLoading && !heatmapData && (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">
                  Backend unavailable — start the Django server to see live demand data
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EV Breakdown tab ── */}
        {activeTab === 'EV Breakdown' && (
          <div className="bg-white rounded-lg border border-[#D5D9D9] p-5">
            <p className="font-bold text-[#0F1111] mb-1">Expected Value Breakdown — Batch of 12 Items</p>
            <p className="text-xs text-gray-400 mb-4">EV optimizer (Pillar 2) · LightGBM pricing + geohash demand index</p>
            <div className="space-y-3 mb-5">
              {[
                { path: 'Local Resale (P2P)',  count: 8, total: 18270, bar: 75, color: '#16a34a' },
                { path: 'Refurbish & Resell',  count: 2, total: 7200,  bar: 30, color: '#2563eb' },
                { path: 'Donate to NGO',       count: 1, total: 0,     bar: 5,  color: '#7c3aed' },
                { path: 'Responsible Recycle', count: 1, total: 0,     bar: 5,  color: '#6b7280' },
              ].map((row) => (
                <div key={row.path}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-semibold text-gray-700">{row.path}</span>
                    <span className="text-xs text-gray-500">
                      {row.count} items · {row.total > 0 ? `₹${row.total.toLocaleString('en-IN')} recovered` : 'no EV'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${row.bar}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Tier breakdown */}
            <div className="border-t border-[#f0f0f0] pt-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tier Distribution</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { tier: 'Tier 1', label: 'Below ₹2k', count: 5, color: '#15803d', bg: '#dcfce7' },
                  { tier: 'Tier 2', label: '₹2k–₹10k',  count: 6, color: '#1d4ed8', bg: '#dbeafe' },
                  { tier: 'Tier 3', label: 'Above ₹10k', count: 1, color: '#7c3aed', bg: '#ede9fe' },
                ].map((t) => (
                  <div key={t.tier} className="text-center rounded-lg p-3" style={{ background: t.bg }}>
                    <p className="text-xl font-black" style={{ color: t.color }}>{t.count}</p>
                    <p className="text-[11px] font-bold" style={{ color: t.color }}>{t.tier}</p>
                    <p className="text-[10px] text-gray-500">{t.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default DashboardPage;
