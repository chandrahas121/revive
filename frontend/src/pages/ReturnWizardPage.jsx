import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const RETURN_REASONS = [
  { id: 'size',    label: 'Didn\'t fit / wrong size' },
  { id: 'desc',    label: 'Not as described' },
  { id: 'mind',    label: 'Changed my mind' },
  { id: 'defect',  label: 'Defective / damaged on arrival' },
  { id: 'wrong',   label: 'Received wrong item' },
  { id: 'price',   label: 'Better price available elsewhere' },
  { id: 'other',   label: 'Other' },
];

const HANDOVER_OPTIONS = [
  {
    key: 'hub',
    title: 'Drop at Amazon Hub',
    sub: 'Amazon kirana partner · usually within 200 m',
    tag: 'Fastest refund',
    tagStyle: 'bg-[#FF9900] text-white',
  },
  {
    key: 'doorstep',
    title: 'Doorstep Pickup',
    sub: 'Our agent arrives in 1–2 days · scans on your doorstep',
    tag: 'No effort needed',
    tagStyle: 'bg-[#F0F2F2] text-gray-600',
  },
];

const ReturnWizardPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [handover, setHandover] = useState('hub');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    api.get('/api/orders/')
      .then((res) => {
        const orders = res.data.results || [];
        const found = orders.find((o) => String(o.id) === String(orderId));
        setOrder(found || null);
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId, user, navigate]);

  const handleSubmit = () => {
    if (!reason) return;
    setSubmitting(true);
    setTimeout(() => {
      navigate(`/return/${orderId}/result`, {
        state: { order, reason, handover },
      });
    }, 600);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EAEDED]">
        <Header />
        <div className="max-w-3xl mx-auto p-8 text-center text-gray-500 text-sm">
          Loading order details…
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#EAEDED]">
        <Header />
        <div className="max-w-3xl mx-auto p-8 text-center">
          <p className="text-gray-600 mb-4 text-sm">Order not found.</p>
          <button
            onClick={() => navigate('/orders')}
            className="px-5 py-2 bg-[#FF9900] hover:bg-[#e88b00] text-white font-bold rounded-lg text-sm"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/orders')}
          className="text-[#007185] hover:text-[#c45500] hover:underline text-sm mb-4 inline-flex items-center gap-1"
        >
          ← Back to Your Orders
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111] mb-5">Return or Replace Items</h1>

        {/* Order item banner */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 mb-4 flex gap-4 items-center shadow-sm">
          <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
            {order.listing_image
              ? <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-contain" />
              : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
            }
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#0F1111] text-sm leading-snug line-clamp-2">
              {order.listing_title || 'Order Item'}
            </p>
            {order.listing_price && (
              <p className="text-sm text-gray-600 mt-0.5">
                ₹{parseFloat(order.listing_price).toLocaleString('en-IN')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-0.5">
              Ordered {new Date(order.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Why returning */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-4">
          <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
            <p className="font-bold text-[#0F1111] text-sm">Why are you returning this item?</p>
          </div>
          <div>
            {RETURN_REASONS.map((r, i) => (
              <label
                key={r.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                  ${i < RETURN_REASONS.length - 1 ? 'border-b border-[#f0f0f0]' : ''}
                  ${reason === r.id ? 'bg-[#FFF8EE]' : 'hover:bg-gray-50'}`}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="w-4 h-4 accent-[#FF9900] flex-shrink-0"
                />
                <span className="text-sm text-[#0F1111]">{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* How to hand over */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-4">
          <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
            <p className="font-bold text-[#0F1111] text-sm">How would you like to return it?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              An Amazon-verified agent will AI-scan your item on handover — your refund fires instantly.
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {HANDOVER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setHandover(opt.key)}
                className={`text-left p-4 rounded-lg border-2 transition-all focus:outline-none
                  ${handover === opt.key
                    ? 'border-[#FF9900] bg-[#FFF8EE]'
                    : 'border-[#D5D9D9] hover:border-gray-400 bg-white'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-[#0F1111] text-sm">{opt.title}</p>
                  {handover === opt.key && (
                    <span className="w-5 h-5 rounded-full bg-[#FF9900] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">✓</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{opt.sub}</p>
                <span className={`inline-block mt-2.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${opt.tagStyle}`}>
                  {opt.tag}
                </span>
              </button>
            ))}
          </div>

          {/* Optional self-scan */}
          <div className="mx-4 mb-4 px-4 py-3 bg-[#F0F2F2] rounded-lg flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F1111]">
                Scan it yourself first <span className="font-normal text-gray-500">(optional)</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Get your AI grade preview now — before you hand it over
              </p>
            </div>
            <button
              onClick={() => navigate('/sell')}
              className="flex-shrink-0 px-4 py-1.5 text-xs font-bold text-[#007185] border border-[#007185] rounded-lg hover:bg-[#007185] hover:text-white transition-colors whitespace-nowrap"
            >
              Scan now
            </button>
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 mb-5 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">What happens next</p>
          <ol className="space-y-2.5">
            {[
              { n: '1', text: handover === 'hub' ? 'Drop your item at the nearest Amazon Hub point (kirana store)' : 'Our agent will arrive at your doorstep in 1–2 days' },
              { n: '2', text: 'The agent AI-scans the item in ~2 seconds — grade and routing decided instantly' },
              { n: '3', text: 'Your refund is credited to Amazon Pay before you leave the hub' },
              { n: '4', text: 'The item gets a second life — routed to the nearest buyer, not a warehouse 600 km away' },
            ].map((step) => (
              <li key={step.n} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#232F3E] text-[#febd69] text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </span>
                <span className="text-sm text-gray-600 leading-snug">{step.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* CTA */}
        <button
          onClick={handleSubmit}
          disabled={!reason || submitting}
          className={`w-full py-3 rounded-lg font-bold text-sm transition-colors
            ${!reason || submitting
              ? 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'
              : 'bg-[#FF9900] hover:bg-[#e88b00] text-white shadow-sm'
            }`}
        >
          {submitting ? 'Processing…' : !reason ? 'Select a return reason to continue' : 'Confirm Return →'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          You won't be charged any return fee · Secure Amazon-verified handover
        </p>
      </main>
    </div>
  );
};

export default ReturnWizardPage;
