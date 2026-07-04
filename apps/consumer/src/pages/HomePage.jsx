import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Sparkles, ChevronLeft, ChevronRight, Star, Recycle, CheckCircle, Smartphone, Shirt, Armchair, IndianRupee } from 'lucide-react'
import Header from '../components/Header'
import Banner from '../components/Banner'
import ProductFeed from '../components/ProductFeed'
import api, { getRecommendations } from '@amazon-hackon/shared'
import { useAuth } from '../context/AuthContext'
import { useLocation as useGeoLocation } from '../hooks/useLocation'

// v2 (point 6): location is requested ONCE (silent browser permission prompt) and
// then used only to sort the storefront nearest-first — exactly like Amazon, which
// uses your location quietly rather than showing a "deals near you" banner.

const inr = (v) => `₹${parseFloat(v).toLocaleString('en-IN')}`

// ── Category quick-nav tiles (original top-of-home strip) ──
const CATEGORY_TILES = [
  { label: 'Shop Revive', sub: 'AI-graded second-life', icon: <Recycle className="w-5 h-5 text-[#007185]" />, source: 'revive' },
  { label: 'Amazon Renewed', sub: 'Certified refurbished', icon: <CheckCircle className="w-5 h-5 text-[#007185]" />, source: 'renewed' },
  { label: 'Mobiles & Laptops', sub: 'Phones, laptops & more', icon: <Smartphone className="w-5 h-5 text-[#007185]" />, category: 'Phone' },
  { label: 'Apparel & Footwear', sub: 'Pre-loved styles', icon: <Shirt className="w-5 h-5 text-[#007185]" />, category: 'Apparel' },
  { label: 'Monitors', sub: 'Displays for less', icon: <Armchair className="w-5 h-5 text-[#007185]" />, category: 'Monitor' },
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
            <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-[#F0F2F2] rounded-full">{c.icon}</span>
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

// ── Amazon-style deal card ──
// A white card with a bold heading and a 2×2 quadrant of product thumbnails,
// each linking to that product. Heading + "See more" link into the category.
// Fully data-driven — every image/label comes from real listing data.
const DealCard = ({ heading, items, onSeeMore, onItem }) => {
  const quad = items.slice(0, 4)
  const single = quad.length === 1
  return (
    <div className="bg-white p-4 sm:p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#0F1111] leading-snug mb-3 line-clamp-2">{heading}</h2>
      <div className={`grid ${single ? 'grid-cols-1' : 'grid-cols-2'} gap-3 flex-1`}>
        {quad.map((it) => (
          <button key={it.id} onClick={() => onItem(it)} className="text-left group">
            <div className={`${single ? 'h-40 sm:h-52' : 'h-24 sm:h-28'} bg-white rounded flex items-center justify-center overflow-hidden`}>
              <img
                src={it.image}
                alt={it.title}
                className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item' }}
              />
            </div>
            <p className="text-[11px] text-[#565959] mt-1 line-clamp-1 group-hover:text-[#C7511F]">{it.brand || it.title}</p>
          </button>
        ))}
      </div>
      <button onClick={onSeeMore} className="text-[13px] text-[#007185] hover:text-[#C7511F] hover:underline mt-3 self-start">
        See more
      </button>
    </div>
  )
}

// "Sign in for your best experience" card — matches the real Amazon home 4th tile.
const SigninCard = () => {
  const navigate = useNavigate()
  return (
    <div className="bg-white p-4 sm:p-5 flex flex-col h-full">
      <h2 className="text-lg font-bold text-[#0F1111] leading-snug mb-3">Sign in for your best experience</h2>
      <button
        onClick={() => navigate('/login')}
        className="w-full py-1.5 rounded text-sm font-medium text-[#0F1111] border border-[#a88734] shadow-sm mb-4"
        style={{ background: 'linear-gradient(180deg,#f7dfa5,#f0c14b)' }}
      >
        Sign in securely
      </button>
      <div className="flex-1 flex items-center justify-center bg-[#f7f7f7] rounded p-3">
        <div className="text-center">
          <Sparkles className="w-8 h-8 text-[#C45500] mx-auto mb-2" />
          <p className="text-xs text-[#565959] leading-snug">Personalised deals, faster<br />checkout &amp; Green Credits</p>
        </div>
      </div>
    </div>
  )
}

// ── Horizontal product rail ("More items to consider" / recs) ──
const ProductRail = ({ title, badge, items, reasonKey }) => {
  const navigate = useNavigate()
  const scroller = useRef(null)
  if (!items || items.length === 0) return null
  const scrollBy = (dir) => {
    if (scroller.current) scroller.current.scrollBy({ left: dir * 320, behavior: 'smooth' })
  }
  return (
    <div className="px-3 sm:px-4 mt-4">
      <div className="bg-white rounded-lg px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          {badge}
          <h2 className="font-bold text-[#0F1111] text-base sm:text-lg">{title}</h2>
        </div>
        <div className="relative group">
          <button
            onClick={() => scrollBy(-1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-9 h-14 items-center justify-center bg-white/90 border border-[#D5D9D9] rounded-r shadow opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-[#565959]" />
          </button>
          <div ref={scroller} className="flex gap-3 overflow-x-auto no-scrollbar pb-1 scroll-smooth">
            {items.map((l) => (
              <button
                key={l.id}
                onClick={() => navigate(`/product/${l.id}`)}
                className="flex-shrink-0 w-40 sm:w-44 text-left group/card"
              >
                <div className="h-40 bg-white rounded flex items-center justify-center p-3">
                  <img
                    src={l.image}
                    alt={l.title}
                    className="max-h-full max-w-full object-contain group-hover/card:scale-105 transition-transform"
                    onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=Item' }}
                  />
                </div>
                <p className="text-[13px] text-[#0F1111] line-clamp-2 leading-snug mt-2 min-h-[2.5rem] group-hover/card:text-[#C7511F]">{l.title}</p>
                <p className="text-base font-bold text-[#0F1111] mt-1">{inr(l.price)}</p>
                {reasonKey && l[reasonKey] && (
                  <p className="text-[11px] text-[#007185] font-medium mt-0.5 line-clamp-1">{l[reasonKey]}</p>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => scrollBy(1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-9 h-14 items-center justify-center bg-white/90 border border-[#D5D9D9] rounded-l shadow opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-[#565959]" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Build category → items map from the loaded listing page (real data only).
const dealGroups = (products) => {
  const byCat = {}
  for (const p of products) {
    const cat = p.category || 'More deals'
    if (!byCat[cat]) byCat[cat] = []
    if (byCat[cat].length < 4) byCat[cat].push(p)
  }
  return Object.entries(byCat)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({ category, items }))
}

// Amazon-style deal heading: "Up to X% off | Category" when the group has real
// discounts, else a plain category deals line.
const dealHeading = (category, items) => {
  const maxOff = Math.max(0, ...items.map((it) => {
    const m = parseFloat(it.mrp)
    return m && m > it.price ? Math.round((1 - it.price / m) * 100) : 0
  }))
  return maxOff > 0 ? `Up to ${maxOff}% off | ${category}` : `${category} — top deals`
}

const DealGrid = ({ products, loading, user }) => {
  const navigate = useNavigate()
  if (loading) {
    return (
      <div className="px-3 sm:px-4 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array(4).fill(null).map((_, i) => (
            <div key={i} className="bg-white rounded p-4 h-72 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {Array(4).fill(null).map((_, j) => <div key={j} className="h-24 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const groups = dealGroups(products)
  if (groups.length === 0) return null

  const cells = groups.map((g) => ({ type: 'deal', ...g }))

  return (
    <div className="px-3 sm:px-4 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cells.map((c, i) =>
          c.type === 'signin' ? (
            <div key="signin" className="rounded overflow-hidden shadow-sm">
              <SigninCard />
            </div>
          ) : (
            <div key={c.category} className="rounded overflow-hidden shadow-sm">
              <DealCard
                heading={dealHeading(c.category, c.items)}
                items={c.items}
                onItem={(it) => navigate(`/product/${it.id}`)}
                onSeeMore={() => navigate(`/?category=${encodeURIComponent(c.category)}`)}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

// Star value for a product tile: real catalog rating for NEW items, grade-derived
// for second-life (matches the Product card's own logic).
const productStars = (p) =>
  p.is_new ? (p.rating || 0) : (p.grade === 'A' ? 5 : p.grade === 'B' ? 4 : p.grade === 'C' ? 3 : 2)

// ── Amazon-style left filter rail ──
// Department + Source filters drive the URL (backend-supported). Rating + Price
// filter the loaded results client-side, so no backend/data-flow change is needed.
const SOURCE_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Shop Revive', value: 'revive' },
  { label: 'Amazon Renewed', value: 'renewed' },
]
const PRICE_FILTERS = [
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 – ₹2,000', min: 500, max: 2000 },
  { label: '₹2,000 – ₹10,000', min: 2000, max: 10000 },
  { label: 'Over ₹10,000', min: 10000, max: Infinity },
]
// Canonical departments for the filter rail. `value` MUST match a real category in
// the catalog (Apparel / Footwear / Phone / Monitor / Laptop / Home & Kitchen /
// Books / Toys) — the backend filters product__category__icontains=value.
const DEPARTMENTS = [
  { label: 'Mobiles & Phones', value: 'Phone' },
  { label: 'Laptops', value: 'Laptop' },
  { label: 'Monitors', value: 'Monitor' },
  { label: 'Apparel', value: 'Apparel' },
  { label: 'Footwear', value: 'Footwear' },
  { label: 'Home & Kitchen', value: 'Home & Kitchen' },
  { label: 'Books', value: 'Books' },
  { label: 'Toys', value: 'Toys' },
]

const Radio = ({ on }) => (
  <span className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center ${on ? 'border-[#007185]' : 'border-gray-400'}`}>
    {on && <span className="w-1.5 h-1.5 rounded-full bg-[#007185]" />}
  </span>
)
const Check = ({ on }) => (
  <span className={`w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center ${on ? 'bg-[#007185] border-[#007185]' : 'border-gray-400 bg-white'}`}>
    {on && <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="4"><path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
  </span>
)

const CategorySidebar = ({ categories, activeCategory, activeSource, minRating, setMinRating, priceCap, setPriceCap, brands, selectedBrands, onToggleBrand, onCategory, onSource, onClear }) => {
  const anyActive = activeCategory || activeSource || minRating > 0 || priceCap != null || selectedBrands.size > 0
  return (
    <aside className="hidden lg:block w-60 flex-shrink-0 pl-4 pt-4">
      {activeCategory && (
        <div className="mb-4 pb-3 border-b border-[#D5D9D9]">
          <p className="text-[13px] text-[#565959] mb-1">Any Category ›</p>
          <p className="text-[13px] font-bold text-[#0F1111]">{activeCategory}</p>
        </div>
      )}
      {anyActive && (
        <button onClick={onClear} className="text-[13px] text-[#007185] hover:text-[#C7511F] hover:underline mb-4">
          Clear all filters
        </button>
      )}

      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0F1111] mb-1.5">Department</h3>
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.value}>
              <button onClick={() => onCategory(c.value)} className="flex items-center gap-2 group">
                <Radio on={activeCategory === c.value} />
                <span className={`text-[13px] group-hover:text-[#C7511F] ${activeCategory === c.value ? 'font-bold text-[#0F1111]' : 'text-[#565959]'}`}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {brands.length > 0 && (
        <div className="mb-5">
          <h3 className="text-base font-bold text-[#0F1111] mb-1.5">Brands</h3>
          <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {brands.map((b) => (
              <li key={b}>
                <button onClick={() => onToggleBrand(b)} className="flex items-center gap-2 group">
                  <Check on={selectedBrands.has(b)} />
                  <span className={`text-[13px] text-left group-hover:text-[#C7511F] ${selectedBrands.has(b) ? 'font-bold text-[#0F1111]' : 'text-[#565959]'}`}>{b}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0F1111] mb-1.5">Condition</h3>
        <ul className="space-y-1.5">
          {SOURCE_FILTERS.map((s) => (
            <li key={s.value}>
              <button onClick={() => onSource(s.value)} className="flex items-center gap-2 group">
                <Radio on={activeSource === s.value} />
                <span className={`text-[13px] group-hover:text-[#C7511F] ${activeSource === s.value ? 'font-bold text-[#0F1111]' : 'text-[#565959]'}`}>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0F1111] mb-1.5">Customer Reviews</h3>
        <ul className="space-y-1.5">
          {[4, 3, 2, 1].map((r) => (
            <li key={r}>
              <button
                onClick={() => setMinRating(minRating === r ? 0 : r)}
                className={`flex items-center gap-1 group ${minRating === r ? 'font-bold' : ''}`}
              >
                {Array(5).fill(null).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < r ? 'text-[#FFA41C] fill-[#FFA41C]' : 'text-[#D5D9D9] fill-[#D5D9D9]'}`} />
                ))}
                <span className="text-[13px] text-[#007185] group-hover:text-[#C7511F] ml-1">&amp; Up</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0F1111] mb-1.5">Price</h3>
        <ul className="space-y-1.5">
          {PRICE_FILTERS.map((p) => (
            <li key={p.label}>
              <button onClick={() => setPriceCap(priceCap === p ? null : p)} className="flex items-center gap-2 group">
                <Radio on={priceCap === p} />
                <span className={`text-[13px] group-hover:text-[#C7511F] ${priceCap === p ? 'font-bold text-[#0F1111]' : 'text-[#565959]'}`}>{p.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

// Amazon-style category chip scroller (top of category/search results).
const CategoryChips = ({ chips, activeCategory, onPick }) => {
  const scroller = useRef(null)
  const by = (d) => scroller.current?.scrollBy({ left: d * 300, behavior: 'smooth' })
  return (
    <div className="bg-white border-b border-[#D5D9D9] relative group">
      <button onClick={() => by(-1)} className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 w-8 items-center justify-center bg-gradient-to-r from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronLeft className="w-5 h-5 text-[#565959]" />
      </button>
      <div ref={scroller} className="flex gap-2 overflow-x-auto no-scrollbar px-3 sm:px-4 py-2.5 scroll-smooth">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => onPick(c)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full border text-[13px] whitespace-nowrap transition-colors
              ${activeCategory === c.value ? 'bg-[#232F3E] text-white border-[#232F3E] font-semibold' : 'bg-white text-[#0F1111] border-[#D5D9D9] hover:border-[#232F3E]'}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <button onClick={() => by(1)} className="hidden sm:flex absolute right-0 top-0 bottom-0 z-10 w-8 items-center justify-center bg-gradient-to-l from-white via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-5 h-5 text-[#565959]" />
      </button>
    </div>
  )
}

const HomePage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [numPages, setNumPages] = useState(1)
  const [recs, setRecs] = useState([])
  const [minRating, setMinRating] = useState(0)
  const [priceCap, setPriceCap] = useState(null)
  const [selectedBrands, setSelectedBrands] = useState(() => new Set())
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
  const isHome = !searchQuery && !sourceFilter && !categoryFilter

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(p))
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Single-param URL update for the filter rail; changing a filter resets to page 1.
  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }
  const handleCategory = (c) => setParam('category', c === categoryFilter ? '' : c)
  const handleSource = (v) => setParam('source', v)
  const toggleBrand = (b) => setSelectedBrands((prev) => {
    const next = new Set(prev)
    if (next.has(b)) next.delete(b); else next.add(b)
    return next
  })
  const clearFilters = () => {
    setMinRating(0)
    setPriceCap(null)
    setSelectedBrands(new Set())
    setSearchParams(new URLSearchParams())
  }

  // Reset client-side filters whenever the server query (category/search/source) changes,
  // so a stale brand/price selection can't hide the new result set.
  useEffect(() => {
    setSelectedBrands(new Set()); setMinRating(0); setPriceCap(null)
  }, [categoryFilter, searchQuery, sourceFilter])

  // Departments shown in the rail = canonical list ∪ active category (so a
  // deep-linked / searched category always appears even if it's not canonical).
  const departments = categoryFilter && !DEPARTMENTS.some((d) => d.value === categoryFilter)
    ? [{ label: categoryFilter, value: categoryFilter }, ...DEPARTMENTS] : DEPARTMENTS

  // Brands available in the loaded result set (real product.brand values).
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort()

  // Chips = "For you" + canonical departments.
  const chips = [{ label: 'For you', value: '' }, ...DEPARTMENTS]
  const pickChip = (c) => (c.value ? setParam('category', c.value) : clearFilters())

  // Rating + price + brand applied client-side over the loaded page (no backend change).
  const visibleProducts = products.filter((p) =>
    productStars(p) >= minRating &&
    (!priceCap || (p.price >= priceCap.min && p.price < priceCap.max)) &&
    (selectedBrands.size === 0 || selectedBrands.has(p.brand))
  )

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
          brand: l.product.brand,
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
          fit_signal: l.product.fit_signal,
          review_summary: l.product.review_summary,
        })))
      })
      .catch(() => { setProducts([]); setTotal(0); setNumPages(1) })
      .finally(() => setLoading(false))
  }, [searchQuery, categoryFilter, sourceFilter, conditionFilter, page, location])

  // Recommendation rail (AI picks) — only on the home surface.
  useEffect(() => {
    if (!isHome) return
    getRecommendations(12)
      .then((res) => setRecs((res.data.results || []).map((l) => ({
        id: l.id, title: l.product.title, price: parseFloat(l.price), image: l.image, rec_reason: l.rec_reason,
      }))))
      .catch(() => setRecs([]))
  }, [isHome])

  return (
    <div className="bg-white min-h-screen">
      <Header />
      <main className="max-w-screen-2xl mx-auto pb-8">
        {isHome ? (
          <>
            <Banner />
            <CategoryNav />
            <DealGrid products={products} loading={loading} user={user} />
            <ProductRail title="More items to consider" items={products.slice(0, 14)} />
            <ProductRail
              title="Certified Refurbished For You"
              badge={<Sparkles className="w-5 h-5 text-[#C45500]" />}
              items={recs}
              reasonKey="rec_reason"
            />
            <div className="px-3 sm:px-4 mt-4">
              <ProductFeed products={products} loading={loading} showHeading page={page}
                numPages={numPages} total={total} onPageChange={goToPage} />
            </div>
          </>
        ) : (
          <>
          {/* Promo strip (template layout, Amazon skin) */}
          <div className="px-3 sm:px-4 pt-3">
            <div className="h-24 sm:h-32 rounded-lg overflow-hidden flex items-center px-5 sm:px-10" style={{ background: 'linear-gradient(105deg,#146eb4,#0c2b6b)' }}>
              <div className="text-white">
                <p className="text-[10px] sm:text-xs font-bold tracking-[0.2em] opacity-90">AMAZON REVIVE DAYS · 4–6 JULY</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-black mt-1 leading-tight">Biggest second-life deals</p>
              </div>
              <button onClick={() => setParam('source', 'revive')} className="ml-auto flex-shrink-0 bg-white text-[#0F1111] font-bold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm hover:bg-gray-100 transition-colors">Explore Now</button>
            </div>
          </div>
          <CategoryChips chips={chips} activeCategory={categoryFilter} onPick={pickChip} />
          <div className="flex">
            <CategorySidebar
              categories={departments}
              activeCategory={categoryFilter}
              activeSource={sourceFilter}
              minRating={minRating}
              setMinRating={setMinRating}
              priceCap={priceCap}
              setPriceCap={setPriceCap}
              brands={brands}
              selectedBrands={selectedBrands}
              onToggleBrand={toggleBrand}
              onCategory={handleCategory}
              onSource={handleSource}
              onClear={clearFilters}
            />
            <div className="flex-1 min-w-0">
              <div className="px-3 sm:px-4 pt-3 pb-1">
                <p className="text-xs sm:text-sm text-gray-600">
                  {searchQuery && <><span className="font-semibold">Search:</span> "{searchQuery}" </>}
                  {categoryFilter && <><span className="font-semibold">Category:</span> {categoryFilter} </>}
                  {sourceFilter && <><span className="font-semibold">Source:</span> {sourceFilter} </>}
                  — {loading ? '…' : `${visibleProducts.length} of ${total} shown`}
                </p>
              </div>
              <ProductFeed products={visibleProducts} loading={loading} showHeading={!searchQuery && !categoryFilter}
                page={page} numPages={numPages} total={total} onPageChange={goToPage} />
            </div>
          </div>
          </>
        )}
      </main>
    </div>
  )
}

export default HomePage
