import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ShoppingCart, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getCredits } from "../api/client";

const NAV_ITEMS = (user, navigate, close) => [
  { label: 'All',          action: () => { navigate('/'); close(); } },
  { label: 'Shop Revive',  action: () => { navigate('/?source=p2p'); close(); }, highlight: true },
  { label: 'Renewed',      action: () => { navigate('/?source=renewed'); close(); } },
  { label: 'Warehouse',    action: () => { navigate('/?source=warehouse'); close(); } },
  { label: 'Sell Unused Items', action: () => { navigate('/sell'); close(); } },
  ...(user ? [{ label: 'My Listings', action: () => { navigate('/my-listings'); close(); } }] : []),
  ...(user ? [{ label: 'Green Credits', action: () => { navigate('/credits'); close(); } }] : []),
  ...(user ? [{ label: 'Orders',      action: () => { navigate('/orders'); close(); } }] : []),
];

const Header = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [credits, setCredits] = useState(null);

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

  const handleAuthClick = () => {
    if (user) logout();
    else navigate('/login');
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
            placeholder="Search Revive listings..."
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
          {/* Account */}
          <div
            className="cursor-pointer px-1 sm:px-2 py-1 border border-transparent hover:border-white rounded-sm transition-colors flex-shrink-0"
            onClick={handleAuthClick}
          >
            <p className="text-gray-300 text-[11px] leading-none mb-0.5 hidden sm:block">
              {user ? `Hello, ${user.name.split(' ')[0]}` : 'Hello, sign in'}
            </p>
            <p className="font-bold text-[13px] leading-none hidden sm:block">
              {user ? 'Account & Sign out' : 'Account & Lists'}
              <span className="ml-0.5">▾</span>
            </p>
            <p className="font-bold text-sm leading-none sm:hidden">
              {user ? 'Hi' : 'Sign in'}
            </p>
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
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-[#febd69] rounded-full text-[#131921] font-bold text-[10px] sm:text-xs flex items-center justify-center">
                  {cart.length}
                </span>
              )}
              <ShoppingCart className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
            </div>
            <p className="font-bold text-sm hidden md:block">Cart</p>
          </div>
        </div>
      </div>

      {/* ── Desktop nav bar ── */}
      <div className="hidden md:flex items-center bg-[#232F3E] text-white text-sm overflow-x-auto whitespace-nowrap px-1 py-1 gap-0">
        {/* ≡ All */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 transition-colors font-bold"
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
        <button onClick={() => navigate('/?q=Electronics')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Electronics</button>
        <button onClick={() => navigate('/?q=Fashion')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Fashion</button>
        <button onClick={() => navigate('/?q=Home')} className="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Home &amp; Garden</button>
      </div>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div className="md:hidden bg-[#232F3E] text-white text-sm shadow-lg">
          {/* User greeting */}
          {user && (
            <div className="px-4 py-3 border-b border-white/10 text-xs text-gray-300">
              Hello, <span className="font-bold text-white">{user.name}</span>
            </div>
          )}

          {/* Nav links */}
          <nav className="py-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className={`w-full text-left px-4 py-3 hover:bg-white/10 transition-colors border-b border-white/5
                  ${item.highlight ? 'text-[#febd69] font-semibold' : 'text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Category links */}
          <div className="border-t border-white/10 py-1">
            <p className="px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Shop by Category</p>
            {['Electronics', 'Fashion', 'Home & Garden'].map((cat) => (
              <button
                key={cat}
                onClick={() => { navigate(`/?q=${cat}`); closeMenu(); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
