import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import GreenCredits from '../components/stitch/GreenCredits'
import ReturnNudge from '../components/stitch/ReturnNudge'
import api, { redeemCredits, getRecommendations } from '../api/client'
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
  const [risk, setRisk] = useState(null)
  const [recs, setRecs] = useState([])

  const finalTotal = Math.max(0, cartTotal - redeemedCredits * 0.1)

  // "Recommendations for you" sidebar panel (matches the real Amazon cart page).
  useEffect(() => {
    getRecommendations(6)
      .then((res) => setRecs(res.data.results || []))
      .catch(() => setRecs([]))
  }, [])

  // Green Credits are the second-life / sustainability reward — they only apply when
  // the cart contains a Revive/Renewed item. A brand-new product (e.g. the iQOO) earns
  // none, so we hide the redeem widget + the "keep this → +credits" promise for it.
  const hasSecondLife = cart.some((it) => it.source && it.source !== 'new')

  // Pillar-4 return-risk: ask the backend to score the cart (it resolves each line
  // listing→product and folds in the mined review fit-signal), then surface the
  // review-derived sizing nudge via <ReturnNudge>. Keyed on the listing ids in cart.
  const cartIdsKey = cart.map((it) => `${it.id}:${it.size || ''}`).join(',')
  useEffect(() => {
    if (cart.length === 0) { setRisk(null); return }
    let alive = true
    api
      .post('/api/prevent/risk/', {
        cart: cart.map((it) => ({ listing_id: it.id, size: it.size })),
      })
      .then((res) => alive && setRisk(res.data))
      .catch(() => alive && setRisk(null))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartIdsKey])

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
    <div className="bg-white min-h-screen">
      <Header />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Back link */}
        <button onClick={() => navigate(-1)}
          className="bg-white border border-[#D5D9D9] hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium text-[#0F1111] shadow-sm mb-5 inline-flex items-center gap-2 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Continue Shopping
        </button>

        {/* Page heading */}
        <h1 className="text-2xl sm:text-3xl font-medium text-[#0F1111] border-b border-[#eef1f4] pb-3 mb-5">Shopping Cart</h1>

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
                  style={{ background: '#ffcf3f' }}>
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                {/* Cart header */}
                <div className="px-4 sm:px-5 py-3 flex items-center justify-between border-b border-[#eef1f4]">
                  <h2 className="font-semibold text-[#0F1111] text-base">
                    Cart <span className="text-[#565959] font-normal">({cartItemCount} item{cartItemCount !== 1 ? 's' : ''})</span>
                  </h2>
                  <span className="text-xs text-[#565959]">Price</span>
                </div>

                {/* Single return-prevention nudge (Pillar 4): bracketeering banner +
                    the review-derived sizing line, de-duplicated inside <ReturnNudge>. */}
                {risk && risk.bracket_nudge && (
                  <div className="px-3 sm:px-4 pt-3">
                    <ReturnNudge risk={risk} />
                  </div>
                )}

                {/* Free delivery banner */}
                <div className="px-4 py-2 bg-[#f0fdf4] border-b border-green-100 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  <p className="text-xs text-green-700 font-semibold">FREE delivery on this order</p>
                </div>

                {/* Items */}
                <div className="divide-y divide-[#F0F2F2]">
                  {cart.map((item) => {
                    const isUnique = item.source && item.source !== 'new'
                    const itemQty = item.qty || 1
                    const maxQty = item.maxStock || (isUnique ? 1 : 10)
                    return (
                      <div key={item.lineKey || item.id} className="flex gap-4 p-4 sm:p-5">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#F7F8F8] rounded-lg flex-shrink-0 overflow-hidden border border-[#D5D9D9]">
                          {item.image && (
                            <img src={item.image} alt={item.title} className="w-full h-full object-contain p-1" />
                          )}
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-sm sm:text-base font-medium text-[#0F1111] line-clamp-2 leading-snug">{item.title}</p>
                          <p className="text-xs text-[#007600] mt-1">In stock</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {item.size != null && item.size !== '' && (
                              <span className="inline-block text-[10px] font-bold text-[#0F1111] bg-[#F0F2F2] border border-[#D5D9D9] rounded px-1.5 py-0.5">Size: {item.size}</span>
                            )}
                            {item.grade && (
                              <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-[#232F3E] text-[#febd69]">Grade {item.grade}</span>
                            )}
                            {isUnique && <span className="text-[10px] text-amber-600">One-of-a-kind</span>}
                          </div>

                          {/* Qty controls (pill) */}
                          <div className="flex items-center gap-4 mt-3">
                            <div className="inline-flex items-center border border-[#c3cad3] rounded-full overflow-hidden">
                              <button
                                onClick={() => itemQty <= 1 ? removeFromCart(item.lineKey) : updateQuantity(item.lineKey, itemQty - 1)}
                                className="px-3.5 py-1.5 text-base text-[#0F1111] bg-[#f5f7f9] hover:bg-[#e3e6e6] transition-colors"
                              >−</button>
                              <span className="px-3 text-sm font-semibold text-[#0F1111]">{itemQty}</span>
                              <button
                                onClick={() => updateQuantity(item.lineKey, itemQty + 1)}
                                disabled={itemQty >= maxQty}
                                className={`px-3.5 py-1.5 text-base transition-colors ${itemQty >= maxQty ? 'text-gray-300 bg-[#f5f7f9] cursor-not-allowed' : 'text-[#0F1111] bg-[#f5f7f9] hover:bg-[#e3e6e6]'}`}
                              >+</button>
                            </div>
                            <button onClick={() => removeFromCart(item.lineKey)}
                              className="text-sm text-[#007185] hover:text-[#c45500] hover:underline">
                              Delete
                            </button>
                          </div>
                        </div>
                        {/* Line total (right) */}
                        <div className="text-base sm:text-lg font-bold text-[#0F1111] whitespace-nowrap">
                          ₹{(parseFloat(item.price) * itemQty).toLocaleString('en-IN')}
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
              {hasSecondLife && <GreenCredits onRedeem={setRedeemedCredits} cartTotal={cartTotal} />}

              {/* Green credits promise — Pillar 5 (second-life purchases only) */}
              {hasSecondLife && (
                <div className="bg-[#131921] rounded-xl px-4 py-3 flex items-start gap-3">
                  <Leaf className="w-4 h-4 text-[#febd69] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-300 leading-snug">
                    Keep this order → <span className="text-[#febd69] font-bold">+15 Green Credits</span> vest when your 7-day return window closes.
                  </p>
                </div>
              )}

              {/* Order summary */}
              <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                <div className="p-4 sm:p-5 space-y-2.5">
                  <h2 className="font-bold text-[#0F1111] text-base mb-1">Order Summary</h2>
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

                  <label className="flex items-center gap-2 text-xs text-[#2b3440] py-1 cursor-pointer">
                    <input type="checkbox" className="accent-[#232F3E] w-3.5 h-3.5" /> This order contains a gift
                  </label>

                  <button
                    onClick={handlePlaceOrder}
                    disabled={placing || success}
                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all active:scale-95 shadow-sm
                      ${placing || success
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'text-[#131921] hover:shadow-md'}`}
                    style={placing || success ? {} : { background: '#ffcf3f' }}
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

              {/* Recommendations panel — matches the real Amazon cart sidebar */}
              {recs.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-[#D5D9D9] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#F0F2F2]">
                    <h2 className="font-bold text-[#0F1111] text-sm">Recommendations for you</h2>
                  </div>
                  <ul className="divide-y divide-[#F0F2F2]">
                    {recs.map((l) => (
                      <li key={l.id}>
                        <button
                          onClick={() => navigate(`/product/${l.id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F8F8] transition-colors"
                        >
                          <div className="w-12 h-12 flex-shrink-0 bg-[#F7F8F8] rounded border border-[#D5D9D9] flex items-center justify-center overflow-hidden">
                            <img src={l.image} alt={l.product?.title}
                              className="max-w-full max-h-full object-contain mix-blend-multiply"
                              onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=Item' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-[#0F1111] line-clamp-2 leading-snug">{l.product?.title}</p>
                            <p className="text-sm font-bold text-[#0F1111] mt-0.5">₹{parseFloat(l.price).toLocaleString('en-IN')}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CheckoutPage
