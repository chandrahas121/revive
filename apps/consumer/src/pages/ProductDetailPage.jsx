import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShieldCheck, Star, Heart, Share2, Tag, Truck, RefreshCw, Smartphone, ChevronLeft } from 'lucide-react'
import Header from '../components/Header'
import LifecycleTimeline from '../components/LifecycleTimeline'
import HealthCard from '../components/stitch/HealthCard'
import VirtualTryOn from '../components/stitch/VirtualTryOn'
import FitTwin from '../components/stitch/FitTwin'
import api, { getHealthCard, advanceListingStage } from '@amazon-hackon/shared'
import { useCart } from '../context/CartContext'

const CLOTHING_KEYWORDS = ['clothing', 'fashion', 'apparel', 'garment', 'textile', 'shirt', 'dress', 'jacket', 'pants', 'jeans', 'blouse', 'skirt', 'coat']

// Footwear is "clothing" for the size selector / try-on, but NOT for Fit-Twin —
// shoes don't use the S–XXL garment fit model, so "How this fits" is apparel-only.
const FOOTWEAR_KEYWORDS = ['shoe', 'footwear', 'sneaker', 'boot', 'sandal', 'loafer']

const isClothing = (category = '') =>
  CLOTHING_KEYWORDS.some((kw) => category.toLowerCase().includes(kw))

// Apparel = garments only (clothing keywords, minus footwear).
const isApparel = (category = '') =>
  isClothing(category) && !FOOTWEAR_KEYWORDS.some((kw) => category.toLowerCase().includes(kw))

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

// Amazon-style partial-fill star row (value 0–5).
const Stars = ({ value = 0, className = '' }) => {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span
      className={`relative inline-block leading-none whitespace-nowrap ${className}`}
      aria-label={`${value} out of 5 stars`}
    >
      <span className="text-[#D5D9D9]">★★★★★</span>
      <span className="absolute inset-0 overflow-hidden text-[#FFA41C]" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  )
}

const fmtDate = (d) => {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return d
  }
}

// Amazon-style "Customer reviews" block: rating summary + breakdown bars + list.
const ReviewsSection = ({ ratings, reviews }) => {
  const [showAll, setShowAll] = useState(false)
  const avg = ratings?.average || 0
  const total = ratings?.total || reviews.length
  const reviewCount = ratings?.review_count || reviews.length
  const breakdown = ratings?.breakdown || {}
  const denom = reviewCount || 1

  const visibleReviews = showAll ? reviews : reviews.slice(0, 3)

  return (
    <section id="reviews" className="bg-white border border-[#D5D9D9] rounded-lg mt-4 px-4 py-5 sm:px-6 scroll-mt-4">
      <h2 className="text-lg sm:text-xl font-bold text-[#0F1111] mb-4">Customer reviews</h2>
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Summary + breakdown ── */}
        <div className="lg:w-72 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Stars value={avg} className="text-xl" />
            <span className="text-base text-[#0F1111]">{avg.toFixed(1)} out of 5</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">{total.toLocaleString('en-IN')} global ratings</p>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const c = breakdown[String(star)] || 0
              const pct = Math.round((c / denom) * 100)
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="text-[#007185] w-12 flex-shrink-0">{star} star</span>
                  <div className="flex-1 h-5 bg-[#F0F2F2] border border-[#D5D9D9] rounded-sm overflow-hidden">
                    <div className="h-full bg-[#FFA41C]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[#007185] w-9 text-right flex-shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Review list ── */}
        <div className="flex-1 min-w-0 lg:border-l lg:border-[#D5D9D9] lg:pl-6">
          <p className="text-base font-bold text-[#0F1111] mb-3">
            {reviewCount.toLocaleString('en-IN')} reviews with content
          </p>
          {reviews.length === 0 && (
            <p className="text-sm text-gray-500">No written reviews yet.</p>
          )}
          <div className="divide-y divide-[#E7E7E7]">
            {visibleReviews.map((r) => (
              <div key={r.id} className="py-4 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-[#E7E9EC] flex items-center justify-center text-xs font-bold text-[#565959]">
                    {(r.author || '?').charAt(0)}
                  </div>
                  <span className="text-sm text-[#0F1111] font-medium">{r.author}</span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Stars value={r.rating} className="text-sm" />
                  <span className="text-sm font-bold text-[#0F1111]">{r.title}</span>
                </div>
                {r.review_date && (
                  <p className="text-xs text-gray-500 mb-1.5">Reviewed on {fmtDate(r.review_date)}</p>
                )}
                {r.verified_purchase && (
                  <p className="text-xs font-bold text-[#C45500] mb-1.5">Verified Purchase</p>
                )}
                <p className="text-sm text-[#0F1111] leading-relaxed">{r.body}</p>
                {r.helpful_votes > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {r.helpful_votes.toLocaleString('en-IN')} {r.helpful_votes === 1 ? 'person' : 'people'} found this helpful
                  </p>
                )}
              </div>
            ))}
          </div>
          {reviews.length > 3 && !showAll && (
            <div className="mt-4 pt-4 border-t border-[#E7E7E7]">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm font-semibold text-[#007185] hover:text-[#C45500] hover:underline"
              >
                See more reviews
              </button>
            </div>
          )}
          {reviews.length > 3 && showAll && (
            <div className="mt-4 pt-4 border-t border-[#E7E7E7]">
              <button
                onClick={() => setShowAll(false)}
                className="text-sm font-semibold text-[#007185] hover:text-[#C45500] hover:underline"
              >
                See fewer reviews
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// Pillar-4 "What buyers say" card — review-mined pros/cons + fit verdict, fed by the
// detail endpoint's review_summary / fit_signal. Pure presentation; renders nothing
// when there's no mined intel.
const FIT_TENDENCY = {
  runs_small: 'Buyers say this tends to run small — consider sizing up.',
  runs_large: 'Buyers say this tends to run large — consider sizing down.',
  true_to_size: 'Buyers say this fits true to size.',
}

const BuyersSayCard = ({ summary, fitSignal }) => {
  const s = summary || {}
  const pros = s.pros || []
  const cons = s.cons || []
  const reasons = (s.return_reasons || []).filter((r) => r && r.reason).slice(0, 2)
  const fitLine = s.fit_verdict || (fitSignal && FIT_TENDENCY[fitSignal.direction]) || ''
  const hasBody = s.tldr || pros.length || cons.length || fitLine || reasons.length
  if (!hasBody) return null

  return (
    <section className="bg-white border border-[#D5D9D9] rounded-lg mt-4 px-4 py-5 sm:px-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-[#0F1111]">What buyers say</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#232F3E] text-[#febd69]">
          AI summary
        </span>
      </div>

      {s.tldr && <p className="text-sm text-[#0F1111] leading-relaxed mb-4">{s.tldr}</p>}

      {(pros.length > 0 || cons.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-bold text-[#0F1111] mb-1.5">Pros</p>
            <ul className="space-y-1">
              {pros.length === 0 && <li className="text-sm text-gray-400">—</li>}
              {pros.map((p, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-[#0F1111]">
                  <span className="text-[#007600] font-bold leading-5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F1111] mb-1.5">Cons</p>
            <ul className="space-y-1">
              {cons.length === 0 && <li className="text-sm text-gray-400">—</li>}
              {cons.map((c, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-[#565959]">
                  <span className="text-[#bd4a17] font-bold leading-5">–</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Fit & sizing callout — mirrors the "AI Condition Notes" pattern */}
      {fitLine && (
        <div className="border-l-4 border-[#FF9900] bg-[#FFFBF0] rounded-r p-3 mb-3">
          <p className="text-xs font-bold text-[#0F1111] mb-1">Fit &amp; sizing</p>
          <p className="text-sm text-gray-700 leading-relaxed">{fitLine}</p>
        </div>
      )}

      {reasons.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1.5">Why a few people return this</p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r, i) => (
              <span key={i} className="text-[11px] text-gray-600 bg-[#F0F2F2] border border-[#D5D9D9] rounded-full px-2.5 py-0.5">
                {r.reason}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

const ProductDetailPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart, removeFromCart, updateQuantity, cart, getItemQty } = useCart()

  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [selectedSize, setSelectedSize] = useState(null)
  const SIZES = ['S', 'M', 'L', 'XL', 'XXL']
  const [showHealthCard, setShowHealthCard] = useState(false)
  const [cardData, setCardData] = useState(null)
  const [cardLoading, setCardLoading] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  const handleAdvanceStage = async () => {
    if (!listing) return
    setAdvancing(true)
    try {
      const res = await advanceListingStage(listing.id)
      setListing((prev) => ({ ...prev, status: res.data.status, lifecycle: res.data.lifecycle }))
    } catch {
      // ignore — demo control
    } finally {
      setAdvancing(false)
    }
  }

  useEffect(() => {
    api.get(`/api/listings/${id}/`)
      .then((res) => setListing(res.data))
      .catch((err) => { if (err.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [id])

  // For sized (clothing) items the cart line is per-size, so "in cart" / qty must be
  // judged against the size the shopper is currently looking at — that way after
  // adding size M the Add button stays available to ALSO add size L (which is exactly
  // the size-hedge we want checkout to flag as bracketeering).
  const sizedItem = isClothing(listing?.product?.category || '')
  const lineMatch = (item) =>
    Number(item.id) === Number(id) &&
    (!sizedItem || String(item.size ?? '') === String(selectedSize ?? ''))
  const currentLine = cart.find(lineMatch)
  const inCart = !!currentLine
  const cartQty = cart.filter(lineMatch).reduce((s, i) => s + (i.qty || 1), 0)
  const currentKey = currentLine?.lineKey ?? id
  const isSecondLife = listing ? listing.source !== 'new' : false
  const maxStock = listing?.stock ?? (isSecondLife ? 1 : 10)

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
      size: selectedSize,
      maxStock,
    })
  }

  const handleIncrement = () => {
    if (cartQty < maxStock) updateQuantity(currentKey, cartQty + 1)
  }
  const handleDecrement = () => {
    if (cartQty > 1) updateQuantity(currentKey, cartQty - 1)
    else removeFromCart(currentKey)
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
        <button onClick={() => navigate(-1)} className="bg-white border border-[#D5D9D9] hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-bold text-[#0F1111] shadow-sm mb-4 inline-flex items-center gap-2 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600" />
          Back to results
        </button>
      </div>
    </div>
  )

  const product = listing.product
  const price = parseFloat(listing.price)
  const mrp = product.mrp ? parseFloat(product.mrp) : null
  const savings = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : null
  // v2 lifecycle: staged (refurbishing / held-local) items are visible but not buyable yet.
  const lc = listing.lifecycle
  const staged = lc && !lc.live && !lc.sold
  // Customer-review aggregates (from the detail endpoint), Amazon-style.
  const ratingAvg = listing.ratings?.average ?? product.rating ?? 0
  const ratingTotal = listing.ratings?.total ?? product.rating_count ?? 0

  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">

        <button
          onClick={() => navigate(-1)}
          className="text-[#0F1111] bg-white border border-[#D5D9D9] hover:bg-[#F7F8F8] shadow-sm rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium mb-3 sm:mb-4 inline-flex items-center gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          Back to results
        </button>

        {/* Mobile: image → buy box → details | Desktop: image → details → buy box */}
        <div className="flex flex-col lg:flex-row gap-0 sm:gap-4">

          {/* ── Image panel ── */}
          <div className="lg:w-[38%] order-1 flex-shrink-0">
            <div className="bg-white border border-[#D5D9D9] rounded-lg p-6 sm:p-8 flex flex-col">
              <div className="flex-1 flex items-center justify-center min-h-[240px] sm:min-h-[320px] lg:min-h-[360px]">
                <img
                  src={listing.image}
                  alt={product.title}
                  className="max-w-full max-h-56 sm:max-h-72 lg:max-h-96 object-contain mix-blend-multiply"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/300x300?text=No+Image' }}
                />
              </div>

              {listing.images && listing.images.length > 0 && !listing.is_new && (
                <div className="mt-6 border-t border-[#D5D9D9] pt-4">
                  <p className="text-sm font-bold text-[#0F1111] mb-2">Seller photos</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {listing.images.map((im, i) => (
                      <div key={i} className="flex-shrink-0 w-20">
                        <div className="w-20 h-20 rounded border border-[#D5D9D9] bg-white flex items-center justify-center overflow-hidden">
                          <img src={im.url} alt={im.label} className="max-w-full max-h-full object-contain"
                            onError={(e) => { e.target.style.display = 'none' }} />
                        </div>
                        <p className="text-[10px] text-gray-500 text-center mt-0.5">{im.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isClothing(product.category) && (
              <div className="mt-4">
                <VirtualTryOn
                  garmentImage={listing.image}
                  garmentTitle={product.title}
                  price={price}
                  mrp={mrp}
                  grade={listing.grade}
                  gradeLabel={listing.grade_display}
                />
              </div>
            )}
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

            {/* Stars — real aggregate from customer reviews */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-[#0F1111]">{ratingAvg.toFixed(1)}</span>
              <Stars value={ratingAvg} className="text-base" />
              <a
                href="#reviews"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="text-[#007185] text-sm hover:underline hover:text-[#c45500] cursor-pointer"
              >
                {ratingTotal.toLocaleString('en-IN')} ratings
              </a>
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

            {listing.images && listing.images.length > 0 && !listing.is_new && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#0F1111] mb-1.5">Seller photos</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {listing.images.map((im, i) => (
                    <div key={i} className="flex-shrink-0 w-20">
                      <div className="w-20 h-20 rounded border border-[#D5D9D9] bg-white flex items-center justify-center overflow-hidden">
                        <img src={im.url} alt={im.label} className="max-w-full max-h-full object-contain"
                          onError={(e) => { e.target.style.display = 'none' }} />
                      </div>
                      <p className="text-[10px] text-gray-500 text-center mt-0.5">{im.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* v2 second-life lifecycle — where this item is in its journey */}
            {lc && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#0F1111] mb-1.5">Second-life journey</p>
                <LifecycleTimeline
                  lifecycle={lc}
                  onAdvance={handleAdvanceStage}
                  advancing={advancing}
                  showAdvance
                />
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
                <span className="text-[#0F1111]">
                  7-day return window {listing.is_new ? '' : 'via Amazon Revive'}
                </span>
              </div>
              <div className="flex px-3 py-2.5 gap-3">
                <span className="text-[#0F1111] font-semibold w-20 flex-shrink-0">Ships from</span>
                <span className="text-[#0F1111]">{listing.is_new ? 'Amazon' : 'Amazon Revive'}</span>
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
                <div className={`text-sm text-[#0F1111] leading-relaxed ${!descExpanded ? 'line-clamp-4' : ''}`}>
                  {product.description}
                </div>
                {product.description.length > 200 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-[#007185] hover:underline hover:text-[#c45500] text-sm mt-1 flex items-center font-semibold focus:outline-none"
                  >
                    <svg className={`w-3.5 h-3.5 mr-1 transform transition-transform ${descExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {descExpanded ? 'Read less' : 'Read more'}
                  </button>
                )}
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

              {listing.buying_options && listing.buying_options.length > 1 && (
                <div className="border border-[#D5D9D9] rounded divide-y divide-[#D5D9D9]">
                  <p className="text-[11px] font-bold text-[#0F1111] px-2.5 py-1.5 bg-[#F7F8F8]">Buying options</p>
                  {listing.buying_options.map((o) => (
                    <button key={o.id} onClick={() => navigate(`/product/${o.id}`)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-left hover:bg-[#F7F8F8] transition-colors ${o.id === listing.id ? 'bg-[#FFF8E7]' : ''}`}>
                      <span className="text-xs font-semibold text-[#0F1111]">
                        {o.is_new ? 'New' : (o.source === 'renewed' ? 'Renewed' : (o.condition_label || 'Used'))}
                        {o.id === listing.id && <span className="text-[10px] text-[#C7511F] ml-1">• viewing</span>}
                      </span>
                      <span className="text-xs font-bold text-[#0F1111]">₹{parseFloat(o.price).toLocaleString('en-IN')}</span>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-sm">
                <span className="text-[#007600] font-semibold">FREE Delivery</span>
                <span className="text-[#0F1111]"> by Tomorrow</span>
              </p>

              {staged
                ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 leading-snug">
                    {lc.track === 'renewed'
                      ? 'Being refurbished at an authorized center — not buyable yet. It goes live as Amazon Renewed once certified.'
                      : 'Held locally — goes live the moment a nearby buyer appears. Not buyable yet.'}
                  </p>
                : <p className="text-lg text-[#007600]">In Stock</p>}

              {isClothing(product.category) && (
                <div>
                  <p className="text-xs font-semibold text-[#0F1111] mb-1">Select size</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES.map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setSelectedSize(sz)}
                        className={`min-w-9 h-9 px-2.5 rounded border text-xs font-semibold transition-colors
                          ${selectedSize === sz
                            ? 'bg-[#131921] text-white border-[#131921]'
                            : 'bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#131921]'}`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {listing.source === 'p2p' && (
                <p className="text-xs text-gray-500 bg-[#F0F2F2] border border-[#D5D9D9] rounded p-2 leading-relaxed">
                  Ships from Amazon Hub after seller verification
                </p>
              )}

              {/* Staged (refurbishing / held-local) items are visible but not buyable yet.
                  Otherwise: quantity selector once in cart, else Add to Cart. */}
              {staged ? (
                <button
                  disabled
                  className="w-full py-2.5 rounded-full text-sm font-bold border bg-[#F0F2F2] text-gray-400 cursor-default border-[#D5D9D9]"
                >
                  Not yet available
                </button>
              ) : inCart ? (
                <div className="space-y-2">
                  {/* Amazon-style qty row */}
                  <div className="flex items-center justify-center gap-0 border border-[#D5D9D9] rounded-full overflow-hidden h-9 bg-white shadow-sm">
                    <button
                      onClick={handleDecrement}
                      className="w-10 h-full flex items-center justify-center text-lg font-bold text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6] transition-colors border-r border-[#D5D9D9]"
                    >
                      {cartQty === 1 ? (
                        <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                      ) : '−'}
                    </button>
                    <span className="flex-1 text-center text-sm font-bold text-[#0F1111] bg-white h-full flex items-center justify-center">
                      {cartQty}
                    </span>
                    <button
                      onClick={handleIncrement}
                      disabled={cartQty >= maxStock}
                      className={`w-10 h-full flex items-center justify-center text-lg font-bold transition-colors border-l border-[#D5D9D9]
                        ${cartQty >= maxStock ? 'text-gray-300 bg-[#F0F2F2] cursor-not-allowed' : 'text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6]'}`}
                    >
                      +
                    </button>
                  </div>
                  {isSecondLife && (
                    <p className="text-[11px] text-center text-amber-600">One-of-a-kind item · qty 1 only</p>
                  )}
                  {!isSecondLife && cartQty >= maxStock && (
                    <p className="text-[11px] text-center text-amber-600">Maximum available stock reached</p>
                  )}
                  <button
                    onClick={() => removeFromCart(currentKey)}
                    className="w-full text-center text-xs text-[#007185] hover:text-[#c45500] hover:underline py-1"
                  >
                    Remove from cart
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  className="w-full py-2.5 rounded-full text-sm font-bold border text-[#131921] border-[#f0c040] shadow-sm active:scale-95 transition-colors"
                  style={{ background: 'linear-gradient(180deg, #ffd99e, #febd69)' }}
                >
                  Add to Cart
                </button>
              )}

              {!staged && (
                <button
                  onClick={() => { handleAddToCart(); navigate('/checkout') }}
                  className="w-full py-2.5 rounded-full text-sm font-bold text-white border border-[#e07000] shadow-sm transition-colors active:scale-95"
                  style={{ background: 'linear-gradient(180deg, #ffac31, #FF9900)' }}
                >
                  Buy Now
                </button>
              )}

              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4 6v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6l-8-4z" />
                </svg>
                <span>Secure transaction</span>
              </div>

              {/* Health Card is a SECOND-LIFE trust artifact only — a brand-new
                  catalogue item has no AI grade / refurb record, so no card. */}
              {!listing.is_new && (
                <>
                  <hr className="border-[#D5D9D9]" />
                  <button
                    onClick={handleViewHealthCard}
                    className="w-full py-2 rounded text-sm font-semibold bg-[#232F3E] hover:bg-[#131921] text-[#febd69] border border-[#3d5166] transition-colors"
                  >
                    View Product Health Card
                  </button>
                </>
              )}



              {isApparel(product.category) && (
                <FitTwin
                  category={product.category}
                  itemId={product.fit_item_id}
                  brand={product.brand}
                  size={selectedSize}
                  availableSizes={SIZES}
                  sizeSystem="letter"
                  fitSignal={listing.fit_signal}
                />
              )}

              <hr className="border-[#D5D9D9]" />

              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Ships from</span>
                  <span className="font-semibold text-[#0F1111]">{listing.is_new ? 'Amazon' : 'Amazon Revive'}</span>
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
                    source={listing.source}
                    listing={listing}
                    product={listing.product}
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

        {/* ── What buyers say (Pillar-4 review intelligence) ── */}
        <BuyersSayCard summary={listing.review_summary} fitSignal={listing.fit_signal} />

        {/* ── Customer reviews (real Amazon Reviews 2023 data) ── */}
        {listing.reviews && (
          <ReviewsSection ratings={listing.ratings} reviews={listing.reviews} />
        )}
      </main>
    </div>
  )
}

export default ProductDetailPage
