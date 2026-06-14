import React from "react";
import { useNavigate } from "react-router-dom";
import { StarIcon } from "lucide-react";
import { useCart } from "../context/CartContext";

const GRADE_STYLES = {
  A: 'bg-[#e6f4ea] text-[#107a45]',
  B: 'bg-[#fbf1d9] text-[#b06f00]',
  C: 'bg-[#fbe9dd] text-[#bd4a17]',
  D: 'bg-[#fbe5e3] text-[#b3261e]',
};

const GRADE_LABELS = {
  A: 'Like New',
  B: 'Very Good',
  C: 'Good',
  D: 'Acceptable',
};

const SOURCE_LABEL = {
  p2p:       { text: 'REVIVE',    style: 'bg-[#232F3E] text-[#febd69]' },
  renewed:   { text: 'Renewed',   style: 'bg-[#007185] text-white' },
  warehouse: { text: 'Warehouse', style: 'bg-[#565959] text-white' },
  return:    { text: 'Returned',  style: 'bg-gray-400 text-white' },
};

const Product = ({ id, title, price, description, category, image, grade, source }) => {
  const navigate = useNavigate();
  const { addToCart, cart } = useCart();
  const inCart = id != null && cart.some((item) => Number(item.id) === Number(id));
  const stars = grade === 'A' ? 5 : grade === 'B' ? 4 : grade === 'C' ? 3 : 2;
  const srcLabel = SOURCE_LABEL[source];

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart({ id, title, price, image, grade, source });
  };

  return (
    <div
      className="relative flex flex-col bg-white rounded shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer p-3 sm:p-4"
      onClick={() => navigate(`/product/${id}`)}
    >
      {/* Source badge */}
      {srcLabel && (
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 ${srcLabel.style}`}>
          {srcLabel.text}
        </span>
      )}

      {/* Grade badge */}
      {grade && (
        <span className={`absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded z-10 ${GRADE_STYLES[grade] || ''}`}>
          {grade}
        </span>
      )}

      {/* Image */}
      <div className="flex items-center justify-center mt-5 mb-2 h-36 sm:h-44">
        <img
          src={image}
          alt={title}
          className="max-h-full max-w-full object-contain"
          onError={(e) => { e.target.src = 'https://via.placeholder.com/200x200?text=No+Image'; }}
        />
      </div>

      {/* Title */}
      <h4 className="my-1.5 text-xs sm:text-sm font-semibold line-clamp-2 flex-grow">{title}</h4>

      {/* Stars */}
      <div className="flex my-1">
        {Array(stars).fill(null).map((_, i) => (
          <StarIcon key={`f${i}`} className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-yellow-500" />
        ))}
        {Array(5 - stars).fill(null).map((_, i) => (
          <StarIcon key={`e${i}`} className="h-3 w-3 sm:h-4 sm:w-4 text-gray-300 fill-gray-300" />
        ))}
      </div>

      {/* Price */}
      <div className="mb-0.5 font-bold text-sm sm:text-base">
        ₹{parseFloat(price).toLocaleString('en-IN')}
      </div>

      {/* Condition pill + grade label */}
      {grade && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${GRADE_STYLES[grade] || ''}`}>{grade}</span>
          <span className="text-[11px] text-gray-500">{GRADE_LABELS[grade]}</span>
        </div>
      )}

      {/* Free delivery */}
      <p className="text-[11px] text-[#007600] font-medium mb-2">FREE delivery Tomorrow</p>

      {/* Add to cart */}
      <button
        onClick={handleAdd}
        disabled={inCart}
        className={`mt-auto py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded border transition-colors
          ${inCart
            ? 'bg-gray-100 text-gray-400 cursor-default border-gray-200'
            : 'text-[#131921] border-[#f0c040] shadow-sm active:scale-95'
          }`}
        style={inCart ? {} : { background: 'linear-gradient(180deg, #ffd99e, #febd69)' }}
      >
        {inCart ? 'Added to Cart' : 'Add to Cart'}
      </button>
    </div>
  );
};

export default Product;
