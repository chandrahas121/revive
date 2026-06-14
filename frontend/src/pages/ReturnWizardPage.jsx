import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { estimateGreenCredits } from '../utils/tier';

const RETURN_REASONS = [
  { id: 'size',    label: 'Didn\'t fit / wrong size' },
  { id: 'desc',    label: 'Not as described' },
  { id: 'mind',    label: 'Changed my mind' },
  { id: 'defect',  label: 'Defective / damaged on arrival' },
  { id: 'wrong',   label: 'Received wrong item' },
  { id: 'price',   label: 'Better price available elsewhere' },
  { id: 'other',   label: 'Other' },
];

const ReturnWizardPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [kept, setKept] = useState(false);

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

  // Keep-it nudge — credits the buyer would earn by NOT returning (final_idea §5)
  const orderValue = order?.listing_price ? parseFloat(order.listing_price) : 0;
  const nudgeCredits = order
    ? estimateGreenCredits(order.listing_category || 'Other', orderValue)
    : 0;

  const handleSubmit = () => {
    if (!reason) return;
    setSubmitting(true);
    // Grading fires automatically on the next screen (S3). Handover is chosen
    // there, after the customer sees the grade — per final_idea Journey 1.
    setTimeout(() => {
      navigate(`/return/${orderId}/result`, { state: { order, reason } });
    }, 500);
  };

  const handleKeepIt = () => {
    setKept(true);
    // In production this queues credits to vest at window close and cancels the return.
    setTimeout(() => navigate('/orders'), 1800);
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

  if (kept) {
    return (
      <div className="min-h-screen bg-[#EAEDED]">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-10">
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-8 text-center shadow-sm">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🌿</div>
            <p className="text-lg font-bold text-[#0F1111] mb-1">Glad you're keeping it!</p>
            <p className="text-sm text-gray-500">
              {nudgeCredits} Green Credits will vest when your return window closes with no return.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

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
                ₹{orderValue.toLocaleString('en-IN')}
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

        {/* Keep-it nudge (final_idea §8 S2) */}
        <div className="bg-gradient-to-r from-[#f0fdf4] to-white border border-green-200 rounded-lg p-4 mb-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🌿</span>
            <div className="flex-grow min-w-0">
              <p className="font-bold text-[#0F1111] text-sm">
                Changed your mind? Keep it and earn {nudgeCredits} Green Credits
              </p>
              <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                Credits vest when your return window closes with nothing sent back —
                redeemable on Amazon Revive second-life items.
              </p>
              <button
                onClick={handleKeepIt}
                className="mt-2.5 px-4 py-1.5 text-xs font-bold text-green-800 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              >
                Keep it — I changed my mind
              </button>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 mb-5 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">What happens next</p>
          <ol className="space-y-2.5">
            {[
              'An Amazon-verified agent AI-scans the item in ~2 seconds — grade decided instantly',
              'You\'ll see the grade, then choose how to hand the item over',
              'Your refund is credited to Amazon Pay the moment the scan completes',
              'The item gets a second life — routed to the nearest buyer, not a warehouse 600 km away',
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-[#232F3E] text-[#febd69] text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-600 leading-snug">{text}</span>
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
          {submitting ? 'Starting AI scan…' : !reason ? 'Select a return reason to continue' : 'Confirm Return → AI Scan'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">
          You won't be charged any return fee · Secure Amazon-verified handover
        </p>
      </main>
    </div>
  );
};

export default ReturnWizardPage;
