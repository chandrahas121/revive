import React, { createContext, useContext, useState } from 'react';

// Shared UI state for the Seller Central shell: the left menu flyout, the
// Health Card modal, and per-session "relisted / review decision / SAFE-T
// submitted" flags that persist as the user navigates between routes.
const Ctx = createContext(null);

export const SellerUIProvider = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCat, setMenuCat] = useState('Inventory');
  const [hcOpen, setHcOpen] = useState(null);         // health-card case id or null
  const [relisted, setRelisted] = useState({});       // { caseId: true }
  const [reviewDecision, setReviewDecision] = useState({}); // { reviewId: 'accept'|'override' }
  const [safetSubmitted, setSafetSubmitted] = useState({}); // { safetId: true }

  const value = {
    menuOpen, setMenuOpen,
    toggleMenu: () => setMenuOpen((v) => !v),
    menuCat, setMenuCat,
    hcOpen, openHealthCard: (id) => setHcOpen(id), closeHealthCard: () => setHcOpen(null),
    relisted, confirmRelist: (id) => setRelisted((s) => ({ ...s, [id]: true })),
    reviewDecision, decideReview: (id, d) => setReviewDecision((s) => ({ ...s, [id]: d })),
    safetSubmitted, submitSafet: (id) => setSafetSubmitted((s) => ({ ...s, [id]: true })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useSellerUI = () => useContext(Ctx);
