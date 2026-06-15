import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import GreenCredits from '../components/stitch/GreenCredits'
import ReturnNudge from '../components/stitch/ReturnNudge'
import api, { redeemCredits } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const CheckoutPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, removeFromCart, updateQuantity, clearCart, cartTotal, cartItemCount } = useCart()
  const [redeemedCredits, setRedeemedCredits] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [risk, setRisk] = useState(null)

  const finalTotal = Math.max(0, cartTotal - redeemedCredits * 0.1)

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
      // Pillar 5: actually record the credit spend so the balance drops (the toggle
      // only previewed the discount). 20% cap on the cart total, server-validated.
      if (redeemedCredits > 0) {
        try { await redeemCredits({ listing_price: cartTotal, commit: true }) } catch { /* non-blocking */ }
      }
      clearCart()
      setSuccess(true)
      setTimeout(() => navigate('/orders'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Some items may no longer be available.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-[#0F1111] mb-4 sm:mb-6">Checkout</h1>

        {success && (
          <div className="bg-white border border-[#D5D9D9] rounded-lg p-8 text-center shadow-sm mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #077a52, #0a8f63)' }}>
              <svg className="w-7 h-7 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
              </svg>
            </div>
            <h2 className="text-xl font-black text-[#0F1111] mb-1">Order placed!</h2>
            <p className="text-sm text-gray-500">Heading to your orders…</p>
          </div>
        )}
        {error && (
          <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Mobile: order summary first, then cart items */}
        <div className="flex flex-col-reverse lg:flex-row gap-4 sm:gap-6">

          {/* ── Cart items ── */}
          <div className="flex-grow min-w-0">
            {cart.length === 0 && !success ? (
              <div className="bg-white rounded-lg border border-[#D5D9D9] shadow-sm p-8 sm:p-10 text-center">
                <p className="text-gray-500 mb-4 text-sm">Your cart is empty.</p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2 bg-[#febd69] rounded font-bold text-sm"
                >
                  Continue Shopping
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm divide-y border border-[#D5D9D9]">
                <div className="px-3 sm:px-4 py-3 border-b border-[#D5D9D9]">
                  <h2 className="font-bold text-[#0F1111] text-sm sm:text-base">
                    Cart ({cartItemCount} item{cartItemCount !== 1 ? 's' : ''})
                  </h2>
                </div>

                {/* Single return-prevention nudge (Pillar 4): bracketeering banner +
                    the review-derived sizing line, de-duplicated inside <ReturnNudge>. */}
                {risk && risk.bracket_nudge && (
                  <div className="px-3 sm:px-4 pt-3">
                    <ReturnNudge risk={risk} />
                  </div>
                )}

                {cart.map((item) => {
                  const isUnique = item.source && item.source !== 'new'
                  const itemQty = item.qty || 1
                  const maxQty = item.maxStock || (isUnique ? 1 : 10)
                  return (
                  <div key={item.lineKey || item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-[#0F1111] line-clamp-2">{item.title}</p>
                      {item.size != null && item.size !== '' && (
                        <span className="inline-block text-[10px] font-bold text-[#0F1111] bg-[#F0F2F2] border border-[#D5D9D9] rounded px-1.5 py-0.5 mt-0.5">Size: {item.size}</span>
                      )}
                      {item.grade && (
                        <span className="text-[10px] font-bold text-green-700 ml-1">Grade {item.grade}</span>
                      )}
                      <p className="font-bold text-[#0F1111] mt-1 text-sm">
                        ₹{(parseFloat(item.price) * itemQty).toLocaleString('en-IN')}
                        {itemQty > 1 && <span className="text-xs text-gray-400 font-normal ml-1">(₹{parseFloat(item.price).toLocaleString('en-IN')} each)</span>}
                      </p>
                      {/* Quantity controls */}
                      <div className="flex items-center gap-0 mt-2">
                        <div className="inline-flex items-center border border-[#D5D9D9] rounded-lg overflow-hidden">
                          <button
                            onClick={() => itemQty <= 1 ? removeFromCart(item.lineKey) : updateQuantity(item.lineKey, itemQty - 1)}
                            className="w-8 h-8 flex items-center justify-center text-sm font-bold text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6] transition-colors border-r border-[#D5D9D9]"
                          >
                            {itemQty === 1 ? (
                              <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                            ) : '−'}
                          </button>
                          <span className="w-10 text-center text-xs font-bold text-[#0F1111] bg-white py-1.5">{itemQty}</span>
                          <button
                            onClick={() => updateQuantity(item.lineKey, itemQty + 1)}
                            disabled={itemQty >= maxQty}
                            className={`w-8 h-8 flex items-center justify-center text-sm font-bold transition-colors border-l border-[#D5D9D9]
                              ${itemQty >= maxQty ? 'text-gray-300 bg-[#F0F2F2] cursor-not-allowed' : 'text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6]'}`}
                          >
                            +
                          </button>
                        </div>
                        <span className="mx-2 text-gray-300">|</span>
                        <button
                          onClick={() => removeFromCart(item.lineKey)}
                          className="text-[#007185] hover:underline hover:text-[#c45500] text-xs"
                        >
                          Delete
                        </button>
                        {isUnique && <span className="text-[10px] text-amber-600 ml-2">One-of-a-kind</span>}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Order summary sidebar ── */}
          {(cart.length > 0 || success) && (
            <div className="lg:w-72 flex-shrink-0 space-y-3 sm:space-y-4">
              {hasSecondLife && <GreenCredits onRedeem={setRedeemedCredits} cartTotal={cartTotal} />}

              {/* Green credits promise — Pillar 5 (second-life purchases only) */}
              {hasSecondLife && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-green-800 leading-snug">
                    Keep this order &rarr; <strong>+15 Green Credits</strong> vest when your 7-day return window closes.
                  </p>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm border border-[#D5D9D9] p-3 sm:p-4 space-y-2 sm:space-y-3">
                <h2 className="font-bold text-[#0F1111] text-sm sm:text-base">Order Summary</h2>

                <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                  <span>Subtotal ({cartItemCount} items)</span>
                  <span>₹{cartTotal.toLocaleString('en-IN')}</span>
                </div>
                {redeemedCredits > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-green-600">
                    <span>Green Credits</span>
                    <span>-₹{(redeemedCredits * 0.1).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                  <span>Delivery</span>
                  <span className="text-green-700 font-semibold">FREE</span>
                </div>

                <hr className="border-[#D5D9D9]" />

                <div className="flex justify-between font-bold text-[#0F1111] text-sm sm:text-base">
                  <span>Order Total</span>
                  <span>₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={placing || success}
                  className={`w-full py-2.5 sm:py-3 rounded font-bold text-sm transition-colors
                    ${placing || success
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-[#FF9900] hover:bg-[#e88b00] text-white'}`}
                >
                  {placing ? 'Placing Order…' : 'Place Order'}
                </button>
                <p className="text-xs text-gray-400 text-center">Secure checkout · Amazon Pay</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default CheckoutPage
