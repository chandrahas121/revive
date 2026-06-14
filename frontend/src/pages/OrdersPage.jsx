import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLE = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  returned: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const GRADE_STYLE = {
  A: 'bg-[#e6f4ea] text-[#107a45]',
  B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]',
  D: 'bg-[#fbe5e3] text-[#b3261e]',
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    api.get('/api/orders/')
      .then((res) => setOrders(res.data.results || []))
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#EAEDED]">
        <Header />
        <div className="max-w-4xl mx-auto p-8 text-center text-gray-500">Loading your orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F1111] mb-4 sm:mb-6">Your Orders</h1>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm mb-4">{error}</div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#D5D9D9] shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No orders yet</h2>
            <p className="text-gray-400 text-sm mb-6">Your Revive purchases will appear here.</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-2 text-[#131921] font-bold rounded text-sm border border-[#f0c040] shadow-sm"
              style={{ background: 'linear-gradient(180deg, #ffd99e, #febd69)' }}
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg border border-[#D5D9D9] shadow-sm overflow-hidden">
                {/* Order header */}
                <div className="bg-gray-50 border-b border-[#D5D9D9] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-3 sm:gap-6 text-xs text-gray-500">
                    <div>
                      <p className="uppercase font-semibold">Order Placed</p>
                      <p className="text-gray-800 font-medium">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    {order.listing_price && (
                      <div>
                        <p className="uppercase font-semibold">Total</p>
                        <p className="text-gray-800 font-medium">₹{parseFloat(order.listing_price).toLocaleString('en-IN')}</p>
                      </div>
                    )}
                    <div>
                      <p className="uppercase font-semibold">Source</p>
                      <p className="text-gray-800 font-medium">{order.listing_source_display || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.is_p2p && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: '#222f3e', color: '#febd69' }}>REVIVE</span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[order.status] || 'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Order item */}
                <div className="p-3 sm:p-4 flex gap-3 sm:gap-4">
                  <div className="w-20 h-20 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                    {order.listing_image ? (
                      <img
                        src={order.listing_image}
                        alt={order.listing_title}
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">📦</div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-[#0F1111] text-sm line-clamp-2">{order.listing_title}</p>
                    {order.listing_grade && (
                      <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded ${GRADE_STYLE[order.listing_grade] || ''}`}>
                        Grade {order.listing_grade}{order.listing_grade_display ? ` — ${order.listing_grade_display}` : ''}
                      </span>
                    )}
                    {order.return_window_closes && order.status !== 'delivered' && (
                      <p className="text-xs text-gray-400 mt-1.5">
                        Return window closes {new Date(order.return_window_closes).toLocaleDateString('en-IN')}
                      </p>
                    )}
                    {order.escrow_released === false && order.is_p2p && (
                      <p className="text-xs text-blue-600 mt-1">Payment in escrow — released on delivery confirmation</p>
                    )}

                    {/* Action buttons */}
                    {['delivered', 'confirmed', 'pending'].includes(order.status) && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/return/${order.id}`)}
                          className="px-3 py-1.5 text-xs font-bold rounded text-[#febd69] border border-[#3d5166] hover:border-[#febd69] transition-colors"
                          style={{ background: '#222f3e' }}
                        >
                          Return Item
                        </button>
                        <button
                          onClick={() => navigate(`/product/${order.listing_id || order.id}`)}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-[#D5D9D9] text-[#0F1111] hover:border-[#565959] rounded transition-colors"
                        >
                          View Item
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default OrdersPage;
