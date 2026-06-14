import React, { useState, useEffect } from 'react';
import api from '../../api/client';

const REASONS = [
  { value: 'changed my mind', label: 'Changed my mind' },
  { value: "didn't fit", label: "Doesn't fit" },
  { value: 'found it cheaper', label: 'Found a better price' },
  { value: 'no longer needed', label: 'No longer needed' },
  { value: 'item defective', label: 'Item is defective' },
  { value: 'item damaged', label: 'Arrived damaged' },
  { value: 'wrong item', label: 'Wrong item sent' },
];

/**
 * Pillar 4 — return-initiation "are you sure?" keep-it nudge (S2 return wizard).
 * Pure recommendation: it suggests keeping the item for soft reasons. The buyer
 * chooses to keep or continue the return. No rewards, no persistence here.
 *
 * onClose(result): result.kept === true if the buyer chose to keep the item.
 */
const KeepItModal = ({ order, onClose }) => {
  const [reason, setReason] = useState('');
  const [nudge, setNudge] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reason) { setNudge(null); return; }
    setLoading(true);
    api.post('/api/prevent/keep/', { order_id: order.id, reason })
      .then((res) => setNudge(res.data))
      .catch(() => setNudge(null))
      .finally(() => setLoading(false));
  }, [reason, order.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Return this item?</h3>
          <button onClick={() => onClose(null)} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700 font-medium line-clamp-1">{order.listing_title}</p>

          <label className="block text-xs font-semibold text-gray-500 uppercase">
            Reason for return
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select a reason…</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          {/* Keep-it recommendation — only for soft (eligible) reasons */}
          {!loading && nudge?.eligible && nudge.nudge_text && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-sm text-blue-800">{nudge.nudge_text}</p>
              <button
                onClick={() => onClose({ kept: true })}
                className="mt-2 w-full py-2 bg-[#232F3E] hover:bg-[#1a242e] text-white rounded text-sm font-bold"
              >
                Keep this item
              </button>
            </div>
          )}

          {reason && (
            <button
              onClick={() => onClose({ kept: false })}
              className="w-full py-2 border border-gray-300 text-gray-700 rounded text-sm font-semibold hover:bg-gray-50"
            >
              Continue return
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeepItModal;
