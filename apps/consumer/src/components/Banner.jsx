import React from "react";
import { Carousel } from "react-responsive-carousel";
import { useNavigate } from "react-router-dom";
import "react-responsive-carousel/lib/styles/carousel.min.css";

const SLIDES = [
  {
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1500&h=500&fit=crop",
    title: "Shop AI-Verified Pre-Loved Electronics",
    subtitle: "Same trust. Lower price. Better for the planet.",
    cta: "Shop Revive Electronics",
    source: "p2p",
  },
  {
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1500&h=500&fit=crop",
    title: "List Your Items in Minutes",
    subtitle: "Take photos, set your price, drop off at any Amazon Locker.",
    cta: "Start Selling",
    link: "/sell",
  },
  {
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=1500&h=500&fit=crop",
    title: "Earn Green Credits on Every Order",
    subtitle: "Keep your delivery. Skip the return. Earn credits, save CO₂.",
    cta: "Browse Renewed Items",
    source: "renewed",
  },
];

const TRUST_CELLS = [
  {
    icon: (
      <svg className="w-5 h-5 text-[#077a52] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bold: 'AI-verified condition',
    sub: 'Every item graded A–D',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#077a52] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round"/>
      </svg>
    ),
    bold: 'Buyer protection',
    sub: 'Escrow until you confirm',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#077a52] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M1 4v6h6M23 20v-6h-6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    bold: '7-day returns',
    sub: 'Instant Amazon Pay refund',
  },
  {
    icon: (
      <svg className="w-5 h-5 text-[#077a52] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 1 1 0 20M6.3 6.3a10 10 0 0 0 0 11.4M12 2v20" strokeLinecap="round"/>
        <path d="M2 12h10" strokeLinecap="round"/>
      </svg>
    ),
    bold: 'Earn Green Credits',
    sub: 'Saved CO₂ on every order',
  },
];

const TrustStrip = () => (
  <div className="bg-white border-b border-[#D5D9D9]">
    <div className="max-w-screen-xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-[#D5D9D9]">
      {TRUST_CELLS.map((c) => (
        <div key={c.bold} className="flex items-center gap-2.5 px-3 sm:px-4 py-3">
          {c.icon}
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0F1111] leading-snug">{c.bold}</p>
            <p className="text-[11px] text-gray-500 leading-snug hidden sm:block">{c.sub}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Banner = () => {
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* Bottom fade into page background */}
      <div className="absolute w-full h-16 sm:h-24 bottom-0 z-20 pointer-events-none" style={{ background: 'linear-gradient(to top, #EAEDED, transparent)' }} />

      <Carousel
        autoPlay
        infiniteLoop
        showStatus={false}
        showIndicators
        showThumbs={false}
        interval={4000}
        swipeable
      >
        {SLIDES.map((slide, i) => (
          <div key={i} className="relative">
            <img
              loading="lazy"
              src={slide.image}
              alt={slide.title}
              className="w-full object-cover h-44 sm:h-64 md:h-80 lg:h-[360px]"
            />
            {/* Text overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent flex items-center z-10">
              <div className="text-left px-4 sm:px-8 md:px-12 max-w-xs sm:max-w-md">
                <h2 className="text-white text-base sm:text-xl md:text-2xl lg:text-3xl font-bold leading-snug mb-1 sm:mb-2 drop-shadow">
                  {slide.title}
                </h2>
                <p className="text-gray-200 text-xs sm:text-sm mb-3 sm:mb-4 drop-shadow hidden sm:block">
                  {slide.subtitle}
                </p>
                <button
                  onClick={() =>
                    slide.link
                      ? navigate(slide.link)
                      : navigate(slide.source ? `/?source=${slide.source}` : '/')
                  }
                  className="bg-[#febd69] hover:bg-[#f3a847] text-[#131921] font-bold px-3 py-1.5 sm:px-5 sm:py-2 rounded text-xs sm:text-sm transition-colors"
                >
                  {slide.cta}
                </button>
              </div>
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export { TrustStrip };
export default Banner;
