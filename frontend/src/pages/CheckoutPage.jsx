import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import GreenCredits from '../components/stitch/GreenCredits'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const CheckoutPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cart, removeFromCart, clearCart, cartTotal } = useCart()
  const [redeemedCredits, setRedeemedCredits] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const finalTotal = Math.max(0, cartTotal - redeemedCredits * 0.1)

  const handlePlaceOrder = async () => {
    if (!user) { navigate('/login'); return }
    if (cart.length === 0) return
    try {
      setPlacing(true)
      setError('')
      await Promise.all(cart.map((item) => api.post('/api/orders/', { listing_id: item.id })))
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
          <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium mb-4 text-sm">
            Order placed! Redirecting to your orders…
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
                    Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})
                  </h2>
                </div>

                {/* Return prevention nudge — Pillar 4 */}
                <div className="px-3 sm:px-4 py-2.5 bg-[#FFFBF0] border-b border-amber-100 flex items-start gap-2.5">
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-semibold text-[#0F1111]">
                      Customers with your profile kept <strong>size 8</strong> in this brand — size 9 was returned 3× more.
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">AI fit intelligence · Pillar 4 – Return Prevention</p>
                  </div>
                  <button className="flex-shrink-0 text-[11px] font-semibold text-[#007185] hover:underline whitespace-nowrap mt-0.5">
                    Dismiss
                  </button>
                </div>

                {cart.map((item) => (
                  <div key={item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                      {item.image && (
                        <img src={item.image} alt={item.title} className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-semibold text-xs sm:text-sm text-[#0F1111] line-clamp-2">{item.title}</p>
                      {item.grade && (
                        <span className="text-[10px] font-bold text-green-700">Grade {item.grade}</span>
                      )}
                      <p className="font-bold text-[#0F1111] mt-1 text-sm">
                        ₹{parseFloat(item.price).toLocaleString('en-IN')}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-[#007185] hover:underline text-xs self-start flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Order summary sidebar ── */}
          {(cart.length > 0 || success) && (
            <div className="lg:w-72 flex-shrink-0 space-y-3 sm:space-y-4">
              <GreenCredits onRedeem={setRedeemedCredits} />

              {/* Green credits promise — Pillar 5 */}
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                <p className="text-xs text-green-800 leading-snug">
                  Keep this order → <strong>+15 Green Credits</strong> vest when your 7-day return window closes.
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-[#D5D9D9] p-3 sm:p-4 space-y-2 sm:space-y-3">
                <h2 className="font-bold text-[#0F1111] text-sm sm:text-base">Order Summary</h2>

                <div className="flex justify-between text-xs sm:text-sm text-gray-600">
                  <span>Subtotal ({cart.length} items)</span>
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
