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

// Async seller inspect (non-blocking): submit → job_id, then poll status.
export const inspectReturnAsync = (formData) =>
  api.post('/api/grade/inspect/async/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getInspectStatus = (jobId) =>
  api.get(`/api/grade/inspect/status/${jobId}/`);

// ── Presigned uploads (browser → object storage direct) ───────────────────────
export const presignUpload = ({ filename, content_type }) =>
  api.post('/api/uploads/presign/', { filename, content_type });

// Upload a File straight to object storage via a presigned POST.
// Returns the public file URL, or null if storage isn't configured (caller then
// falls back to sending the file through Django). Django never sees the bytes.
export const uploadImageToStorage = async (file) => {
  let presign;
  try {
    const { data } = await presignUpload({
      filename: file.name,
      content_type: file.type || 'image/jpeg',
    });
    presign = data;
  } catch (err) {
    if (err.response?.status === 400) return null; // storage not configured → fallback
    throw err;
  }

  const form = new FormData();
  Object.entries(presign.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file); // the file field MUST be appended last

  // Bare fetch — not the `api` instance — so we don't send the API baseURL/cookies.
  const resp = await fetch(presign.upload_url, { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
  return presign.file_url;
};

// The helper works for any file (image OR video) — content type is driven by
// file.type. Alias for readability at call sites that upload video.
export const uploadFileToStorage = uploadImageToStorage;

// Async RETURN inspection — keeps the fraud gates (unlike the seller path).
export const inspectReturnGatedAsync = (formData) =>
  api.post('/api/grade/inspect/return/async/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// Poll an inspect job (seller or return) until the worker finishes.
// Returns the final result dict, or throws on timeout.
export const pollInspect = async (jobId, { maxMs = 150000, intervalMs = 2500 } = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let res;
    try {
      res = await getInspectStatus(jobId);
    } catch {
      continue; // transient poll error — keep trying until the ceiling
    }
    if (res.data?.status && res.data.status !== 'processing') return res.data;
  }
  throw new Error('Grading timed out');
};

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

// v2 lifecycle: turn a graded RETURN into a STAGED second-life listing (not instantly live)
export const processReturn = (payload) => api.post('/api/returns/process/', payload);
// Demo control: advance a listing to its next lifecycle stage (refurb done / demand met / sold)
export const advanceListingStage = (listingId) =>
  api.post(`/api/listings/${listingId}/advance/`, {});

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
