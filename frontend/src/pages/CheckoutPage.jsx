import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import GreenCredits from '../components/stitch/GreenCredits'
import api, { redeemCredits } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { ShoppingCart, ChevronLeft, ShieldCheck, RefreshCw, Leaf, Truck, Lock } from 'lucide-react'

const WHY_REVIVE = [
  { icon: <ShieldCheck className="w-4 h-4 text-[#febd69]" />, bold: 'AI-verified quality', sub: 'Every item graded A–D' },
  { icon: <Lock className="w-4 h-4 text-[#febd69]" />, bold: 'Escrow protection', sub: 'Payment held until delivery' },
  { icon: <RefreshCw className="w-4 h-4 text-[#febd69]" />, bold: '7-day returns', sub: 'Instant Amazon Pay refund' },
  { icon: <Leaf className="w-4 h-4 text-[#febd69]" />, bold: 'Earn Green Credits', sub: 'Saved CO₂ on every order' },
]

const CheckoutPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal, cartItemCount } = useCart()
  const [redeemedCredits, setRedeemedCredits] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [dismissedSizeNudge, setDismissedSizeNudge] = useState(false)

  const finalTotal = Math.max(0, cartTotal - redeemedCredits * 0.1)

  const multiSizeProducts = useMemo(() => {
    const byProduct = {}
    for (const it of cart) {
      const key = it.title || it.id
      if (!byProduct[key]) byProduct[key] = { title: it.title, sizes: new Set(), linkId: it.id }
      if (it.size != null && it.size !== '') byProduct[key].sizes.add(String(it.size))
    }
    return Object.values(byProduct).filter((g) => g.sizes.size >= 2)
  }, [cart])

  const handlePlaceOrder = async () => {
    if (!user) { navigate('/login'); return }
    if (cart.length === 0) return
    try {
      setPlacing(true)
      setError('')
      await Promise.all(cart.flatMap((item) => {
        const qty = item.qty || 1
        return Array.from({ length: qty }, () =>
          api.post('/api/orders/', { listing_id: item.id, size: item.size })
        )
      }))
      if (redeemedCredits > 0) {
        try { await redeemCredits({ listing_price: cartTotal, commit: true }) } catch { /* non-blocking */ }
      }
      clearCart()
      setSuccess(true)
      setTimeout(() => navigate('/orders'), 2500)
    } catch (err) {
      setError(err.response?.data?.error || 'Some items may no longer be available.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Back link */}
        <button onClick={() => navigate(-1)}
          className="bg-white border border-[#D5D9D9] hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-[#0F1111] shadow-sm mb-5 inline-flex items-center gap-2 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Continue Shopping
        </button>

        {/* Page heading */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-[#232F3E] flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-5 h-5 text-[#febd69]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0F1111]">Checkout</h1>
        </div>

        {/* Success banner */}
        {success && (
          <div className="bg-[#131921] rounded-xl overflow-hidden mb-6 shadow-lg">
            <div className="px-6 py-5 flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-[#febd69]/20 border-2 border-[#febd69] flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-[#febd69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <p className="text-[#febd69] text-xs font-bold uppercase tracking-widest mb-0.5">Order Confirmed</p>
                <h2 className="text-white text-xl font-black leading-tight">Order placed successfully!</h2>
                <p className="text-gray-400 text-sm mt-1">Redirecting to your orders…</p>
              </div>
            </div>
            <div className="h-1 w-full bg-[#232F3E]">
              <div className="h-full bg-[#febd69] animate-[shrink_2.5s_linear_forwards]" style={{ width: '100%', animation: 'none', transition: 'width 2.5s linear' }} />
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-5 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse lg:flex-row gap-4 sm:gap-6">

          {/* ── Cart items ── */}
          <div className="flex-grow min-w-0">
            {cart.length === 0 && !success ? (
              <div className="bg-white rounded-xl border border-[#D5D9D9] shadow-sm p-10 text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-5 text-sm">Your cart is empty.</p>
                <button onClick={() => navigate('/')}
                  className="px-6 py-2.5 rounded-lg font-medium text-sm text-[#131921] shadow-sm transition-transform active:scale-95"
                  style={{ background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #f0c040' }}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                {/* Cart header */}
                <div className="px-4 py-3 bg-[#232F3E] flex items-center justify-between">
                  <h2 className="font-bold text-white text-sm sm:text-base">
                    Cart <span className="text-[#febd69]">({cartItemCount} item{cartItemCount !== 1 ? 's' : ''})</span>
                  </h2>
                  <Truck className="w-4 h-4 text-[#febd69]" />
                </div>

                {/* Free delivery banner */}
                <div className="px-4 py-2 bg-[#f0fdf4] border-b border-green-100 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-semibold">FREE delivery on this order</p>
                </div>

                {/* Size nudge */}
                {multiSizeProducts.length > 0 && !dismissedSizeNudge && (
                  <div className="px-4 py-2.5 bg-[#FFFBF0] border-b border-amber-100 flex items-start gap-2.5">
                    <div className="flex-grow min-w-0">
                      <p className="text-xs font-semibold text-[#0F1111]">
                        We noticed you've added multiple sizes of{' '}
                        <strong>{multiSizeProducts[0].title}</strong>
                        {multiSizeProducts.length > 1 ? ' (and other items)' : ''}. Unsure which to keep?
                      </p>
                      <button onClick={() => navigate(`/product/${multiSizeProducts[0].linkId}`)}
                        className="text-[11px] font-semibold text-[#007185] hover:underline mt-0.5">
                        See the best size for you on the product page →
                      </button>
                    </div>
                    <button onClick={() => setDismissedSizeNudge(true)}
                      className="flex-shrink-0 text-[11px] font-semibold text-[#007185] hover:underline whitespace-nowrap mt-0.5">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Items */}
                <div className="divide-y divide-[#F0F2F2]">
                  {cart.map((item) => {
                    const isUnique = item.source && item.source !== 'new'
                    const itemQty = item.qty || 1
                    const maxQty = item.maxStock || (isUnique ? 1 : 10)
                    return (
                      <div key={item.id} className="flex gap-3 sm:gap-4 p-4">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#F7F8F8] rounded-lg flex-shrink-0 overflow-hidden border border-[#D5D9D9]">
                          {item.image && (
                            <img src={item.image} alt={item.title} className="w-full h-full object-contain p-1" />
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="font-semibold text-xs sm:text-sm text-[#0F1111] line-clamp-2 leading-snug">{item.title}</p>
                          {item.grade && (
                            <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#232F3E] text-[#febd69]">
                              Grade {item.grade}
                            </span>
                          )}
                          <p className="font-bold text-[#0F1111] mt-1.5 text-sm sm:text-base">
                            ₹{(parseFloat(item.price) * itemQty).toLocaleString('en-IN')}
                            {itemQty > 1 && <span className="text-xs text-gray-400 font-normal ml-1">(₹{parseFloat(item.price).toLocaleString('en-IN')} each)</span>}
                          </p>

                          {/* Qty controls */}
                          <div className="flex items-center gap-3 mt-2.5">
                            <div className="inline-flex items-center border border-[#D5D9D9] rounded-lg overflow-hidden shadow-sm">
                              <button
                                onClick={() => itemQty <= 1 ? removeFromCart(item.id) : updateQuantity(item.id, itemQty - 1)}
                                className="w-8 h-8 flex items-center justify-center text-sm font-bold text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6] transition-colors border-r border-[#D5D9D9]"
                              >
                                {itemQty === 1 ? (
                                  <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                ) : '−'}
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-[#0F1111] bg-white py-1.5">{itemQty}</span>
                              <button
                                onClick={() => updateQuantity(item.id, itemQty + 1)}
                                disabled={itemQty >= maxQty}
                                className={`w-8 h-8 flex items-center justify-center text-sm font-bold transition-colors border-l border-[#D5D9D9]
                                  ${itemQty >= maxQty ? 'text-gray-300 bg-[#F0F2F2] cursor-not-allowed' : 'text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6]'}`}
                              >+</button>
                            </div>
                            <button onClick={() => removeFromCart(item.id)}
                              className="text-xs text-[#c45500] hover:underline font-medium">
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          {(cart.length > 0 || success) && (
            <div className="lg:w-80 flex-shrink-0 space-y-3 sm:space-y-4">

              {/* Green Credits */}
              <GreenCredits onRedeem={setRedeemedCredits} cartTotal={cartTotal} />

              {/* Why Revive */}
              {/* <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                <div className="px-4 py-3 bg-[#232F3E]">
                  <p className="text-sm font-bold text-[#febd69]">Why Revive?</p>
                </div>
                <ul className="divide-y divide-[#F0F2F2]">
                  {WHY_REVIVE.map(({ icon, bold, sub }) => (
                    <li key={bold} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#232F3E]/10 flex items-center justify-center flex-shrink-0">
                        {icon}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#0F1111]">{bold}</span>
                        <span className="text-xs text-gray-400"> — {sub}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div> */}

              {/* Green credits promise */}
              <div className="bg-[#131921] rounded-xl px-4 py-3 flex items-start gap-3">
                <Leaf className="w-4 h-4 text-[#febd69] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300 leading-snug">
                  Keep this order → <span className="text-[#febd69] font-bold">+15 Green Credits</span> vest when your 7-day return window closes.
                </p>
              </div>

              {/* Order summary */}
              <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                <div className="px-4 py-3 bg-[#232F3E]">
                  <h2 className="font-bold text-[#febd69] text-sm sm:text-base">Order Summary</h2>
                </div>
                <div className="p-4 space-y-2.5">
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                    <span>Subtotal ({cartItemCount} items)</span>
                    <span className="font-semibold text-[#0F1111]">₹{cartTotal.toLocaleString('en-IN')}</span>
                  </div>
                  {redeemedCredits > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-green-600">
                      <span>Green Credits discount</span>
                      <span className="font-semibold">-₹{(redeemedCredits * 0.1).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                    <span>Delivery</span>
                    <span className="text-green-600 font-bold">FREE</span>
                  </div>

                  <div className="border-t border-[#D5D9D9] pt-2.5 flex justify-between font-bold text-[#0F1111] text-sm sm:text-base">
                    <span>Order Total</span>
                    <span>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing || success}
                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 shadow-sm
                      ${placing || success
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'text-[#131921] hover:shadow-md'}`}
                    style={placing || success ? {} : { background: 'linear-gradient(180deg,#ffd99e,#febd69)', border: '1px solid #f0c040' }}
                  >
                    {placing ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" /></svg>
                        Placing Order…
                      </span>
                    ) : 'Place Order'}
                  </button>

                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <p className="text-xs text-gray-400">Secure checkout · Amazon Pay</p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CheckoutPage
