import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { products, SVG, gCol } from '../data/sellerData';
import { useSellerUI } from '../SellerUI';

const GRID = '36px 130px 1fr 150px 160px 220px 150px 30px';
const ROW_MENU = ['Edit listing', 'Manage images', 'Copy listing', 'Add another condition', 'Change to Fulfilled by Merchant', 'Send or replenish inventory', 'Set replenishment alerts', 'Create removal order', 'Create fulfillment order', 'Print item labels', 'Close listing', 'Delete listing'];

export default function SellerInventory() {
  const nav = useNavigate();
  const [rowMenu, setRowMenu] = useState(null);
  const openProduct = (asin) => nav(`/seller/inventory/${asin}`);
  const { openHealthCard } = useSellerUI();

  return (
    <div style={{ background: '#fff', minHeight: '80vh' }}>
      <div style={{ maxWidth: 1500, margin: '0 auto', padding: '12px 16px 60px' }}>
        <div style={{ fontSize: 12.5, color: '#111', padding: '6px 0', borderBottom: '1px solid #eaeded' }}>
          <b>Listing Tools:</b>
          {['All Inventory', 'Search Suppressed and Inactive Listings (1)', 'Improve Listing Quality in bulk', 'Potential Duplicates', 'Complete your drafts', 'Review compliance'].map((t, i) => (
            <React.Fragment key={i}><span className="sc-teal" style={{ margin: '0 4px', textDecoration: i === 0 ? 'underline' : 'none' }}>{t}</span>{i < 5 ? '|' : ''}</React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: '#111', padding: '6px 0' }}>
          <b>FBA Inventory Tools:</b>
          {['FBA Dashboard', 'FBA Inventory', 'Shipments', 'FBA Opportunities', 'FBA Analytics'].map((t, i) => (
            <React.Fragment key={i}><span className="sc-teal" style={{ margin: '0 4px' }}>{t}</span>{i < 4 ? '|' : ''}</React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: 10 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0 }}>Manage All Inventory</h1>
            <div style={{ fontSize: 12.5, color: '#565959', marginTop: 4 }}>Manage your inventory across marketplaces from a single place.
              <span className="sc-teal"> Learn more</span> | <span className="sc-teal">View product tour</span> | <span className="sc-teal">Provide feedback</span></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnDark}>Add a variation</button>
            <button style={btnDark}>Add a product</button>
          </div>
        </div>

        {/* filter bar */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Search</div>
            <div style={{ display: 'flex' }}>
              <select style={{ height: 34, border: '1px solid #888c8c', borderRadius: '8px 0 0 8px', background: '#f0f2f2', fontSize: 13, padding: '0 8px', borderRight: 'none' }}><option>All</option></select>
              <input placeholder="Search SKU, Title/Keyword, FNSKU, ASIN, UPC/EAN" style={{ width: 340, height: 34, border: '1px solid #888c8c', padding: '0 10px', fontSize: 13 }} />
              <button style={{ width: 40, height: 34, background: '#f0f2f2', border: '1px solid #888c8c', borderLeft: 'none', borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.4"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
              </button>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}><Toggle />Show only Favorites</label>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Listing status <span style={{ background: '#007185', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, verticalAlign: 1 }}>Updated</span></div>
            <select style={sel}><option>Active ({products.length})</option></select>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Fulfilled by</div>
            <select style={sel}><option>All</option></select>
          </div>
          <button style={btnGhost}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>All filters</button>
          <button style={btnGhost}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v10M4.2 4.2l4.2 4.2m7.2 7.2l4.2 4.2" /></svg>Preferences</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '14px 0 4px', fontSize: 12.5 }}>
          <span>1 - {products.length} of {products.length}</span>
          <span style={{ fontWeight: 700 }}>Sort by:</span>
          <select style={{ height: 30, border: '1px solid #888c8c', borderRadius: 6, fontSize: 12.5, padding: '0 8px' }}><option>Sales: Highest on top</option></select>
        </div>

        {/* header */}
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '8px 6px', borderBottom: '2px solid #d5d9d9', fontSize: 12 }}>
          <div />
          <div><b>Listing status</b><div style={{ color: '#565959' }}>Next step</div></div>
          <div><b>Product details</b><div style={{ color: '#565959' }}>Image, Title, ASIN, and SKU</div></div>
          <div><b>Performance</b> <span style={{ color: '#007185' }}>&#9432;</span><div style={{ color: '#565959' }}>Last 30 days</div></div>
          <div><b>Inventory</b><div style={{ color: '#565959' }}>Fulfilled by and quantity</div></div>
          <div><b>Price and shipping cost</b><div style={{ color: '#565959' }}>Pricing details</div></div>
          <div><b>Estimated fees</b><div style={{ color: '#565959' }}>per unit sold</div></div>
          <div />
        </div>

        {/* rows */}
        {products.map((p, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 12, padding: '14px 6px', borderBottom: '1px solid #eaeded', fontSize: 12.5, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 15, height: 15 }} />
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" /></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#111' }}>{p.status}</div>
              <div style={{ color: '#565959', fontSize: 11.5, marginTop: 2 }}>{p.date}</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ width: 46, height: 46, borderRadius: 4, background: p.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={p.ink} strokeWidth="1.5"><path d={SVG.shoe} /><path d="M9 8V6a3 3 0 016 0v2" /></svg>
              </div>
              <div style={{ minWidth: 0 }}>
                <div onClick={() => openProduct(p.asin)} className="sc-teal" style={{ lineHeight: 1.34 }}>{p.title}</div>
                {p.cond && (
                  <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 800, letterSpacing: '.4px', textTransform: 'uppercase', background: '#131a22', color: '#febd69', padding: '2px 8px', borderRadius: 5 }}>
                    Revive &middot; {p.cond}
                  </span>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', marginTop: 6, color: '#565959' }}>
                  <span>ASIN</span><span style={{ color: '#111' }}>{p.asin}</span>
                  <span>SKU</span><span style={{ color: '#111' }}>{p.sku}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, border: '1px solid #d5d9d9', borderRadius: 6, padding: '3px 8px', color: '#007185', fontSize: 11.5, cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                  Variation Family Details
                </div>
                {p.hcCase && (() => {
                  const hg = gCol[p.hcGrade] || {};
                  return (
                    <div onClick={() => openHealthCard(p.hcCase)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 8, marginLeft: 6, border: `1px solid ${hg.line}`, background: hg.bg, borderRadius: 6, padding: '3px 9px', color: hg.ink, fontSize: 11.5, cursor: 'pointer', fontWeight: 700 }}>
                      <span style={{ width: 17, height: 17, borderRadius: 4, background: '#fff', color: hg.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 10 }}>{p.hcGrade}</span>
                      AI-inspected &middot; view Health Card
                    </div>
                  );
                })()}
              </div>
            </div>
            <div style={{ color: '#565959' }}>
              <KV k="Sales" v={p.sales} /><KV k="Units sold" v={p.units} /><KV k="Page views" v={p.views} /><KV k="Sales rank" v={p.rank} />
              <div style={{ fontSize: 11 }}>{p.category}</div>
            </div>
            <div style={{ color: '#565959' }}>
              <KV k="Available (FBA)" v={p.fba} /><KV k="Inbound" v={p.inbound} /><KV k="Unfulfillable" v={p.unfulfillable} /><KV k="Reserved" v={p.reserved} />
            </div>
            <div style={{ color: '#565959' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}><span>Price</span>
                <span style={priceBox}><span style={priceUnit}>INR</span><input defaultValue={p.price} style={priceInput} /></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Shipping cost</span><span>+ ₹0.00</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '5px 0' }}><span>Minimum price</span>
                <span style={priceBox}><span style={priceUnit}>INR</span><input style={priceInput} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span>Maximum price</span>
                <span style={priceBox}><span style={priceUnit}>INR</span><input style={priceInput} /></span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ color: '#007600' }}>&#10004;</span> Featured offer</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={chk}><span style={{ color: '#007600' }}>&#10004;</span>Competitive price</span><span>{p.comp}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={chk}><span style={{ color: '#007600' }}>&#10004;</span>Lowest price</span><span>{p.low}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={chk}><span style={{ color: '#007600' }}>&#10004;</span>Business price</span><span>{p.biz}</span></div>
                <div className="sc-teal" style={{ marginTop: 3 }}>View reference prices</div>
              </div>
            </div>
            <div style={{ color: '#565959' }}>
              <KV k="Total fees" v={p.totalFees} /><KV k="FBA fee" v={p.fbaFee} />
              <div className="sc-teal" style={{ marginTop: 4 }}>Calculate revenue</div>
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => setRowMenu(rowMenu === idx ? null : idx)} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d5d9d9', borderRadius: 6, color: '#333', background: '#fff', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
              </button>
              {rowMenu === idx && (
                <div style={{ position: 'absolute', top: 30, right: 0, width: 220, background: '#fff', border: '1px solid #d5d9d9', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', zIndex: 30, padding: '4px 0', fontSize: 13 }}>
                  {ROW_MENU.map((m, i) => (
                    <div key={i} onClick={() => (i === 0 ? openProduct(p.asin) : setRowMenu(null))} className="act-row" style={{ padding: '9px 14px', cursor: 'pointer' }}>{m}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div style={{ fontSize: 12, color: '#565959', padding: '20px 0' }}>Help | Program Policies | English | Download the Amazon Seller mobile app | Next gen selling</div>
      </div>
    </div>
  );
}

const KV = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{k}</span><b style={{ color: '#111' }}>{v}</b></div>;
const Toggle = () => <span style={{ width: 32, height: 16, background: '#ccc', borderRadius: 10, position: 'relative', display: 'inline-block' }}><span style={{ position: 'absolute', top: 2, left: 2, width: 12, height: 12, background: '#fff', borderRadius: '50%' }} /></span>;
const btnDark = { background: '#232f3e', color: '#fff', fontSize: 13, borderRadius: 8, padding: '8px 16px', border: 'none', cursor: 'pointer' };
const btnGhost = { height: 34, alignSelf: 'flex-end', border: '1px solid #007185', color: '#007185', background: '#fff', borderRadius: 8, fontSize: 13, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' };
const sel = { height: 34, border: '1px solid #888c8c', borderRadius: 8, fontSize: 13, padding: '0 8px', minWidth: 120 };
const priceBox = { display: 'flex', alignItems: 'center', border: '1px solid #888c8c', borderRadius: 4, overflow: 'hidden' };
const priceUnit = { background: '#f0f2f2', padding: '2px 5px', fontSize: 11, borderRight: '1px solid #888c8c' };
const priceInput = { width: 52, border: 'none', padding: '2px 5px', fontSize: 12, textAlign: 'right' };
const chk = { display: 'flex', alignItems: 'center', gap: 5 };
