import React from "react";
import { useNavigate } from "react-router-dom";
import { StarIcon, Minus, Plus } from "lucide-react";
import { useCart } from "../context/CartContext";

const GRADE_STYLES = {
  A: 'bg-[#e6f4ea] text-[#107a45]',
  B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]',
  D: 'bg-[#fbe5e3] text-[#b3261e]',
};
const GRADE_LABELS = { A: 'Like New', B: 'Very Good', C: 'Good', D: 'Acceptable' };

// v2: two second-life trust badges. Renewed = authorized-center refurb; else Revive.
const SOURCE_LABEL = {
  renewed:   { text: 'Renewed by Amazon', style: 'bg-[#007185] text-white' },
  p2p:       { text: 'Revive', style: 'bg-[#232F3E] text-[#febd69]' },
  warehouse: { text: 'Revive', style: 'bg-[#232F3E] text-[#febd69]' },
  return:    { text: 'Revive', style: 'bg-[#232F3E] text-[#febd69]' },
};
const inr = (v) => `₹${parseFloat(v).toLocaleString('en-IN')}`;

// Pillar 4 — review-mined sizing skew (matches FitTwin DIRECTION tokens).
const FIT_PILL = {
  runs_small: 'Runs small',
  runs_large: 'Runs large',
};

const Product = ({ id, title, price, image, grade, source, isNew, mrp, secondLife, rating, ratingCount, lifecycle, fitSignal, reviewSummary }) => {
  const navigate = useNavigate();
  const { addToCart, removeFromCart, updateQuantity, cart, getItemQty } = useCart();
  const inCart = id != null && cart.some((item) => Number(item.id) === Number(id));
  const cartQty = getItemQty(id);
  const srcLabel = !isNew ? SOURCE_LABEL[source] : null;

  // v2 lifecycle: a staged second-life item (refurbishing / held-local) is visible
  // but not yet buyable. Show its stage and disable purchase until it goes live.
  const staged = lifecycle && !lifecycle.live && !lifecycle.sold;
  const stageLabel = staged ? (lifecycle.stages?.find((s) => s.current)?.label || 'In progress') : null;

  // New tiles use the real catalog rating; second-life derive stars from grade.
  const rateStars = isNew
    ? Math.round(rating || 0)
    : (grade === 'A' ? 5 : grade === 'B' ? 4 : grade === 'C' ? 3 : 2);
  const showMrp = !isNew && mrp && parseFloat(mrp) > parseFloat(price);
  const offPct = showMrp ? Math.round((1 - parseFloat(price) / parseFloat(mrp)) * 100) : 0;

  // Pillar-4 browse-time return cues (real review intel, pre-empt returns early).
  // The fit-skew pill is intentionally NOT shown on the catalog photo tile — the
  // sizing story belongs on the product page ("What buyers say" + FitTwin), not
  // stamped on every thumbnail. Keep only the low-return keep-rate cue here.
  const fitPill = null;
  const returnRisk = reviewSummary && typeof reviewSummary.return_risk === 'number'
    ? reviewSummary.return_risk : null;
  const keepRate = returnRisk != null && returnRisk < 0.2 ? Math.round((1 - returnRisk) * 10) : null;

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart({ id, title, price, image, grade, source, maxStock: isNew ? 10 : 1 });
  };

  const handleIncrease = (e) => {
    e.stopPropagation();
    updateQuantity(id, cartQty + 1);
  };

  const handleDecrease = (e) => {
    e.stopPropagation();
    if (cartQty <= 1) removeFromCart(id);
    else updateQuantity(id, cartQty - 1);
  };

  return (
    <div
      className="relative flex flex-col bg-white border border-[#D5D9D9] rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer p-3 sm:p-4"
      onClick={() => navigate(`/product/${id}`)}
    >
      {srcLabel && (
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 ${srcLabel.style}`}>
          {srcLabel.text}
        </span>
      )}
      {!isNew && grade && (
        <span className={`absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded z-10 ${GRADE_STYLES[grade] || ''}`}>
          {grade}
        </span>
      )}
      {staged && (
        <span className="absolute top-8 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 bg-amber-100 text-amber-800 border border-amber-200">
          ⏳ {stageLabel}
        </span>
      )}

      <div className="flex items-center justify-center mt-5 mb-2 h-36 sm:h-44">
        <img src={image} alt={title} className="max-h-full max-w-full object-contain"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/200x200?text=No+Image'; }} />
      </div>

      <h4 className="my-1.5 text-xs sm:text-sm font-semibold line-clamp-2 flex-grow">{title}</h4>

      <div className="flex items-center gap-1 my-1">
        {Array(rateStars).fill(null).map((_, i) => (
          <StarIcon key={`f${i}`} className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-yellow-500" />
        ))}
        {Array(5 - rateStars).fill(null).map((_, i) => (
          <StarIcon key={`e${i}`} className="h-3 w-3 sm:h-4 sm:w-4 text-gray-300 fill-gray-300" />
        ))}
        {isNew && ratingCount > 0 && (
          <span className="text-[11px] text-[#007185] ml-1">{ratingCount.toLocaleString('en-IN')}</span>
        )}
      </div>

      {/* Pillar-4 review cues: a fit-skew pill and/or a low-return keep-rate line. */}
      {(fitPill || keepRate) && (
        <div className="flex items-center gap-1.5 flex-wrap -mt-0.5 mb-1">
          {fitPill && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#fbe9dd] text-[#bd4a17]">
              {fitPill}
            </span>
          )}
          {keepRate && (
            <span className="text-[11px] text-[#007185] font-medium">
              ✓ {keepRate} in 10 buyers keep this
            </span>
          )}
        </div>
      )}

      <div className="mb-0.5 font-bold text-sm sm:text-base flex items-baseline gap-1.5">
        {inr(price)}
        {showMrp && (
          <>
            <span className="text-[11px] text-gray-400 font-normal line-through">{inr(mrp)}</span>
            <span className="text-[11px] text-[#007600] font-semibold">({offPct}% off)</span>
          </>
        )}
      </div>

      {!isNew && grade && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${GRADE_STYLES[grade] || ''}`}>{grade}</span>
          <span className="text-[11px] text-gray-500">{GRADE_LABELS[grade]}</span>
        </div>
      )}

      {isNew && secondLife && (
        <p className="text-[11px] text-[#007185] font-medium mb-1">
          {secondLife.labels.join(' / ')} from {inr(secondLife.from_price)}
        </p>
      )}

      <p className="text-[11px] text-[#007600] font-medium mb-2">FREE delivery Tomorrow</p>

      {staged ? (
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/product/${id}`); }}
          className="mt-auto py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded border border-amber-300 bg-amber-50 text-amber-800"
        >
          {lifecycle.track === 'renewed' ? 'Refurbishing — track it' : 'Held nearby — track it'}
        </button>
      ) : !isNew && inCart ? (
        // Second-life unique item — only 1 in stock, disable once added
        <button
          disabled
          className="mt-auto py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded border bg-gray-100 text-gray-500 border-gray-200 cursor-default"
        >
          ✓ Added to Cart
        </button>
      ) : inCart ? (
        // New item in cart — show qty widget so user can adjust without going to detail page
        <div className="mt-auto flex items-center rounded-full overflow-hidden border border-[#D5D9D9] shadow-sm bg-white h-8 sm:h-9" onClick={e => e.stopPropagation()}>
          <button
            onClick={handleDecrease}
            className="w-10 sm:w-12 h-full flex items-center justify-center text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6] transition-colors"
          >
            {cartQty === 1 ? (
              <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
            ) : <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />}
          </button>
          <span className="flex-1 px-3 text-xs sm:text-sm font-bold text-[#0F1111] border-x border-[#D5D9D9] h-full flex items-center justify-center bg-white">{cartQty}</span>
          <button
            onClick={handleIncrease}
            className="w-10 sm:w-12 h-full flex items-center justify-center text-[#0F1111] bg-[#F0F2F2] hover:bg-[#e3e6e6] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleAdd}
          className="mt-auto py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded border transition-colors text-[#131921] border-[#f0c040] shadow-sm active:scale-95"
          style={{ background: 'linear-gradient(180deg, #ffd99e, #febd69)' }}
        >
          Add to Cart
        </button>
      )}
    </div>
  );
};

export default Product;
