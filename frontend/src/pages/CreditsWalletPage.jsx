import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Header from '../components/Header';
import { getCredits, donateCredits, vestCredits } from '../api/client';
import { useAuth } from '../context/AuthContext';

const MULTIPLIER_ROWS = [
  { cat: 'Fashion / Footwear', mult: '2.0×', note: 'high return rate (30–35%)' },
  { cat: 'Home & Kitchen',     mult: '1.0×', note: 'baseline (10–15%)' },
  { cat: 'Electronics',        mult: '0.8×', note: 'low return rate (8–12%)' },
  { cat: 'Books / Toys',       mult: '0.5×', note: 'very low return rate (3–5%)' },
];

const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const daysLeft = (iso) => {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - new Date()) / 86400000);
  return d > 0 ? d : 0;
};

const CreditsWalletPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRates, setShowRates] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate('/login'); }, [user, authLoading, navigate]);

  const load = () => {
    getCredits()
      .then((res) => setWallet(res.data))
      .catch(() => setWallet(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (user) load(); }, [user]);

  const handleDonate = async () => {
    if (!wallet || wallet.balance < 50) return;
    setBusy(true);
    try { const res = await donateCredits(50); setWallet(res.data); } catch {} finally { setBusy(false); }
  };
  const handleVest = async () => {
    setBusy(true);
    try { const res = await vestCredits(); setWallet(res.data); } catch {} finally { setBusy(false); }
  };

  if (authLoading || loading) {
    return (<div className="min-h-screen bg-[#EAEDED]"><Header /><div className="max-w-3xl mx-auto p-8 text-center text-gray-500 text-sm">Loading your wallet…</div></div>);
  }

  const w = wallet || { balance: 0, pending: 0, value_rupees: 0, history: [] };
  const earnHistory = (w.history || []).filter((t) => t.kind === 'earn' && t.status === 'vested');
  const pendingHistory = (w.history || []).filter((t) => t.kind === 'earn' && t.status === 'pending');
  const spendHistory = (w.history || []).filter((t) => t.kind === 'spend' || t.kind === 'donate');

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4">

        <button onClick={() => navigate('/')} className="bg-white border border-[#D5D9D9] hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-bold text-[#0F1111] shadow-sm mb-2 inline-flex items-center gap-2 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111]">Green Credits</h1>

        {/* Balance */}
        <div className="bg-gradient-to-br from-[#0a4d2e] to-[#15803d] rounded-lg p-5 text-white shadow-sm">
          <p className="text-green-100 text-xs uppercase tracking-wider font-semibold mb-1">Available Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black">{w.balance}</span>
            <span className="text-green-100 text-sm">credits = ₹{w.value_rupees} off second-life items</span>
          </div>
          {w.pending > 0 && (
            <p className="text-green-100/90 text-xs mt-2">🌱 {w.pending} credits pending — vest when your return windows close</p>
          )}
          <p className="text-green-100/80 text-[11px] mt-3 leading-snug">
            Earn credits by keeping orders and dropping returns at a kirana yourself. Spend them on REVIVE second-life items.
          </p>
        </div>

        {/* Pending */}
        {pendingHistory.length > 0 && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9] flex items-center justify-between">
              <p className="font-bold text-[#0F1111] text-sm">Pending — vesting soon</p>
              <button onClick={handleVest} disabled={busy} className="text-xs font-semibold text-[#007185] hover:underline disabled:opacity-50">Check vesting</button>
            </div>
            {pendingHistory.map((t) => {
              const dl = daysLeft(t.vests_at);
              return (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between border-b border-[#f0f0f0] last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-[#0F1111]">{t.reason}</p>
                    {dl != null && <p className="text-xs text-amber-600 mt-0.5">window closes in {dl} day{dl !== 1 ? 's' : ''}</p>}
                  </div>
                  <span className="text-sm font-bold text-amber-600 flex-shrink-0">+{t.amount} pending</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Redeem + Donate actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => navigate('/?source=p2p')}
            className="bg-white border border-[#D5D9D9] rounded-lg p-4 text-left hover:border-[#febd69] transition-colors shadow-sm">
            <p className="font-bold text-[#0F1111] text-sm">Spend on REVIVE items →</p>
            <p className="text-xs text-gray-500 mt-0.5">Up to 20% off any second-life purchase</p>
          </button>
          <button onClick={handleDonate} disabled={busy || w.balance < 50}
            className={`bg-white border rounded-lg p-4 text-left transition-colors shadow-sm ${w.balance >= 50 ? 'border-[#D5D9D9] hover:border-green-400' : 'border-gray-200 opacity-60 cursor-not-allowed'}`}>
            <p className="font-bold text-[#0F1111] text-sm">Donate 50 credits 🌳</p>
            <p className="text-xs text-gray-500 mt-0.5">To a verified e-waste / tree-planting NGO</p>
          </button>
        </div>

        {/* Earning history */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9]"><p className="font-bold text-[#0F1111] text-sm">Earning history</p></div>
          {earnHistory.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">No earnings yet — keep an order to start earning.</p>
          ) : earnHistory.map((t) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between border-b border-[#f0f0f0] last:border-0">
              <div className="min-w-0">
                <p className="text-sm text-[#0F1111]">{t.reason}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.category} · {fmtDate(t.created_at)}</p>
              </div>
              <span className="text-sm font-bold text-green-700 flex-shrink-0">+{t.amount}</span>
            </div>
          ))}
        </div>

        {/* Spending history */}
        {spendHistory.length > 0 && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9]"><p className="font-bold text-[#0F1111] text-sm">Spending history</p></div>
            {spendHistory.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between border-b border-[#f0f0f0] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-[#0F1111]">{t.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(t.created_at)}</p>
                </div>
                <span className="text-sm font-bold text-gray-500 flex-shrink-0">−{t.amount}</span>
              </div>
            ))}
          </div>
        )}

        {/* Earn-rate explainer */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
          <button onClick={() => setShowRates(!showRates)} className="w-full px-4 py-3 flex items-center justify-between">
            <p className="font-bold text-[#0F1111] text-sm">How earn rates work</p>
            <span className="text-gray-400 text-sm">{showRates ? '−' : '+'}</span>
          </button>
          {showRates && (
            <div className="px-4 pb-4">
              <p className="text-xs text-gray-500 mb-3">Credits scale with a category's return rate — Amazon saves more from a prevented return in high-return categories.</p>
              <div className="divide-y divide-[#f0f0f0] border border-[#f0f0f0] rounded-lg">
                {MULTIPLIER_ROWS.map((r) => (
                  <div key={r.cat} className="flex items-center justify-between px-3 py-2">
                    <div><p className="text-sm text-[#0F1111]">{r.cat}</p><p className="text-[11px] text-gray-400">{r.note}</p></div>
                    <span className="text-sm font-bold text-green-700">{r.mult}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">1 credit = ₹0.10 · redeemable up to 20% of an item's price · expire 12 months after earning.</p>
            </div>
          )}
        </div>

        {/* What does NOT earn */}
        <div className="bg-[#F7F8F8] border border-[#D5D9D9] rounded-lg p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What does not earn credits</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Agent-pickup returns, donations, recycling, and selling items earn no credits. Credits are a buyer-side
            reward for keeping orders and using kirana self-drop. Sellers receive money (UPI), not credits.
          </p>
        </div>
      </main>
    </div>
  );
};

export default CreditsWalletPage;
