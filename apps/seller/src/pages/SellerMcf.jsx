import React from 'react';

// Create MCF Order — presentational 3-column form (Fulfillment sub-nav target).
export default function SellerMcf() {
  return (
    <div style={{ background: '#fff', minHeight: '80vh' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '18px 20px 60px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 400, margin: 0 }}>Create MCF Order</h1>
        <div style={{ fontSize: 12.5, color: '#565959', marginTop: 4 }}>Go to <span className="sc-teal">Multi-Channel Fulfillment</span> to learn more. Watch <span className="sc-teal">our video tutorial</span> to learn how to place an order and set up automated order placement.</div>
        <div style={{ background: '#eef6f7', border: '1px solid #cfe3e5', borderRadius: 6, padding: '12px 16px', margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: '#111' }}>
          <span>Estimate the return on investment (ROI) that Buy with Prime may provide to your business when you offer Prime shopping benefits such as fast, free delivery, and easy returns on your ecommerce website. <span className="sc-teal">Try the ROI Calculator</span></span>
          <span style={{ color: '#888', cursor: 'pointer', fontSize: 16 }}>&times;</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <Col n="1. Enter customer address">
            <L>Country <span className="sc-teal">?</span></L>
            <select style={inp}><option>🇺🇸 United States</option></select>
            <div style={{ fontSize: 11.5, color: '#565959', margin: '4px 0 16px' }}>International postal addresses allowed</div>
            <L>Full name</L><input style={{ ...inp, marginBottom: 16 }} />
            <L>Street address</L><input placeholder="Street address, P.O. box, company name, c/o" style={inp} />
            <div className="sc-teal" style={{ fontSize: 13, margin: '6px 0 16px' }}>+ Add a line</div>
            <L>City</L><input style={{ ...inp, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}><L>State / Province</L><select style={inp}><option /></select></div>
              <div style={{ flex: 1 }}><L>ZIP / Postal code</L><input style={inp} /></div>
            </div>
          </Col>
          <Col n="2. Add items">
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #888c8c', borderRadius: 6, padding: '0 10px', height: 38, gap: 8, marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              <span style={{ color: '#8a8f8f', fontSize: 13 }}>Search by title, MSKU, ASIN, or FNSKU</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, paddingBottom: 8, borderBottom: '1px solid #eaeded' }}><span>SKUs</span><span>Units</span></div>
            <div style={{ textAlign: 'center', color: '#565959', fontSize: 13, padding: '26px 10px', borderBottom: '1px solid #eaeded' }}>Use the search field above to add items to this order</div>
            <div style={{ fontSize: 13, fontWeight: 700, margin: '16px 0 5px' }}>Order ID</div>
            <input placeholder="Will generate if left blank" style={{ ...inp, marginBottom: 16 }} />
            <L>Packing slip comments <span className="sc-teal">&#9432;</span></L>
            <input defaultValue="Thank you for your order" style={inp} />
          </Col>
          <Col n="3. Select shipping options">
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Shipping speed</div>
            <Radio on label="Standard" />
            <Radio label="Expedited" />
            <div style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 8px' }}>Shipping details estimates</div>
            <div style={{ fontSize: 12.5, color: '#565959', lineHeight: 1.9 }}>Shipping weight : -<br />Estimated ship date : -<br />Latest delivery date : -<br />Order total : -</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
              <button style={{ background: '#232f3e', color: '#fff', fontSize: 13, borderRadius: 8, padding: '9px 18px', border: 'none', cursor: 'pointer' }}>Create order</button>
              <button style={{ background: '#fff', color: '#007185', border: '1px solid #007185', fontSize: 13, borderRadius: 8, padding: '9px 18px', cursor: 'pointer' }}>Create hold order</button>
            </div>
          </Col>
        </div>
      </div>
    </div>
  );
}

const Col = ({ n, children }) => <div style={{ border: '1px solid #d5d9d9', borderRadius: 8, padding: 20 }}><div style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>{n}</div>{children}</div>;
const L = ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{children}</div>;
const inp = { width: '100%', height: 38, border: '1px solid #888c8c', borderRadius: 6, padding: '0 10px', fontSize: 13, boxSizing: 'border-box' };
const Radio = ({ on, label }) => (
  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 16, cursor: 'pointer' }}>
    <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#007185' : '#888'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#007185' }} />}</span>
    <span><b style={{ fontWeight: 700 }}>{label}</b><div style={{ fontSize: 12, color: '#565959' }}>Arrives by:</div></span>
  </label>
);
