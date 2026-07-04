import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '@amazon-hackon/shared';
import { useAuth } from '../context/AuthContext';

const GRADE_STYLE = {
  A: 'bg-[#e6f4ea] text-[#107a45]', B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]', D: 'bg-[#fbe5e3] text-[#b3261e]',
};
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/orders/')
      .then((res) => setOrder((res.data.results || []).find((o) => String(o.id) === String(id)) || null))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="min-h-screen bg-white"><Header /><div className="max-w-5xl mx-auto p-8 text-center text-gray-500">Loading…</div></div>;
  if (!order) return (
    <div className="min-h-screen bg-white"><Header />
      <div className="max-w-5xl mx-auto p-10 text-center">
        <p className="text-gray-500 mb-4 text-sm">Order not found.</p>
        <button onClick={() => navigate('/orders')} className="bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold rounded-full px-5 py-2 text-sm">Back to Your Orders</button>
      </div>
    </div>
  );

  const price = order.listing_price ? parseFloat(order.listing_price) : 0;
  const orderNum = `${String(order.id).padStart(3, '0')}-${String(order.id * 7 % 9999999).padStart(7, '0')}`;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-6">
        <div className="bg-white border border-[#D5D9D9] rounded-lg p-5 sm:p-7">
          {/* Breadcrumb */}
          <div className="text-xs text-[#007185] mb-2">
            <button onClick={() => navigate('/orders')} className="hover:underline">Your Account</button> ›{' '}
            <button onClick={() => navigate('/orders')} className="hover:underline">Your Orders</button> ›{' '}
            <span className="text-[#c45500]">Order Details</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-medium text-[#0F1111] mb-2">Order Details</h1>
          <div className="flex items-center gap-3 border-b border-[#eef1f4] pb-3 text-[13px] text-[#2b3440] flex-wrap">
            <span>Ordered on {fmtDate(order.created_at)}</span>
            <span className="text-[#c3cad3]">|</span>
            <span>Order# {orderNum}</span>
            <span className="ml-auto text-[#007185] cursor-pointer hover:underline">Invoice ▾</span>
          </div>

          {/* Summary box */}
          <div className="border border-[#D5D9D9] rounded-lg p-5 grid grid-cols-1 sm:grid-cols-3 gap-6 my-5">
            <div>
              <p className="text-sm font-bold text-[#0F1111] mb-2">Ship to</p>
              <div className="text-[13px] text-[#2b3440] leading-relaxed">
                <p className="font-semibold">{user?.name || 'Amazon Customer'}</p>
                <p>No. 24, 3rd Cross, HSR Layout</p>
                <p>Bengaluru, Karnataka 560100</p>
                <p>India</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F1111] mb-2">Payment method</p>
              <p className="text-[13px] text-[#2b3440]">Amazon Pay UPI</p>
              {order.is_p2p && <p className="text-[12px] text-blue-600 mt-1">Escrow protected</p>}
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F1111] mb-2">Order Summary</p>
              <div className="text-[13px] text-[#2b3440] space-y-1">
                <div className="flex justify-between"><span>Item(s) Subtotal:</span><span>₹{price.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>Shipping:</span><span>₹0.00</span></div>
                <div className="flex justify-between"><span>Total:</span><span>₹{price.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>Promotion Applied:</span><span>−₹0.00</span></div>
                <div className="flex justify-between font-bold text-[#c45500] border-t border-[#eef1f4] pt-1.5 mt-1"><span>Grand Total:</span><span>₹{price.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>

          {/* Item card */}
          <div className="border border-[#D5D9D9] rounded-lg overflow-hidden">
            <div className="bg-[#F0F2F2] px-5 py-2.5 text-sm font-bold text-[#007600] capitalize">{order.status === 'delivered' ? 'Delivered' : 'Arriving soon'}</div>
            <div className="p-5 flex gap-5 items-start flex-wrap">
              <div className="w-24 h-24 flex-shrink-0 bg-[#F7F8F8] border border-[#D5D9D9] rounded overflow-hidden flex items-center justify-center">
                {order.listing_image ? <img src={order.listing_image} alt={order.listing_title} className="w-full h-full object-contain p-1" onError={(e) => { e.target.style.display = 'none'; }} /> : <span className="text-3xl">📦</span>}
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-[#007185] hover:text-[#c45500] cursor-pointer leading-snug" onClick={() => navigate(`/product/${order.listing_id || order.id}`)}>{order.listing_title}</p>
                {order.listing_grade && <span className={`inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded ${GRADE_STYLE[order.listing_grade] || ''}`}>Grade {order.listing_grade}</span>}
                <p className="text-sm font-bold text-[#0F1111] mt-1">₹{price.toLocaleString('en-IN')}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <button onClick={() => navigate(`/product/${order.listing_id || order.id}`)} className="bg-[#ffcf3f] hover:bg-[#ffc21a] text-[#16181d] font-semibold text-xs rounded-full px-4 py-1.5 transition-colors">Buy it again</button>
                  <button onClick={() => navigate(`/track/${order.id}`)} className="bg-white border border-[#c3cad3] hover:bg-[#f5f7f9] text-[#0F1111] text-xs rounded-full px-4 py-1.5 transition-colors">Track package</button>
                  {['delivered', 'confirmed', 'pending'].includes(order.status) && (
                    <button onClick={() => navigate(`/return/${order.id}`)} className="bg-white border border-[#c3cad3] hover:bg-[#f5f7f9] text-[#0F1111] text-xs rounded-full px-4 py-1.5 transition-colors">Return or replace</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderDetailsPage;
