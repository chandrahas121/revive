import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '@amazon-hackon/shared';
import { useAuth } from '../context/AuthContext';
import { estimateGreenCredits } from '../utils/tier';
import { ChevronLeft } from 'lucide-react';

// S2 — Return Wizard (reason selection + keep-it nudge). Choosing a reason leads
// into S3 (AI grading + disposition + tier-gated handover) on GradingResultPage —
// that's where photos are captured, the AI grades the item, and the return is
// routed/confirmed. (final_idea_v2.md §8 S2 → S3.)
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
  const [kept, setKept] = useState(false);
  const [reason, setReason] = useState('');

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

  const handleKeepIt = () => {
    setKept(true);
    setTimeout(() => navigate('/orders'), 1800);
  };

  // Proceed to S3 — the AI grading + disposition + handover screen. We pass the
  // full order and the human-readable reason so the grader has its context.
  const handleContinue = () => {
    if (!reason || !order) return;
    const reasonLabel = RETURN_REASONS.find((r) => r.id === reason)?.label || reason;
    navigate(`/return/${order.id}/result`, { state: { order, reason: reasonLabel } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-3xl mx-auto p-8 text-center text-gray-500 text-sm">
          Loading order details…
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-3xl mx-auto p-8 text-center">
          <p className="text-gray-600 mb-4 text-sm">Order not found.</p>
          <button onClick={() => navigate('/orders')}
            className="px-5 py-2 bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold rounded-full text-sm">
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (kept) {
    return (
      <div className="min-h-screen bg-white">
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

  const eligibleDate = order.return_window_closes
    ? new Date(order.return_window_closes)
    : new Date(new Date(order.created_at).getTime() + 7 * 86400000);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-6">

        <button
          onClick={() => navigate('/orders')}
          className="bg-white border border-[#d5dbe1] hover:bg-[#f5f7f9] rounded-lg px-4 py-2 text-sm font-medium text-[#0F1111] mb-4 inline-flex items-center gap-2 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Back to Your Orders
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          {/* ── Left: choose items to return ── */}
          <div className="bg-white border border-[#e3e7eb] rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#0F1111] mb-6">Choose items to return</h1>

            <div className="flex gap-5 items-start border-t border-[#eef1f4] pt-6 flex-wrap">
              <input type="checkbox" checked readOnly className="mt-1.5 accent-[#232F3E] w-4 h-4 flex-shrink-0" />
              <div className="w-24 h-28 flex-shrink-0 rounded-lg bg-[#F7F8F8] border border-[#eef1f4] overflow-hidden flex items-center justify-center">
                {order.listing_image
                  ? <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-contain p-1" />
                  : <span className="text-3xl">📦</span>}
              </div>
              <div className="w-52 flex-shrink-0">
                <p className="text-[15px] font-bold text-[#16181d] leading-snug line-clamp-3">{order.listing_title || 'Order item'}</p>
                {order.listing_grade && (
                  <span className="inline-block mt-1.5 text-[10px] font-black px-2 py-0.5 rounded bg-[#e6f4ea] text-[#107a45]">Grade {order.listing_grade}</span>
                )}
                <p className="text-sm font-semibold text-[#16181d] mt-1.5">₹{orderValue.toLocaleString('en-IN')}</p>
              </div>
              <div className="flex-1 min-w-[220px]">
                <p className="text-[15px] font-semibold text-[#16181d] mb-2.5">What is the issue with the item? <span className="text-[#565f6b] font-normal">(required)</span></p>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border border-[#c3cad3] rounded-lg px-3 py-3 text-sm bg-[#f5f7f9] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#232F3E]"
                >
                  <option value="">Choose a response.</option>
                  {RETURN_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            </div>

            {/* Keep-it nudge */}
            <div className="bg-gradient-to-r from-[#f0fdf4] to-white border border-green-200 rounded-xl p-4 mt-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">🌿</span>
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-[#0F1111] text-sm">Changed your mind? Keep it and earn {nudgeCredits} Green Credits</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">Credits vest when your return window closes with nothing sent back — redeemable on Amazon Revive second-life items.</p>
                  <button onClick={handleKeepIt} className="mt-2.5 px-4 py-1.5 text-xs font-bold text-green-800 bg-green-100 hover:bg-green-200 rounded-full transition-colors">Keep it — I changed my mind</button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: summary ── */}
          <div className="bg-white border border-[#e3e7eb] rounded-2xl p-5 sm:p-6">
            <button
              onClick={handleContinue}
              disabled={!reason}
              className={`w-full rounded-full py-3 font-semibold text-[15px] transition-colors ${!reason ? 'bg-[#fbe9b0] text-[#a98a3c] cursor-not-allowed' : 'bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d]'}`}
            >
              Continue
            </button>
            <p className="text-center text-[13px] text-[#565f6b] mt-2.5">Return eligible till <b className="text-[#16181d]">{eligibleDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b></p>
            <div className="border-t border-[#eef1f4] my-4" />
            <p className="text-[15px] font-semibold text-[#16181d] mb-3">Items you are returning</p>
            <div className="w-20 h-24 rounded-lg bg-[#F7F8F8] border border-[#eef1f4] overflow-hidden flex items-center justify-center">
              {order.listing_image
                ? <img src={order.listing_image} alt="" className="w-full h-full object-contain p-1" />
                : <span className="text-2xl">📦</span>}
            </div>
            <p className="text-[11px] text-[#9aa6b2] mt-3">Next: our AI inspects the item's condition and arranges the greenest handover.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReturnWizardPage;
