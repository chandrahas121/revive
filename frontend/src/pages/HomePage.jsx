import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
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

const RecommendationRail = () => {
  const navigate = useNavigate()
  const [recs, setRecs] = useState([])
  useEffect(() => {
    getRecommendations(10).then((res) => setRecs(res.data.results || [])).catch(() => setRecs([]))
  }, [])
  if (recs.length === 0) return null
  return (
    <div className="bg-white border-b border-[#D5D9D9] px-3 sm:px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✨</span>
        <h2 className="font-bold text-[#0F1111] text-base sm:text-lg">Certified Refurbished For You</h2>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#232F3E] text-[#febd69]">AI picks</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {recs.map((l) => (
          <button key={l.id} onClick={() => navigate(`/product/${l.id}`)}
            className="flex-shrink-0 w-40 bg-white border border-[#D5D9D9] rounded-lg overflow-hidden text-left hover:shadow-md transition-shadow">
            <div className="h-28 bg-gray-100 flex items-center justify-center p-2">
              <img src={l.image} alt={l.product.title} className="max-h-full max-w-full object-contain mix-blend-multiply"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item' }} />
            </div>
            <div className="p-2">
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${GRADE_PILL[l.grade] || ''}`}>Grade {l.grade}</span>
              </div>
              <p className="text-xs text-[#0F1111] line-clamp-2 leading-snug h-8">{l.product.title}</p>
              <p className="text-sm font-bold text-[#0F1111] mt-1">₹{parseFloat(l.price).toLocaleString('en-IN')}</p>
              <p className="text-[10px] text-[#007185] mt-0.5 line-clamp-1">{l.rec_reason}</p>
            </div>
          </button>
        ))}
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
  }, [searchQuery, sourceFilter, conditionFilter, page, location])


  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-screen-2xl mx-auto">
        {!searchQuery && !sourceFilter && <Banner />}
        {/* {!searchQuery && !sourceFilter && <TrustStrip />} */}
        {!searchQuery && !sourceFilter && <RecommendationRail />}
        {(searchQuery || sourceFilter) && (
          <div className="px-3 sm:px-4 pt-3 pb-1">
            <p className="text-xs sm:text-sm text-gray-600">
              {searchQuery && <><span className="font-semibold">Search:</span> "{searchQuery}" </>}
              {sourceFilter && <><span className="font-semibold">Source:</span> {sourceFilter} </>}
              — {loading ? '…' : `${total} found`}
            </p>
          </div>
        )}
        <ProductFeed products={products} loading={loading} showHeading={!searchQuery}
          page={page} numPages={numPages} total={total} onPageChange={goToPage} />
      </main>
    </div>
  )
}

export default HomePage
