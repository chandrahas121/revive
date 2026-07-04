import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerUI } from '../SellerUI';
import { useSellerAuth } from '../SellerAuthContext';

// Amazon Seller Central top bar + dark sub-nav. `bars` hides the sub-nav on the
// product-detail screen (matches the design's chromeBars flag).
export default function SellerChrome({ storeName, marketplace = 'India', bars = true }) {
  const nav = useNavigate();
  const { toggleMenu } = useSellerUI();
  const { seller, logout } = useSellerAuth();
  const displayStore = (storeName || seller?.store_name || seller?.name || 'Seller').toUpperCase();

  const handleSignOut = async () => {
    await logout();
    nav('/seller/signin');
  };
  return (
    <>
      {/* top bar */}
      <div style={{ background: '#232f3e', display: 'flex', alignItems: 'center', gap: 12, padding: '7px 14px', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={toggleMenu} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', borderRadius: 3, background: 'transparent', flexShrink: 0, border: 'none', cursor: 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
        <div onClick={() => nav('/seller')} style={{ cursor: 'pointer', flexShrink: 0 }}>
          <svg width="192" height="30" viewBox="0 0 192 30" fill="none">
            <text x="0" y="22" fontFamily="Arial,Helvetica,sans-serif" fontSize="22" fontWeight="700" letterSpacing="-.6" fill="#fff">amazon</text>
            <path d="M3 25 C 27 34, 66 34, 84 26" stroke="#FF9900" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M84 26 l 1.5 -4.5 l -6 1.5 Z" fill="#FF9900" />
            <text x="90" y="22" fontFamily="Arial,Helvetica,sans-serif" fontSize="15" fontWeight="400" fill="#fff">seller central</text>
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: 3, padding: '4px 12px', fontSize: 13, color: '#111', flexShrink: 0, gap: 10, height: 30 }}>
          <b style={{ fontWeight: 700 }}>{displayStore}</b>
          <span style={{ width: 1, height: 14, background: '#ccc' }} />
          <span style={{ color: '#333' }}>{marketplace}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', height: 36 }}>
          <input placeholder="Search" style={{ flex: 1, minWidth: 0, border: 'none', borderRadius: '4px 0 0 4px', padding: '0 12px', fontSize: 14, background: '#fff', color: '#111' }} />
          <button style={{ width: 46, background: '#37475a', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#fff' }}>
          <button style={{ width: 36, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', borderRadius: 3, background: 'transparent', border: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
          </button>
          <button onClick={handleSignOut} title="Sign out" style={{ width: 36, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', borderRadius: 3, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H8a1.65 1.65 0 001-1.51V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8a1.65 1.65 0 001.51 1H22a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#fff', fontSize: 13, padding: '6px 8px', borderRadius: 3, background: 'transparent', border: 'none' }}>EN <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg></button>
          <button style={{ color: '#fff', fontSize: 13, padding: '6px 8px', borderRadius: 3, background: 'transparent', border: 'none' }}>Help</button>
        </div>
      </div>
      {/* sub nav */}
      {bars && (
        <div style={{ background: '#232f3e', borderTop: '1px solid #3a4553', display: 'flex', alignItems: 'center', gap: 2, padding: '2px 10px', overflowX: 'auto' }}>
          <button style={{ width: 26, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#febd69', flexShrink: 0, background: 'transparent', border: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2h12a2 2 0 012 2v18l-8-4-8 4V4a2 2 0 012-2z" /></svg>
          </button>
          <SN onClick={() => nav('/seller/inventory')}>Add Products</SN>
          <SN>Campaign Manager</SN>
          <SN onClick={() => nav('/seller')}>Business Reports</SN>
          <SN onClick={() => nav('/seller/mcf')}>Fulfillment</SN>
          <SN>Advertising Reports</SN>
          <SN onClick={() => nav('/seller/inventory')}>Manage All Inventory</SN>
          <SN onClick={() => nav('/seller/returns')}>Manage Returns</SN>
          <SN>Certifications</SN>
          <SN>Manage Seller Fulfilled Products</SN>
          <div style={{ flex: 1 }} />
          <button style={{ color: '#fff', fontSize: 12, border: '1px solid #adb1b8', borderRadius: 3, padding: '4px 14px', flexShrink: 0, marginLeft: 8, background: 'transparent' }}>Edit</button>
        </div>
      )}
    </>
  );
}

function SN({ children, onClick }) {
  return (
    <span onClick={onClick} className="sn-link"
      style={{ color: '#fff', fontSize: 13, padding: '6px 9px', borderRadius: 3, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      {children}
    </span>
  );
}
