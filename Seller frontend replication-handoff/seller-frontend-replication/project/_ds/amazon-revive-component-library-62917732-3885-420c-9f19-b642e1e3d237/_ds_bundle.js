/* @ds-bundle: {"format":3,"namespace":"AmazonReviveComponentLibrary_629177","components":[{"name":"TryOnResultCard","sourcePath":"frontend/src/components/stitch/TryOnResultCard.jsx"}],"sourceHashes":{"frontend/src/components/stitch/TryOnResultCard.jsx":"7430f54adc83","revive/app.jsx":"112673c0dd7d","revive/cart.jsx":"79859677472d","revive/components.jsx":"65511db3bf12","revive/data.js":"ee5d1023d6bb","revive/grading.jsx":"a519b476fa67","revive/healthcard.jsx":"4ce05b0da9a0","revive/home.jsx":"c46b4bc23165","revive/nav.js":"55cdf280fd05","revive/orders.jsx":"f541b6ea9c7d","revive/product.jsx":"d5f6a2341451","revive/sell.jsx":"7af50421b37f","revive/theme.js":"c909852545f0","revive/tryon.jsx":"223bf6c547ca"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AmazonReviveComponentLibrary_629177 = window.AmazonReviveComponentLibrary_629177 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// frontend/src/components/stitch/TryOnResultCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  useState
} = React;
const {
  createPortal
} = ReactDOM;
/* ============================================================
 * TryOnResultCard — Polished result card for Virtual Try-On.
 *
 * Replaces the full-page result takeover with a compact,
 * well-proportioned modal card styled to match the Amazon Revive
 * design system (navy / gold / orange / teal).
 *
 * Props:
 *   resultImage   {string}  — base64 or URL of the AI result
 *   personPreview {string}  — original person photo (for before/after)
 *   garmentImage  {string}  — URL of the garment thumbnail
 *   garmentTitle  {string}  — name of the garment
 *   price         {number}  — (optional) listing price
 *   mrp           {number}  — (optional) original MRP
 *   grade         {string}  — (optional) condition grade (A–D)
 *   gradeLabel    {string}  — (optional) human-readable grade label
 *   onReset       {fn}      — called when user clicks "Try Another Photo"
 *   onDownload    {fn}      — called when user clicks "Download"
 *   onClose       {fn}      — called when user closes the card
 * ============================================================ */
/* ── Icons ── */
const CloseIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M18 6L6 18M6 6l12 12"
}));
const DownloadIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
}));
const SparkIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 20 20",
  fill: "currentColor"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
}));
const PersonIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 20 20",
  fill: "currentColor"
}, p), /*#__PURE__*/React.createElement("circle", {
  cx: "10",
  cy: "3.5",
  r: "3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 9.5A5 5 0 0 1 15 9.5V14H13L12.5 18H7.5L7 14H5V9.5z",
  opacity: ".8"
}));
const BeforeAfterIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4"
}), /*#__PURE__*/React.createElement("path", {
  d: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"
}), /*#__PURE__*/React.createElement("line", {
  x1: "12",
  y1: "4",
  x2: "12",
  y2: "20",
  strokeDasharray: "3 2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 12l-2-2 2-2M16 12l2-2-2-2"
}));
const inr = n => `₹${Number(n).toLocaleString("en-IN")}`;
const GRADE_PILL = {
  A: "bg-green-400/15 text-green-300 border-green-400/25",
  B: "bg-[#febd69]/15 text-[#febd69] border-[#febd69]/25",
  C: "bg-orange-400/15 text-orange-300 border-orange-400/25",
  D: "bg-red-400/15 text-red-300 border-red-400/25"
};
const TryOnResultCard = ({
  resultImage,
  personPreview,
  garmentImage,
  garmentTitle,
  price,
  mrp,
  grade,
  gradeLabel,
  onReset,
  onDownload,
  onClose
}) => {
  const [view, setView] = useState("result"); // "result" | "before" | "split"

  const savePct = mrp && price && mrp > price ? Math.round((1 - price / mrp) * 100) : null;
  const hasBefore = !!personPreview;
  return createPortal(
  /*#__PURE__*/
  /* Backdrop */
  React.createElement("div", {
    className: "fixed inset-0 z-[100] flex items-end justify-center bg-black/65 sm:items-center sm:p-4",
    onClick: e => e.target === e.currentTarget && onClose?.()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex w-full flex-col overflow-hidden bg-white sm:max-w-2xl sm:rounded-2xl sm:shadow-2xl",
    style: {
      maxHeight: "92dvh"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-shrink-0 items-center gap-3 bg-[#232F3E] px-4 py-3",
    style: {
      paddingTop: "max(0.75rem, env(safe-area-inset-top))"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#febd69]"
  }, /*#__PURE__*/React.createElement(PersonIcon, {
    className: "h-4 w-4"
  })), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "text-sm font-bold leading-tight text-white"
  }, "Virtual Try-On", " ", /*#__PURE__*/React.createElement("span", {
    className: "font-normal text-white/40"
  }, "\xB7 Result")), /*#__PURE__*/React.createElement("p", {
    className: "text-[10.5px] text-white/35"
  }, "Powered by Revive AI")), hasBefore && /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 rounded-lg border border-white/10 bg-white/8 p-1"
  }, [{
    id: "result",
    label: "After"
  }, {
    id: "before",
    label: "Before"
  }, {
    id: "split",
    label: "Split"
  }].map(({
    id,
    label
  }) => /*#__PURE__*/React.createElement("button", {
    key: id,
    onClick: () => setView(id),
    className: `rounded-md px-2.5 py-1 text-[11px] font-bold transition-all
                    ${view === id ? "bg-[#febd69] text-[#131921] shadow-sm" : "text-white/50 hover:text-white/80"}`
  }, label))), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    className: "ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
  }, /*#__PURE__*/React.createElement(CloseIcon, {
    className: "h-4 w-4"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-shrink-0 items-center gap-3 border-b border-[#EAEDED] bg-white px-4 py-2.5"
  }, /*#__PURE__*/React.createElement("img", {
    src: garmentImage,
    alt: garmentTitle,
    className: "h-10 w-10 flex-shrink-0 rounded-md border border-[#EAEDED] bg-[#F7F8F8] object-contain p-0.5",
    onError: e => {
      e.target.src = "https://via.placeholder.com/40x40?text=Item";
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "min-w-0 flex-1"
  }, /*#__PURE__*/React.createElement("p", {
    className: "truncate text-[13px] font-bold text-[#0F1111]"
  }, garmentTitle), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mt-0.5"
  }, price != null && /*#__PURE__*/React.createElement("span", {
    className: "text-xs font-bold text-[#0F1111]"
  }, inr(price)), savePct && /*#__PURE__*/React.createElement("span", {
    className: "text-[10.5px] text-[#CC0C39] font-semibold"
  }, savePct, "% off"), grade && /*#__PURE__*/React.createElement("span", {
    className: `hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${GRADE_PILL[grade] || GRADE_PILL.B}`
  }, gradeLabel || `Grade ${grade}`))), /*#__PURE__*/React.createElement("span", {
    className: "flex flex-shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-extrabold text-green-700"
  }, /*#__PURE__*/React.createElement(SparkIcon, {
    className: "h-3 w-3 text-[#FF9900]"
  }), "AI Generated")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-hidden bg-[#F7F8F8]"
  }, view === "split" && hasBefore ?
  /*#__PURE__*/
  /* Split view: before | after side by side */
  React.createElement("div", {
    className: "flex h-full"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 flex-col overflow-hidden border-r border-[#EAEDED]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0 bg-[#1F2A38] px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/50"
  }, "Before"), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 items-center justify-center bg-[#F0F2F2] overflow-hidden"
  }, /*#__PURE__*/React.createElement("img", {
    src: personPreview,
    alt: "Before",
    className: "h-full w-full object-contain",
    style: {
      maxHeight: "52vh"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/70 backdrop-blur-sm"
  }, "Your photo"))), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 flex-col overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0 px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-[#131921]",
    style: {
      background: "linear-gradient(135deg, #ffd99e, #febd69)"
    }
  }, "After \xB7 AI Try-On"), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 items-center justify-center bg-[#F0F2F2] overflow-hidden"
  }, /*#__PURE__*/React.createElement("img", {
    src: resultImage,
    alt: "AI Try-On Result",
    className: "h-full w-full object-contain",
    style: {
      maxHeight: "52vh"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute bottom-2 right-2 rounded px-2 py-0.5 text-[9px] font-bold text-[#131921] shadow-sm",
    style: {
      background: "linear-gradient(135deg, #ffd99e, #febd69)"
    }
  }, "AI Try-On")))) : view === "before" && hasBefore ?
  /*#__PURE__*/
  /* Before view */
  React.createElement("div", {
    className: "flex h-full flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0 bg-[#1F2A38] px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/50"
  }, "Before \u2014 Your photo"), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 items-center justify-center overflow-hidden"
  }, /*#__PURE__*/React.createElement("img", {
    src: personPreview,
    alt: "Your photo",
    className: "h-full w-full object-contain",
    style: {
      maxHeight: "56vh"
    }
  }))) :
  /*#__PURE__*/
  /* Result view (default) */
  React.createElement("div", {
    className: "flex h-full flex-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-shrink-0 bg-[#232F3E] px-4 py-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-[#febd69]"
  }, "Wearing ", garmentTitle), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-1 items-center justify-center overflow-hidden bg-[#F0F2F2]"
  }, /*#__PURE__*/React.createElement("img", {
    src: resultImage,
    alt: "Virtual Try-On Result",
    className: "h-full w-full object-contain",
    style: {
      maxHeight: "56vh"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "absolute top-3 right-3 rounded px-2.5 py-1 text-[10px] font-bold text-[#131921] shadow",
    style: {
      background: "linear-gradient(135deg, #ffd99e, #febd69)"
    }
  }, "AI Try-On"), hasBefore && /*#__PURE__*/React.createElement("button", {
    onClick: () => setView("split"),
    className: "absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/70"
  }, /*#__PURE__*/React.createElement(BeforeAfterIcon, {
    className: "h-3.5 w-3.5"
  }), "Compare")))), /*#__PURE__*/React.createElement("p", {
    className: "flex-shrink-0 bg-[#F7F8F8] py-1.5 text-center text-[10.5px] text-gray-400"
  }, "AI-generated preview. Actual fit may vary. Results are not stored."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-shrink-0 gap-2 border-t border-[#EAEDED] bg-white px-3 py-3 sm:px-5 sm:py-4",
    style: {
      paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onDownload,
    className: "flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#D5D9D9] py-2.5 text-sm font-bold text-[#007185] transition-colors hover:border-[#007185] hover:bg-[#F7F8F8]"
  }, /*#__PURE__*/React.createElement(DownloadIcon, {
    className: "h-4 w-4"
  }), "Download"), /*#__PURE__*/React.createElement("button", {
    onClick: onReset,
    className: "flex flex-1 items-center justify-center rounded-lg border border-[#e07000] py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99]",
    style: {
      background: "linear-gradient(180deg, #ffac31, #FF9900)"
    }
  }, "Try Another Photo")))), document.body);
};
Object.assign(__ds_scope, { TryOnResultCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "frontend/src/components/stitch/TryOnResultCard.jsx", error: String((e && e.message) || e) }); }

// revive/app.jsx
try { (() => {
/* ============ Router ============ */
function parseHash() {
  let h = window.location.hash || "#/";
  if (!h.startsWith("#/")) h = "#/";
  const [path, qs] = h.slice(1).split("?");
  const query = {};
  if (qs) qs.split("&").forEach(kv => {
    const [k, v] = kv.split("=");
    query[k] = decodeURIComponent(v || "");
  });
  const seg = path.split("/").filter(Boolean); // [] for "/"
  return {
    path,
    seg,
    query,
    full: h.split("?")[0]
  };
}
function App() {
  const [r, setR] = useState(parseHash());
  useEffect(() => {
    const on = () => {
      setR(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  let screen;
  const head = r.seg[0];
  if (head === "product") screen = /*#__PURE__*/React.createElement(ProductPage, {
    id: r.seg[1]
  });else if (head === "orders") screen = /*#__PURE__*/React.createElement(OrdersPage, null);else if (head === "grading") screen = /*#__PURE__*/React.createElement(GradingPage, null);else if (head === "sell") screen = /*#__PURE__*/React.createElement(SellPage, null);else if (head === "listings") screen = /*#__PURE__*/React.createElement(ListingsPage, null);else if (head === "cart") screen = /*#__PURE__*/React.createElement(CartPage, null);else screen = /*#__PURE__*/React.createElement(HomePage, {
    query: r.query
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, screen, /*#__PURE__*/React.createElement(Jumper, {
    route: r.full
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/app.jsx", error: String((e && e.message) || e) }); }

// revive/cart.jsx
try { (() => {
/* ============ Cart & Checkout ============ */
function CartPage() {
  const [items, setItems] = useState([{
    id: 3,
    title: "Philips 43-inch 4K UHD Smart TV",
    grade: "B",
    price: 19999,
    mrp: 34990,
    qty: 1,
    ph: "Smart TV",
    tint: "tint-b"
  }]);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [placed, setPlaced] = useState(false);
  const removeItem = id => setItems(prev => prev.filter(i => i.id !== id));
  const updateQty = (id, qty) => setItems(prev => prev.map(i => i.id === id ? {
    ...i,
    qty
  } : i));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalCredits = items.length * 15;
  if (placed) {
    return /*#__PURE__*/React.createElement("div", {
      className: "app"
    }, /*#__PURE__*/React.createElement(Header, {
      cartCount: 0
    }), /*#__PURE__*/React.createElement("main", {
      className: "wrap-md page-pad"
    }, /*#__PURE__*/React.createElement("div", {
      className: "order-placed-screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-icon"
    }, /*#__PURE__*/React.createElement(I.check, {
      style: {
        width: 32,
        height: 32,
        color: '#fff'
      }
    })), /*#__PURE__*/React.createElement("h2", null, "Order placed successfully!"), /*#__PURE__*/React.createElement("p", {
      className: "muted",
      style: {
        fontSize: 15,
        maxWidth: 400,
        textAlign: 'center',
        lineHeight: 1.6
      }
    }, "Your item will be delivered tomorrow. Keep this order for ", /*#__PURE__*/React.createElement("b", {
      style: {
        color: 'var(--green)'
      }
    }, "+", totalCredits, " Green Credits"), " to vest in 7 days."), /*#__PURE__*/React.createElement("div", {
      className: "op-actions"
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn btn-amber btn-sq",
      onClick: () => {
        window.location.hash = '#/orders';
      }
    }, "View Orders"), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-ghost btn-sq",
      onClick: () => {
        window.location.hash = '#/';
      }
    }, "Continue Shopping")))));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, {
    cartCount: items.length
  }), /*#__PURE__*/React.createElement("main", {
    className: "wrap-md page-pad"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "page-h1"
  }, "Checkout"), /*#__PURE__*/React.createElement("div", {
    className: "cart-layout"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "cart-section-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cart-section-head"
  }, "Cart (", items.length, " ", items.length === 1 ? 'item' : 'items', ")"), items.map(item => {
    const cfg = HC_CFG[item.grade] || HC_CFG.B;
    const save = item.mrp ? Math.round((1 - item.price / item.mrp) * 100) : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "cart-item",
      key: item.id
    }, !tipDismissed && /*#__PURE__*/React.createElement("div", {
      className: "cart-ai-tip"
    }, /*#__PURE__*/React.createElement(I.spark, {
      style: {
        width: 13,
        height: 13,
        color: 'var(--gold)',
        flexShrink: 0,
        marginTop: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        fontSize: 12.5,
        lineHeight: 1.55
      }
    }, "Customers with your profile kept ", /*#__PURE__*/React.createElement("b", null, "size 8"), " in this brand \u2014 size 9 was returned 3\xD7 more.\xA0", /*#__PURE__*/React.createElement("span", {
      className: "link",
      style: {
        fontWeight: 700
      }
    }, "AI fit intelligence \xB7 Pillar 4 \u2013 Return Prevention")), /*#__PURE__*/React.createElement("button", {
      style: {
        flexShrink: 0,
        fontSize: 12,
        color: 'var(--link)',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      },
      onClick: () => setTipDismissed(true)
    }, "Dismiss")), /*#__PURE__*/React.createElement("div", {
      className: "cart-item-row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cart-thumb"
    }, /*#__PURE__*/React.createElement(ImgPH, {
      label: item.ph,
      tint: item.tint,
      style: {
        width: '100%',
        height: '100%'
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "cart-item-info"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cart-item-title",
      onClick: () => {
        window.location.hash = `#/product/${item.id}`;
      }
    }, item.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: cfg.accent,
        marginBottom: 5
      }
    }, "Grade ", item.grade), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        margin: '6px 0 3px'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "price",
      style: {
        fontSize: 21,
        fontWeight: 800
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "sym"
    }, "\u20B9"), item.price.toLocaleString('en-IN')), save && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: '#b3261e'
      }
    }, "(", save, "% off)")), item.mrp && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--ink-3)'
      }
    }, "M.R.P.: ", /*#__PURE__*/React.createElement("span", {
      className: "strike"
    }, "\u20B9", item.mrp.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        color: 'var(--green)',
        fontWeight: 600,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement(I.truck, {
      style: {
        width: 13,
        height: 13
      }
    }), "FREE delivery Tomorrow"), /*#__PURE__*/React.createElement("div", {
      className: "cart-item-actions"
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: 13
      }
    }, "Qty:"), /*#__PURE__*/React.createElement("select", {
      className: "qty-select",
      value: item.qty,
      onChange: e => updateQty(item.id, parseInt(e.target.value))
    }, [1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("option", {
      key: n,
      value: n
    }, n))), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--line)',
        fontSize: 16
      }
    }, "|"), /*#__PURE__*/React.createElement("button", {
      className: "cart-action-btn",
      onClick: () => removeItem(item.id)
    }, "Remove"), /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--line)',
        fontSize: 16
      }
    }, "|"), /*#__PURE__*/React.createElement("button", {
      className: "cart-action-btn",
      onClick: () => {
        window.location.hash = `#/product/${item.id}`;
      }
    }, "View Item")))));
  }), items.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '48px 24px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(I.cart, {
    style: {
      width: 48,
      height: 48,
      color: 'var(--line)',
      marginBottom: 12
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 17
    }
  }, "Your cart is empty"), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 13.5,
      marginTop: 6
    }
  }, "Browse pre-loved items on Revive"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-sq",
    style: {
      marginTop: 18
    },
    onClick: () => {
      window.location.hash = '#/';
    }
  }, "Continue Shopping")), items.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderTop: '1px solid var(--line-soft)',
      textAlign: 'right',
      fontSize: 15
    }
  }, "Subtotal (", items.length, " ", items.length === 1 ? 'item' : 'items', "):\xA0", /*#__PURE__*/React.createElement("b", {
    style: {
      fontSize: 19
    }
  }, "\u20B9", subtotal.toLocaleString('en-IN'))))), /*#__PURE__*/React.createElement("div", {
    className: "cart-sidebar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cart-card",
    style: {
      textAlign: 'center',
      padding: '13px 16px'
    }
  }, !signedIn ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "link",
    style: {
      fontWeight: 700,
      fontSize: 14
    },
    onClick: () => setSignedIn(true)
  }, "Sign in"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14
    }
  }, " to use Green Credits")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(I.leafLine, {
    style: {
      width: 15,
      height: 15,
      color: 'var(--green)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'var(--green-ink)',
      fontWeight: 700
    }
  }, "Green Credits active"))), items.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "cart-card",
    style: {
      background: 'var(--green-bg)',
      border: '1px solid var(--green-line)',
      padding: '12px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(I.leaf, {
    style: {
      width: 15,
      height: 15,
      color: 'var(--green)',
      flexShrink: 0,
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.6,
      color: 'var(--ink)'
    }
  }, "Keep this order \u2192 ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--green)'
    }
  }, "+", totalCredits, " Green Credits"), " vest when your 7-day return window closes."))), /*#__PURE__*/React.createElement("div", {
    className: "cart-card"
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      margin: '0 0 16px',
      letterSpacing: '-.3px'
    }
  }, "Order Summary"), /*#__PURE__*/React.createElement("div", {
    className: "os-row"
  }, /*#__PURE__*/React.createElement("span", null, "Subtotal (", items.length, " ", items.length === 1 ? 'item' : 'items', ")"), /*#__PURE__*/React.createElement("span", null, "\u20B9", subtotal.toLocaleString('en-IN'))), /*#__PURE__*/React.createElement("div", {
    className: "os-row"
  }, /*#__PURE__*/React.createElement("span", null, "Delivery"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green)',
      fontWeight: 700
    }
  }, "FREE")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--line)',
      margin: '12px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 17,
      fontWeight: 800
    }
  }, /*#__PURE__*/React.createElement("span", null, "Order Total"), /*#__PURE__*/React.createElement("span", null, "\u20B9", subtotal.toLocaleString('en-IN', {
    minimumFractionDigits: 2
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-block btn-sq",
    style: {
      fontSize: 16,
      padding: '13px 0',
      marginTop: 16,
      fontWeight: 800
    },
    onClick: () => setPlaced(true),
    disabled: items.length === 0
  }, "Place Order"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 10,
      fontSize: 12,
      color: 'var(--ink-3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement(I.lock, {
    style: {
      width: 12,
      height: 12
    }
  }), "Secure checkout \xB7 Amazon Pay")), /*#__PURE__*/React.createElement("div", {
    className: "cart-card",
    style: {
      padding: '13px 15px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '.8px',
      textTransform: 'uppercase',
      color: 'var(--ink-3)',
      marginBottom: 10
    }
  }, "Why Revive?"), [{
    ico: 'badge',
    t: 'AI-verified condition',
    s: 'Every item graded A–D by Amazon AI'
  }, {
    ico: 'lock',
    t: '7-day buyer protection',
    s: 'Instant Amazon Pay refund'
  }, {
    ico: 'leafLine',
    t: 'Earn Green Credits',
    s: 'Keep & earn · skip the return'
  }].map(({
    ico,
    t,
    s
  }) => {
    const Ico = I[ico];
    return /*#__PURE__*/React.createElement("div", {
      key: t,
      style: {
        display: 'flex',
        gap: 9,
        marginBottom: 10,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement(Ico, {
      style: {
        width: 15,
        height: 15,
        color: 'var(--green)',
        flexShrink: 0,
        marginTop: 1
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 700
      }
    }, t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11.5,
        color: 'var(--ink-3)',
        marginTop: 1
      }
    }, s)));
  }))))));
}
Object.assign(window, {
  CartPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/cart.jsx", error: String((e && e.message) || e) }); }

// revive/components.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ============ Shared chrome + primitives ============ */
const {
  useState,
  useEffect,
  useRef
} = React;

/* ---- icons ---- */
const I = {
  leaf: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M20 4s-9-1-14 4c-3.2 3.2-3 8-1.5 10.5C7 15 11 11 16 9c-4 3-7 6-9.2 10.3C10 21 16 21 19 16c2.5-4.2 1-12 1-12z"
  })),
  search: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  })),
  caret: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M7 10l5 5 5-5z"
  })),
  pin: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
  })),
  cart: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "20",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "20",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2.5 3.5h2.2l2 12.2a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.3l1.4-7.7H6"
  })),
  menu: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M4 12h16M4 17h16"
  })),
  star: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 2l2.95 6.3 6.55.9-4.8 4.55 1.2 6.75L12 17.9 5.9 20.5l1.2-6.75-4.8-4.55 6.55-.9z"
  })),
  spark: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.3a1 1 0 0 0 .95.68h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 0 0-.37 1.12l1.07 3.3c.3.92-.75 1.68-1.54 1.11l-2.8-2.03a1 1 0 0 0-1.17 0l-2.8 2.03c-.78.57-1.84-.19-1.54-1.11l1.07-3.3a1 1 0 0 0-.36-1.12L2.98 8.72c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 0 0 .95-.68z"
  })),
  shield: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M10 1.94A11.95 11.95 0 0 1 2.17 5C2.06 5.65 2 6.32 2 7c0 5.22 3.34 9.67 8 11.32C14.66 16.67 18 12.22 18 7c0-.68-.06-1.35-.17-2A11.95 11.95 0 0 1 10 1.94zM11 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0-7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7z",
    clipRule: "evenodd"
  })),
  badge: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M6.27 3.46a3.07 3.07 0 0 0 1.74-.72 3.07 3.07 0 0 1 3.98 0c.49.42 1.1.67 1.74.72a3.07 3.07 0 0 1 2.81 2.81c.05.64.3 1.25.72 1.74a3.07 3.07 0 0 1 0 3.98c-.42.49-.67 1.1-.72 1.74a3.07 3.07 0 0 1-2.81 2.81 3.07 3.07 0 0 0-1.74.72 3.07 3.07 0 0 1-3.98 0 3.07 3.07 0 0 0-1.74-.72 3.07 3.07 0 0 1-2.81-2.81 3.07 3.07 0 0 0-.72-1.74 3.07 3.07 0 0 1 0-3.98c.42-.49.67-1.1.72-1.74a3.07 3.07 0 0 1 2.81-2.81zm7.44 5.25a1 1 0 0 0-1.42-1.42L9 10.59 7.71 9.3a1 1 0 0 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l4-4z",
    clipRule: "evenodd"
  })),
  check: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 20 20",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z",
    clipRule: "evenodd"
  })),
  lock: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M12 2a8 8 0 0 0-8 8c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12a8 8 0 0 0-8-8zm-1 8.5V8a1 1 0 1 1 2 0v2.5h2l-3 4-3-4z"
  })),
  truck: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 6h11v9H3zM14 9h4l3 3v3h-7"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "7",
    cy: "18",
    r: "1.6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "17.5",
    cy: "18",
    r: "1.6"
  })),
  refresh: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.9",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"
  })),
  arrowL: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M15 6l-6 6 6 6"
  })),
  arrowR: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M9 6l6 6-6 6"
  })),
  cam: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 8h3l1.5-2h9L18 8h3v11H3z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "3.4"
  })),
  box: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10"
  })),
  spinner: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, p), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9",
    strokeOpacity: "0.22"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3a9 9 0 0 1 9 9"
  })),
  grid: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
  })),
  leafLine: p => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, p), /*#__PURE__*/React.createElement("path", {
    d: "M11 20A7 7 0 0 1 4 13C4 8 9 4 20 4c0 11-4 16-9 16zM4 20c4-7 9-10 14-11"
  }))
};

/* ---- product image placeholder (striped, with caption) ---- */
function ImgPH({
  label,
  tint,
  ico = "box",
  style,
  className = ""
}) {
  const Ico = I[ico] || I.box;
  return /*#__PURE__*/React.createElement("div", {
    className: `imgph ${tint || ""} ${className}`,
    style: style
  }, /*#__PURE__*/React.createElement("div", {
    className: "imgph-label",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement(Ico, {
    className: "imgph-ico"
  }), label));
}

/* ---- star rating ---- */
function Stars({
  n = 5,
  size
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "stars"
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement(I.star, {
    key: i,
    className: i <= n ? "star-on" : "star-off",
    style: size ? {
      width: size,
      height: size
    } : null
  })));
}

/* ---- QR (decorative) ---- */
const QR_RECTS = [[2, 2, 15, 15, 1.5], [4, 4, 11, 11, .5], [6, 6, 7, 7, 0], [35, 2, 15, 15, 1.5], [37, 4, 11, 11, .5], [39, 6, 7, 7, 0], [2, 35, 15, 15, 1.5], [4, 37, 11, 11, .5], [6, 39, 7, 7, 0], [20, 2, 4, 4, 0], [26, 2, 4, 4, 0], [20, 8, 4, 4, 0], [26, 14, 4, 4, 0], [32, 20, 4, 4, 0], [38, 20, 4, 4, 0], [44, 26, 4, 4, 0], [2, 20, 4, 4, 0], [8, 20, 4, 4, 0], [20, 26, 4, 4, 0], [26, 32, 4, 4, 0], [32, 38, 4, 4, 0], [44, 38, 4, 4, 0], [20, 38, 4, 4, 0], [26, 44, 4, 4, 0], [32, 26, 4, 4, 0], [44, 14, 4, 4, 0], [8, 26, 4, 4, 0], [14, 32, 4, 4, 0]];
function QR({
  size
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: "0 0 52 52"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "52",
    height: "52",
    fill: "white"
  }), QR_RECTS.map(([x, y, w, h, rx], i) => /*#__PURE__*/React.createElement("rect", {
    key: i,
    x: x,
    y: y,
    width: w,
    height: h,
    rx: rx,
    fill: "#131a22"
  })));
}

/* ---- Amazon logo SVG ---- */
function AmazonLogo({
  height = 28
}) {
  const w = Math.round(height * 3.35);
  return /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: height,
    viewBox: "0 0 116 40",
    fill: "none"
  }, /*#__PURE__*/React.createElement("text", {
    x: "2",
    y: "27",
    fontFamily: "\"Amazon Ember\",\"Helvetica Neue\",Arial,sans-serif",
    fontWeight: "700",
    fontSize: "28",
    fill: "white"
  }, "amazon"), /*#__PURE__*/React.createElement("path", {
    d: "M8 34 C 32 44, 80 44, 108 34",
    fill: "none",
    stroke: "#FF9900",
    strokeWidth: "2.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M105 31 L110 34.5 L105.5 38",
    fill: "none",
    stroke: "#FF9900",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

/* ---- Header ---- */
const NAV = [{
  label: "All",
  to: "#/"
}, {
  label: "Shop Revive",
  to: "#/?src=p2p",
  hl: true
}, {
  label: "Renewed",
  to: "#/?src=renewed"
}, {
  label: "Warehouse",
  to: "#/?src=warehouse"
}, {
  label: "List an Item",
  to: "#/sell"
}, {
  label: "My Listings",
  to: "#/listings"
}, {
  label: "Orders",
  to: "#/orders"
}];
function Header({
  cartCount = 2
}) {
  const [menu, setMenu] = useState(false);
  const go = to => {
    window.location.hash = to;
    setMenu(false);
  };
  return /*#__PURE__*/React.createElement("header", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr-top"
  }, /*#__PURE__*/React.createElement("button", {
    className: "hdr-burger",
    onClick: () => setMenu(true),
    "aria-label": "Menu"
  }, /*#__PURE__*/React.createElement(I.menu, null)), /*#__PURE__*/React.createElement("div", {
    className: "hdr-logo",
    onClick: () => go("#/")
  }, /*#__PURE__*/React.createElement(AmazonLogo, {
    height: 27
  })), /*#__PURE__*/React.createElement("div", {
    className: "hdr-deliver"
  }, /*#__PURE__*/React.createElement(I.pin, null), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "d-top"
  }, "Deliver to user01"), /*#__PURE__*/React.createElement("span", {
    className: "d-bot"
  }, "Bengaluru 560001"))), /*#__PURE__*/React.createElement("form", {
    className: "hdr-search",
    onSubmit: e => {
      e.preventDefault();
      go("#/");
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "search-cat"
  }, "All ", /*#__PURE__*/React.createElement(I.caret, null)), /*#__PURE__*/React.createElement("input", {
    placeholder: "Search Revive listings\u2026"
  }), /*#__PURE__*/React.createElement("button", {
    className: "search-btn",
    type: "submit",
    "aria-label": "Search"
  }, /*#__PURE__*/React.createElement(I.search, null))), /*#__PURE__*/React.createElement("div", {
    className: "hdr-actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hdr-act",
    onClick: () => go("#/orders")
  }, /*#__PURE__*/React.createElement("span", {
    className: "a-top"
  }, "Hello, user01"), /*#__PURE__*/React.createElement("span", {
    className: "a-bot"
  }, "Account & Lists")), /*#__PURE__*/React.createElement("div", {
    className: "hdr-act",
    onClick: () => go("#/orders")
  }, /*#__PURE__*/React.createElement("span", {
    className: "a-top"
  }, "Returns"), /*#__PURE__*/React.createElement("span", {
    className: "a-bot"
  }, "& Orders")), /*#__PURE__*/React.createElement("div", {
    className: "hdr-cart",
    onClick: () => go("#/cart")
  }, /*#__PURE__*/React.createElement("span", {
    className: "cart-ico"
  }, /*#__PURE__*/React.createElement(I.cart, null), cartCount > 0 && /*#__PURE__*/React.createElement("span", {
    className: "cart-count"
  }, cartCount)), /*#__PURE__*/React.createElement("b", null, "Cart")))), /*#__PURE__*/React.createElement("nav", {
    className: "hdr-sub"
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.label,
    className: `subnav-btn ${n.hl ? "hl" : ""}`,
    onClick: () => go(n.to)
  }, n.label)), /*#__PURE__*/React.createElement("span", {
    className: "subnav-sep"
  }, "|"), /*#__PURE__*/React.createElement("button", {
    className: "subnav-btn",
    onClick: () => go("#/")
  }, "Electronics"), /*#__PURE__*/React.createElement("button", {
    className: "subnav-btn",
    onClick: () => go("#/")
  }, "Fashion"), /*#__PURE__*/React.createElement("button", {
    className: "subnav-btn",
    onClick: () => go("#/")
  }, "Home & Garden")), menu && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "drawer-back",
    onClick: () => setMenu(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "drawer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "drawer-head"
  }, /*#__PURE__*/React.createElement(AmazonLogo, {
    height: 22
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#c9cfd4"
    }
  }, "Hello,"), /*#__PURE__*/React.createElement("b", {
    style: {
      color: '#fff'
    }
  }, "user01"))), /*#__PURE__*/React.createElement("div", {
    className: "drawer-sec"
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.label,
    className: `drawer-item ${n.hl ? "hl" : ""}`,
    onClick: () => go(n.to)
  }, n.label))), /*#__PURE__*/React.createElement("div", {
    className: "drawer-sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Shop by Category"), ["Electronics", "Fashion", "Home & Garden"].map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: "drawer-item",
    onClick: () => go("#/")
  }, c))))));
}

/* ---- floating screen jumper (prototype nav helper) ---- */
function Jumper({
  route
}) {
  const [open, setOpen] = useState(false);
  const items = [{
    to: "#/",
    label: "Marketplace",
    ico: "grid"
  }, {
    to: "#/product/2",
    label: "Product detail",
    ico: "box"
  }, {
    to: "#/cart",
    label: "Cart / Checkout",
    ico: "cart"
  }, {
    to: "#/orders",
    label: "Your Orders",
    ico: "truck"
  }, {
    to: "#/grading",
    label: "AI Grading Result",
    ico: "spark"
  }, {
    to: "#/sell",
    label: "List an Item",
    ico: "cam"
  }, {
    to: "#/listings",
    label: "My Listings",
    ico: "leafLine"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "jumper"
  }, /*#__PURE__*/React.createElement("div", {
    className: `jumper-menu ${open ? "open" : ""}`
  }, items.map(it => {
    const Ico = I[it.ico];
    const on = route === it.to || it.to === "#/product/2" && route.startsWith("#/product") || it.to === "#/cart" && route === "#/cart";
    return /*#__PURE__*/React.createElement("a", {
      key: it.to,
      className: on ? "on" : "",
      href: it.to,
      onClick: () => setOpen(false)
    }, /*#__PURE__*/React.createElement(Ico, null), it.label);
  })), open && /*#__PURE__*/React.createElement("span", {
    className: "jumper-label"
  }, "Jump to screen"), /*#__PURE__*/React.createElement("button", {
    className: "jumper-fab",
    onClick: () => setOpen(o => !o),
    "aria-label": "Jump to screen"
  }, open ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, "\u2715") : /*#__PURE__*/React.createElement(I.grid, null)));
}
Object.assign(window, {
  I,
  ImgPH,
  Stars,
  QR,
  AmazonLogo,
  Header,
  Jumper,
  useState,
  useEffect,
  useRef
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/components.jsx", error: String((e && e.message) || e) }); }

// revive/data.js
try { (() => {
/* Revive demo catalog + orders — content mirrors the existing app */
window.REVIVE = function () {
  const PRODUCTS = [{
    id: 1,
    title: "Sony Alpha A7 III Mirrorless Camera Body",
    price: 89990,
    mrp: 134990,
    grade: "A",
    source: "p2p",
    category: "Electronics",
    rating: 4,
    ratings: 142,
    cond: "Like new — under 4k shutter count, original box and strap included.",
    desc: "Full-frame 24.2MP mirrorless camera body with 5-axis stabilisation, 4K HDR video and 693-point hybrid AF. Includes battery, charger and original packaging.",
    seller: "Aperture Collective",
    completeness: 1.0,
    ph: "Camera body",
    tint: "tint-a"
  }, {
    id: 2,
    title: "boAt Rockerz 450 Bluetooth Headphones",
    price: 1799,
    mrp: 2990,
    grade: "A",
    source: "warehouse",
    category: "Electronics",
    rating: 4,
    ratings: 142,
    cond: "Like new, original box included, no visible scratches.",
    desc: "Wireless Bluetooth headphones with 15 hours playback, 40mm dynamic drivers and dual-mode connectivity. Lightweight on-ear design with soft cushioned earcups.",
    seller: "Amazon Warehouse",
    completeness: 1.0,
    ph: "Headphones",
    tint: "tint-b"
  }, {
    id: 3,
    title: "Samsung 43\" Crystal 4K UHD Smart TV",
    price: 26499,
    mrp: 41900,
    grade: "B",
    source: "warehouse",
    category: "Electronics",
    rating: 4,
    ratings: 318,
    cond: "Light cosmetic wear on stand — panel flawless, fully functional.",
    desc: "43-inch Crystal 4K UHD smart TV with HDR, built-in voice assistants and Tizen OS. Minor scuff on the rear stand; screen and ports tested perfect.",
    seller: "Amazon Warehouse",
    completeness: 0.95,
    ph: "Smart TV",
    tint: "tint-b"
  }, {
    id: 4,
    title: "Sony WH-1000XM4 Wireless Headphones",
    price: 17990,
    mrp: 29990,
    grade: "A",
    source: "renewed",
    category: "Electronics",
    rating: 5,
    ratings: 2104,
    cond: "Renewed to like-new — fresh earpads, 90-day warranty.",
    desc: "Industry-leading noise-cancelling over-ear headphones with 30-hour battery, multipoint pairing and adaptive sound control. Amazon Renewed certified.",
    seller: "Amazon Renewed",
    completeness: 1.0,
    ph: "Headphones",
    tint: "tint-a"
  }, {
    id: 5,
    title: "Logitech MX Master 3 Wireless Mouse",
    price: 5999,
    mrp: 8995,
    grade: "B",
    source: "p2p",
    category: "Electronics",
    rating: 4,
    ratings: 86,
    cond: "Good — light shine on scroll wheel, tracks perfectly.",
    desc: "Advanced ergonomic wireless mouse with MagSpeed electromagnetic scrolling, 4000 DPI Darkfield tracking and USB-C quick charge. Pairs with up to 3 devices.",
    seller: "TechResale Mumbai",
    completeness: 0.9,
    ph: "Wireless mouse",
    tint: "tint-b"
  }, {
    id: 6,
    title: "Instant Pot Duo 6L Multi-Cooker",
    price: 5490,
    mrp: 9999,
    grade: "A",
    source: "return",
    category: "Home & Kitchen",
    rating: 4,
    ratings: 540,
    cond: "Open-box return — used once, sealed inner pot and accessories.",
    desc: "7-in-1 electric pressure cooker: pressure cook, slow cook, rice, steam, sauté, yogurt and warm. Stainless steel inner pot with all accessories included.",
    seller: "Amazon Returns",
    completeness: 1.0,
    ph: "Multi-cooker",
    tint: "tint-a"
  }, {
    id: 7,
    title: "Apple iPad Air (5th Gen) 64GB Wi-Fi",
    price: 41900,
    mrp: 59900,
    grade: "B",
    source: "renewed",
    category: "Electronics",
    rating: 5,
    ratings: 712,
    cond: "Very good — faint micro-scratches on back, screen pristine.",
    desc: "10.9-inch Liquid Retina display, M1 chip, 64GB storage. Battery health above 90%. Renewed and certified with charger and cable.",
    seller: "Amazon Renewed",
    completeness: 1.0,
    ph: "Tablet",
    tint: "tint-b"
  }, {
    id: 8,
    title: "Nike Air Zoom Pegasus 39 Running Shoes",
    price: 4299,
    mrp: 9295,
    grade: "C",
    source: "p2p",
    category: "Footwear",
    rating: 3,
    ratings: 54,
    cond: "Good — visible sole wear, plenty of life left, cleaned.",
    desc: "Responsive road running shoes with Zoom Air units, breathable mesh upper and a wide forefoot. UK 9. Honestly graded with visible outsole wear.",
    seller: "RunnersResale",
    completeness: 0.85,
    ph: "Running shoes",
    tint: "tint-b"
  }, {
    id: 9,
    title: "Kindle Paperwhite 11th Gen 8GB",
    price: 7990,
    mrp: 13999,
    grade: "A",
    source: "warehouse",
    category: "Electronics",
    rating: 5,
    ratings: 980,
    cond: "Like new — no marks, warm-light display tested.",
    desc: "6.8-inch glare-free display, adjustable warm light, weeks of battery and IPX8 waterproofing. Warehouse open-box with USB-C cable.",
    seller: "Amazon Warehouse",
    completeness: 1.0,
    ph: "E-reader",
    tint: "tint-a"
  }, {
    id: 10,
    title: "Dyson V8 Cordless Vacuum Cleaner",
    price: 19900,
    mrp: 34900,
    grade: "B",
    source: "return",
    category: "Home & Kitchen",
    rating: 4,
    ratings: 405,
    cond: "Very good — minor scuffs, filter washed, strong suction.",
    desc: "Cordless stick vacuum with up to 40 minutes run time, HEPA filtration and click-in battery. Includes wall dock and two cleaner heads.",
    seller: "Amazon Returns",
    completeness: 0.95,
    ph: "Cordless vacuum",
    tint: "tint-b"
  }];
  const SOURCE_LABEL = {
    p2p: "REVIVE \u2013 P2P",
    renewed: "Amazon Renewed",
    warehouse: "Warehouse Deal",
    return: "Amazon Return"
  };
  const SOURCE_CHIP = {
    p2p: {
      text: "REVIVE",
      cls: "chip-revive"
    },
    renewed: {
      text: "Renewed",
      cls: "chip-renewed"
    },
    warehouse: {
      text: "Warehouse",
      cls: "chip-warehouse"
    },
    return: {
      text: "Returned",
      cls: "chip-return"
    }
  };
  const GRADE_DISPLAY = {
    A: "Grade A \u2013 Excellent",
    B: "Grade B \u2013 Very Good",
    C: "Grade C \u2013 Good",
    D: "Grade D \u2013 Acceptable"
  };
  const ORDERS = [{
    id: 1,
    productId: 4,
    title: "Sony WH-1000XM4 Wireless Headphones",
    total: 17990,
    source: "Amazon Renewed",
    status: "confirmed",
    grade: "A",
    placed: "13 Jun 2026",
    returnCloses: "20/6/2026",
    isP2P: false,
    ph: "Headphones",
    tint: "tint-a"
  }, {
    id: 2,
    productId: 5,
    title: "Logitech MX Master 3 Mouse",
    total: 5999,
    source: "P2P (Individual)",
    status: "confirmed",
    grade: "B",
    placed: "13 Jun 2026",
    returnCloses: "20/6/2026",
    isP2P: true,
    escrow: true,
    ph: "Wireless mouse",
    tint: "tint-b"
  }];
  const LISTINGS = [{
    id: 11,
    title: "OnePlus Bullets Wireless Z2 Earphones",
    price: 1499,
    grade: "A",
    status: "listed",
    category: "Electronics",
    when: "2h ago",
    ph: "Earphones",
    tint: "tint-a"
  }, {
    id: 12,
    title: "JBL Flip 5 Portable Speaker",
    price: 6490,
    grade: "B",
    status: "listed",
    category: "Electronics",
    when: "1d ago",
    ph: "Speaker",
    tint: "tint-b"
  }, {
    id: 13,
    title: "Levi's 511 Slim Jeans (32W)",
    price: 1290,
    grade: "B",
    status: "sold",
    category: "Clothing",
    when: "5d ago",
    ph: "Denim jeans",
    tint: "tint-b"
  }, {
    id: 14,
    title: "Canon EF 50mm f/1.8 STM Lens",
    price: 6900,
    grade: "A",
    status: "pending",
    category: "Electronics",
    when: "12m ago",
    ph: "Camera lens",
    tint: "tint-a"
  }];
  return {
    PRODUCTS,
    ORDERS,
    LISTINGS,
    SOURCE_LABEL,
    SOURCE_CHIP,
    GRADE_DISPLAY,
    byId: id => PRODUCTS.find(p => String(p.id) === String(id))
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/data.js", error: String((e && e.message) || e) }); }

// revive/grading.jsx
try { (() => {
/* ============ AI Grading Result ============ */
const TIER = {
  A: {
    label: "Like New",
    desc: "No visible defects — all accessories present.",
    route: "Local Resale (P2P)",
    rc: "#107a45",
    rbg: "#e6f4ea",
    rdesc: "Best EV: sell to a verified buyer near you via Revive.",
    ring: "#16a34a",
    gbg: "#e6f4ea",
    score: 95,
    conf: 96
  },
  B: {
    label: "Very Good",
    desc: "Light cosmetic wear only — fully functional.",
    route: "Local Resale",
    rc: "#107a45",
    rbg: "#e6f4ea",
    rdesc: "Best EV: list on marketplace — strong local demand for this category.",
    ring: "#d97706",
    gbg: "#fbf1d9",
    score: 78,
    conf: 88
  },
  C: {
    label: "Good",
    desc: "Visible defects but fully functional.",
    route: "Refurbish",
    rc: "#1d4ed8",
    rbg: "#e7f0fb",
    rdesc: "EV routing: send to Revive Refurb centre — repair cost < resale uplift.",
    ring: "#ea580c",
    gbg: "#fbe9dd",
    score: 55,
    conf: 82
  },
  D: {
    label: "Acceptable",
    desc: "Heavy wear or significant missing parts.",
    route: "Donate / Recycle",
    rc: "#6b7280",
    rbg: "#f3f4f6",
    rdesc: "EV optimizer: resale value below logistics cost — donate to partner NGO.",
    ring: "#dc2626",
    gbg: "#fbe5e3",
    score: 30,
    conf: 79
  }
};
function ScanPhase({
  progress
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "scanbox"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scan-orbit"
  }, /*#__PURE__*/React.createElement(I.spinner, null)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontWeight: 800,
      fontSize: 18,
      margin: "0 0 4px"
    }
  }, "AI scanning your item\u2026"), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: 13,
      margin: 0
    }
  }, "Grounding DINO + CLIP + Vision LLM \xB7 usually under 2 seconds"), /*#__PURE__*/React.createElement("div", {
    className: "scan-prog"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${progress}%`
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "faint",
    style: {
      fontSize: 12
    }
  }, progress, "% \u2014 detecting defects, checking completeness"));
}
function GradingPage() {
  const grade = "B";
  const t = TIER[grade];
  const refund = 312;
  const [phase, setPhase] = useState("scanning");
  const [prog, setProg] = useState(0);
  const [show, setShow] = useState({
    route: false,
    refund: false,
    impact: false
  });
  const R = 36,
    C = 2 * Math.PI * R;
  useEffect(() => {
    const DUR = 1400,
      start = Date.now();
    const tick = setInterval(() => {
      const el = Date.now() - start;
      const p = Math.min(100, Math.round(el / DUR * 100));
      setProg(p);
      if (el >= DUR) {
        clearInterval(tick);
        setPhase("revealed");
        setTimeout(() => setShow(s => ({
          ...s,
          route: true
        })), 350);
        setTimeout(() => setShow(s => ({
          ...s,
          refund: true
        })), 700);
        setTimeout(() => setShow(s => ({
          ...s,
          impact: true
        })), 1050);
      }
    }, 60);
    return () => clearInterval(tick);
  }, []);
  const evRows = [{
    path: "Local Resale",
    ev: 1840,
    bar: 100,
    on: true
  }, {
    path: "Refurbish",
    ev: 890,
    bar: 48,
    on: false
  }, {
    path: "Donate",
    ev: 0,
    bar: 0,
    on: false
  }, {
    path: "Warehouse Return",
    ev: -40,
    bar: 0,
    on: false
  }];
  const dash = t.score / 100 * C;
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap-sm page-pad"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.hash = "#/orders";
    }
  }, /*#__PURE__*/React.createElement(I.arrowL, {
    style: {
      width: 15,
      height: 15
    }
  }), "Back to Your Orders"), /*#__PURE__*/React.createElement("h1", {
    className: "page-h1",
    style: {
      marginBottom: 4
    }
  }, "AI Grading Result"), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: 13.5,
      marginTop: 0,
      marginBottom: 22
    }
  }, "Doorstep agent scan \xB7 Return reason: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--ink)"
    }
  }, "Better price available elsewhere")), phase === "scanning" && /*#__PURE__*/React.createElement(ScanPhase, {
    progress: prog
  }), phase === "revealed" && /*#__PURE__*/React.createElement("div", {
    className: "stack gap16"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-l"
  }, /*#__PURE__*/React.createElement(I.spark, null), "AI Grade Result"), /*#__PURE__*/React.createElement("span", {
    className: "ph-r"
  }, "1.4s \xB7 Pillar 1")), /*#__PURE__*/React.createElement("div", {
    className: "grade-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grade-ring"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 80 80",
    style: {
      position: "absolute",
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "40",
    cy: "40",
    r: R,
    fill: "none",
    stroke: "#e6e9e9",
    strokeWidth: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "40",
    cy: "40",
    r: R,
    fill: "none",
    stroke: t.ring,
    strokeWidth: "6",
    strokeLinecap: "round",
    strokeDasharray: `${dash} ${C}`,
    transform: "rotate(-90 40 40)",
    style: {
      transition: "stroke-dasharray 1s var(--ease)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "gnum"
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      background: t.gbg,
      color: t.ring
    }
  }, grade))), /*#__PURE__*/React.createElement("div", {
    className: "grade-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gm-tier",
    style: {
      color: t.ring
    }
  }, t.label), /*#__PURE__*/React.createElement("div", {
    className: "gm-desc"
  }, t.desc), /*#__PURE__*/React.createElement("div", {
    className: "gm-conf"
  }, "Confidence: ", /*#__PURE__*/React.createElement("b", null, t.conf, "%"), " \xB7 0 manual review flags"))), /*#__PURE__*/React.createElement("div", {
    className: "grade-scale"
  }, ["A", "B", "C", "D"].map(g => /*#__PURE__*/React.createElement("div", {
    key: g,
    className: `gs-cell ${g === grade ? "" : "dim"}`,
    style: {
      background: TIER[g].gbg,
      color: TIER[g].ring,
      borderColor: g === grade ? TIER[g].ring : "transparent"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "gs-g"
  }, g), /*#__PURE__*/React.createElement("div", {
    className: "gs-l"
  }, TIER[g].label))))), /*#__PURE__*/React.createElement("div", {
    className: `fade ${show.route ? "in" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ph-l"
  }, /*#__PURE__*/React.createElement(I.refresh, {
    style: {
      width: 14,
      height: 14
    }
  }), "AI Routing Decision"), /*#__PURE__*/React.createElement("span", {
    className: "ph-r"
  }, "EV Optimizer \xB7 Pillar 2")), /*#__PURE__*/React.createElement("div", {
    className: "card-pad",
    style: {
      padding: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "route-chosen",
    style: {
      borderColor: t.rc,
      background: t.rbg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "rc-dot",
    style: {
      background: t.rc
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: t.rc
    }
  }, t.route), /*#__PURE__*/React.createElement("p", null, t.rdesc))), /*#__PURE__*/React.createElement("div", {
    className: "section-cap",
    style: {
      marginBottom: 4
    }
  }, "Expected Value (EV) breakdown"), evRows.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.path,
    className: `ev-row ${r.on ? "on" : ""}`
  }, /*#__PURE__*/React.createElement("span", {
    className: "ev-l"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: r.on ? 800 : 600,
      color: r.on ? "var(--ink)" : "var(--ink-2)"
    }
  }, r.path), r.on && /*#__PURE__*/React.createElement("span", {
    className: "tag-chosen"
  }, "CHOSEN")), /*#__PURE__*/React.createElement("span", {
    className: "row gap12"
  }, r.bar > 0 && /*#__PURE__*/React.createElement("span", {
    className: "ev-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${r.bar}%`
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: `ev-val ${r.ev > 0 ? "pos" : r.ev === 0 ? "zero" : "neg"}`
  }, r.ev > 0 ? `₹${r.ev.toLocaleString("en-IN")}` : r.ev === 0 ? "—" : `₹${r.ev}`))))))), /*#__PURE__*/React.createElement("div", {
    className: `fade ${show.refund ? "in" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "refund-banner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-ico"
  }, /*#__PURE__*/React.createElement(I.check, null)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Refund Issued!"), /*#__PURE__*/React.createElement("p", null, "\u20B9", refund, " credited to your Amazon Pay wallet"))), /*#__PURE__*/React.createElement("div", {
    className: "refund-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "Refund amount"), /*#__PURE__*/React.createElement("span", {
    className: "rl-v",
    style: {
      color: "var(--green)"
    }
  }, "\u20B9", refund)), /*#__PURE__*/React.createElement("div", {
    className: "refund-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "Typically credited within"), /*#__PURE__*/React.createElement("span", {
    className: "rl-v"
  }, "Instant \xB7 Amazon Pay")), /*#__PURE__*/React.createElement("div", {
    className: "refund-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "Green Credits earned"), /*#__PURE__*/React.createElement("span", {
    className: "rl-v",
    style: {
      color: "var(--green)"
    }
  }, "+10 Green Credits")))), /*#__PURE__*/React.createElement("div", {
    className: `fade ${show.impact ? "in" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel card-pad",
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "16px 20px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-cap"
  }, "Your Environmental Impact")), /*#__PURE__*/React.createElement("div", {
    className: "impact",
    style: {
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "impact-cell"
  }, /*#__PURE__*/React.createElement("b", null, "590 km"), /*#__PURE__*/React.createElement("span", null, "saved vs. warehouse return")), /*#__PURE__*/React.createElement("div", {
    className: "impact-cell"
  }, /*#__PURE__*/React.createElement("b", null, "4.2 kg"), /*#__PURE__*/React.createElement("span", null, "CO\u2082 avoided"))), /*#__PURE__*/React.createElement("div", {
    className: "map-ph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pin"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mp-t"
  }, "Item matched to a buyer 5 km away"), /*#__PURE__*/React.createElement("span", {
    className: "mp-s"
  }, "EV routing demand map \xB7 coming soon")))), /*#__PURE__*/React.createElement("div", {
    className: `fade ${show.impact ? "in" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "nextstep"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Your item has a second life"), /*#__PURE__*/React.createElement("p", null, "It will be listed on Revive marketplace \u2014 a local buyer is already matched.")), /*#__PURE__*/React.createElement("div", {
    className: "row gap8"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-sm btn-sq",
    onClick: () => {
      window.location.hash = "#/";
    }
  }, "Shop Revive"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sm btn-sq",
    style: {
      background: "transparent",
      border: "1px solid #5a6675",
      color: "#cfd6dc"
    },
    onClick: () => {
      window.location.hash = "#/orders";
    }
  }, "My Orders")))))));
}
Object.assign(window, {
  GradingPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/grading.jsx", error: String((e && e.message) || e) }); }

// revive/healthcard.jsx
try { (() => {
/* ============ Innovative Product Health Passport ============ */
const HC_CFG = {
  A: {
    label: "Excellent",
    sub: "Like new — no visible defects",
    accent: "#107a45",
    ring: "#16a34a",
    score: 95
  },
  B: {
    label: "Very Good",
    sub: "Light cosmetic wear, fully functional",
    accent: "#b06f00",
    ring: "#d97706",
    score: 75
  },
  C: {
    label: "Good",
    sub: "Visible wear, all features work",
    accent: "#bd4a17",
    ring: "#ea580c",
    score: 55
  },
  D: {
    label: "Acceptable",
    sub: "Heavy wear or minor defects present",
    accent: "#b3261e",
    ring: "#dc2626",
    score: 35
  }
};
function HealthCard({
  grade = "B",
  cond,
  completeness = 1.0,
  seller
}) {
  const cfg = HC_CFG[grade] || HC_CFG.B;
  const completePct = Math.round(completeness * 100);
  const [tab, setTab] = useState('overview');
  const [qr, setQr] = useState(false);
  const R = 38,
    C = 2 * Math.PI * R;
  const dash = cfg.score / 100 * C;
  const JOURNEY = [{
    label: 'Purchased New',
    sub: 'Original retail price',
    done: true
  }, {
    label: 'In Use',
    sub: '~1.2 years owned',
    done: true
  }, {
    label: 'Listed on Revive',
    sub: seller ? `By ${seller}` : 'By seller',
    done: true
  }, {
    label: 'AI Graded',
    sub: `Grade ${grade} · ${cfg.score}/100`,
    done: true
  }, {
    label: 'Hub Verified',
    sub: 'Condition matched listing',
    done: true
  }, {
    label: 'Your Cart',
    sub: 'Ready to ship today',
    done: false
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "hc"
  }, /*#__PURE__*/React.createElement("div", {
    className: `hc-top ${grade}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-guilloche"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hc-brand"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "84",
    height: "25",
    viewBox: "0 0 116 40",
    fill: "none"
  }, /*#__PURE__*/React.createElement("text", {
    x: "2",
    y: "27",
    fontFamily: "\"Amazon Ember\",\"Helvetica Neue\",Arial,sans-serif",
    fontWeight: "700",
    fontSize: "28",
    fill: "white"
  }, "amazon"), /*#__PURE__*/React.createElement("path", {
    d: "M8 34 C 32 44, 80 44, 108 34",
    fill: "none",
    stroke: "#FF9900",
    strokeWidth: "2.8",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M105 31 L110 34.5 L105.5 38",
    fill: "none",
    stroke: "#FF9900",
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("button", {
    className: "hc-qr",
    onClick: () => setQr(true),
    title: "Scan to verify"
  }, /*#__PURE__*/React.createElement(QR, {
    size: 34
  }))), /*#__PURE__*/React.createElement("div", {
    className: "hc-passport-badge"
  }, "PRODUCT HEALTH PASSPORT"), /*#__PURE__*/React.createElement("div", {
    className: "hc-seal"
  }, /*#__PURE__*/React.createElement("svg", {
    className: "ring",
    viewBox: "0 0 96 96"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "48",
    cy: "48",
    r: R,
    fill: "#fff",
    stroke: "#e6e9e9",
    strokeWidth: "6"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "48",
    cy: "48",
    r: R,
    fill: "none",
    stroke: cfg.ring,
    strokeWidth: "6",
    strokeLinecap: "round",
    strokeDasharray: `${dash} ${C}`,
    transform: "rotate(-90 48 48)",
    style: {
      transition: "stroke-dasharray 1.1s cubic-bezier(.2,.7,.2,1)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "grade",
    style: {
      color: cfg.accent
    }
  }, grade)), /*#__PURE__*/React.createElement("p", {
    className: "hc-label"
  }, cfg.label), /*#__PURE__*/React.createElement("p", {
    className: "hc-sub"
  }, cfg.sub), /*#__PURE__*/React.createElement("div", {
    className: "hc-pillars"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-pillar"
  }, /*#__PURE__*/React.createElement(I.spark, {
    style: {
      width: 12,
      height: 12
    }
  }), /*#__PURE__*/React.createElement("span", null, "AI Verified")), /*#__PURE__*/React.createElement("div", {
    className: "hc-pillar-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hc-pillar"
  }, /*#__PURE__*/React.createElement(I.badge, {
    style: {
      width: 12,
      height: 12
    }
  }), /*#__PURE__*/React.createElement("span", null, "Hub Checked")), /*#__PURE__*/React.createElement("div", {
    className: "hc-pillar-sep"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hc-pillar"
  }, /*#__PURE__*/React.createElement(I.shield, {
    style: {
      width: 12,
      height: 12
    }
  }), /*#__PURE__*/React.createElement("span", null, "Crypto Signed")))), /*#__PURE__*/React.createElement("div", {
    className: "hc-tabs"
  }, ['overview', 'journey', 'impact'].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: `hc-tab ${tab === t ? 'on' : ''}`,
    onClick: () => setTab(t)
  }, t.charAt(0).toUpperCase() + t.slice(1)))), tab === 'overview' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hc-meters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-meter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, "Condition Score"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, cfg.score, /*#__PURE__*/React.createElement("small", null, " /100")), /*#__PURE__*/React.createElement("div", {
    className: "hc-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${cfg.score}%`,
      background: cfg.ring
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "hc-meter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mk"
  }, "Completeness"), /*#__PURE__*/React.createElement("div", {
    className: "mv"
  }, completePct, /*#__PURE__*/React.createElement("small", null, " %")), /*#__PURE__*/React.createElement("div", {
    className: "hc-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: `${completePct}%`,
      background: "#0284c7"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "hc-sec"
  }, /*#__PURE__*/React.createElement(I.spark, null), /*#__PURE__*/React.createElement("span", null, "AI Assessment")), /*#__PURE__*/React.createElement("div", {
    className: "hc-assess"
  }, cond || /*#__PURE__*/React.createElement("span", {
    className: "faint",
    style: {
      fontStyle: 'italic'
    }
  }, "No AI notes available for this item.")), /*#__PURE__*/React.createElement("div", {
    className: "hc-sec"
  }, /*#__PURE__*/React.createElement(I.badge, null), /*#__PURE__*/React.createElement("span", null, "Verification Details")), /*#__PURE__*/React.createElement("div", {
    className: "hc-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fk"
  }, "Graded By"), /*#__PURE__*/React.createElement("div", {
    className: "fv"
  }, "Amazon AI")), /*#__PURE__*/React.createElement("div", {
    className: "hc-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fk"
  }, "Hub Inspected"), /*#__PURE__*/React.createElement("div", {
    className: "fv"
  }, "Yes \u2713")), /*#__PURE__*/React.createElement("div", {
    className: "hc-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fk"
  }, "Grade"), /*#__PURE__*/React.createElement("div", {
    className: "fv"
  }, grade, " \u2014 ", cfg.label)), /*#__PURE__*/React.createElement("div", {
    className: "hc-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fk"
  }, "CO\u2082 Saved"), /*#__PURE__*/React.createElement("div", {
    className: "fv",
    style: {
      color: 'var(--green)'
    }
  }, "~0.21 kg")), seller && /*#__PURE__*/React.createElement("div", {
    className: "hc-field"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fk"
  }, "Sold By"), /*#__PURE__*/React.createElement("div", {
    className: "fv link"
  }, seller)))), tab === 'journey' && /*#__PURE__*/React.createElement("div", {
    className: "hc-journey-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-journey-intro"
  }, "Verified provenance chain for this item"), /*#__PURE__*/React.createElement("div", {
    className: "hc-journey"
  }, JOURNEY.map((step, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `journey-step ${step.done ? 'done' : 'next'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "jstep-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "jstep-dot"
  }), i < JOURNEY.length - 1 && /*#__PURE__*/React.createElement("div", {
    className: "jstep-line"
  })), /*#__PURE__*/React.createElement("div", {
    className: "jstep-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "jstep-label"
  }, step.label), /*#__PURE__*/React.createElement("div", {
    className: "jstep-sub"
  }, step.sub))))), /*#__PURE__*/React.createElement("div", {
    className: "hc-journey-sig"
  }, /*#__PURE__*/React.createElement(I.lock, {
    style: {
      width: 11,
      height: 11,
      color: 'var(--ink-3)'
    }
  }), /*#__PURE__*/React.createElement("span", null, "Each step cryptographically anchored \xB7 GS1 Digital Link"))), tab === 'impact' && /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-hero"
  }, /*#__PURE__*/React.createElement(I.leafLine, {
    style: {
      width: 26,
      height: 26,
      color: 'var(--green)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 800,
      fontSize: 14
    }
  }, "You're making a difference"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--ink-3)',
      marginTop: 1
    }
  }, "Compared to buying this item new"))), /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "his-val"
  }, "0.21 kg"), /*#__PURE__*/React.createElement("div", {
    className: "his-label"
  }, "CO\u2082 Saved")), /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "his-val"
  }, "+2.1 yr"), /*#__PURE__*/React.createElement("div", {
    className: "his-label"
  }, "Life Extended")), /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-stat hc-gc-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "his-val",
    style: {
      color: 'var(--green)',
      fontSize: 26
    }
  }, "+15"), /*#__PURE__*/React.createElement("div", {
    className: "his-label"
  }, "\uD83C\uDF3F Green Credits vest in 7 days"))), /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hc-co2-key"
  }, "Buying new"), /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-bar-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-bar",
    style: {
      width: '100%',
      background: '#d1545d'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "hc-co2-val",
    style: {
      color: '#b3261e'
    }
  }, "1.84 kg")), /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hc-co2-key"
  }, "This item"), /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-bar-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hc-co2-bar",
    style: {
      width: '88%',
      background: 'var(--green)'
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "hc-co2-val",
    style: {
      color: 'var(--green)'
    }
  }, "1.63 kg"))), /*#__PURE__*/React.createElement("div", {
    className: "hc-impact-fact"
  }, /*#__PURE__*/React.createElement(I.leaf, {
    style: {
      width: 13,
      height: 13,
      color: 'var(--green)',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", null, "1 in 4 returned products ends up in landfill. You're keeping this one in circulation."))), /*#__PURE__*/React.createElement("div", {
    className: "hc-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "fl"
  }, "Cryptographically signed \xB7 GS1 Digital Link"), /*#__PURE__*/React.createElement("span", {
    className: "fr"
  }, /*#__PURE__*/React.createElement(I.leafLine, null), "Eco Verified"))), qr && /*#__PURE__*/React.createElement("div", {
    className: "modal-back",
    style: {
      zIndex: 84,
      alignItems: "center"
    },
    onClick: () => setQr(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "qrmodal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "spread",
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 800
    }
  }, "Scan to Verify"), /*#__PURE__*/React.createElement("div", {
    className: "faint",
    style: {
      fontSize: 11,
      marginTop: 2
    }
  }, "GS1 Digital Link \xB7 signed")), /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    style: {
      position: "static",
      width: 30,
      height: 30,
      boxShadow: "none",
      border: "1px solid var(--line)",
      background: "var(--surface-2)"
    },
    onClick: () => setQr(false)
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "qr-frame"
  }, /*#__PURE__*/React.createElement(QR, {
    size: 184
  })), /*#__PURE__*/React.createElement("div", {
    className: "faint",
    style: {
      fontSize: 11
    }
  }, "Tap outside or \u2715 to close"))));
}
Object.assign(window, {
  HealthCard,
  HC_CFG
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/healthcard.jsx", error: String((e && e.message) || e) }); }

// revive/home.jsx
try { (() => {
/* ============ Home / marketplace feed ============ */
const HERO_SLIDES = [{
  eyebrow: "AI-Verified · Pre-Loved",
  title: "Shop AI-Verified Pre-Loved Electronics",
  sub: "Same trust. Lower price. Better for the planet.",
  cta: "Shop Revive Electronics",
  to: "#/?src=p2p"
}, {
  eyebrow: "Sell in minutes",
  title: "List Your Items in Minutes",
  sub: "Take photos, set your price, drop off at any Amazon Locker.",
  cta: "Start Selling",
  to: "#/sell"
}, {
  eyebrow: "Earn while you save",
  title: "Earn Green Credits on Every Order",
  sub: "Keep your delivery. Skip the return. Earn credits, save CO\u2082.",
  cta: "Browse Renewed Items",
  to: "#/?src=renewed"
}];
const TABS = [{
  label: "All",
  value: ""
}, {
  label: "Revive",
  value: "p2p"
}, {
  label: "Renewed",
  value: "renewed"
}, {
  label: "Warehouse",
  value: "warehouse"
}, {
  label: "Returns",
  value: "return"
}];
function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(x => (x + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const s = HERO_SLIDES[i];
  const move = d => setI(x => (x + d + HERO_SLIDES.length) % HERO_SLIDES.length);
  return /*#__PURE__*/React.createElement("div", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-tex"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-shade"
  }), /*#__PURE__*/React.createElement("div", {
    className: "hero-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-copy",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "hero-eyebrow"
  }, /*#__PURE__*/React.createElement(I.spark, null), s.eyebrow), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, s.title), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, s.sub), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-lg btn-sq",
    onClick: () => {
      window.location.hash = s.to;
    }
  }, s.cta))), /*#__PURE__*/React.createElement("button", {
    className: "hero-arrow l",
    onClick: () => move(-1)
  }, /*#__PURE__*/React.createElement(I.arrowL, null)), /*#__PURE__*/React.createElement("button", {
    className: "hero-arrow r",
    onClick: () => move(1)
  }, /*#__PURE__*/React.createElement(I.arrowR, null)), /*#__PURE__*/React.createElement("div", {
    className: "hero-dots"
  }, HERO_SLIDES.map((_, k) => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: `hero-dot ${k === i ? "on" : ""}`,
    onClick: () => setI(k)
  })))));
}
function TrustStrip() {
  const cells = [{
    ico: "badge",
    b: "AI-verified condition",
    s: "Every item graded A–D"
  }, {
    ico: "lock",
    b: "Buyer protection",
    s: "Escrow until you confirm"
  }, {
    ico: "refresh",
    b: "7-day returns",
    s: "Instant Amazon Pay refund"
  }, {
    ico: "leafLine",
    b: "Earn Green Credits",
    s: "Saved CO₂ on every order"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "trust-strip"
  }, cells.map(c => {
    const Ico = I[c.ico];
    return /*#__PURE__*/React.createElement("div", {
      className: "trust-cell",
      key: c.b
    }, /*#__PURE__*/React.createElement(Ico, null), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, c.b), /*#__PURE__*/React.createElement("span", null, c.s)));
  }));
}
function PCard({
  p
}) {
  const chip = REVIVE.SOURCE_CHIP[p.source];
  const save = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : null;
  const go = e => {
    e.stopPropagation();
    window.location.hash = `#/product/${p.id}`;
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "pcard",
    onClick: go
  }, /*#__PURE__*/React.createElement("div", {
    className: "pcard-img"
  }, chip && /*#__PURE__*/React.createElement("span", {
    className: `pcard-src chip ${chip.cls}`
  }, chip.text), /*#__PURE__*/React.createElement("span", {
    className: `pcard-grade ${p.grade}`
  }, p.grade), /*#__PURE__*/React.createElement(ImgPH, {
    label: p.ph,
    tint: p.tint
  })), /*#__PURE__*/React.createElement("div", {
    className: "pcard-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pcard-title"
  }, p.title), /*#__PURE__*/React.createElement("div", {
    className: "pcard-rate"
  }, /*#__PURE__*/React.createElement(Stars, {
    n: p.rating
  }), /*#__PURE__*/React.createElement("span", null, p.ratings.toLocaleString("en-IN"))), /*#__PURE__*/React.createElement("div", {
    className: "pcard-price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "now"
  }, /*#__PURE__*/React.createElement("span", {
    className: "price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sym"
  }, "\u20B9"), p.price.toLocaleString("en-IN")))), save && /*#__PURE__*/React.createElement("div", {
    className: "pcard-mrp"
  }, "M.R.P.: ", /*#__PURE__*/React.createElement("span", {
    className: "strike"
  }, "\u20B9", p.mrp.toLocaleString("en-IN")), " ", /*#__PURE__*/React.createElement("span", {
    className: "save"
  }, "(", save, "% off)")), /*#__PURE__*/React.createElement("div", {
    className: "pcard-deliver"
  }, "FREE delivery Tomorrow"), /*#__PURE__*/React.createElement("div", {
    className: "pcard-cond"
  }, /*#__PURE__*/React.createElement("span", {
    className: `gpill ${p.grade}`
  }, p.grade), REVIVE.GRADE_DISPLAY[p.grade].split("– ")[1]), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-sm pcard-btn",
    onClick: go
  }, "Add to Cart")));
}
function HomePage({
  query
}) {
  const src = query.src || "";
  const [tab, setTab] = useState(src);
  useEffect(() => setTab(src), [src]);
  const list = tab ? REVIVE.PRODUCTS.filter(p => p.source === tab) : REVIVE.PRODUCTS;
  const counts = v => v ? REVIVE.PRODUCTS.filter(p => p.source === v).length : REVIVE.PRODUCTS.length;
  const setTo = v => {
    window.location.hash = v ? `#/?src=${v}` : "#/";
    setTab(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(TrustStrip, null), /*#__PURE__*/React.createElement("div", {
    className: "feed-head"
  }, /*#__PURE__*/React.createElement("h2", null, "Fresh on Revive"), /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.value,
    className: `tab ${tab === t.value ? "on" : ""}`,
    onClick: () => setTo(t.value)
  }, t.label, /*#__PURE__*/React.createElement("span", {
    className: "tab-n"
  }, counts(t.value)))))), /*#__PURE__*/React.createElement("div", {
    className: "grid-feed"
  }, list.map(p => /*#__PURE__*/React.createElement(PCard, {
    key: p.id,
    p: p
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 40
    }
  })));
}
Object.assign(window, {
  HomePage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/home.jsx", error: String((e && e.message) || e) }); }

// revive/nav.js
try { (() => {
/* Amazon Revive — shared, locked header + footer.
   Injected identically on every page so the navbar is never disturbed.
   Set window.REVIVE = { active: 'Shop Revive', signedIn: true } before this loads. */
(function () {
  const cfg = Object.assign({
    active: 'Shop Revive',
    signedIn: true,
    cart: 4,
    credits: 0
  }, window.REVIVE || {});
  const NAV = [{
    label: 'All',
    href: 'Home.html',
    icon: true
  }, {
    label: 'Shop Revive',
    href: 'Home.html',
    highlight: true
  }, {
    label: 'Renewed',
    href: 'Home.html'
  }, {
    label: 'Sell Unused Items',
    href: '#'
  }, {
    label: 'My Listings',
    href: '#',
    auth: true
  }, {
    label: 'Green Credits',
    href: '#',
    auth: true
  }, {
    label: 'Orders',
    href: 'Your Orders.html',
    auth: true
  }];
  const navItems = NAV.filter(i => !i.auth || cfg.signedIn).map(i => {
    if (i.icon) {
      return `<a href="${i.href}" class="flex items-center gap-1.5 px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 transition-colors font-bold">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>${i.label}</a>`;
    }
    const cls = i.highlight ? 'font-bold text-az-yellow' : '';
    return `<a href="${i.href}" class="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 transition-colors ${cls}">${i.label}</a>`;
  }).join('');
  const account = cfg.signedIn ? `<p class="text-gray-300 text-[11px] leading-none mb-0.5">Hello, user01</p><p class="font-bold text-[13px] leading-none">Account &amp; Lists <span class="ml-0.5">▾</span></p>` : `<p class="text-gray-300 text-[11px] leading-none mb-0.5">Hello, sign in</p><p class="font-bold text-[13px] leading-none">Account &amp; Lists <span class="ml-0.5">▾</span></p>`;
  const header = `
  <header class="sticky top-0 z-50">
    <div class="flex items-center bg-az-dark px-2 py-1 gap-2">
      <a href="Home.html" class="flex-shrink-0 cursor-pointer border border-transparent hover:border-white rounded-sm transition-colors">
        <img width="110" height="33" src="https://links.papareact.com/f90" alt="Amazon" class="p-2 object-contain"/>
      </a>
      <div class="hidden md:flex flex-col cursor-pointer flex-shrink-0 px-1 py-1 border border-transparent hover:border-white rounded-sm transition-colors min-w-[90px]">
        <span class="text-gray-300 text-[11px] leading-none">Delivering to</span>
        <span class="flex items-center gap-0.5 mt-0.5">
          <svg class="w-3.5 h-3.5 text-white flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          <span class="text-white font-bold text-[13px] leading-none">Update location</span>
        </span>
      </div>
      <form onsubmit="return false" class="flex flex-1 min-w-0 items-center rounded-md overflow-hidden h-10">
        <input class="flex-1 min-w-0 h-full px-3 text-sm text-black focus:outline-none" type="text" placeholder="Search Revive listings..."/>
        <button type="submit" class="h-full px-3 sm:px-4 bg-az-yellow hover:bg-[#f3a847] flex items-center justify-center flex-shrink-0">
          <svg class="h-5 w-5 text-az-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3" stroke-linecap="round"/></svg>
        </button>
      </form>
      <div class="flex items-center gap-1 sm:gap-3 flex-shrink-0 text-white">
        <div class="cursor-pointer px-1 sm:px-2 py-1 border border-transparent hover:border-white rounded-sm transition-colors hidden sm:block">${account}</div>
        ${cfg.signedIn ? `<div class="cursor-pointer hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-[#1c3d2b] hover:bg-[#245038] text-[#a7f3d0] text-xs font-bold" title="Green Credits"><span>🌿</span><span>${cfg.credits}</span></div>` : ''}
        <div class="cursor-pointer px-1 sm:px-2 py-1 border border-transparent hover:border-white rounded-sm transition-colors hidden md:block flex-shrink-0">
          <p class="text-gray-300 text-[11px] leading-none mb-0.5">Returns</p>
          <p class="font-bold text-[13px] leading-none">&amp; Orders</p>
        </div>
        <a href="#" class="cursor-pointer flex items-center gap-1 px-1 sm:px-2 py-1">
          <div class="relative">
            <span class="absolute -top-1.5 -right-1 h-5 w-5 bg-az-yellow rounded-full text-az-dark font-bold text-xs flex items-center justify-center">${cfg.cart}</span>
            <svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <p class="font-bold text-sm hidden md:block">Cart</p>
        </a>
      </div>
    </div>
    <div class="hidden md:flex items-center bg-az-navy text-white text-sm overflow-x-auto whitespace-nowrap px-1 py-1 gap-0">
      ${navItems}
      <span class="text-gray-600 px-1 flex-shrink-0 hidden lg:inline select-none">|</span>
      <a href="#" class="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Electronics</a>
      <a href="#" class="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Fashion</a>
      <a href="#" class="px-3 py-2 border border-transparent hover:border-white rounded-sm flex-shrink-0 hidden lg:inline transition-colors">Home &amp; Garden</a>
    </div>
  </header>`;
  const footer = `
  <footer class="mt-10">
    <a href="#top" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;" class="block bg-az-navy hover:bg-[#37475A] text-white text-center text-sm py-4 transition-colors">Back to top</a>
    <div class="bg-az-dark text-gray-300">
      <div class="max-w-container mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div><p class="text-white font-bold mb-3">Get to Know Us</p><ul class="space-y-2 text-gray-400"><li>About Amazon Revive</li><li>How grading works</li><li>Sustainability</li><li>Careers</li></ul></div>
        <div><p class="text-white font-bold mb-3">Sell & Earn</p><ul class="space-y-2 text-gray-400"><li>Sell unused items</li><li>Green Credits</li><li>Seller protection</li><li>Pickup &amp; handover</li></ul></div>
        <div><p class="text-white font-bold mb-3">Buyer Help</p><ul class="space-y-2 text-gray-400"><li>7-day returns</li><li>Buyer protection</li><li>Product Health Card</li><li>Contact us</li></ul></div>
        <div><p class="text-white font-bold mb-3">Shop Second-Life</p><ul class="space-y-2 text-gray-400"><li>Shop Revive</li><li>Amazon Renewed</li><li>Electronics</li><li>Fashion</li></ul></div>
      </div>
      <div class="border-t border-white/10 py-5 text-center text-xs text-gray-500">© 2026 Amazon Revive · A circular marketplace concept</div>
    </div>
  </footer>`;
  const h = document.getElementById('site-header');
  if (h) h.innerHTML = header;
  const f = document.getElementById('site-footer');
  if (f) f.innerHTML = footer;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/nav.js", error: String((e && e.message) || e) }); }

// revive/orders.jsx
try { (() => {
/* ============ Orders + My Listings ============ */
function OrdersPage() {
  const go = h => {
    window.location.hash = h;
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap-sm page-pad"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "page-h1"
  }, "Your Orders"), REVIVE.ORDERS.map(o => /*#__PURE__*/React.createElement("div", {
    className: "order",
    key: o.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "order-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "oh-grp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "oh-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Order Placed"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, o.placed)), /*#__PURE__*/React.createElement("div", {
    className: "oh-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Total"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "\u20B9", o.total.toLocaleString("en-IN"))), /*#__PURE__*/React.createElement("div", {
    className: "oh-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Source"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, o.source))), /*#__PURE__*/React.createElement("div", {
    className: "row gap8"
  }, o.isP2P && /*#__PURE__*/React.createElement("span", {
    className: "chip chip-revive"
  }, "REVIVE"), /*#__PURE__*/React.createElement("span", {
    className: `status ${o.status}`
  }, o.status))), /*#__PURE__*/React.createElement("div", {
    className: "order-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "order-thumb"
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: o.ph,
    tint: o.tint
  })), /*#__PURE__*/React.createElement("div", {
    className: "order-info"
  }, /*#__PURE__*/React.createElement("h3", null, o.title), /*#__PURE__*/React.createElement("span", {
    className: `gpill ${o.grade}`
  }, REVIVE.GRADE_DISPLAY[o.grade]), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12.5,
      marginTop: 8
    }
  }, "Return window closes ", o.returnCloses), o.escrow && /*#__PURE__*/React.createElement("div", {
    className: "order-escrow"
  }, /*#__PURE__*/React.createElement(I.lock, {
    style: {
      width: 13,
      height: 13
    }
  }), "Payment in escrow \u2014 released on delivery confirmation"), /*#__PURE__*/React.createElement("div", {
    className: "order-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-dark btn-sm btn-sq",
    onClick: () => go("#/grading")
  }, "Return Item"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sm btn-sq",
    onClick: () => go(`#/product/${o.productId}`)
  }, "View Item"))))))));
}
const STATUS_CFG = {
  listed: {
    label: "Active",
    cls: "A",
    dot: "#16a34a"
  },
  pending: {
    label: "Pending Verify",
    cls: "B",
    dot: "#d97706"
  },
  sold: {
    label: "Sold",
    cls: "soft",
    dot: "#9aa0a0"
  }
};
function ListingsPage() {
  const [tab, setTab] = useState("all");
  const all = REVIVE.LISTINGS;
  const counts = {
    all: all.length,
    listed: all.filter(l => l.status === "listed").length,
    sold: all.filter(l => l.status === "sold").length
  };
  const earned = all.filter(l => l.status === "sold").reduce((s, l) => s + l.price, 0);
  const list = tab === "all" ? all : all.filter(l => l.status === tab);
  const TABS = [{
    k: "all",
    l: "All"
  }, {
    k: "listed",
    l: "Active"
  }, {
    k: "sold",
    l: "Sold"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap-xs page-pad"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spread",
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "page-h1",
    style: {
      margin: 0
    }
  }, "My Listings"), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: 13,
      margin: "3px 0 0"
    }
  }, "Items you've listed on Revive")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-sq",
    onClick: () => {
      window.location.hash = "#/sell";
    }
  }, "+ List an Item")), /*#__PURE__*/React.createElement("div", {
    className: "stats3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("b", null, counts.all), /*#__PURE__*/React.createElement("span", null, "Total")), /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--green)"
    }
  }, counts.listed), /*#__PURE__*/React.createElement("span", null, "Active")), /*#__PURE__*/React.createElement("div", {
    className: "stat green"
  }, /*#__PURE__*/React.createElement("b", null, "\u20B9", earned.toLocaleString("en-IN")), /*#__PURE__*/React.createElement("span", null, "Earned"))), /*#__PURE__*/React.createElement("div", {
    className: "pills"
  }, TABS.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: `fpill ${tab === t.k ? "on" : ""}`,
    onClick: () => setTab(t.k)
  }, t.l, /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, counts[t.k])))), list.map(l => {
    const sc = STATUS_CFG[l.status];
    return /*#__PURE__*/React.createElement("div", {
      className: "listing",
      key: l.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "listing-thumb"
    }, /*#__PURE__*/React.createElement(ImgPH, {
      label: l.ph,
      tint: l.tint
    }), l.status === "sold" && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        background: "rgba(15,17,17,.34)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: 11
      }
    }, "SOLD")), /*#__PURE__*/React.createElement("div", {
      className: "grow"
    }, /*#__PURE__*/React.createElement("div", {
      className: "spread",
      style: {
        alignItems: "flex-start",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.35,
        paddingRight: 6
      }
    }, l.title), /*#__PURE__*/React.createElement("span", {
      className: "chip",
      style: {
        flexShrink: 0,
        background: sc.cls === "soft" ? "var(--surface-3)" : `var(--g${sc.cls}-bg)`,
        color: sc.cls === "soft" ? "var(--ink-2)" : `var(--g${sc.cls})`,
        border: "1px solid",
        borderColor: sc.cls === "soft" ? "var(--line)" : `var(--g${sc.cls}-line)`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 99,
        background: sc.dot
      }
    }), sc.label)), /*#__PURE__*/React.createElement("div", {
      className: "row gap8",
      style: {
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: `gpill ${l.grade}`
    }, "Grade ", l.grade), /*#__PURE__*/React.createElement("span", {
      className: "chip-soft",
      style: {
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 6
      }
    }, l.category)), /*#__PURE__*/React.createElement("div", {
      className: "spread",
      style: {
        marginTop: 11
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", {
      style: {
        fontSize: 16
      }
    }, "\u20B9", l.price.toLocaleString("en-IN")), /*#__PURE__*/React.createElement("span", {
      className: "faint",
      style: {
        fontSize: 11,
        marginLeft: 8,
        whiteSpace: "nowrap"
      }
    }, "Listed ", l.when)), l.status === "listed" && /*#__PURE__*/React.createElement("span", {
      className: "link",
      style: {
        fontSize: 12.5,
        fontWeight: 700
      },
      onClick: () => {
        window.location.hash = `#/product/${l.id}`;
      }
    }, "View listing \u2192"), l.status === "sold" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12.5,
        color: "var(--green)",
        fontWeight: 700
      }
    }, "\u2713 Sold"), l.status === "pending" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--gB)"
      }
    }, "Awaiting hub verification"))));
  })));
}
Object.assign(window, {
  OrdersPage,
  ListingsPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/orders.jsx", error: String((e && e.message) || e) }); }

// revive/product.jsx
try { (() => {
/* ============ Product detail ============ */
function ProductPage({
  id
}) {
  const p = REVIVE.byId(id) || REVIVE.PRODUCTS[1];
  const [hc, setHc] = useState(false);
  const [tryOn, setTryOn] = useState(false);
  const [thumb, setThumb] = useState(0);
  const save = p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : null;
  const chosen = REVIVE.GRADE_DISPLAY[p.grade];
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap-md page-pad"
  }, /*#__PURE__*/React.createElement("span", {
    className: "crumb",
    onClick: () => {
      window.location.hash = "#/";
    }
  }, /*#__PURE__*/React.createElement(I.arrowL, {
    style: {
      width: 15,
      height: 15
    }
  }), "Back to results"), /*#__PURE__*/React.createElement("div", {
    className: "pdp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-gallery"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pdp-stage"
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: p.ph,
    tint: p.tint
  })), /*#__PURE__*/React.createElement("div", {
    className: "pdp-thumbs"
  }, [0, 1, 2, 3].map(k => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: `pdp-thumb ${k === thumb ? "on" : ""}`,
    onClick: () => setThumb(k)
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: "",
    tint: p.tint,
    ico: "box"
  }))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "pdp-src"
  }, REVIVE.SOURCE_LABEL[p.source]), /*#__PURE__*/React.createElement("h1", {
    className: "pdp-title"
  }, p.title), /*#__PURE__*/React.createElement("div", {
    className: "pdp-cond"
  }, "Condition: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: HC_CFG[p.grade].accent
    }
  }, chosen)), /*#__PURE__*/React.createElement("div", {
    className: "pdp-rate"
  }, /*#__PURE__*/React.createElement(Stars, {
    n: p.rating
  }), /*#__PURE__*/React.createElement("span", {
    className: "link"
  }, p.ratings.toLocaleString("en-IN"), " ratings")), /*#__PURE__*/React.createElement("hr", {
    className: "hr",
    style: {
      margin: "14px 0"
    }
  }), /*#__PURE__*/React.createElement("div", null, save && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      marginBottom: 2
    }
  }, "M.R.P.: ", /*#__PURE__*/React.createElement("span", {
    className: "strike"
  }, "\u20B9", p.mrp.toLocaleString("en-IN")), " ", /*#__PURE__*/React.createElement("span", {
    className: "save"
  }, "(", save, "% off)")), /*#__PURE__*/React.createElement("span", {
    className: "pdp-price-now"
  }, /*#__PURE__*/React.createElement("span", {
    className: "price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sym"
  }, "\u20B9"), p.price.toLocaleString("en-IN"))), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      marginTop: 2
    }
  }, "Inclusive of all taxes")), /*#__PURE__*/React.createElement("div", {
    className: "ai-note"
  }, /*#__PURE__*/React.createElement("h5", null, /*#__PURE__*/React.createElement(I.spark, null), "AI Condition Notes"), /*#__PURE__*/React.createElement("p", null, p.cond)), /*#__PURE__*/React.createElement("div", {
    className: "spec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Delivery"), /*#__PURE__*/React.createElement("span", {
    className: "v",
    style: {
      color: "var(--green)",
      fontWeight: 700
    }
  }, "FREE delivery by Tomorrow")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Returns"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "7-day return window via Revive")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Ships from"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "Revive Marketplace")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Sold by"), /*#__PURE__*/React.createElement("span", {
    className: "v link"
  }, p.seller))), /*#__PURE__*/React.createElement("div", {
    className: "about"
  }, /*#__PURE__*/React.createElement("h4", null, "About this item"), /*#__PURE__*/React.createElement("p", null, p.desc), /*#__PURE__*/React.createElement("p", {
    className: "faint",
    style: {
      fontSize: 12,
      marginTop: 10
    }
  }, "Category: ", p.category))), /*#__PURE__*/React.createElement("div", {
    className: "buybox"
  }, /*#__PURE__*/React.createElement("div", {
    className: "bb-price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "price"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sym"
  }, "\u20B9"), p.price.toLocaleString("en-IN"))), save && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      marginTop: -6
    }
  }, "M.R.P.: ", /*#__PURE__*/React.createElement("span", {
    className: "strike"
  }, "\u20B9", p.mrp.toLocaleString("en-IN")), " ", /*#__PURE__*/React.createElement("span", {
    className: "save"
  }, "(", save, "% off)")), /*#__PURE__*/React.createElement("div", {
    className: "bb-deliver",
    style: {
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("b", null, "FREE Delivery"), " by Tomorrow"), /*#__PURE__*/React.createElement("div", {
    className: "bb-stock"
  }, "In Stock"), p.source === "p2p" && /*#__PURE__*/React.createElement("div", {
    className: "chip-soft",
    style: {
      fontSize: 12,
      padding: "8px 10px",
      borderRadius: 8,
      lineHeight: 1.4
    }
  }, "Ships from Amazon Hub after seller verification"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-block btn-sq"
  }, "Add to Cart"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-orange btn-block btn-sq"
  }, "Buy Now"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-tryon btn-block btn-sq",
    onClick: () => setTryOn(true)
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    fill: "currentColor",
    width: 15,
    height: 15,
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "10",
    cy: "3.5",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 9.5A5 5 0 0 1 15 9.5V14H13L12.5 18H7.5L7 14H5V9.5z",
    opacity: ".8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 14L3 18.5M15 14L17 18.5",
    stroke: "currentColor",
    strokeWidth: "1.4",
    fill: "none",
    strokeLinecap: "round",
    opacity: ".4"
  })), "Virtual Try-On"), /*#__PURE__*/React.createElement("div", {
    className: "bb-secure"
  }, /*#__PURE__*/React.createElement(I.lock, null), "Secure transaction"), /*#__PURE__*/React.createElement("hr", {
    className: "hr"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-dark btn-block btn-sq",
    onClick: () => setHc(true)
  }, "View Product Health Card"), /*#__PURE__*/React.createElement("hr", {
    className: "hr"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bb-meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spread"
  }, /*#__PURE__*/React.createElement("span", null, "Ships from"), /*#__PURE__*/React.createElement("span", null, "Revive")), /*#__PURE__*/React.createElement("div", {
    className: "spread"
  }, /*#__PURE__*/React.createElement("span", null, "Sold by"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--link)"
    }
  }, p.seller)), /*#__PURE__*/React.createElement("div", {
    className: "spread"
  }, /*#__PURE__*/React.createElement("span", null, "Returns"), /*#__PURE__*/React.createElement("span", null, "7-day window")))))), hc && /*#__PURE__*/React.createElement("div", {
    className: "modal-back",
    onClick: () => setHc(false)
  }, /*#__PURE__*/React.createElement("button", {
    className: "modal-close",
    onClick: () => setHc(false)
  }, "\u2715"), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(HealthCard, {
    grade: p.grade,
    cond: p.cond,
    completeness: p.completeness,
    seller: p.seller
  }))), tryOn && /*#__PURE__*/React.createElement(VirtualTryOn, {
    product: p,
    onClose: () => setTryOn(false)
  }));
}
Object.assign(window, {
  ProductPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/product.jsx", error: String((e && e.message) || e) }); }

// revive/sell.jsx
try { (() => {
/* ============ List an Item (Sell) ============ */
const CATEGORIES = ["Electronics", "Footwear", "Clothing", "Home & Kitchen", "Books", "Toys", "Sports", "Beauty", "Jewelry", "Other"];
const SELL_GRADE = {
  A: {
    label: "Excellent",
    ring: "#16a34a",
    bg: "#e6f4ea"
  },
  B: {
    label: "Good",
    ring: "#d97706",
    bg: "#fbf1d9"
  },
  C: {
    label: "Fair",
    ring: "#ea580c",
    bg: "#fbe9dd"
  },
  D: {
    label: "Acceptable",
    ring: "#dc2626",
    bg: "#fbe5e3"
  }
};
const DEMO_RESULT = {
  grade: "A",
  confidence: 0.94,
  summary: "Like new — original box included, no visible scratches. All accessories present.",
  defects: [{
    type: "micro-scuff",
    severity: "minor"
  }]
};
function GradePreview({
  result
}) {
  const cfg = SELL_GRADE[result.grade];
  return /*#__PURE__*/React.createElement("div", {
    className: "grade-preview"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gp-head",
    style: {
      background: cfg.bg
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "gp-badge",
    style: {
      background: cfg.ring
    }
  }, result.grade), /*#__PURE__*/React.createElement("div", {
    className: "grow"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: cfg.ring
    }
  }, "AI Grade: ", cfg.label), /*#__PURE__*/React.createElement("div", {
    className: "faint",
    style: {
      fontSize: 11
    }
  }, Math.round(result.confidence * 100), "% confidence \xB7 live scan")), /*#__PURE__*/React.createElement("span", {
    className: "chip-green",
    style: {
      fontSize: 11,
      padding: "3px 9px"
    }
  }, /*#__PURE__*/React.createElement(I.badge, {
    style: {
      width: 12,
      height: 12
    }
  }), "Verified")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "11px 14px",
      background: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "section-cap",
    style: {
      marginBottom: 4
    }
  }, "AI Condition Notes"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12.5,
      color: "var(--ink-2)",
      lineHeight: 1.55
    }
  }, result.summary)), /*#__PURE__*/React.createElement("div", {
    className: "gp-defects"
  }, result.defects.map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `defect ${d.severity}`
  }, d.type, " \xB7 ", d.severity))));
}
function SellPage() {
  const [cat, setCat] = useState("Electronics");
  const [stage, setStage] = useState("done"); // empty | grading | done
  const [result, setResult] = useState(DEMO_RESULT);
  const [title, setTitle] = useState("Sony WH-1000XM4 Wireless Headphones");
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState(DEMO_RESULT.summary);
  const [price, setPrice] = useState("17990");
  const upload = () => {
    setStage("grading");
    setResult(null);
    setTimeout(() => {
      setStage("done");
      setResult(DEMO_RESULT);
      setNotes(DEMO_RESULT.summary);
    }, 1600);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Header, null), /*#__PURE__*/React.createElement("main", {
    className: "wrap-xs page-pad"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "page-h1",
    style: {
      marginBottom: 4
    }
  }, "List an Item"), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: 13.5,
      marginTop: 0,
      marginBottom: 20
    }
  }, "Sell your pre-loved item on Revive \u2014 AI-verified, buyer-protected."), /*#__PURE__*/React.createElement("div", {
    className: "success-banner"
  }, /*#__PURE__*/React.createElement(I.check, null), "Photo graded by AI \u2014 review the details below and publish your listing."), /*#__PURE__*/React.createElement("div", {
    className: "step-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-num"
  }, "1"), /*#__PURE__*/React.createElement("h3", null, "What are you selling?")), /*#__PURE__*/React.createElement("p", {
    className: "step-sub"
  }, "Select category first \u2014 AI uses it to detect the right defects."), /*#__PURE__*/React.createElement("div", {
    className: "cat-grid"
  }, CATEGORIES.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    className: `cat-btn ${cat === c ? "on" : ""}`,
    onClick: () => setCat(c)
  }, c)))), /*#__PURE__*/React.createElement("div", {
    className: "step-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-num"
  }, "2"), /*#__PURE__*/React.createElement("h3", null, "Photos ", /*#__PURE__*/React.createElement("span", {
    className: "faint",
    style: {
      fontWeight: 400,
      fontSize: 12
    }
  }, "(up to 10)"))), /*#__PURE__*/React.createElement("p", {
    className: "step-sub"
  }, "Grading as ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--navy-800)"
    }
  }, cat), " \u2014 AI analyses instantly on upload."), stage === "empty" ? /*#__PURE__*/React.createElement("div", {
    className: "dropzone",
    onClick: upload
  }, /*#__PURE__*/React.createElement(I.cam, {
    className: "dz-ico"
  }), /*#__PURE__*/React.createElement("h4", null, "Drag and drop photos here"), /*#__PURE__*/React.createElement("p", null, "or click to browse \xB7 AI grades instantly")) : /*#__PURE__*/React.createElement("div", {
    className: "dz-grid"
  }, ["Headphones", "Side view", "In box"].map((lbl, i) => /*#__PURE__*/React.createElement("div", {
    className: "dz-tile",
    key: i
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: lbl,
    tint: "tint-a"
  }), i === 0 && /*#__PURE__*/React.createElement("span", {
    className: "cover"
  }, "Cover"))), /*#__PURE__*/React.createElement("div", {
    className: "dz-add",
    onClick: upload
  }, "+")), stage === "grading" && /*#__PURE__*/React.createElement("div", {
    className: "row gap8",
    style: {
      marginTop: 13,
      padding: "11px 13px",
      background: "#eef5fb",
      border: "1px solid #d4e6f5",
      borderRadius: 9,
      fontSize: 13,
      color: "#2d6da0"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: 16,
      border: "2px solid #6fa8da",
      borderTopColor: "transparent",
      borderRadius: 99,
      display: "inline-block",
      animation: "spin .8s linear infinite"
    }
  }), "AI is analysing your photo \u2014 grading defects, completeness\u2026"), stage === "done" && result && /*#__PURE__*/React.createElement(GradePreview, {
    result: result
  })), /*#__PURE__*/React.createElement("div", {
    className: "step-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-num"
  }, "3"), /*#__PURE__*/React.createElement("h3", null, "Item Details")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginLeft: 0,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Title ", /*#__PURE__*/React.createElement("span", {
    className: "req"
  }, "*")), /*#__PURE__*/React.createElement("input", {
    className: "inp",
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: "e.g. Sony WH-1000XM4 Wireless Headphones"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Description"), /*#__PURE__*/React.createElement("textarea", {
    className: "inp",
    rows: 3,
    value: desc,
    onChange: e => setDesc(e.target.value),
    placeholder: "Describe your item \u2014 age, usage, any accessories included\u2026"
  })), /*#__PURE__*/React.createElement("div", {
    className: "field",
    style: {
      marginBottom: 0
    }
  }, /*#__PURE__*/React.createElement("label", null, "Condition Notes ", result && /*#__PURE__*/React.createElement("span", {
    className: "ai-fill"
  }, "(auto-filled by AI \u2014 edit if needed)")), /*#__PURE__*/React.createElement("textarea", {
    className: "inp",
    rows: 2,
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Note any scratches, dents, or missing parts honestly\u2026"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "step-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-h"
  }, /*#__PURE__*/React.createElement("span", {
    className: "step-num"
  }, "\u20B9"), /*#__PURE__*/React.createElement("h3", null, "Pricing")), /*#__PURE__*/React.createElement("div", {
    className: "price-inp",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "sym"
  }, "\u20B9"), /*#__PURE__*/React.createElement("input", {
    className: "inp",
    style: {
      fontSize: 18,
      fontWeight: 800
    },
    type: "number",
    value: price,
    onChange: e => setPrice(e.target.value)
  })), /*#__PURE__*/React.createElement("p", {
    className: "faint",
    style: {
      fontSize: 12,
      marginTop: 8,
      marginBottom: 0
    }
  }, "AI price suggestion: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: "var(--green)"
    }
  }, "\u20B917,200 \u2013 \u20B918,500"), " based on grade and recent sales.")), /*#__PURE__*/React.createElement("div", {
    className: "infobox"
  }, /*#__PURE__*/React.createElement(I.box, null), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "How drop-off works"), /*#__PURE__*/React.createElement("p", null, "After listing, drop your item at any Amazon Locker or Kirana partner hub. Revive verifies the condition matches your listing before it goes live. You earn when the buyer confirms receipt."))), /*#__PURE__*/React.createElement("div", {
    className: "row gap12"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sq grow",
    style: {
      justifyContent: "center",
      padding: "12px"
    },
    onClick: () => {
      window.location.hash = "#/";
    }
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-sq grow",
    style: {
      justifyContent: "center",
      padding: "12px"
    },
    onClick: () => {
      window.location.hash = "#/listings";
    }
  }, "Publish Listing"))));
}
Object.assign(window, {
  SellPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/sell.jsx", error: String((e && e.message) || e) }); }

// revive/theme.js
try { (() => {
/* Shared Tailwind theme for the Amazon Revive redesign. Load AFTER the Tailwind CDN. */
tailwind.config = {
  theme: {
    extend: {
      colors: {
        'az-navy': '#232F3E',
        'az-dark': '#131921',
        'az-orange': '#FF9900',
        'az-yellow': '#febd69',
        'az-link': '#007185',
        'az-ink': '#0F1111',
        'az-line': '#D5D9D9',
        'az-bg': '#EAEDED',
        'az-green': '#007600',
        'az-red': '#CC0C39'
      },
      fontFamily: {
        sans: ['Inter', '"Amazon Ember"', 'Arial', 'system-ui', 'sans-serif']
      },
      maxWidth: {
        container: '1500px'
      }
    }
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/theme.js", error: String((e && e.message) || e) }); }

// revive/tryon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ============ Virtual Try-On ============ */

/* ---- Icons ---- */
const TryOnPersonIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 20 20",
  fill: "currentColor"
}, p), /*#__PURE__*/React.createElement("circle", {
  cx: "10",
  cy: "3.5",
  r: "3"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 9.5A5 5 0 0 1 15 9.5V14H13L12.5 18H7.5L7 14H5V9.5z",
  opacity: ".8"
}), /*#__PURE__*/React.createElement("path", {
  d: "M5 14L3 18.5M15 14L17 18.5",
  stroke: "currentColor",
  strokeWidth: "1.4",
  fill: "none",
  strokeLinecap: "round",
  opacity: ".4"
}));
const TryOnCloseIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M18 6L6 18M6 6l12 12"
}));
const TryOnCheckIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 20 20",
  fill: "currentColor"
}, p), /*#__PURE__*/React.createElement("path", {
  fillRule: "evenodd",
  d: "M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z",
  clipRule: "evenodd"
}));
const TryOnScanIcon = p => /*#__PURE__*/React.createElement("svg", _extends({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.9",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p), /*#__PURE__*/React.createElement("path", {
  d: "M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "12",
  cy: "12",
  r: "3.2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 8.8V7M12 17v-1.2M15.2 12H17M7 12h1.8"
}));

/* ---- Shared tip data ---- */
const TRYON_TIPS = ["Full body visible", "Good lighting", "Stand straight", "Plain background", "Fitted clothing", "Arms slightly out"];

/* ============ Phase 1: Upload modal ============ */
function TryOnUploadPhase({
  product,
  onClose,
  photoUrl,
  setPhotoUrl,
  onContinue
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const p = product;
  const handleFile = file => {
    if (!file || !file.type.startsWith("image/")) return;
    setPhotoUrl(URL.createObjectURL(file));
  };
  const handleDrop = e => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "tryon-head"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-brand-mark"
  }, /*#__PURE__*/React.createElement(TryOnPersonIcon, {
    width: 17,
    height: 17
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "#fff",
      letterSpacing: "-.3px"
    }
  }, "Virtual Try-On"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgba(255,255,255,.42)",
      marginTop: 1
    }
  }, "Powered by Revive AI"))), /*#__PURE__*/React.createElement("button", {
    className: "tryon-x",
    onClick: onClose,
    "aria-label": "Close"
  }, /*#__PURE__*/React.createElement(TryOnCloseIcon, {
    width: 15,
    height: 15
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tryon-split"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-left-panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: "1.8px",
      textTransform: "uppercase",
      color: "rgba(255,255,255,.28)",
      marginBottom: 16
    }
  }, "Now trying on"), /*#__PURE__*/React.createElement("div", {
    className: "tryon-product-thumb"
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: p.ph,
    tint: p.tint,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 800,
      color: "#fff",
      lineHeight: 1.28,
      marginBottom: 11
    }
  }, p.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "gpill " + p.grade,
    style: {
      fontSize: 10.5
    }
  }, "Grade ", p.grade)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 25,
      fontWeight: 900,
      color: "var(--amber)",
      letterSpacing: "-.6px"
    }
  }, "\u20B9", p.price.toLocaleString("en-IN")), p.mrp && p.mrp > p.price && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "rgba(255,255,255,.33)",
      marginTop: 3
    }
  }, "M.R.P. ", /*#__PURE__*/React.createElement("span", {
    style: {
      textDecoration: "line-through"
    }
  }, "\u20B9", p.mrp.toLocaleString("en-IN")))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "auto",
      paddingTop: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 9,
      padding: "10px 12px",
      borderRadius: "var(--r-sm)",
      background: "rgba(254,189,105,.08)",
      border: "1px solid rgba(254,189,105,.16)",
      fontSize: 12,
      color: "rgba(255,255,255,.6)",
      fontWeight: 600,
      lineHeight: 1.5
    }
  }, /*#__PURE__*/React.createElement(I.spark, {
    width: 13,
    height: 13,
    style: {
      color: "var(--amber)",
      flexShrink: 0,
      marginTop: 1
    }
  }), "AI body measurement & garment fitting technology"))), /*#__PURE__*/React.createElement("div", {
    className: "tryon-right-panel"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: "var(--ink)",
      letterSpacing: "-.38px",
      marginBottom: 4
    }
  }, "Your photo"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: "var(--ink-3)",
      marginBottom: 18,
      lineHeight: 1.5
    }
  }, "Upload a full-body photo for the best fit result"), /*#__PURE__*/React.createElement("div", {
    className: "tryon-drop" + (dragOver ? " drag" : "") + (photoUrl ? " has-photo" : ""),
    onClick: () => !photoUrl && fileRef.current && fileRef.current.click(),
    onDragOver: e => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
    role: "button",
    tabIndex: 0
  }, /*#__PURE__*/React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    style: {
      display: "none"
    },
    onChange: e => handleFile(e.target.files[0])
  }), photoUrl ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      height: "100%"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: photoUrl,
    alt: "Your photo",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 12,
      left: 12,
      background: "var(--green)",
      color: "#fff",
      borderRadius: "var(--pill)",
      padding: "5px 12px",
      fontSize: 12,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      gap: 5,
      boxShadow: "0 2px 10px rgba(7,122,82,.45)"
    }
  }, /*#__PURE__*/React.createElement(TryOnCheckIcon, {
    width: 11,
    height: 11
  }), "Photo ready"), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      fileRef.current && fileRef.current.click();
    },
    style: {
      position: "absolute",
      top: 12,
      right: 12,
      background: "rgba(15,17,17,.72)",
      backdropFilter: "blur(6px)",
      color: "#fff",
      border: "1px solid rgba(255,255,255,.2)",
      borderRadius: "var(--pill)",
      padding: "5px 13px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit"
    }
  }, "Change photo")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 7,
      textAlign: "center",
      padding: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: "50%",
      background: "var(--surface-3)",
      border: "1px solid var(--line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(TryOnPersonIcon, {
    width: 28,
    height: 28,
    style: {
      color: "#b4baba"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700,
      color: "var(--ink-2)"
    }
  }, dragOver ? "Release to upload!" : "Drop your full-body photo here"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-3)"
    }
  }, "or click to browse \xB7 JPG, PNG \xB7 max 10 MB"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 15,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10.5,
      fontWeight: 800,
      letterSpacing: ".7px",
      textTransform: "uppercase",
      color: "var(--ink-3)",
      marginBottom: 9
    }
  }, "Photo tips"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, TRYON_TIPS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 5,
      padding: "5px 11px",
      borderRadius: "var(--pill)",
      background: "var(--surface-2)",
      border: "1px solid var(--line-soft)",
      fontSize: 11.5,
      color: "var(--ink-2)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(TryOnCheckIcon, {
    width: 10,
    height: 10,
    style: {
      color: "var(--green)",
      flexShrink: 0
    }
  }), t)))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-block btn-sq btn-lg" + (photoUrl ? " btn-amber" : ""),
    style: !photoUrl ? {
      background: "var(--surface-3)",
      color: "var(--ink-3)",
      border: "1px solid var(--line)",
      boxShadow: "none",
      cursor: "default",
      marginTop: 18
    } : {
      marginTop: 18
    },
    disabled: !photoUrl,
    onClick: photoUrl ? onContinue : undefined
  }, photoUrl ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TryOnScanIcon, {
    width: 16,
    height: 16
  }), " Start Try-On") : "Upload a photo to continue"))));
}

/* ============ Phase 2: Processing (full page) ============ */
function TryOnProcessingPhase({
  progress,
  stepIndex
}) {
  const steps = ["Analyzing body measurements", "Fitting garment to your shape", "Rendering your look"];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      maxWidth: 460,
      margin: "0 auto",
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 150,
      height: 150,
      marginBottom: 30
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 150 150",
    width: 150,
    height: 150,
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      animation: "spin 2.7s linear infinite"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "75",
    cy: "75",
    r: "68",
    stroke: "var(--amber)",
    strokeWidth: "2.5",
    strokeDasharray: "66 360",
    strokeLinecap: "round",
    fill: "none",
    opacity: ".55"
  })), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 150 150",
    width: 150,
    height: 150,
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      animation: "spin 4.4s linear infinite reverse"
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "75",
    cy: "75",
    r: "54",
    stroke: "var(--orange-2)",
    strokeWidth: "1.5",
    strokeDasharray: "36 300",
    strokeLinecap: "round",
    fill: "none",
    opacity: ".38"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(TryOnPersonIcon, {
    width: 56,
    height: 56,
    style: {
      color: "var(--amber)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      height: 2,
      background: "linear-gradient(90deg, transparent, var(--amber), transparent)",
      borderRadius: "99px",
      animation: "tryonScan 2s ease-in-out infinite",
      zIndex: 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 23,
      fontWeight: 800,
      color: "var(--ink)",
      letterSpacing: "-.45px",
      marginBottom: 7
    }
  }, "Fitting your look\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: "var(--ink-3)"
    }
  }, "Revive AI is working its magic")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 9,
      borderRadius: "99px",
      background: "var(--surface-3)",
      overflow: "hidden",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      borderRadius: "99px",
      background: "linear-gradient(90deg, var(--amber), var(--orange-2))",
      width: progress + "%",
      transition: "width .18s linear"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-3)"
    }
  }, steps[stepIndex]), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 800,
      color: "var(--orange-2)"
    }
  }, Math.round(progress), "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      width: "100%"
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      fontSize: 13.5,
      fontWeight: i === stepIndex ? 700 : 500,
      color: i < stepIndex ? "var(--green)" : i === stepIndex ? "var(--ink)" : "var(--ink-3)",
      transition: "color .35s"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: "50%",
      flexShrink: 0,
      background: i < stepIndex ? "var(--green)" : i === stepIndex ? "var(--navy-800)" : "var(--surface-3)",
      border: "2px solid " + (i < stepIndex ? "var(--green)" : i === stepIndex ? "var(--amber-2)" : "var(--line)"),
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all .35s"
    }
  }, i < stepIndex && /*#__PURE__*/React.createElement(TryOnCheckIcon, {
    width: 12,
    height: 12,
    style: {
      color: "#fff"
    }
  }), i === stepIndex && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: "var(--amber)"
    }
  })), s))));
}

/* ============ Phase 3: Result (full page) ============ */
function TryOnResultPhase({
  product,
  photoUrl
}) {
  const p = product;
  const [saved, setSaved] = useState(false);
  const metrics = [{
    label: "Fit Score",
    value: "94%",
    color: "var(--green)"
  }, {
    label: "Recommended Size",
    value: "M",
    color: "var(--ink)"
  }, {
    label: "Confidence",
    value: "High",
    color: "var(--amber-2)"
  }, {
    label: "Style Match",
    value: "✓ Great",
    color: "var(--link)"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "12px 20px",
      background: "#fff",
      borderBottom: "1px solid var(--line-soft)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: "var(--r-sm)",
      overflow: "hidden",
      border: "1px solid var(--line-soft)",
      background: "var(--surface-2)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: "",
    tint: p.tint,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 0
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "var(--ink)"
    }
  }, p.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 7,
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "gpill " + p.grade,
    style: {
      fontSize: 10.5
    }
  }, "Grade ", p.grade), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: "var(--ink-2)",
      fontWeight: 700
    }
  }, "\u20B9", p.price.toLocaleString("en-IN"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 13px",
      borderRadius: "var(--pill)",
      background: "var(--green-bg)",
      border: "1px solid var(--green-line)",
      fontSize: 11.5,
      fontWeight: 800,
      color: "var(--green-ink)"
    }
  }, /*#__PURE__*/React.createElement(I.spark, {
    width: 12,
    height: 12,
    style: {
      color: "var(--orange-2)"
    }
  }), "AI Generated Result")), /*#__PURE__*/React.createElement("div", {
    className: "tryon-result-panels"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-result-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-panel-label"
  }, "Your photo"), /*#__PURE__*/React.createElement("div", {
    className: "tryon-panel-photo"
  }, /*#__PURE__*/React.createElement("img", {
    src: photoUrl,
    alt: "Original",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "tryon-result-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-panel-label",
    style: {
      background: "var(--navy-800)",
      color: "var(--amber)",
      border: "1px solid var(--navy-700)"
    }
  }, "Wearing ", p.title), /*#__PURE__*/React.createElement("div", {
    className: "tryon-panel-photo"
  }, /*#__PURE__*/React.createElement("img", {
    src: photoUrl,
    alt: "Try-on result",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "contrast(1.05) saturate(1.07)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, transparent 52%, rgba(19,26,34,.2) 100%)",
      pointerEvents: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 14,
      left: 14,
      background: "rgba(19,26,34,.87)",
      backdropFilter: "blur(8px)",
      borderRadius: "var(--r-sm)",
      padding: "9px 12px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      border: "1px solid rgba(255,255,255,.09)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 6,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,.1)",
      flexShrink: 0,
      background: "var(--surface-2)"
    }
  }, /*#__PURE__*/React.createElement(ImgPH, {
    label: "",
    tint: p.tint,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 0
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: "rgba(255,255,255,.38)",
      fontWeight: 800,
      letterSpacing: "1.2px",
      textTransform: "uppercase"
    }
  }, "Wearing"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: "#fff",
      fontWeight: 800,
      lineHeight: 1.3
    }
  }, p.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: "var(--amber)",
      fontWeight: 800,
      marginTop: 2
    }
  }, "\u20B9", p.price.toLocaleString("en-IN")))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 14,
      right: 14,
      background: "var(--green)",
      color: "#fff",
      borderRadius: "var(--pill)",
      padding: "6px 15px",
      fontSize: 13.5,
      fontWeight: 900,
      boxShadow: "0 3px 12px rgba(7,122,82,.5)"
    }
  }, "94% Fit Match")))), /*#__PURE__*/React.createElement("div", {
    className: "tryon-metrics-bar"
  }, metrics.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.label,
    className: "tryon-metric-cell"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 900,
      color: m.color,
      letterSpacing: "-.4px"
    }
  }, m.value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: "var(--ink-3)",
      fontWeight: 600,
      marginTop: 3
    }
  }, m.label)))), /*#__PURE__*/React.createElement("div", {
    className: "tryon-actions-bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-amber btn-lg btn-sq"
  }, "Add to Cart"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-sq btn-lg",
    style: saved ? {
      background: "var(--green-bg)",
      color: "var(--green-ink)",
      border: "1px solid var(--green-line)"
    } : {
      background: "#fff",
      border: "1px solid var(--line)",
      color: "var(--ink)",
      boxShadow: "var(--sh-xs)"
    },
    onClick: () => setSaved(true)
  }, saved ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(TryOnCheckIcon, {
    width: 15,
    height: 15,
    style: {
      color: "var(--green)"
    }
  }), " Saved!") : "Save Look"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost btn-sq btn-lg"
  }, "Try Different Size")));
}

/* ============ Main controller ============ */
function VirtualTryOn({
  product,
  onClose
}) {
  const [phase, setPhase] = useState("upload"); // "upload" | "page"
  const [pagePhase, setPagePhase] = useState("processing"); // "processing" | "result"
  const [photoUrl, setPhotoUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const timerRef = useRef(null);
  const startTryOn = () => {
    setPhase("page");
    setPagePhase("processing");
    setProgress(0);
    setStepIndex(0);
    let acc = 0,
      s = 0;
    timerRef.current = setInterval(() => {
      acc += Math.random() * 9 + 5;
      const pc = Math.min(acc, 100);
      if (pc > 34 && s < 1) {
        s = 1;
        setStepIndex(1);
      }
      if (pc > 68 && s < 2) {
        s = 2;
        setStepIndex(2);
      }
      if (pc >= 100) {
        clearInterval(timerRef.current);
        setTimeout(() => setPagePhase("result"), 520);
      }
      setProgress(pc);
    }, 165);
  };
  const handleRetry = () => {
    setPhase("upload");
    setPhotoUrl(null);
    setProgress(0);
    setStepIndex(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  /* ── Full-page experience (processing + result) ── */
  if (phase === "page") {
    return /*#__PURE__*/React.createElement("div", {
      className: "tryon-page-wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "tryon-page-hdr"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "tryon-brand-mark"
    }, /*#__PURE__*/React.createElement(TryOnPersonIcon, {
      width: 16,
      height: 16
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: "#fff"
      }
    }, "Virtual Try-On", pagePhase === "result" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "rgba(255,255,255,.38)",
        fontWeight: 400,
        marginLeft: 9
      }
    }, "\xB7 Result"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10
      }
    }, pagePhase === "result" && /*#__PURE__*/React.createElement("button", {
      onClick: handleRetry,
      style: {
        fontSize: 13,
        color: "rgba(255,255,255,.7)",
        fontWeight: 600,
        background: "rgba(255,255,255,.09)",
        border: "1px solid rgba(255,255,255,.15)",
        borderRadius: "var(--pill)",
        padding: "5px 14px",
        cursor: "pointer",
        fontFamily: "inherit"
      }
    }, "Try another photo"), /*#__PURE__*/React.createElement("button", {
      className: "tryon-x",
      onClick: onClose,
      "aria-label": "Close"
    }, /*#__PURE__*/React.createElement(TryOnCloseIcon, {
      width: 15,
      height: 15
    })))), pagePhase === "processing" ? /*#__PURE__*/React.createElement(TryOnProcessingPhase, {
      progress: progress,
      stepIndex: stepIndex
    }) : /*#__PURE__*/React.createElement(TryOnResultPhase, {
      product: product,
      photoUrl: photoUrl
    }));
  }

  /* ── Upload modal ── */
  return /*#__PURE__*/React.createElement("div", {
    className: "tryon-backdrop",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "tryon-modal",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(TryOnUploadPhase, {
    product: product,
    onClose: onClose,
    photoUrl: photoUrl,
    setPhotoUrl: setPhotoUrl,
    onContinue: startTryOn
  })));
}
Object.assign(window, {
  VirtualTryOn
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "revive/tryon.jsx", error: String((e && e.message) || e) }); }

__ds_ns.TryOnResultCard = __ds_scope.TryOnResultCard;

})();
