import React from 'react';
import { useNavigate } from 'react-router-dom';

// Edit-listing screen. Fields are pre-filled with the pickleball-bag example from
// the design (the demo product-detail is illustrative, not data-driven).
export default function SellerProductDetail() {
  const nav = useNavigate();
  const back = () => nav('/seller/inventory');
  return (
    <div style={{ background: '#fff', minHeight: '80vh' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #eaeded', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <svg width="158" height="24" viewBox="0 0 158 24" fill="none">
          <text x="0" y="18" fontFamily="Arial,Helvetica,sans-serif" fontSize="17" fontWeight="700" fill="#131a22">amazon</text>
          <text x="72" y="18" fontFamily="Arial,Helvetica,sans-serif" fontSize="12" fill="#565959">seller central</text>
        </svg>
        <span className="sc-link" onClick={back} style={{ fontSize: 13 }}>Need help?</span>
      </div>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px 60px' }}>
        <div className="sc-teal" onClick={back} style={{ fontSize: 13, marginBottom: 14 }}>&#8592; Back to Manage All Inventory</div>
        <div style={{ display: 'flex', gap: 26 }}>
          <div style={{ width: 200, height: 200, border: '1px solid #eaeded', borderRadius: 6, background: '#fde7f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="90" height="90" viewBox="0 0 24 24" fill="none" stroke="#d16fa0" strokeWidth="1.3"><path d="M8 21h8a2 2 0 002-2l1-11H5l1 11a2 2 0 002 2z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, color: '#111', lineHeight: 1.4 }}>Buuvu Pickleball Bag With 2 Towels – Large Paddle Shoulder Tote With Zipper, Adjustable Strap Pocket | Unisex Sling Backpack For Travel &amp; Gym | Durable Sports Paddle Bag (Pink)</div>
            <div style={{ fontSize: 13, marginTop: 12 }}><b>ASIN:</b> B0DK7V5NXL</div>
            <div style={{ fontSize: 13, marginTop: 4 }}><b>Amazon Sales Rank:</b> 160528</div>
            <div style={{ fontSize: 13, marginTop: 12, fontWeight: 700 }}>Competing Marketplace Offers:</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>1 New from ₹4,549 + ₹0.00 shipping</div>
            <div className="sc-teal" style={{ fontSize: 13, marginTop: 4 }}>View Listings on Amazon</div>
            <div className="sc-teal" style={{ fontSize: 13, marginTop: 6 }}>More Info &#8250;</div>
          </div>
        </div>
        {/* tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #d5d9d9', marginTop: 22 }}>
          <span style={{ padding: '11px 18px', fontSize: 14, fontWeight: 700, borderBottom: '3px solid #e77600', color: '#111' }}>Product Details</span>
          {['Images', 'Variations', 'Offer', 'Safety & Compliance'].map((t) => (
            <span key={t} style={{ padding: '11px 18px', fontSize: 14, color: '#565959', cursor: 'pointer' }}>{t}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
          <div style={{ width: 130, flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: '#565959', marginBottom: 6 }}>Listing Language <span className="sc-teal">?</span></div>
            <select style={{ width: '100%', height: 32, border: '1px solid #888c8c', borderRadius: 6, fontSize: 13, padding: '0 8px' }}><option>English</option></select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 12, background: '#f0f7fc', border: '1px solid #cfe3f2', borderRadius: 6, padding: '14px 16px', fontSize: 13, color: '#111' }}>
              <span style={{ color: '#0066c0', fontSize: 16 }}>&#9432;</span>
              <div>
                <div>When multiple sellers sell the same product through a single detail page, we combine and present the best product data to ensure customers get the best experience.</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ width: 15, height: 15 }} />Show content currently live on the detail page</label>
              </div>
            </div>
            <div style={{ marginTop: 22 }}>
              <Label>Product Title <span style={{ color: '#c00' }}>*</span></Label>
              <input defaultValue="Buuvu Pickleball Bag With 2 Towels – Large Paddle Shoulder Tote With Zipper, Adjustable Strap Pocket" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
              <div><Label>Brand Name</Label><input defaultValue="Buuvu" style={inp} /></div>
              <div><Label>Manufacturer</Label><input defaultValue="Buuvu" style={inp} /></div>
              <div><Label>Item Type</Label><input defaultValue="Sports Paddle Bag" style={inp} /></div>
              <div><Label>Color</Label><input defaultValue="Pink" style={inp} /></div>
            </div>
            <div style={{ marginTop: 18 }}>
              <Label>Product Description</Label>
              <textarea defaultValue="Large capacity pickleball bag with dedicated paddle pocket, two included towels, and an adjustable sling strap for travel and gym use." style={{ ...inp, height: 90, padding: 10, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
              <button style={{ background: '#232f3e', color: '#fff', fontSize: 13, borderRadius: 8, padding: '9px 22px', border: 'none', cursor: 'pointer' }}>Save and finish</button>
              <button onClick={back} style={{ background: '#fff', color: '#111', border: '1px solid #888c8c', fontSize: 13, borderRadius: 8, padding: '9px 22px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const Label = ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{children}</div>;
const inp = { width: '100%', height: 38, border: '1px solid #888c8c', borderRadius: 6, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' };
