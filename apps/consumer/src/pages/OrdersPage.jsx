import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '@amazon-hackon/shared';
import { useAuth } from '../context/AuthContext';

const GRADE_STYLE = {
  A: 'bg-[#e6f4ea] text-[#107a45]',
  B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]',
  D: 'bg-[#fbe5e3] text-[#b3261e]',
};

// Friendly status headline (template shows a bold green status line per order).
const STATUS_LABEL = {
  pending: 'Ordered', confirmed: 'Preparing for dispatch', shipped: 'Shipped',
  delivered: 'Delivered', returned: 'Returned', cancelled: 'Cancelled',
};

const ORDER_TABS = ['Orders', 'Buy Again', 'Not Yet Shipped', 'Cancelled Orders'];

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const OrdersPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Orders');

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
      <div className="min-h-screen bg-white">
        <Header />
        <div className="max-w-6xl mx-auto p-8 text-center text-gray-500">Loading your orders...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <div className="text-xs text-[#007185] mb-2">Your Account › Your Orders</div>

        {/* Heading + search */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-medium text-[#0F1111]">Your Orders</h1>
          <div className="flex gap-2">
            <input placeholder="Search all orders" className="border border-[#c3cad3] rounded-md px-3 py-2 text-sm w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-[#e77600]" />
            <button className="bg-[#F0F2F2] border border-[#c3cad3] rounded-md px-4 py-2 text-sm hover:bg-[#e3e6e6] transition-colors">Search Orders</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-5 sm:gap-6 border-b border-[#D5D9D9] mb-4 text-sm overflow-x-auto no-scrollbar">
          {ORDER_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`pb-2 whitespace-nowrap border-b-[3px] transition-colors ${activeTab === t ? 'border-[#e77600] text-[#c45500] font-bold' : 'border-transparent text-[#565959] hover:text-[#c45500]'}`}
            >
              {t}
            </button>
          ))}
        </div>

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
              className="px-6 py-2 text-[#16181d] font-semibold rounded-full text-sm bg-[#ffcf3f] hover:bg-[#ffc21a] shadow-sm transition-colors"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#0F1111] mb-3"><b>{orders.length} order{orders.length !== 1 ? 's' : ''}</b> placed in the past 3 months</p>

            {orders.map((order) => {
              const statusLabel = STATUS_LABEL[order.status] || order.status;
              const canReturn = ['delivered', 'confirmed', 'pending'].includes(order.status);
              return (
                <div key={order.id} className="bg-white border border-[#D5D9D9] rounded-lg mb-4 overflow-hidden">
                  {/* Header row */}
                  <div className="bg-[#F0F2F2] border-b border-[#D5D9D9] px-4 sm:px-5 py-3 flex flex-wrap gap-4 sm:gap-10 text-xs text-[#565959]">
                    <div>
                      <p className="uppercase tracking-wide text-[10px]">Order placed</p>
                      <p className="text-[#0F1111] text-[13px]">{fmtDate(order.created_at)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-[10px]">Total</p>
                      <p className="text-[#0F1111] text-[13px]">{order.listing_price ? `₹${parseFloat(order.listing_price).toLocaleString('en-IN')}` : '—'}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-wide text-[10px]">Ship to</p>
                      <p className="text-[#007185] text-[13px]">{user?.name?.split(' ')[0] || 'You'}</p>
                    </div>
                    <div className="ml-auto text-right">
                      <p>Order # {String(order.id).padStart(3, '0')}-{String(order.id * 7 % 9999999).padStart(7, '0')}</p>
                      <p className="mt-0.5">
                        <button onClick={() => navigate(`/orders/${order.id}`)} className="text-[#007185] hover:underline">View order details</button>
                        <span className="text-[#c3cad3] mx-1.5">|</span>
                        <span className="text-[#007185] cursor-pointer hover:underline">Invoice</span>
                      </p>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 sm:p-5 flex gap-5 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold text-[#007600] mb-0.5 flex items-center gap-2">
                        {statusLabel}
                        {order.is_p2p && <span className="text-[10px] font-bold px-2 py-0.5 rounded align-middle" style={{ background: '#222f3e', color: '#febd69' }}>REVIVE</span>}
                      </p>
                      <p className="text-xs text-[#565959] mb-3">
                        {order.status === 'delivered' ? 'Package was delivered.' :
                          order.return_window_closes && canReturn ? `Return window closes ${new Date(order.return_window_closes).toLocaleDateString('en-IN')}` :
                          `Source: ${order.listing_source_display || 'Amazon Revive'}`}
                      </p>
                      <div className="flex gap-4">
                        <div className="w-20 h-20 flex-shrink-0 bg-[#F7F8F8] border border-[#D5D9D9] rounded overflow-hidden flex items-center justify-center">
                          {order.listing_image ? (
                            <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-contain p-1"
                              onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : <span className="text-3xl">📦</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#007185] hover:text-[#c45500] cursor-pointer line-clamp-2 leading-snug" onClick={() => navigate(`/product/${order.listing_id || order.id}`)}>{order.listing_title}</p>
                          {order.listing_grade && (
                            <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded ${GRADE_STYLE[order.listing_grade] || ''}`}>
                              Grade {order.listing_grade}{order.listing_grade_display ? ` — ${order.listing_grade_display}` : ''}
                            </span>
                          )}
                          {order.escrow_released === false && order.is_p2p && (
                            <p className="text-xs text-blue-600 mt-1">Payment in escrow — released on delivery confirmation</p>
                          )}
                          <button
                            onClick={() => navigate(`/product/${order.listing_id || order.id}`)}
                            className="mt-2 bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold text-xs rounded-full px-4 py-1.5 transition-colors"
                          >
                            Buy it again
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right action column */}
                    <div className="w-52 flex-shrink-0 hidden md:flex flex-col gap-2">
                      <button onClick={() => navigate(`/orders/${order.id}`)} className="bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold text-[13px] rounded-full py-2 transition-colors">View order details</button>
                      <button onClick={() => navigate(`/track/${order.id}`)} className="bg-white border border-[#c3cad3] hover:bg-[#f5f7f9] text-[#0F1111] text-[13px] rounded-full py-2 transition-colors">Track package</button>
                      {canReturn && (
                        <button onClick={() => navigate(`/return/${order.id}`)} className="bg-white border border-[#c3cad3] hover:bg-[#f5f7f9] text-[#0F1111] text-[13px] rounded-full py-2 transition-colors">Return or replace items</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
};

export default OrdersPage;
