import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Truck, Info, Pencil, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STEPS = ['Ordered', 'Shipped', 'Out for delivery', 'Delivered'];
const STATUS_STEP = { pending: 0, confirmed: 1, shipped: 2, delivered: 3, returned: 3, cancelled: 0 };
const dshort = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const dlong = (d) => d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
const addDays = (d, n) => new Date(new Date(d).getTime() + n * 86400000);

const TrackPackagePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/orders/')
      .then((res) => setOrder((res.data.results || []).find((o) => String(o.id) === String(id)) || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen bg-white"><Header /><div className="max-w-5xl mx-auto p-8 text-center text-gray-500">Loading…</div></div>;
  if (!order) return (
    <div className="min-h-screen bg-white"><Header />
      <div className="max-w-5xl mx-auto p-10 text-center">
        <p className="text-gray-500 mb-4 text-sm">Order not found.</p>
        <button onClick={() => navigate('/orders')} className="bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold rounded-full px-5 py-2 text-sm">Back to Your Orders</button>
      </div>
    </div>
  );

  const step = STATUS_STEP[order.status] ?? 0;
  const delivered = order.status === 'delivered';
  const created = order.created_at ? new Date(order.created_at) : new Date();
  const eta = addDays(created, 2);
  const trackId = `KRT${String(order.id).padStart(4, '0')}${String(order.id * 91 % 999999).padStart(6, '0')}`;
  const carrier = 'Amazon Logistics';
  const stageDates = [created, addDays(created, 1), addDays(created, 2), addDays(created, 2)];

  // Indicative update log (no live courier feed) — reflects progress up to current step.
  const allUpdates = [
    { step: 3, date: stageDates[3], time: '11:20', text: 'Delivered — package handed to customer', loc: 'Bengaluru, KA' },
    { step: 2, date: stageDates[2], time: '07:45', text: 'Out for delivery', loc: 'Bengaluru DS2, KA' },
    { step: 1, date: stageDates[1], time: '19:10', text: 'Package arrived at delivery station', loc: 'Bengaluru DS2, KA' },
    { step: 1, date: stageDates[1], time: '06:30', text: 'Shipped — in transit to destination', loc: 'Hosur SC, TN' },
    { step: 0, date: stageDates[0], time: '14:02', text: 'Order confirmed at Amazon Revive hub', loc: 'Seller location' },
  ].filter((u) => u.step <= step);

  // Group updates by day.
  const byDay = allUpdates.reduce((acc, u) => {
    const k = dlong(u.date); (acc[k] = acc[k] || []).push(u); return acc;
  }, {});

  const address = [user?.name || 'Amazon Customer', 'No. 24, 3rd Cross, HSR Layout', 'Bengaluru, Karnataka 560100', 'India'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-[13px] text-[#565f6b]">
          <button onClick={() => navigate('/orders')} aria-label="Back" className="w-8 h-8 rounded-lg bg-white border border-[#d5dbe1] hover:border-[#232F3E] flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/orders')} className="text-[#007185] hover:underline">Your Orders</button>
          <span className="text-[#c3cad3]">›</span>
          <span className="text-[#16181d] font-semibold">Track Package</span>
        </div>

        {/* ETA banner */}
        <div className="rounded-lg border border-[#D5D9D9] bg-[#f5fbf6] p-5 sm:p-6 mb-4 flex items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="text-2xl sm:text-[26px] font-extrabold text-[#007600] leading-tight">{delivered ? 'Delivered' : `Arriving ${dlong(eta)}`}</div>
            <div className="text-sm text-[#2b3440] mt-1.5 line-clamp-1">{order.listing_title}</div>
            <div className="text-xs text-[#565f6b] mt-1">{carrier} · Tracking ID <b className="text-[#16181d]">{trackId}</b></div>
          </div>
          <div className="w-24 h-24 flex-shrink-0 rounded-lg bg-white border border-[#D5D9D9] overflow-hidden flex items-center justify-center">
            {order.listing_image ? <img src={order.listing_image} alt="" className="w-full h-full object-contain p-1.5" onError={(e) => { e.target.style.display = 'none'; }} /> : <span className="text-3xl">📦</span>}
          </div>
        </div>

        {/* Horizontal status tracker */}
        <div className="bg-white border border-[#e3e7eb] rounded-lg p-6 sm:p-8 mb-4">
          <div className="flex items-center">
            {STEPS.map((s, i) => {
              const done = i < step, current = i === step;
              return (
                <React.Fragment key={s}>
                  {i > 0 && <div className="flex-1 h-[3px] rounded mb-11" style={{ background: i <= step ? '#007600' : '#e3e7eb' }} />}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0" style={{ width: 110 }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${done ? 'bg-[#007600] text-white' : current ? 'bg-[#232F3E] text-white' : 'bg-white border-2 border-[#d5dbe1] text-[#9aa6b2]'}`}
                      style={current ? { boxShadow: '0 0 0 5px rgba(0,118,0,.18)' } : {}}>
                      {done ? '✓' : current ? <Truck className="w-5 h-5" /> : i + 1}
                    </div>
                    <div className="text-center">
                      <div className="text-[13px] font-bold text-[#16181d]">{s}</div>
                      <div className="text-[11px] text-[#9aa6b2] mt-0.5">{dshort(stageDates[i])}</div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Two column: updates + shipping */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Update log */}
          <div className="bg-white border border-[#e3e7eb] rounded-lg p-5 sm:p-6">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-lg font-bold text-[#16181d]">All updates</h2>
              <span className="text-xs text-[#9aa6b2]">Times shown in local timezone</span>
            </div>
            <div className="flex items-start gap-2 bg-[#eef5ff] border border-[#cfe0fb] rounded-lg px-3 py-2.5 my-3">
              <Info className="w-4 h-4 text-[#1a4b8f] flex-shrink-0 mt-0.5" />
              <span className="text-xs text-[#1a4b8f]">You're seeing the same status our Customer Service team can access.</span>
            </div>
            {Object.entries(byDay).map(([day, items]) => (
              <div key={day}>
                <div className="text-sm font-bold text-[#16181d] mt-4 mb-3">{day}</div>
                {items.map((u, i) => (
                  <div key={i} className="flex gap-4 pb-4">
                    <div className="w-16 flex-shrink-0 text-xs text-[#565f6b] text-right pt-0.5">{u.time}</div>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#007600] mt-1" />
                      <span className="w-0.5 flex-1 bg-[#e3e7eb] mt-1" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[#16181d]">{u.text}</div>
                      <div className="text-xs text-[#9aa6b2] italic">{u.loc}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Shipping + actions */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-[#e3e7eb] rounded-lg p-5">
              <div className="text-[15px] font-bold text-[#16181d] mb-3">Shipping address</div>
              {address.map((l, i) => <div key={i} className="text-[13px] text-[#2b3440] leading-relaxed">{l}</div>)}
              <button className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] text-[#007185] hover:underline"><Pencil className="w-3.5 h-3.5" /> Update delivery instructions</button>
            </div>
            <div className="bg-white border border-[#e3e7eb] rounded-lg p-5">
              <div className="text-[15px] font-bold text-[#16181d] mb-3">{carrier}</div>
              <button className="w-full flex items-center justify-between bg-white border border-[#d5dbe1] hover:border-[#232F3E] rounded-lg px-3.5 py-3 text-[13px] font-semibold transition-colors mb-2.5">
                Request cancellation <ChevronRight className="w-4 h-4 text-[#9aa6b2]" />
              </button>
              <div className="text-xs text-[#565f6b]">Tracking ID <b className="text-[#16181d]">{trackId}</b></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TrackPackagePage;
