import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('revive_cart') || '[]');
      // Normalize IDs to numbers and drop any items with missing IDs
      return Array.isArray(raw)
        ? raw.filter(item => item.id != null).map(item => ({ ...item, id: Number(item.id) }))
        : [];
    } catch {
      return [];
    }
  });

  const addToCart = (listing) => {
    if (listing.id == null) return;
    const nid = Number(listing.id);
    setCart((prev) => {
      if (prev.some((item) => Number(item.id) === nid)) return prev;
      const next = [...prev, { ...listing, id: nid }];
      localStorage.setItem('revive_cart', JSON.stringify(next));
      return next;
    });
  };

  const removeFromCart = (id) => {
    const nid = Number(id);
    setCart((prev) => {
      const next = prev.filter((item) => Number(item.id) !== nid);
      localStorage.setItem('revive_cart', JSON.stringify(next));
      return next;
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.setItem('revive_cart', '[]');
  };

  const cartTotal = cart.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
