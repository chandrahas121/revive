import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Recycle, CheckCircle, Smartphone, Shirt, Armchair, IndianRupee, Sparkles } from 'lucide-react'
import Header from '../components/Header'
import Banner, { TrustStrip } from '../components/Banner'
import ProductFeed from '../components/ProductFeed'
import api, { getRecommendations } from '../api/client'
import { useLocation as useGeoLocation } from '../hooks/useLocation'

// v2 (point 6): location is requested ONCE (silent browser permission prompt) and
// then used only to sort the storefront nearest-first — exactly like Amazon, which
// uses your location quietly rather than showing a "deals near you" banner.


const GRADE_PILL = {
  A: 'bg-green-100 text-green-800', B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-orange-100 text-orange-800', D: 'bg-red-100 text-red-800',
}

// ── Category quick-nav tiles ──
// Pure UI/navigation shortcuts layered on top of the existing search/source
// filter params already used by HomePage + ProductFeed (no new data flow).
const CATEGORY_TILES = [
  { label: 'Shop Revive', sub: 'AI-graded second-life', icon: <Recycle className="w-5 h-5 text-[#007185]" />, source: 'revive' },
  { label: 'Amazon Renewed', sub: 'Certified refurbished', icon: <CheckCircle className="w-5 h-5 text-[#007185]" />, source: 'renewed' },
  { label: 'Electronics', sub: 'Phones, laptops & more', icon: <Smartphone className="w-5 h-5 text-[#007185]" />, category: 'Electronics' },
  { label: 'Fashion', sub: 'Pre-loved styles', icon: <Shirt className="w-5 h-5 text-[#007185]" />, category: 'Fashion' },
  { label: 'Home & Garden', sub: 'Furnish for less', icon: <Armchair className="w-5 h-5 text-[#007185]" />, category: 'Home' },
  { label: 'Sell Unused Items', sub: 'Earn from your closet', icon: <IndianRupee className="w-5 h-5 text-[#007185]" />, link: '/sell' },
]

const CategoryNav = () => {
  const navigate = useNavigate()
  const goTo = (tile) => {
    if (tile.link) return navigate(tile.link)
    if (tile.source) return navigate(`/?source=${tile.source}`)
    if (tile.category) return navigate(`/?category=${encodeURIComponent(tile.category)}`)
    return navigate(`/?q=${encodeURIComponent(tile.q || '')}`)
  }
  return (
    <div className="px-3 sm:px-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {CATEGORY_TILES.map((c) => (
          <button
            key={c.label}
            onClick={() => goTo(c)}
            className="bg-white border border-[#D5D9D9] rounded-lg px-4 py-3 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
          >
            <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[#F0F2F2] rounded-full">
              {c.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-[#0F1111] leading-tight">{c.label}</span>
              <span className="block text-xs text-gray-500 leading-tight">{c.sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

const RecommendationRail = () => {
  const navigate = useNavigate()
  const [recs, setRecs] = useState([])
  useEffect(() => {
    getRecommendations(10).then((res) => setRecs(res.data.results || [])).catch(() => setRecs([]))
  }, [])
  if (recs.length === 0) return null
  return (
    <div className="px-3 sm:px-4 mt-4">
      <div className="bg-white border border-[#D5D9D9] rounded-lg px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-[#C45500]" />
          <h2 className="font-bold text-[#0F1111] text-base sm:text-lg">Certified Refurbished For You</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#232F3E] text-[#febd69]">AI picks</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
          {recs.map((l) => (
            <button key={l.id} onClick={() => navigate(`/product/${l.id}`)}
              className="flex-shrink-0 w-52 bg-white border border-[#D5D9D9] rounded-lg overflow-hidden text-left hover:shadow-md hover:border-[#a8b2b2] transition-all">
              <div className="h-36 bg-[#f7f7f7] flex items-center justify-center p-3 relative">
                <img src={l.image} alt={l.product.title} className="max-h-full max-w-full object-contain mix-blend-multiply"
                  onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item' }} />
                <span className={`absolute top-2 left-2 text-[10px] font-black px-1.5 py-0.5 rounded ${GRADE_PILL[l.grade] || ''}`}>Grade {l.grade}</span>
              </div>
              <div className="px-3 pt-2.5 pb-3 border-t border-[#D5D9D9]">
                <p className="text-[13px] font-medium text-[#0F1111] line-clamp-2 leading-snug min-h-[2.5rem]">{l.product.title}</p>
                <p className="text-base font-bold text-[#0F1111] mt-2">₹{parseFloat(l.price).toLocaleString('en-IN')}</p>
                <p className="text-[11px] text-[#007185] font-medium mt-0.5 line-clamp-1">{l.rec_reason}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [numPages, setNumPages] = useState(1)
  const { location, status, request } = useGeoLocation()

  // Ask for location permission exactly once (no persistent banner).
  useEffect(() => {
    if (!location && status === 'idle') request()
  }, [location, status, request])

  const searchQuery = searchParams.get('q') || ''
  const categoryFilter = searchParams.get('category') || ''
  const sourceFilter = searchParams.get('source') || ''
  const conditionFilter = searchParams.get('condition') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (categoryFilter) params.set('category', categoryFilter)
    if (sourceFilter) params.set('source', sourceFilter)
    if (conditionFilter) params.set('condition', conditionFilter)
    params.set('page', String(page))
    // v2: "Near me" — sort the storefront by proximity to the buyer's live location
    if (location) { params.set('lat', location.lat); params.set('lng', location.lng) }


    api.get(`/api/listings/?${params.toString()}`)
      .then((res) => {
        const listings = res.data.results || []
        setTotal(res.data.count || listings.length)
        setNumPages(res.data.num_pages || 1)
        setProducts(listings.map((l) => ({
          id: l.id,
          title: l.product.title,
          price: parseFloat(l.price),
          description: l.condition_summary || l.product.description,
          category: l.product.category,
          image: l.image,
          grade: l.grade,
          source: l.source,
          source_display: l.source_display,
          grade_display: l.grade_display,
          seller_name: l.seller_name,
          is_new: l.is_new,
          mrp: l.mrp,
          second_life: l.second_life,
          rating: l.product.rating,
          rating_count: l.product.rating_count,
        })))
      })
      .catch(() => { setProducts([]); setTotal(0); setNumPages(1) })
      .finally(() => setLoading(false))
  }, [searchQuery, categoryFilter, sourceFilter, conditionFilter, page, location])


  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-screen-2xl mx-auto">
        {!searchQuery && !sourceFilter && !categoryFilter && <Banner />}
        {!searchQuery && !sourceFilter && !categoryFilter && <CategoryNav />}
        {!searchQuery && !sourceFilter && !categoryFilter && <RecommendationRail />}
        {(searchQuery || sourceFilter || categoryFilter) && (
          <div className="px-3 sm:px-4 pt-3 pb-1">
            <p className="text-xs sm:text-sm text-gray-600">
              {searchQuery && <><span className="font-semibold">Search:</span> "{searchQuery}" </>}
              {categoryFilter && <><span className="font-semibold">Category:</span> {categoryFilter} </>}
              {sourceFilter && <><span className="font-semibold">Source:</span> {sourceFilter} </>}
              — {loading ? '…' : `${total} found`}
            </p>
          </div>
        )}
        <ProductFeed products={products} loading={loading} showHeading={!searchQuery && !categoryFilter}
          page={page} numPages={numPages} total={total} onPageChange={goToPage} />
      </main>
    </div>
  )
}

export default HomePage
