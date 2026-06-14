import React, { useState, useEffect } from 'react';
import { getCredits } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

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

  // Max credits applicable to THIS order: 20% cap, bounded by balance
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
        <span className="text-green-600 font-bold">Sign in</span> to use Green Credits
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden w-full">
      <div className="bg-green-50 border-b border-green-100 px-4 py-3 flex items-center gap-2">
        <span className="text-green-600 text-lg">🌿</span>
        <h2 className="font-bold text-sm text-green-800">Green Credits</h2>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="h-8 bg-gray-100 rounded animate-pulse" />
        ) : (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Available Balance</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-green-700">{balance}</span>
              <span className="text-sm text-green-600 font-medium">credits</span>
            </div>
            {pending > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">+{pending} pending (vest on return-window close)</p>
            )}
          </div>
        )}

        <hr className="border-gray-100" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700 font-medium">Redeem on this order</p>
            {isToggled
              ? <p className="text-xs text-green-600">Using {applicable} credits — saves ₹{discount}</p>
              : <p className="text-xs text-gray-400">Up to 20% of this order (₹{discount} max)</p>}
          </div>
          <button
            onClick={handleToggle}
            disabled={applicable === 0}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
              ${applicable === 0 ? 'bg-gray-200 cursor-not-allowed' : isToggled ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${isToggled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded p-2.5 flex gap-2 items-start">
          <span className="text-blue-500 text-sm mt-0.5">ℹ</span>
          <p className="text-xs text-blue-700 leading-snug">
            Earned by keeping orders + kirana self-drop. Spendable only on REVIVE second-life items, capped at 20% per order.
          </p>
        </div>
      </div>
    </div>
  );
};

export default GreenCredits;
