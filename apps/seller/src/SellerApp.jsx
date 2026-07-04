import React from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { SellerUIProvider } from './SellerUI';
import { SellerAuthProvider, useSellerAuth } from './SellerAuthContext';
import SellerChrome from './components/SellerChrome';
import MenuFlyout from './components/MenuFlyout';
import HealthCardModal from './components/HealthCardModal';
import SellerSignIn from './pages/SellerSignIn';
import SellerDashboard from './pages/SellerDashboard';
import SellerInventory from './pages/SellerInventory';
import SellerProductDetail from './pages/SellerProductDetail';
import SellerMcf from './pages/SellerMcf';
import SellerReturns from './pages/SellerReturns';
import GradingAssistant from './pages/GradingAssistant';
import ReturnsDashboard from './pages/ReturnsDashboard';

// Global styles ported from the design's inline <style> (hover states + focus rings).
const SELLER_CSS = `
.seller-root{background:#f3f3f3;color:#0f1111;font-family:"Amazon Ember","Inter","Helvetica Neue",Arial,sans-serif;min-height:100vh;}
.seller-root .sc-link{color:#0066c0;cursor:pointer;}
.seller-root .sc-link:hover{color:#c45500;text-decoration:underline;}
.seller-root .sc-teal{color:#007185;cursor:pointer;}
.seller-root .sc-teal:hover{color:#c45500;text-decoration:underline;}
.seller-root .sn-link:hover{outline:1px solid #fff;}
.seller-root .cat-row:hover{background:#f0f2f2;}
.seller-root .mi-row:hover{background:#f0f2f2;}
.seller-root .act-row:hover{background:#f0f2f2;}
.seller-root ::placeholder{color:#8a8f8f;}
.seller-root input:focus,.seller-root select:focus{outline:2px solid #e77600;outline-offset:-1px;}
`;

// Gate every console route behind a seller session. While the session is being
// checked we render nothing (avoids a sign-in flash); once known, an unauthed
// visitor is bounced to the seller sign-in screen.
function RequireSeller({ children }) {
  const { seller, loading } = useSellerAuth();
  if (loading) return null;
  if (!seller) return <Navigate to="/seller/signin" replace />;
  return children;
}

// Full chrome layout (top bar + sub-nav) for every screen except sign-in and the
// product-detail editor, which render their own headers.
function ShellLayout() {
  return (
    <RequireSeller>
      <SellerChrome bars />
      <Outlet />
      <MenuFlyout />
      <HealthCardModal />
    </RequireSeller>
  );
}

export default function SellerApp() {
  return (
    <SellerAuthProvider>
      <SellerUIProvider>
        <style>{SELLER_CSS}</style>
        <div className="seller-root">
          <Routes>
            <Route path="signin" element={<SellerSignIn />} />
            {/* product detail hides the seller chrome and renders its own slim header */}
            <Route path="inventory/:asin" element={<RequireSeller><SellerProductDetail /></RequireSeller>} />
            <Route element={<ShellLayout />}>
              <Route index element={<SellerDashboard />} />
              <Route path="inventory" element={<SellerInventory />} />
              <Route path="mcf" element={<SellerMcf />} />
              <Route path="returns" element={<SellerReturns />} />
              <Route path="returns/dashboard" element={<ReturnsDashboard />} />
              <Route path="returns/grade/:caseId" element={<GradingAssistant />} />
            </Route>
          </Routes>
        </div>
      </SellerUIProvider>
    </SellerAuthProvider>
  );
}
