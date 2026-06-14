import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── Pillar 1 — AI Grading ─────────────────────────────────────────────────────
export const gradeImage = (formData) =>
  api.post('/api/grade/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const gradeAndRoute = (formData) =>
  api.post('/api/grade/route/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Multi-angle (+ optional video) return inspection with product-match fraud gate
export const inspectReturn = (formData) =>
  api.post('/api/grade/inspect/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// ── Pillar 2 — Smart Routing ──────────────────────────────────────────────────
export const routeItem = (payload) => api.post('/api/route/', payload);
export const demandGate = (payload) => api.post('/api/route/gate/', payload);
export const applyRoute = (listingId, payload) =>
  api.post(`/api/route/apply/${listingId}/`, payload);
export const getHeatmap = (category = 'Electronics') =>
  api.get('/api/route/heatmap/', { params: { category } });

// v2 — local demand from live location (storefront "Near me" + Sell It hint)
export const getLocalDemand = ({ lat, lng, geohash5, category = 'Electronics' }) =>
  api.get('/api/route/local-demand/', { params: { lat, lng, geohash5, category } });

// ── Listings (v2) ─────────────────────────────────────────────────────────────
export const getMyListings = () => api.get('/api/listings/mine/');
// action: 'delist' | 'pause' | 'relist'
export const manageListing = (listingId, action) =>
  api.post(`/api/listings/${listingId}/manage/`, { action });
export const getStorefront = (params = {}) =>
  api.get('/api/listings/', { params });   // supports lat/lng/near, condition, grade, category

// v2 (point 3): catalog match → real MRP + system-suggested resale price
export const suggestCatalog = ({ q, category, grade = 'B' }) =>
  api.get('/api/catalog/suggest/', { params: { q, category, grade } });

// ── Pillar 3 — Product Health Card ───────────────────────────────────────────
export const generateHealthCard = (payload) => api.post('/api/card/generate/', payload);
export const getHealthCard = (listingId) => api.get(`/api/card/${listingId}/`);
export const verifyHealthCard = (listingId) => api.get(`/api/card/${listingId}/verify/`);
export const getHealthCardQR = (listingId) => api.get(`/api/card/${listingId}/qr/`);
export const appendLedger = (listingId, payload) =>
  api.post(`/api/card/${listingId}/ledger/`, payload);

// ── Pillar 5 — Green Credits + Recommendations ───────────────────────────────
export const getCredits     = () => api.get('/api/credits/me/');
export const vestCredits    = () => api.post('/api/credits/vest/', {});
export const redeemCredits  = (payload) => api.post('/api/credits/redeem/', payload);
export const donateCredits  = (amount) => api.post('/api/credits/donate/', { amount });
export const getRecommendations = (n = 8) => api.get('/api/recommend/', { params: { n } });

export default api;
