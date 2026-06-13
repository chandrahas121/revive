import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import Banner from '../components/Banner'
import ProductFeed from '../components/ProductFeed'
import api from '../api/client'

const HomePage = () => {
  const [searchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const searchQuery = searchParams.get('q') || ''
  const sourceFilter = searchParams.get('source') || ''

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (sourceFilter) params.set('source', sourceFilter)

    api.get(`/api/listings/?${params.toString()}`)
      .then((res) => {
        const listings = res.data.results || []
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
        })))
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [searchQuery, sourceFilter])

  return (
    <div className="bg-[#EAEDED] min-h-screen">
      <Header />
      <main className="max-w-screen-2xl mx-auto">
        {!searchQuery && !sourceFilter && <Banner />}
        {(searchQuery || sourceFilter) && (
          <div className="px-3 sm:px-4 pt-3 pb-1">
            <p className="text-xs sm:text-sm text-gray-600">
              {searchQuery && <><span className="font-semibold">Search:</span> "{searchQuery}" </>}
              {sourceFilter && <><span className="font-semibold">Source:</span> {sourceFilter} </>}
              — {loading ? '…' : `${products.length} found`}
            </p>
          </div>
        )}
        <ProductFeed products={products} loading={loading} />
      </main>
    </div>
  )
}

export default HomePage
