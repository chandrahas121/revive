import React from 'react';
import { useNavigate } from 'react-router-dom';

const COLUMNS = [
  {
    heading: 'Get to Know Us',
    links: [
      { label: 'About Amazon Revive', to: '/' },
      { label: 'Careers', href: '#' },
      { label: 'Investor Relations', href: '#' },
      { label: 'Amazon Devices', href: '#' },
    ],
  },
  {
    heading: 'Make Money with Us',
    links: [
      { label: 'Sell on Amazon Revive', to: '/sell' },
      { label: 'List a Pre-Loved Item', to: '/sell' },
      { label: 'Become an Affiliate', href: '#' },
      { label: 'Advertise Your Products', href: '#' },
    ],
  },
  {
    heading: 'Amazon Payment Products',
    links: [
      { label: 'Amazon Business Card', href: '#' },
      { label: 'Shop with Points', href: '#' },
      { label: 'Reload Your Balance', href: '#' },
      { label: 'Amazon Currency Converter', href: '#' },
    ],
  },
  {
    heading: 'Let Us Help You',
    links: [
      { label: 'Your Account', to: '/orders' },
      { label: 'Your Orders', to: '/orders' },
      { label: 'Green Credits Wallet', to: '/credits' },
      { label: 'Returns & Replacements', to: '/orders' },
      { label: 'Shipping Rates & Policies', href: '#' },
    ],
  },
];

const Footer = () => {
  const navigate = useNavigate();

  const handleScrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <footer className="w-full" style={{ fontFamily: 'inherit' }}>
      {/* Back to top */}
      <button
        onClick={handleScrollTop}
        className="block w-full py-3.5 text-center text-white text-sm font-medium transition-colors"
        style={{ background: '#37475A' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#485769')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#37475A')}
      >
        Back to top
      </button>

      {/* Main link grid */}
      <div className="w-full py-10 px-4" style={{ background: '#232F3E' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-white font-bold text-[15px] mb-4">{col.heading}</h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <button
                        onClick={() => navigate(link.to)}
                        className="text-[#8a97a9] hover:text-white hover:underline text-sm transition-colors text-left"
                      >
                        {link.label}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        className="text-[#8a97a9] hover:text-white hover:underline text-sm transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ background: '#232F3E', borderTop: '1px solid rgba(197,198,204,0.2)' }} />

      {/* Branding + locale */}
      <div
        className="w-full py-7 flex flex-col md:flex-row items-center justify-center gap-5"
        style={{ background: '#232F3E' }}
      >
        <span className="font-bold text-white text-2xl tracking-tight cursor-pointer" onClick={() => navigate('/')}>
          amazon<span style={{ color: '#febd69' }}>.in</span>
        </span>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {[
            { icon: '🌐', label: 'English' },
            { icon: '₹', label: 'INR – Indian Rupee' },
            { icon: '🇮🇳', label: 'India' },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="flex items-center gap-1.5 border text-white text-xs px-3 py-1.5 rounded transition-colors"
              style={{ borderColor: 'rgba(197,198,204,0.4)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#37475A')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legal bar */}
      <div
        className="w-full py-7 px-4 flex flex-col items-center gap-2"
        style={{ background: '#131A22' }}
      >
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {['Conditions of Use', 'Privacy Notice', 'Interest-Based Ads', 'Cookie Preferences'].map((item) => (
            <a key={item} href="#" className="text-[#8a97a9] hover:text-white hover:underline text-[11px] transition-colors">
              {item}
            </a>
          ))}
        </div>
        <p className="text-[#8a97a9] text-[11px]">© 2024, Amazon, Inc. or its affiliates</p>
      </div>
    </footer>
  );
};

export default Footer;
