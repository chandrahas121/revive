import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import HealthCard from '../components/stitch/HealthCard'
import VirtualTryOn from '../components/stitch/VirtualTryOn'
import api, { getHealthCard } from '../api/client'
import { useCart } from '../context/CartContext'

const CLOTHING_KEYWORDS = ['clothing', 'fashion', 'apparel', 'garment', 'textile', 'wear', 'shirt', 'dress', 'jacket', 'pants', 'jeans', 'top', 'blouse', 'skirt', 'coat', 'shoes', 'footwear']

const isClothing = (category = '') =>
  CLOTHING_KEYWORDS.some((kw) => category.toLowerCase().includes(kw))

const GRADE_STYLE = {
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  C: 'bg-orange-100 text-orange-800 border-orange-200',
  D: 'bg-red-100 text-red-800 border-red-200',
}

const SOURCE_LABEL = {
  p2p:       'REVIVE – P2P',
  renewed:   'Amazon Renewed',
  warehouse: 'Warehouse Deal',
  return:    'Amazon Return',
}

const GRADE_TEXT_COLOR = {
  A: 'text-green-700',
  B: 'text-yellow-700',
  C: 'text-orange-700',
  D: 'text-red-700',
}

const ProductDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart, cart } = useCart()

  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [added, setAdded] = useState(false)
  const [showHealthCard, setShowHealthCard] = useState(false)
  const [cardData, setCardData] = useState(null)
  const [cardLoading, setCardLoading] = useState(false)

  useEffect(() => {
    api.get(`/api/listings/${id}/`)
      .then((res) => setListing(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [id])

  const inCart = cart.some((item) => Number(item.id) === Number(id))

  const handleViewHealthCard = async () => {
    setShowHealthCard(true)
    if (!cardData && !cardLoading) {
      setCardLoading(true)
      try {
        const res = await getHealthCard(listing.id)
        setCardData(res.data)
      } catch {
        // card not yet generated — falls back to prop-based display
      } finally {
        setCardLoading(false)
      }
    }
  }

  const handleAddToCart = () => {
    if (!listing) return
    addToCart({
      id: listing.id,
      title: listing.product.title,
      price: listing.price,
      image: listing.image,
      grade: listing.grade,
      source: listing.source,
    })
    setAdded(true)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="lg:w-2/5 h-64 sm:h-80 bg-gray-200 rounded-lg" />
            <div className="lg:w-2/5 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-20 bg-gray-100 rounded" />
            </div>
            <div className="lg:w-1/5 h-48 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )

  if (notFound || !listing) return (
    <div className="min-h-screen bg-[#EAEDED]">
      <Header />
      <div className="p-8 sm:p-10 text-center">
        <p className="text-gray-500 mb-4 text-sm">Listing not found.</p>
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-[#febd69] rounded font-semibold text-sm">
          Back to Marketplace
        </button>
      </div>
    </div>
  )

  const product = listing.product
  const price = parseFloat(listing.price)
  const mrp = product.mrp ? parseFloat(product.mrp) : null
  const savings = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null

  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        <button
          onClick={() => navigate(-1)}
          className="text-[#007185] hover:underline text-xs sm:text-sm mb-3 sm:mb-4 inline-flex items-center gap-1"
        >
          ← Back to results
        </button>

        {/* Mobile: image → buy box → details | Desktop: image → details → buy box */}
        <div className="flex flex-col lg:flex-row gap-0 sm:gap-4">

          {/* ── Image panel ── */}
          <div className="lg:w-[38%] order-1 flex-shrink-0">
            <div className="bg-white border border-[#D5D9D9] rounded-lg flex items-center justify-center min-h-[240px] sm:min-h-[320px] lg:min-h-[420px] p-8">
              <img
                src={listing.image}
                alt={product.title}
                className="max-w-full max-h-56 sm:max-h-72 lg:max-h-96 object-contain mix-blend-multiply"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=No+Image' }}
              />
            </div>
          </div>

          {/* ── Product details ── */}
          <div className="lg:flex-1 order-3 lg:order-2 min-w-0 bg-white border-t border-b border-[#D5D9D9] lg:border lg:rounded-lg px-4 py-4 sm:px-5">

            {/* Source label */}
            {listing.source && (
              <p className="text-sm text-[#007185] font-semibold mb-1">
                {SOURCE_LABEL[listing.source] || listing.source_display}
              </p>
            )}

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-medium text-[#0F1111] leading-snug mb-2">
              {product.title}
            </h1>

            {/* Condition */}
            {listing.grade && (
              <p className="text-sm text-gray-600 mb-3">
                Condition:{' '}
                <span className={`font-semibold ${GRADE_TEXT_COLOR[listing.grade] || ''}`}>
                  {listing.grade_display || `Grade ${listing.grade}`}
                </span>
              </p>
            )}

            {/* Stars */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex leading-none">
                {[1, 2, 3, 4].map((i) => <span key={i} className="text-[#FF9900]">★</span>)}
                <span className="text-[#D5D9D9]">★</span>
              </div>
              <span className="text-[#007185] text-sm hover:underline hover:text-[#c45500] cursor-pointer">
                142 ratings
              </span>
            </div>

            <hr className="border-[#D5D9D9] mb-4" />

            {/* Price */}
            <div className="mb-4">
              {mrp && mrp > price && (
                <p className="text-xs text-gray-500 mb-0.5">
                  M.R.P.:{' '}
                  <span className="line-through">₹{mrp.toLocaleString('en-IN')}</span>
                  {savings && <span className="text-[#CC0C39] font-medium ml-1">({savings}% off)</span>}
                </p>
              )}
              <span className="text-3xl font-bold text-[#0F1111]">
                ₹{price.toLocaleString('en-IN')}
              </span>
              <p className="text-xs text-gray-500 mt-0.5">Inclusive of all taxes</p>
            </div>

            {/* AI Condition Notes */}
            {listing.condition_summary && (
              <div className="border-l-4 border-[#FF9900] bg-[#FFFBF0] rounded-r p-3 mb-4">
                <p className="text-xs font-bold text-[#0F1111] mb-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-[#FF9900]" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  AI Condition Notes
                </p>
                <p className="text-sm text-gray-700 leading-relaxed">{listing.condition_summary}</p>
              </div>
            )}

            {/* Delivery / Returns / Ships from / Sold by */}
            <div className="border border-[#D5D9D9] rounded divide-y divide-[#D5D9D9] mb-5 text-sm">
              <div className="flex px-3 py-2.5 gap-3">
                <span className="text-[#0F1111] font-semibold w-20 flex-shrink-0">Delivery</span>
                <span className="text-[#007600] font-semibold">FREE delivery by Tomorrow</span>
              </div>
              <div className="flex px-3 py-2.5 gap-3">
                <span className="text-[#0F1111] font-semibold w-20 flex-shrink-0">Returns</span>
                <span className="text-[#0F1111]">7-day return window via Amazon Revive</span>
              </div>
              <div className="flex px-3 py-2.5 gap-3">
                <span className="text-[#0F1111] font-semibold w-20 flex-shrink-0">Ships from</span>
                <span className="text-[#0F1111]">Amazon Revive</span>
              </div>
              {listing.seller_name && (
                <div className="flex px-3 py-2.5 gap-3">
                  <span className="text-[#0F1111] font-semibold w-20 flex-shrink-0">Sold by</span>
                  <span className="text-[#007185] hover:underline cursor-pointer">{listing.seller_name}</span>
                </div>
              )}
            </div>

            {/* About this item */}
            {product.description && (
              <div className="mb-3">
                <p className="text-base font-bold text-[#0F1111] mb-2">About this item</p>
                <p className="text-sm text-[#0F1111] leading-relaxed">{product.description}</p>
              </div>
            )}

            {product.category && (
              <p className="text-xs text-gray-400 mt-2">Category: {product.category}</p>
            )}
          </div>

          {/* ── Buy box ── */}
          <div className="lg:w-60 xl:w-64 order-2 lg:order-3 flex-shrink-0">
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-4 space-y-3 lg:sticky lg:top-4">

              <div>
                <p className="text-2xl font-bold text-[#0F1111]">₹{price.toLocaleString('en-IN')}</p>
                {mrp && mrp > price && (
                  <p className="text-xs text-gray-500">
                    M.R.P.: <span className="line-through">₹{mrp.toLocaleString('en-IN')}</span>
                    {savings && <span className="text-[#CC0C39] ml-1">({savings}% off)</span>}
                  </p>
                )}
              </div>

              <p className="text-sm">
                <span className="text-[#007600] font-semibold">FREE Delivery</span>
                <span className="text-[#0F1111]"> by Tomorrow</span>
              </p>

              <p className="text-lg text-[#007600]">In Stock</p>

              {listing.source === 'p2p' && (
                <p className="text-xs text-gray-500 bg-[#F0F2F2] border border-[#D5D9D9] rounded p-2 leading-relaxed">
                  Ships from Amazon Hub after seller verification
                </p>
              )}

              <button
                onClick={handleAddToCart}
                disabled={inCart || added}
                className={`w-full py-2 rounded text-sm font-bold border transition-colors
                  ${inCart || added
                    ? 'bg-[#F0F2F2] text-gray-400 cursor-default border-[#D5D9D9]'
                    : 'text-[#131921] border-[#f0c040] shadow-sm active:scale-95'}`}
                style={(inCart || added) ? {} : { background: 'linear-gradient(180deg, #ffd99e, #febd69)' }}
              >
                {inCart || added ? 'Added to Cart' : 'Add to Cart'}
              </button>

              <button
                onClick={() => { handleAddToCart(); navigate('/checkout') }}
                className="w-full py-2 rounded text-sm font-bold text-white border border-[#e07000] shadow-sm transition-colors active:scale-95"
                style={{ background: 'linear-gradient(180deg, #ffac31, #FF9900)' }}
              >
                Buy Now
              </button>

              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" />
                </svg>
                <span>Secure transaction</span>
              </div>

              <hr className="border-[#D5D9D9]" />

              <button
                onClick={handleViewHealthCard}
                className="w-full py-2 rounded text-sm font-semibold bg-[#232F3E] hover:bg-[#131921] text-[#febd69] border border-[#3d5166] transition-colors"
              >
                View Product Health Card
              </button>

              {isClothing(product.category) && (
                <VirtualTryOn
                  garmentImage={listing.image}
                  garmentTitle={product.title}
                />
              )}

              <hr className="border-[#D5D9D9]" />

              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Ships from</span>
                  <span className="font-semibold text-[#0F1111]">Amazon Revive</span>
                </div>
                {listing.seller_name && (
                  <div className="flex justify-between">
                    <span>Sold by</span>
                    <span className="text-[#007185]">{listing.seller_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Returns</span>
                  <span className="font-semibold text-[#0F1111]">7-day window</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Health Card Modal ── */}
          {showHealthCard && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:items-center sm:pt-4"
              style={{ background: 'rgba(0,0,0,0.65)' }}
              onClick={() => setShowHealthCard(false)}
            >
              <div
                className="relative w-full"
                style={{ maxWidth: 360 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setShowHealthCard(false)}
                    className="w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-gray-900 text-sm font-bold border border-[#D5D9D9]"
                  >
                    ✕
                  </button>
                </div>
                <div className="rounded-lg overflow-y-auto overflow-x-hidden shadow-2xl" style={{ maxHeight: '82vh' }}>
                  <HealthCard
                    grade={listing.grade}
                    conditionSummary={listing.condition_summary}
                    completeness={listing.completeness}
                    sellerName={listing.seller_name}
                    cardData={cardData}
                    loading={cardLoading}
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

export default ProductDetailPage
