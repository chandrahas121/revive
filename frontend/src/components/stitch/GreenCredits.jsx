import React, { useState, useEffect } from 'react';
import { getCredits } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Leaf, Info } from 'lucide-react';

const CREDIT_VALUE = 0.10;   // ₹ per credit
const CAP_FRACTION = 0.20;   // max 20% of the order

const GreenCredits = ({ onRedeem, cartTotal = 0 }) => {
  const { user } = useAuth();
  const [balance, setBalance] = useState(null);
  const [pending, setPending] = useState(0);
  const [isToggled, setIsToggled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getCredits()
      .then((res) => { setBalance(res.data.balance); setPending(res.data.pending || 0); })
      .catch(() => { setBalance(0); setPending(0); })
      .finally(() => setLoading(false));
  }, [user]);

  const capCredits = Math.floor((cartTotal * CAP_FRACTION) / CREDIT_VALUE);
  const applicable = Math.max(0, Math.min(balance || 0, capCredits));
  const discount = (applicable * CREDIT_VALUE).toFixed(2);

  const handleToggle = () => {
    const next = !isToggled;
    setIsToggled(next);
    if (onRedeem) onRedeem(next ? applicable : 0);
  };

  if (!user) {
    return (
      <div className="bg-white rounded-xl border border-[#D5D9D9] overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#232F3E] flex items-center gap-2">
          <Leaf className="w-4 h-4 text-[#febd69]" />
          <h2 className="font-bold text-sm text-[#febd69]">Green Credits</h2>
        </div>
        <div className="p-4 text-center text-sm text-gray-500">
          <span className="text-[#007185] font-bold cursor-pointer hover:underline">Sign in</span> to use Green Credits
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#D5D9D9] shadow-sm overflow-hidden w-full">
      {/* Header */}
      <div className="bg-[#232F3E] px-4 py-3 flex items-center gap-2">
        <Leaf className="w-4 h-4 text-[#febd69]" />
        <h2 className="font-bold text-sm text-[#febd69]">Green Credits</h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Balance */}
        {loading ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">Available Balance</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#131921]">{balance}</span>
                <span className="text-sm text-gray-500 font-medium">credits</span>
              </div>
              {pending > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">+{pending} pending (vest on return-window close)</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-full bg-[#232F3E]/10 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-[#febd69]" />
            </div>
          </div>
        )}

        <div className="border-t border-[#F0F2F2]" />

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0F1111]">Redeem on this order</p>
            {isToggled
              ? <p className="text-xs text-green-600 font-medium">Using {applicable} credits — saves ₹{discount}</p>
              : <p className="text-xs text-gray-400">Up to 20% of this order (₹{discount} max)</p>
            }
          </div>
          <button
            onClick={handleToggle}
            disabled={applicable === 0}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
              ${applicable === 0 ? 'bg-gray-200 cursor-not-allowed' : isToggled ? 'bg-[#232F3E]' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full shadow transition duration-200 ${isToggled ? 'translate-x-5 bg-[#febd69]' : 'translate-x-0 bg-white'}`} />
          </button>
        </div>

        {/* Info box */}
        <div className="bg-[#232F3E]/5 border border-[#232F3E]/10 rounded-lg p-3 flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-[#232F3E] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 leading-snug">
            Earned by keeping orders + kirana self-drop. Spendable only on Revive second-life items, capped at 20% per order.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GreenCredits;
