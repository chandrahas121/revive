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

// Next few calendar days as Amazon-style pickup slots.
const pickupDays = () => {
  const out = [];
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push(d);
  }
  return out;
};
const TIME_SLOTS = ['9 AM – 12 PM', '12 PM – 4 PM', '4 PM – 8 PM'];

const ReturnWizardPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kept, setKept] = useState(false);

  // step: reason → method → schedule → done
  const [step, setStep] = useState('reason');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('');          // 'pickup' | 'kirana'
  const [day, setDay] = useState(null);              // Date for agent pickup
  const [slot, setSlot] = useState('');              // time slot for agent pickup

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

  const orderValue = order?.listing_price ? parseFloat(order.listing_price) : 0;
  const category = order?.listing_category || 'Other';
  const nudgeCredits = order ? estimateGreenCredits(category, orderValue) : 0;
  // Self-drop at a kirana partner is the sustainable handover → it earns Green Credits.
  const kiranaCredits = order ? estimateGreenCredits(category, orderValue) : 0;
  const refundAmount = Math.round(orderValue);

  const handleKeepIt = () => {
    setKept(true);
    setTimeout(() => navigate('/orders'), 1800);
  };

  const fmtDay = (d) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

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
          <button onClick={() => navigate('/orders')}
            className="px-5 py-2 bg-[#FF9900] hover:bg-[#e88b00] text-white font-bold rounded-lg text-sm">
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

  // ── Order banner reused across steps ──────────────────────────────────────────
  const OrderBanner = () => (
    <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 mb-4 flex gap-4 items-center shadow-sm">
      <div className="w-16 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
        {order.listing_image
          ? <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-contain" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#0F1111] text-sm leading-snug line-clamp-2">
          {order.listing_title || 'Order Item'}
        </p>
        {order.listing_price && (
          <p className="text-sm text-gray-600 mt-0.5">₹{orderValue.toLocaleString('en-IN')}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          Ordered {new Date(order.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    </div>
  );

  // ── Step indicator ────────────────────────────────────────────────────────────
  const STEPS = [['reason', 'Reason'], ['method', 'Return method'], ['schedule', 'Schedule']];
  const activeIdx = step === 'done' ? STEPS.length : STEPS.findIndex(([s]) => s === step);
  const Stepper = () => (
    <div className="flex items-center gap-2 mb-5">
      {STEPS.map(([s, label], i) => (
        <React.Fragment key={s}>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full text-[11px] font-black flex items-center justify-center
              ${i <= activeIdx ? 'bg-[#232F3E] text-[#febd69]' : 'bg-gray-200 text-gray-500'}`}>
              {i < activeIdx ? '✓' : i + 1}
            </span>
            <span className={`text-xs font-semibold ${i <= activeIdx ? 'text-[#0F1111]' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className="flex-1 h-px bg-gray-300" />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        <button
          onClick={() => navigate('/orders')}
          className="text-[#007185] hover:text-[#c45500] hover:underline text-sm mb-4 inline-flex items-center gap-1">
          ← Back to Your Orders
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111] mb-5">Return or Replace Items</h1>

        {step !== 'done' && <Stepper />}
        {step !== 'done' && <OrderBanner />}

        {/* ── STEP 1 · REASON ───────────────────────────────────────────────────── */}
        {step === 'reason' && (
          <>
            <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-4">
              <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
                <p className="font-bold text-[#0F1111] text-sm">Why are you returning this item?</p>
              </div>
              <div>
                {RETURN_REASONS.map((r, i) => (
                  <label key={r.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
                      ${i < RETURN_REASONS.length - 1 ? 'border-b border-[#f0f0f0]' : ''}
                      ${reason === r.id ? 'bg-[#FFF8EE]' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name="reason" value={r.id} checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="w-4 h-4 accent-[#FF9900] flex-shrink-0" />
                    <span className="text-sm text-[#0F1111]">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Keep-it nudge */}
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
                  <button onClick={handleKeepIt}
                    className="mt-2.5 px-4 py-1.5 text-xs font-bold text-green-800 bg-green-100 hover:bg-green-200 rounded-lg transition-colors">
                    Keep it — I changed my mind
                  </button>
                </div>
              </div>
            </div>

            <button onClick={() => setStep('method')} disabled={!reason}
              className={`w-full py-3 rounded-lg font-bold text-sm transition-colors
                ${!reason ? 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'
                          : 'bg-[#FF9900] hover:bg-[#e88b00] text-white shadow-sm'}`}>
              {!reason ? 'Select a return reason to continue' : 'Continue'}
            </button>
          </>
        )}

        {/* ── STEP 2 · RETURN METHOD ────────────────────────────────────────────── */}
        {step === 'method' && (
          <>
            <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-5">
              <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
                <p className="font-bold text-[#0F1111] text-sm">How would you like to return it?</p>
              </div>
              <div className="p-4 space-y-3">
                {/* Self-drop at kirana — the sustainable option, earns credits */}
                <button onClick={() => setMethod('kirana')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all
                    ${method === 'kirana' ? 'border-[#FF9900] bg-[#FFF8EE]' : 'border-[#D5D9D9] hover:border-gray-400'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🏪</span>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[#0F1111] text-sm">Drop at a kirana partner yourself</p>
                        {method === 'kirana' && <span className="w-5 h-5 rounded-full bg-[#FF9900] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">Sri Sai Stores · 200 m away · open till 9 PM — no packaging needed, just the QR code</p>
                      <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">Earn {kiranaCredits} Green Credits</span>
                    </div>
                  </div>
                </button>

                {/* Agent pickup — convenient */}
                <button onClick={() => setMethod('pickup')}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all
                    ${method === 'pickup' ? 'border-[#FF9900] bg-[#FFF8EE]' : 'border-[#D5D9D9] hover:border-gray-400'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🚚</span>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[#0F1111] text-sm">Schedule a pickup by an agent</p>
                        {method === 'pickup' && <span className="w-5 h-5 rounded-full bg-[#FF9900] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">✓</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">An Amazon agent collects it from your doorstep · zero effort</p>
                      <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#F0F2F2] text-gray-600">Free · convenient</span>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('reason')}
                className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Back
              </button>
              <button onClick={() => setStep('schedule')} disabled={!method}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors
                  ${!method ? 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'
                            : 'bg-[#FF9900] hover:bg-[#e88b00] text-white shadow-sm'}`}>
                {!method ? 'Choose a return method' : 'Continue'}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 3 · SCHEDULE ─────────────────────────────────────────────────── */}
        {step === 'schedule' && (
          <>
            {method === 'pickup' ? (
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-5">
                <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
                  <p className="font-bold text-[#0F1111] text-sm">Pick a pickup date</p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {pickupDays().map((d) => {
                      const sel = day && d.toDateString() === day.toDateString();
                      return (
                        <button key={d.toISOString()} onClick={() => setDay(d)}
                          className={`py-2.5 rounded-lg border-2 text-xs font-semibold transition-all
                            ${sel ? 'border-[#FF9900] bg-[#FFF8EE] text-[#0F1111]' : 'border-[#D5D9D9] text-gray-600 hover:border-gray-400'}`}>
                          {fmtDay(d)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Time slot</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TIME_SLOTS.map((t) => (
                      <button key={t} onClick={() => setSlot(t)}
                        className={`py-2.5 rounded-lg border-2 text-xs font-semibold transition-all
                          ${slot === t ? 'border-[#FF9900] bg-[#FFF8EE] text-[#0F1111]' : 'border-[#D5D9D9] text-gray-600 hover:border-gray-400'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm mb-5">
                <div className="px-4 py-3 border-b border-[#D5D9D9] bg-gray-50">
                  <p className="font-bold text-[#0F1111] text-sm">Drop-off point</p>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg border-2 border-green-200 bg-[#f0fdf4]">
                    <span className="text-xl">🏪</span>
                    <div>
                      <p className="font-bold text-[#0F1111] text-sm">Sri Sai Stores</p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-snug">200 m away · open till 9 PM · drop anytime in the next 3 days</p>
                      <span className="inline-block mt-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">Earn {kiranaCredits} Green Credits on drop-off</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3 leading-snug">
                    Show the return QR code at the counter — no box or label needed. Your refund is
                    initiated the moment the partner scans it.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep('method')}
                className="px-5 py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50">
                Back
              </button>
              <button onClick={() => setStep('done')}
                disabled={method === 'pickup' && (!day || !slot)}
                className={`flex-1 py-3 rounded-lg font-bold text-sm transition-colors
                  ${method === 'pickup' && (!day || !slot)
                    ? 'bg-[#F7CA76] text-[#8a6d00] cursor-not-allowed opacity-70'
                    : 'bg-[#FF9900] hover:bg-[#e88b00] text-white shadow-sm'}`}>
                {method === 'pickup'
                  ? (!day || !slot ? 'Pick a date & slot' : 'Confirm pickup')
                  : 'Confirm drop-off'}
              </button>
            </div>
          </>
        )}

        {/* ── DONE · CONFIRMATION ───────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-8 text-center shadow-sm">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: 'linear-gradient(135deg, #077a52, #0a8f63)' }}>
                <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                </svg>
              </div>
              <h2 className="text-xl font-black text-[#0F1111] mb-1">
                {method === 'pickup' ? 'Pickup scheduled' : 'Drop-off confirmed'}
              </h2>
              <p className="text-sm text-gray-500">
                {method === 'pickup'
                  ? <>An agent will collect <strong>{order.listing_title}</strong> on <strong>{day && fmtDay(day)}</strong>, {slot}.</>
                  : <>Drop <strong>{order.listing_title}</strong> at <strong>Sri Sai Stores</strong> anytime in the next 3 days.</>}
              </p>
            </div>

            {/* Refund */}
            <div className="bg-white border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
              <div className="bg-green-600 px-4 py-3">
                <p className="text-white font-black text-base">Refund on the way</p>
                <p className="text-green-100 text-xs">
                  ₹{refundAmount.toLocaleString('en-IN')} is initiated to your Amazon Pay wallet the moment the
                  item is {method === 'pickup' ? 'picked up' : 'scanned at the store'}.
                </p>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">Refund amount</span>
                <span className="font-bold text-green-700">₹{refundAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Green credits for self-drop */}
            {method === 'kirana' && (
              <div className="bg-[#f0fdf4] border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🌿</span>
                <p className="text-sm text-green-800">
                  You chose the greener self-drop — <strong>+{kiranaCredits} Green Credits</strong> vest once the
                  partner scans your item.
                </p>
              </div>
            )}

            {/* What happens next — narrative only (routing detail lives in the deck/diagram) */}
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What happens next</p>
              <p className="text-sm text-gray-600 leading-snug">
                Once handed over, the item is AI-graded and routed to its best second life — resold nearby,
                professionally renewed, or responsibly recycled — instead of travelling back to a distant
                warehouse. You don't have to wait for any of that; your refund is already on its way.
              </p>
            </div>

            <button onClick={() => navigate('/orders')}
              className="w-full py-3 rounded-lg bg-[#232F3E] hover:bg-[#131921] text-[#febd69] font-bold text-sm">
              Back to Your Orders
            </button>
          </div>
        )}

        {step !== 'done' && (
          <p className="text-center text-xs text-gray-400 mt-3">
            You won't be charged any return fee · Secure Amazon-verified handover
          </p>
        )}
      </main>
    </div>
  );
};

export default ReturnWizardPage;
