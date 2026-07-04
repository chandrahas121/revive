import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import SellerApp from './SellerApp.jsx'

// Seller Central is a standalone app, but it still serves everything under the
// /seller path space so all of its internal links (nav('/seller/inventory'),
// sellerData.js paths, ?tab= query routes) keep working exactly as before.
// Opening the bare root just redirects into /seller.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/seller/*" element={<SellerApp />} />
        <Route path="*" element={<Navigate to="/seller" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
