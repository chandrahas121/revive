import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart, Menu, X, ChevronRight, UserCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getCredits } from "@amazon-hackon/shared";

const NAV_ITEMS = (user, navigate, close) => [
  { label: 'All',          action: () => { navigate('/'); close(); } },
  // v2 (point 7): only two second-life surfaces — Revive (AI-scanned seller/return
  // items) and Renewed (Amazon authorized-center refurbished). No Warehouse/Returns.
  { label: 'Shop Revive',  action: () => { navigate('/?source=revive'); close(); }, highlight: true },
  { label: 'Renewed',      action: () => { navigate('/?source=renewed'); close(); } },
  { label: 'Sell Unused Items', action: () => { navigate('/sell'); close(); } },
  ...(user ? [{ label: 'My Listings', action: () => { navigate('/my-listings'); close(); } }] : []),
  ...(user ? [{ label: 'Green Credits', action: () => { navigate('/credits'); close(); } }] : []),
  ...(user ? [{ label: 'Orders',      action: () => { navigate('/orders'); close(); } }] : []),
];

const Header = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { cart, cartItemCount } = useCart();
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [credits, setCredits] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = React.useRef(null);

  useEffect(() => {
    if (!accountOpen) return;
    const handler = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountOpen]);

  useEffect(() => {
    if (!user) { setCredits(null); return; }
    getCredits().then((res) => setCredits(res.data.balance)).catch(() => setCredits(null));
  }, [user]);

  const closeMenu = () => setMenuOpen(false);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchText.trim()) params.set('q', searchText.trim());
    const src = searchParams.get('source');
    if (src) params.set('source', src);
    navigate(`/?${params.toString()}`);
    closeMenu();
  };

  const navItems = NAV_ITEMS(user, navigate, closeMenu);

  return (
    <header className="sticky top-0 z-50">
      {/* ── Top bar ── */}
      <div className="flex items-center bg-[#131921] px-2 py-1 gap-2">

        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden flex-shrink-0 p-1.5 text-white hover:bg-white/10 rounded"
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Logo */}
        <div onClick={() => { navigate('/'); closeMenu(); }} className="flex-shrink-0 cursor-pointer border border-transparent hover:border-white rounded-sm transition-colors">
          <img
            width={110}
            height={33}
            src="https://links.papareact.com/f90"
            alt="Amazon logo"
            className="p-2 object-contain"
          />
        </div>

        {/* Deliver to — hidden on mobile */}
        <div className="hidden md:flex flex-col cursor-pointer flex-shrink-0 px-1 py-1 border border-transparent hover:border-white rounded-sm transition-colors min-w-[90px]">
          <span className="text-gray-300 text-[11px] leading-none">Delivering to</span>
          <span className="flex items-center gap-0.5 mt-0.5">
            <svg className="w-3.5 h-3.5 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-white font-bold text-[13px] leading-none">Update location</span>
          </span>
        </div>

        {/* Search — takes all remaining space */}
        <form onSubmit={handleSearch} className="flex flex-1 min-w-0 items-center rounded-md overflow-hidden h-10">
          <input
            className="flex-1 min-w-0 h-full px-3 text-sm text-black focus:outline-none"
            type="text"
            placeholder="Search Amazon..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <button
            type="submit"
            className="h-full px-3 sm:px-4 bg-[#febd69] hover:bg-[#f3a847] flex items-center justify-center flex-shrink-0"
          >
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-[#131921]" />
          </button>
        </form>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 text-white">
          {/* Account — dropdown on click when logged in */}
          <div ref={accountRef} className="relative flex-shrink-0">
            <div
              className="cursor-pointer px-1 sm:px-2 py-1 border border-transparent hover:border-white rounded-sm transition-colors"
              onClick={() => {
                if (user) setAccountOpen((o) => !o);
                else { navigate('/login'); closeMenu(); }
              }}
            >
              <p className="text-gray-300 text-[11px] leading-none mb-0.5 hidden sm:block">
                {user ? `Hello, ${user.name.split(' ')[0]}` : 'Hello, sign in'}
              </p>
              <p className="font-bold text-[13px] leading-none hidden sm:block">
                Account &amp; Lists <span className="ml-0.5">▾</span>
              </p>
              <p className="font-bold text-sm leading-none sm:hidden">
                {user ? 'Hi' : 'Sign in'}
              </p>
            </div>
            {user && accountOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white text-[#0F1111] rounded shadow-xl z-50 min-w-[170px] py-1 border border-gray-200">
                <button
                  onClick={() => { logout(); setAccountOpen(false); closeMenu(); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Green Credits chip */}
          {user && credits != null && (
            <div
              onClick={() => navigate('/credits')}
              className="cursor-pointer hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-[#1c3d2b] hover:bg-[#245038] text-[#a7f3d0] text-xs font-bold"
              title="Green Credits"
            >
              <span>🌿</span><span>{credits}</span>
            </div>
          )}

          {/* Returns & Orders — hidden on mobile */}
          <div
            onClick={() => navigate('/orders')}
            className="cursor-pointer px-1 sm:px-2 py-1 border border-transparent hover:border-white rounded-sm transition-colors hidden md:block flex-shrink-0"
          >
            <p className="text-gray-300 text-[11px] leading-none mb-0.5">Returns</p>
            <p className="font-bold text-[13px] leading-none">&amp; Orders</p>
          </div>

          {/* Cart */}
          <div
            onClick={() => { navigate('/checkout'); closeMenu(); }}
            className="cursor-pointer flex items-center gap-1 px-1 sm:px-2 py-1"
          >
            <div className="relative">
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-[#febd69] rounded-full text-[#131921] font-bold text-[10px] sm:text-xs flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
              <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
            <p className="font-bold text-sm hidden md:block">Cart</p>
          </div>
        </div>
      </div>

      {/* ── Desktop nav bar ── */}
      <div className="hidden md:flex items-center bg-[#232F3E] text-white text-sm overflow-x-auto whitespace-nowrap px-1 py-1 gap-1">
        {/* ≡ All */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-2 mr-1 border border-transparent hover:border-white rounded-sm flex-shrink-0 transition-colors font-bold"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
          </svg>
          All
        </button>
        {navItems.filter(i => i.label !== 'All').map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 transition-colors
              ${item.highlight ? 'font-bold text-[#febd69]' : ''}`}
          >
            {item.label}
          </button>
        ))}
        <span className="text-gray-600 px-1 flex-shrink-0 hidden lg:inline select-none">|</span>
        <button onClick={() => navigate('/?category=Phone')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Mobiles</button>
        <button onClick={() => navigate('/?category=Laptop')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Laptops</button>
        <button onClick={() => navigate('/?category=Apparel')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Apparel</button>
        <button onClick={() => navigate('/?category=Footwear')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Footwear</button>
      </div>

      {/* ── Mobile drawer (Amazon-style white slide-over) ── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Dim overlay */}
          <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />

          {/* Panel */}
          <div className="absolute left-0 top-0 bottom-0 w-[88%] max-w-sm bg-white text-[#0F1111] shadow-2xl overflow-y-auto">
            {/* Dark header with greeting */}
            <div className="sticky top-0 bg-[#232F3E] text-white px-4 py-4 flex items-center gap-2.5 z-10">
              <UserCircle className="w-7 h-7 flex-shrink-0" />
              <span className="text-lg font-bold truncate">
                {user ? `Hello, ${user.name.split(' ')[0]}` : 'Hello, sign in'}
              </span>
              <button onClick={closeMenu} className="ml-auto p-1 hover:bg-white/10 rounded" aria-label="Close menu">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Main nav */}
            <nav className="py-1.5">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between text-left px-4 py-3 hover:bg-[#F7F8F8] transition-colors border-b border-gray-100
                    ${item.highlight ? 'text-[#C7511F] font-bold' : 'text-[#0F1111]'}`}
                >
                  <span className="text-[15px]">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </nav>

            {/* Shop by Category */}
            <div className="border-t-8 border-[#F0F2F2]">
              <p className="px-4 pt-3 pb-1 text-lg font-bold text-[#0F1111]">Shop by Category</p>
              {[
                { label: 'Mobiles & Phones', cat: 'Phone' },
                { label: 'Laptops', cat: 'Laptop' },
                { label: 'Monitors', cat: 'Monitor' },
                { label: 'Apparel', cat: 'Apparel' },
                { label: 'Footwear', cat: 'Footwear' },
                { label: 'Home & Kitchen', cat: 'Home & Kitchen' },
                { label: 'Books', cat: 'Books' },
              ].map((c) => (
                <button key={c.cat} onClick={() => { navigate(`/?category=${encodeURIComponent(c.cat)}`); closeMenu(); }}
                  className="w-full flex items-center justify-between text-left px-4 py-3 border-b border-gray-100 text-[#0F1111] hover:bg-[#F7F8F8] transition-colors">
                  <span className="text-[15px]">{c.label}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              ))}
            </div>

            {/* Help & Settings */}
            <div className="border-t-8 border-[#F0F2F2] pb-6">
              <p className="px-4 pt-3 pb-1 text-lg font-bold text-[#0F1111]">Help &amp; Settings</p>
              {user && (
                <button onClick={() => { navigate('/dashboard'); closeMenu(); }}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 text-[15px] text-[#0F1111] hover:bg-[#F7F8F8] transition-colors">
                  Your Account
                </button>
              )}
              <button onClick={() => { navigate('/orders'); closeMenu(); }}
                className="w-full text-left px-4 py-3 border-b border-gray-100 text-[15px] text-[#0F1111] hover:bg-[#F7F8F8] transition-colors">
                Customer Service
              </button>
              {user ? (
                <button onClick={() => { logout(); closeMenu(); }}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 text-[15px] text-[#0F1111] hover:bg-[#F7F8F8] transition-colors">
                  Sign Out
                </button>
              ) : (
                <button onClick={() => { navigate('/login'); closeMenu(); }}
                  className="w-full text-left px-4 py-3 border-b border-gray-100 text-[15px] text-[#0F1111] hover:bg-[#F7F8F8] transition-colors">
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
