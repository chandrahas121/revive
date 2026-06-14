import React from 'react'
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProductDetailPage from './pages/ProductDetailPage'
import CheckoutPage from './pages/CheckoutPage'
import OrdersPage from './pages/OrdersPage'
import MyListingsPage from './pages/MyListingsPage'
import ReturnWizardPage from './pages/ReturnWizardPage'
import GradingResultPage from './pages/GradingResultPage'
import DashboardPage from './pages/DashboardPage'
import CreditsWalletPage from './pages/CreditsWalletPage'
import SellIt from './components/stitch/SellIt'
import Footer from './components/Footer'

const Layout = () => (
  <div className="flex flex-col min-h-screen">
    <div className="flex-grow">
      <Outlet />
    </div>
    <Footer />
  </div>
)

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                       element={<HomePage />} />
          <Route path="/login"                  element={<LoginPage />} />
          <Route path="/signup"                 element={<SignupPage />} />
          <Route path="/product/:id"            element={<ProductDetailPage />} />
          <Route path="/checkout"               element={<CheckoutPage />} />
          <Route path="/orders"                 element={<OrdersPage />} />
          <Route path="/my-listings"            element={<MyListingsPage />} />
          <Route path="/sell"                   element={<SellIt />} />
          <Route path="/return/:orderId"        element={<ReturnWizardPage />} />
          <Route path="/return/:orderId/result" element={<GradingResultPage />} />
          <Route path="/dashboard"              element={<DashboardPage />} />
          <Route path="/credits"                element={<CreditsWalletPage />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
