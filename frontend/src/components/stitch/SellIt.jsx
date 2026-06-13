import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// These names must match ml/inference/dino.py _PROMPTS_BY_CATEGORY keys (lowercased)
const CATEGORIES = [
  'Electronics',   // → electronics prompts (scratches, dents, cracks)
  'Footwear',      // → footwear prompts (scuffs, sole cracks, stains)
  'Clothing',      // → clothing prompts (stains, tears, holes)
  'Home & Kitchen',
  'Books',
  'Toys',
  'Sports',
  'Beauty',
  'Jewelry',
  'Other',
];

const GRADE_CONFIG = {
  A: { label: 'Excellent',   ring: '#16a34a', bg: '#dcfce7', bar: 95 },
  B: { label: 'Good',        ring: '#d97706', bg: '#fef3c7', bar: 75 },
  C: { label: 'Fair',        ring: '#ea580c', bg: '#ffedd5', bar: 55 },
  D: { label: 'Acceptable',  ring: '#dc2626', bg: '#fee2e2', bar: 35 },
};

// Mini grade preview shown after AI grading
const GradePreview = ({ result, onDismiss }) => {
  const cfg = GRADE_CONFIG[result.grade] || GRADE_CONFIG.B;
  return (
    <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: cfg.ring + '40' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: cfg.bg }}>
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-lg"
            style={{ background: cfg.ring, color: '#fff' }}>
            {result.grade}
          </span>
          <div>
            <p className="text-xs font-bold" style={{ color: cfg.ring }}>
              AI Grade: {cfg.label}
            </p>
            <p className="text-[10px] text-gray-500">
              {Math.round((result.confidence || 0) * 100)}% confidence
              {result.from_cache ? ' · cached' : ''}
            </p>
          </div>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>

      {result.condition_summary && (
        <div className="px-3 py-2 bg-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
            AI Condition Notes
          </p>
          <p className="text-xs text-gray-700 leading-relaxed">{result.condition_summary}</p>
        </div>
      )}

      {result.defects && result.defects.length > 0 && (
        <div className="px-3 py-2 bg-gray-50 border-t flex flex-wrap gap-1.5">
          {result.defects.slice(0, 4).map((d, i) => (
            <span key={i} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
              ${d.severity === 'major' ? 'bg-red-50 text-red-700 border-red-200'
              : d.severity === 'moderate' ? 'bg-orange-50 text-orange-700 border-orange-200'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {d.type} · {d.severity}
            </span>
          ))}
        </div>
      )}

      {result.heatmap_b64 && (
        <div className="px-3 py-2 bg-gray-50 border-t">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Defect Map</p>
          <img
            src={`data:image/jpeg;base64,${result.heatmap_b64}`}
            alt="Defect heatmap"
            className="w-full rounded object-contain max-h-40"
          />
        </div>
      )}
    </div>
  );
};

const SellIt = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [conditionSummary, setConditionSummary] = useState('');

  // Grading state
  const [grading, setGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState(null);
  const [gradeError, setGradeError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const runGrading = async (file, cat) => {
    setGrading(true);
    setGradeResult(null);
    setGradeError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('category', cat);
      fd.append('operator', 'seller');
      fd.append('include_heatmap', 'true');
      const res = await api.post('/api/grade/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setGradeResult(res.data);
      // Auto-fill condition notes if user hasn't typed anything
      if (!conditionSummary && res.data.condition_summary) {
        setConditionSummary(res.data.condition_summary);
      }
    } catch (e) {
      setGradeError('AI grading unavailable — you can still submit manually.');
    } finally {
      setGrading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 10);
    setPhotos(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return urls; });
    if (files[0]) runGrading(files[0], category);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/')).slice(0, 10);
    if (!files.length) return;
    setPhotos(files);
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviewUrls((prev) => { prev.forEach((u) => URL.revokeObjectURL(u)); return urls; });
    runGrading(files[0], category);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !price) { setError('Title and price are required.'); return; }
    if (parseFloat(price) <= 0) { setError('Price must be greater than 0.'); return; }
    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('price', price);
      formData.append('condition_summary', conditionSummary.trim());
      if (photos[0]) formData.append('image', photos[0]);

      await api.post('/api/listings/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        Object.values(err.response?.data || {})[0]?.[0] ||
        'Failed to create listing. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">List an Item</h1>
          <p className="text-gray-500 text-sm mt-1">Sell your pre-loved item on Amazon Revive — AI-verified, buyer-protected.</p>
        </div>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 font-medium text-sm">
            ✓ Listing created! Redirecting to marketplace...
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">

          {/* Step 1 — Category (must come before photo so grading uses correct prompts) */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
              Step 1 — What are you selling?
            </h2>
            <p className="text-xs text-gray-400 mb-3">Select category first — AI uses it to detect the right defects.</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setCategory(c); if (photos[0]) runGrading(photos[0], c); }}
                  className={`py-2 px-3 rounded-lg border text-xs sm:text-sm font-medium transition-colors text-center
                    ${category === c
                      ? 'bg-[#232F3E] text-[#febd69] border-[#232F3E]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2 — Photo upload */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
              Step 2 — Photos <span className="text-gray-400 font-normal text-xs">(up to 10)</span>
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              Grading as <span className="font-semibold text-[#232F3E]">{category}</span> — AI analyses instantly on upload.
            </p>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-5 sm:p-8 text-center cursor-pointer hover:border-[#febd69] hover:bg-yellow-50 transition-colors"
              onClick={() => fileInputRef.current.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              {previewUrls.length === 0 ? (
                <div>
                  <div className="text-4xl sm:text-5xl mb-3">📷</div>
                  <p className="text-gray-700 font-medium text-sm">Drag and drop photos here</p>
                  <p className="text-gray-400 text-xs mt-1">or click to browse · AI grades instantly</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative aspect-square">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover rounded" />
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Cover</span>
                      )}
                    </div>
                  ))}
                  <div className="aspect-square border-2 border-dashed border-gray-200 rounded flex items-center justify-center text-gray-400 text-2xl">+</div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

            {/* Grading status */}
            {grading && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span>AI is analysing your photo — grading defects, completeness...</span>
              </div>
            )}
            {gradeError && (
              <p className="mt-2 text-xs text-amber-600">{gradeError}</p>
            )}
            {gradeResult && !grading && (
              <GradePreview result={gradeResult} onDismiss={() => setGradeResult(null)} />
            )}
          </div>

          {/* Step 3 — Item details */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-gray-800">Step 3 — Item Details</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sony WH-1000XM4 Wireless Headphones"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your item — age, usage, any accessories included..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Condition Notes
                {gradeResult && <span className="text-[10px] text-blue-500 font-normal ml-1">(auto-filled by AI — edit if needed)</span>}
              </label>
              <textarea
                value={conditionSummary}
                onChange={(e) => setConditionSummary(e.target.value)}
                placeholder="Note any scratches, dents, or missing parts honestly..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] text-sm resize-none"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3">Pricing</h2>
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-gray-500">₹</span>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                className="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69] text-lg font-bold"
                required
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">AI price suggestion available after grading (ML pipeline).</p>
          </div>

          {/* Drop-off info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 sm:p-4 flex gap-3">
            <span className="text-xl sm:text-2xl">📦</span>
            <div>
              <p className="font-semibold text-blue-800 text-xs sm:text-sm">How drop-off works</p>
              <p className="text-xs text-blue-600 mt-1">After listing, drop your item at any Amazon Locker or Kirana partner hub. Amazon verifies the condition matches your listing before it goes live. You earn when the buyer confirms receipt.</p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex-1 py-2.5 sm:py-3 border border-gray-300 rounded text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success || grading}
              className={`flex-1 py-2.5 sm:py-3 rounded font-bold text-sm transition-colors
                ${submitting || success || grading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#febd69] hover:bg-[#f3a847] text-[#131921]'}`}
            >
              {grading ? 'Grading photo...' : submitting ? 'Publishing...' : success ? 'Listed!' : 'Publish Listing'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SellIt;
