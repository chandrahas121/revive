import React, { createContext, useState, useEffect, useContext } from 'react';
import { sellerLogin, sellerRegister, sellerLogout, sellerMe } from '@amazon-hackon/shared';

// Seller session — kept separate from the consumer AuthContext. The seller
// portal has its own sign-in / create-account flow and its own /api/seller/auth
// endpoints (gated on is_seller), so a logged-in shopper is not a logged-in
// seller and vice-versa.
const SellerAuthContext = createContext(null);

export const SellerAuthProvider = ({ children }) => {
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sellerMe()
      .then((res) => setSeller(res.data))
      .catch(() => setSeller(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await sellerLogin({ email, password });
    setSeller(res.data.user);
    return res.data;
  };

  const register = async (name, email, password, storeName) => {
    const res = await sellerRegister({ name, email, password, store_name: storeName });
    setSeller(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try { await sellerLogout(); } catch { /* ignore network errors on logout */ }
    setSeller(null);
  };

  return (
    <SellerAuthContext.Provider value={{ seller, loading, login, register, logout }}>
      {children}
    </SellerAuthContext.Provider>
  );
};

export const useSellerAuth = () => useContext(SellerAuthContext);
