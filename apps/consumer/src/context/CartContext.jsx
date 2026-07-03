import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

// A cart LINE is identified by listing id + chosen size, so the same product added
// in two sizes (a classic return-driving "size hedge") becomes two separate lines —
// which is what lets checkout detect bracketeering. Items without a size (electronics,
// one-of-a-kind second-life) collapse to a single line per id as before.
const lineKey = (id, size) => `${Number(id)}::${size == null ? '' : size}`;

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('revive_cart') || '[]');
      return Array.isArray(raw)
        ? raw.filter(item => item.id != null).map(item => ({
            ...item,
            id: Number(item.id),
            qty: item.qty || 1,
            lineKey: item.lineKey || lineKey(item.id, item.size),
          }))
        : [];
    } catch {
      return [];
    }
  });

  const persist = (next) => {
    localStorage.setItem('revive_cart', JSON.stringify(next));
    return next;
  };

  // Callers may pass either a lineKey or a bare listing id. Resolve to a concrete
  // line so id-based callers (e.g. the product page +/- controls) keep working.
  const resolveKey = (cartArr, keyOrId) => {
    const k = String(keyOrId);
    if (cartArr.some((it) => it.lineKey === k)) return k;
    const byId = cartArr.find((it) => Number(it.id) === Number(keyOrId));
    return byId ? byId.lineKey : k;
  };

  const addToCart = (listing, qty = 1) => {
    if (listing.id == null) return;
    const nid = Number(listing.id);
    const key = lineKey(nid, listing.size);
    setCart((prev) => {
      const existing = prev.find((item) => item.lineKey === key);
      if (existing) {
        // Second-life items are unique — never bump qty
        if (existing.source && existing.source !== 'new') return prev;
        const maxQty = existing.maxStock || 99;
        const newQty = Math.min(existing.qty + qty, maxQty);
        if (newQty === existing.qty) return prev;
        const next = prev.map((item) =>
          item.lineKey === key ? { ...item, qty: newQty } : item
        );
        return persist(next);
      }
      const next = [...prev, { ...listing, id: nid, qty, lineKey: key }];
      return persist(next);
    });
  };

  const updateQuantity = (idOrKey, newQty) => {
    setCart((prev) => {
      const key = resolveKey(prev, idOrKey);
      if (newQty <= 0) {
        const next = prev.filter((item) => item.lineKey !== key);
        return persist(next);
      }
      const next = prev.map((item) => {
        if (item.lineKey !== key) return item;
        const maxQty = item.maxStock || 99;
        return { ...item, qty: Math.min(newQty, maxQty) };
      });
      return persist(next);
    });
  };

  const removeFromCart = (idOrKey) => {
    setCart((prev) => {
      const key = resolveKey(prev, idOrKey);
      const next = prev.filter((item) => item.lineKey !== key);
      return persist(next);
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.setItem('revive_cart', '[]');
  };

  const getItemQty = (id) => {
    const nid = Number(id);
    // Sum across all size-lines of this product so the product-page "in cart"
    // indicator reflects every size the shopper added.
    return cart.reduce((s, i) => (Number(i.id) === nid ? s + (i.qty || 1) : s), 0);
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + parseFloat(item.price || 0) * (item.qty || 1),
    0
  );

  const cartItemCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, updateQuantity,
      clearCart, cartTotal, cartItemCount, getItemQty,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
