import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('revive_cart') || '[]');
      return Array.isArray(raw)
        ? raw.filter(item => item.id != null).map(item => ({
            ...item,
            id: Number(item.id),
            qty: item.qty || 1,
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

  const addToCart = (listing, qty = 1) => {
    if (listing.id == null) return;
    const nid = Number(listing.id);
    setCart((prev) => {
      const existing = prev.find((item) => Number(item.id) === nid);
      if (existing) {
        // Second-life items are unique — never bump qty
        if (existing.source && existing.source !== 'new') return prev;
        const maxQty = existing.maxStock || 99;
        const newQty = Math.min(existing.qty + qty, maxQty);
        if (newQty === existing.qty) return prev;
        const next = prev.map((item) =>
          Number(item.id) === nid ? { ...item, qty: newQty } : item
        );
        return persist(next);
      }
      const next = [...prev, { ...listing, id: nid, qty }];
      return persist(next);
    });
  };

  const updateQuantity = (id, newQty) => {
    const nid = Number(id);
    setCart((prev) => {
      if (newQty <= 0) {
        const next = prev.filter((item) => Number(item.id) !== nid);
        return persist(next);
      }
      const next = prev.map((item) => {
        if (Number(item.id) !== nid) return item;
        const maxQty = item.maxStock || 99;
        return { ...item, qty: Math.min(newQty, maxQty) };
      });
      return persist(next);
    });
  };

  const removeFromCart = (id) => {
    const nid = Number(id);
    setCart((prev) => {
      const next = prev.filter((item) => Number(item.id) !== nid);
      return persist(next);
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.setItem('revive_cart', '[]');
  };

  const getItemQty = (id) => {
    const nid = Number(id);
    const item = cart.find((i) => Number(i.id) === nid);
    return item ? item.qty : 0;
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
