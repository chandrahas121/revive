import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Header from '../components/Header';
import { getCredits, donateCredits, vestCredits } from '@amazon-hackon/shared';
import { useAuth } from '../context/AuthContext';

// Behaviour-based ways to earn (no kirana / no per-category return-rate table).
const EARN_WAYS = [
  { icon: '📦', title: 'Keep what you order', sub: "Don't return it — credits vest when the return window closes." },
  { icon: '♻️', title: 'Buy renewed or second-life', sub: 'Choose a pre-owned Revive item over buying new.' },
  { icon: '🏷️', title: 'Resell an unused item', sub: 'List it on Revive instead of letting it sit idle.' },
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
    return (<div className="min-h-screen bg-white"><Header /><div className="max-w-3xl mx-auto p-8 text-center text-gray-500 text-sm">Loading your wallet…</div></div>);
  }

  const w = wallet || { balance: 0, pending: 0, value_rupees: 0, history: [], profile: null };
  const profile = w.profile;
  const pendingHistory = (w.history || []).filter((t) => t.kind === 'earn' && t.status === 'pending');
  const activity = (w.history || []).filter((t) => !(t.kind === 'earn' && t.status === 'pending'));

  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4">

        <button onClick={() => navigate('/')} className="bg-white border border-[#D5D9D9] hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-bold text-[#0F1111] shadow-sm inline-flex items-center gap-2 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-[#0F1111]">Green Credits</h1>

        {/* ── Green Profile hero ── */}
        {profile && (
          <div className="rounded-xl overflow-hidden border border-[#D5D9D9] shadow-sm">
            <div className="bg-gradient-to-br from-[#0a4d2e] to-[#15803d] p-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-green-100 text-[11px] uppercase tracking-wider font-semibold">Your Green Profile</p>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <span className="text-3xl leading-none">{profile.tier_emoji}</span>
                    <div>
                      <p className="text-2xl font-black leading-none">{profile.tier}</p>
                      <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/15 border border-white/25">
                        {profile.multiplier}× earn rate
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-4xl font-black leading-none">{profile.score}</p>
                  <p className="text-green-100/70 text-[11px] mt-1">green score</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-[#febd69] rounded-full transition-all" style={{ width: `${profile.score}%` }} />
                </div>
                <p className="text-green-100/85 text-[11px] mt-1.5">
                  {profile.next_tier
                    ? `${profile.points_to_next} points to ${profile.next_tier} — and a higher earn multiplier`
                    : 'Top tier — you earn the highest reward rate 🎉'}
                </p>
              </div>

              <p className="text-green-100/90 text-xs mt-3 leading-snug">{profile.blurb}</p>
            </div>

            {/* behaviour dimensions */}
            <div className="grid grid-cols-3 divide-x divide-[#eef0f0] bg-white">
              {profile.dimensions.map((d) => (
                <div key={d.key} className="p-3 text-center">
                  <p className="text-xl font-black text-[#15803d]">{d.value}</p>
                  <p className="text-[11px] font-semibold text-[#0F1111] mt-0.5">{d.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{d.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Balance ── */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-400">Available balance</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl font-black text-[#15803d]">{w.balance}</span>
            <span className="text-sm text-gray-500">credits · ₹{w.value_rupees} off second-life items</span>
          </div>
          {w.pending > 0 && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-amber-600">🌱 {w.pending} pending — vest when your return windows close</p>
              <button onClick={handleVest} disabled={busy} className="text-xs font-semibold text-[#007185] hover:underline disabled:opacity-50">Check vesting</button>
            </div>
          )}
        </div>

        {/* pending detail */}
        {pendingHistory.length > 0 && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9]"><p className="font-bold text-[#0F1111] text-sm">Pending — vesting soon</p></div>
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

        {/* ── Ways to earn ── */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9]"><p className="font-bold text-[#0F1111] text-sm">Ways to earn</p></div>
          {EARN_WAYS.map((e) => (
            <div key={e.title} className="px-4 py-3 flex items-start gap-3 border-b border-[#f0f0f0] last:border-0">
              <span className="text-xl leading-none mt-0.5">{e.icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#0F1111]">{e.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">{e.sub}</p>
              </div>
            </div>
          ))}
          {profile && (
            <div className="px-4 py-2.5 bg-[#f0fdf4] text-[11px] text-[#15803d] font-medium">
              Your <strong>{profile.tier}</strong> profile multiplies every earn by <strong>{profile.multiplier}×</strong> — the more sustainable your behaviour, the faster credits add up.
            </div>
          )}
        </div>

        {/* ── Redeem + Donate ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => navigate('/?source=revive')}
            className="bg-white border border-[#D5D9D9] rounded-lg p-4 text-left hover:border-[#febd69] transition-colors shadow-sm">
            <p className="font-bold text-[#0F1111] text-sm">Spend on Revive items →</p>
            <p className="text-xs text-gray-500 mt-0.5">Up to 20% off any second-life purchase</p>
          </button>
          <button onClick={handleDonate} disabled={busy || w.balance < 50}
            className={`bg-white border rounded-lg p-4 text-left transition-colors shadow-sm ${w.balance >= 50 ? 'border-[#D5D9D9] hover:border-green-400' : 'border-gray-200 opacity-60 cursor-not-allowed'}`}>
            <p className="font-bold text-[#0F1111] text-sm">Donate 50 credits 🌳</p>
            <p className="text-xs text-gray-500 mt-0.5">To a verified e-waste / tree-planting NGO</p>
          </button>
        </div>

        {/* ── Activity ── */}
        <div className="bg-white border border-[#D5D9D9] rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-[#D5D9D9]"><p className="font-bold text-[#0F1111] text-sm">Activity</p></div>
          {activity.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">No activity yet — keep an order or buy a Revive item to start earning.</p>
          ) : activity.map((t) => {
            const isEarn = t.kind === 'earn';
            return (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between border-b border-[#f0f0f0] last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-[#0F1111]">{t.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{[t.category, fmtDate(t.created_at)].filter(Boolean).join(' · ')}</p>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${isEarn ? 'text-green-700' : 'text-gray-500'}`}>
                  {isEarn ? '+' : '−'}{t.amount}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-gray-400 text-center pt-1">1 credit = ₹0.10 · redeemable up to 20% of an item's price · valid 12 months.</p>
      </main>
    </div>
  );
};

export default CreditsWalletPage;
