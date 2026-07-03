import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerUI } from '../SellerUI';
import { catNames, menuMap } from '../data/sellerData';

// Two-column left flyout: category rail + items for the active category.
export default function MenuFlyout() {
  const nav = useNavigate();
  const { menuOpen, setMenuOpen, toggleMenu, menuCat, setMenuCat } = useSellerUI();
  if (!menuOpen) return null;

  const items = (menuMap[menuCat] || []).map((row) => {
    const [rawLabel, target, pinned] = row;
    const header = rawLabel.startsWith('__H__');
    return { header, label: header ? rawLabel.replace('__H__ ', '') : rawLabel, target, pinned };
  });

  const go = (target) => {
    setMenuOpen(false);
    if (target) nav(target);
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 80 }} onClick={toggleMenu} />
      <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, display: 'flex', zIndex: 81 }}>
        {/* categories */}
        <div style={{ width: 200, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '2px 0 8px rgba(0,0,0,.1)' }}>
          <div style={{ background: '#232f3e', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, cursor: 'pointer' }} onClick={toggleMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></svg> Menu
          </div>
          {catNames.map((name) => (
            <div key={name} onClick={() => setMenuCat(name)} className="cat-row"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 14, cursor: 'pointer', background: menuCat === name ? '#eaf3f3' : '#fff', borderLeft: `3px solid ${menuCat === name ? '#007185' : 'transparent'}` }}>
              <span>{name}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><polyline points="9 6 15 12 9 18" /></svg>
            </div>
          ))}
        </div>
        {/* items */}
        <div style={{ width: 250, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '2px 0 8px rgba(0,0,0,.08)', padding: '8px 0' }}>
          {items.map((it, i) => it.header ? (
            <div key={i} style={{ padding: '12px 18px 5px', fontSize: 12, fontWeight: 700, color: '#111', borderTop: '1px solid #eaeded', marginTop: 4 }}>{it.label}</div>
          ) : (
            <div key={i} onClick={() => go(it.target)} className="mi-row"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
              <span>{it.label}</span>
              {it.pinned && <svg width="12" height="12" viewBox="0 0 24 24" fill="#232f3e"><path d="M6 2h12a2 2 0 012 2v18l-8-4-8 4V4a2 2 0 012-2z" /></svg>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
