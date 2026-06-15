import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import api from "../../api/client";

/* ============================================================
 * VirtualTryOn — AI Virtual Try-On experience for clothing items.
 * Styled to match the Amazon Revive design system (navy / gold /
 * orange / teal) with a 3-phase flow:
 *   1. Upload  — split modal: product panel + photo drop zone
 *   2. Process — full-page takeover with scan animation
 *   3. Result  — full-page before/after takeover
 *
 * Fully responsive: split layout stacks on mobile, full-page
 * phases use a sticky header (always-visible close button) and
 * a sticky action footer with safe-area padding.
 *
 * Props:
 *   garmentImage  {string}  — URL of the listing's clothing image
 *   garmentTitle  {string}  — Name of the garment
 *   price         {number}  — (optional) listing price
 *   mrp           {number}  — (optional) original MRP
 *   grade         {string}  — (optional) condition grade (A-D)
 *   gradeLabel    {string}  — (optional) human readable grade label
 * ============================================================ */

/* ---- Icons ---- */
const PersonIcon = (p) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
    <circle cx="10" cy="3.5" r="3" />
    <path d="M5 9.5A5 5 0 0 1 15 9.5V14H13L12.5 18H7.5L7 14H5V9.5z" opacity=".8" />
    <path d="M5 14L3 18.5M15 14L17 18.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".4" />
  </svg>
);

const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const CheckIcon = (p) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
  </svg>
);

const ScanIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 8.8V7M12 17v-1.2M15.2 12H17M7 12h1.8" />
  </svg>
);

const SparkIcon = (p) => (
  <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const DownloadIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
  </svg>
);

const BeforeAfterIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
    <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
    <path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <line x1="12" y1="4" x2="12" y2="20" strokeDasharray="3 2" />
    <path d="M8 12l-2-2 2-2M16 12l2-2-2-2" />
  </svg>
);

/* ---- Shared data ---- */
const TIPS = [
  "Full body visible",
  "Good lighting",
  "Stand straight",
  "Plain background",
  "Fitted clothing",
  "Arms slightly out",
];

const PROCESSING_STEPS = [
  "Detecting body pose",
  "Segmenting garment",
  "Generating try-on with AI",
];

const GRADE_PILL = {
  A: "bg-green-400/15 text-green-300 border-green-400/25",
  B: "bg-[#febd69]/15 text-[#febd69] border-[#febd69]/25",
  C: "bg-orange-400/15 text-orange-300 border-orange-400/25",
  D: "bg-red-400/15 text-red-300 border-red-400/25",
};

const inr = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

const VirtualTryOn = ({ garmentImage, garmentTitle, price, mrp, grade, gradeLabel }) => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("upload"); // "upload" | "processing" | "result" | "error"
  const [personPreview, setPersonPreview] = useState(null);
  const [personFile, setPersonFile] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [resultView, setResultView] = useState("result"); // "result" | "before" | "split"
  const fileInputRef = useRef(null);

  /* Simulated (asymptotic) progress while the AI request is in flight —
     never claims 100% until the real result arrives. */
  useEffect(() => {
    if (phase !== "processing") return;
    setProgress(0);
    setStepIndex(0);
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + (96 - p) * 0.06, 96));
    }, 180);
    const t1 = setTimeout(() => setStepIndex(1), 4500);
    const t2 = setTimeout(() => setStepIndex(2), 11000);
    return () => { clearInterval(tick); clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  const reset = () => {
    setPhase("upload");
    setPersonPreview(null);
    setPersonFile(null);
    setResultImage(null);
    setErrorMsg("");
    setResultView("result");
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Image must be under 10 MB.");
      return;
    }
    setErrorMsg("");
    setPersonFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPersonPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleTryOn = async () => {
    if (!personFile) return;
    setPhase("processing");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("person_image", personFile);
      // Pass the garment as a URL — backend will fetch it
      formData.append("garment_image_url", garmentImage);
      formData.append("garment_description", garmentTitle || "clothing item");

      const res = await api.post("/api/tryon/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000, // 2 min — HF Spaces can be slow
      });

      const { result_image_b64 } = res.data;
      setProgress(100);
      setResultImage(`data:image/jpeg;base64,${result_image_b64}`);
      setPhase("result");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        "Virtual try-on service is temporarily unavailable. Please try again.";
      setErrorMsg(msg);
      setPhase("error");
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = `tryon-${garmentTitle?.replace(/\s+/g, "-") || "result"}.jpg`;
    a.click();
  };

  const savePct = mrp && mrp > price ? Math.round((1 - price / mrp) * 100) : null;

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        id="virtual-tryon-btn"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-2.5 rounded border border-[#D5D9D9] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#FF9900] hover:bg-[#FFFBF0]"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#232F3E] text-[#febd69]">
          <PersonIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#0F1111]">Virtual Try-On</span>
          <span className="block text-[11px] text-gray-500">See how it looks on you</span>
        </span>
        <span
          className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#131921]"
          style={{ background: "linear-gradient(135deg, #ffd99e, #febd69)" }}
        >
          AI
        </span>
      </button>

      {/* ══════════════ PHASE: UPLOAD / ERROR — split modal ══════════════ */}
      {open && (phase === "upload" || phase === "error") && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          {/* Always-visible floating close button — independent of inner layout */}
          <button
            onClick={handleClose}
            aria-label="Close"
            className="fixed right-3 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/70 active:scale-95 sm:right-6 sm:top-6 sm:h-9 sm:w-9 sm:bg-white sm:text-gray-500 sm:shadow-md sm:hover:bg-[#F0F2F2] sm:hover:text-gray-800"
            style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <CloseIcon className="h-4 w-4" />
          </button>

          <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[88vh] sm:max-w-3xl sm:flex-row sm:rounded-2xl sm:shadow-2xl">

            {/* Sticky header bar — spans full width, always visible */}
            <div
              className="flex flex-shrink-0 items-center gap-2.5 bg-[#232F3E] px-4 py-3 pr-14 sm:hidden"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#febd69]">
                <PersonIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight text-white">Virtual Try-On</p>
                <p className="text-[11px] text-white/40">Powered by Revive AI</p>
              </div>
            </div>

            {/* ── Left: product panel (navy) ── */}
            <div className="flex flex-shrink-0 items-center gap-3 bg-[#1F2A38] p-3 sm:w-[240px] sm:flex-col sm:items-stretch sm:gap-0 sm:p-5">
              {/* Desktop header inside panel */}
              <div className="hidden items-center justify-between sm:mb-5 sm:flex">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[#febd69]">
                    <PersonIcon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold leading-tight text-white">Virtual Try-On</p>
                    <p className="text-[10px] text-white/40">Powered by Revive AI</p>
                  </div>
                </div>
              </div>

              <p className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 sm:mb-4 sm:block">
                Now trying on
              </p>

              <img
                src={garmentImage}
                alt={garmentTitle}
                className="h-14 w-14 flex-shrink-0 rounded-lg border border-white/10 bg-white object-contain p-1 sm:aspect-square sm:h-auto sm:w-full sm:p-3"
                onError={(e) => { e.target.src = "https://via.placeholder.com/64x64?text=Item"; }}
              />

              <div className="min-w-0 sm:mt-4">
                <p className="line-clamp-2 text-sm font-bold leading-snug text-white sm:text-[14.5px]">{garmentTitle}</p>

                {grade && (
                  <div className="mt-1.5 hidden sm:block">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${GRADE_PILL[grade] || GRADE_PILL.B}`}>
                      {gradeLabel || `Grade ${grade}`}
                    </span>
                  </div>
                )}

                {price != null && (
                  <div className="mt-1 sm:mt-2.5">
                    <span className="text-sm font-extrabold text-[#febd69] sm:text-[22px]">{inr(price)}</span>
                    {savePct && (
                      <span className="ml-1.5 hidden text-[11px] text-white/35 sm:inline">
                        M.R.P. <span className="line-through">{inr(mrp)}</span> ({savePct}% off)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* AI note — desktop only */}
              <div className="mt-auto hidden items-start gap-2 rounded-md border border-[#febd69]/20 bg-[#febd69]/10 p-2.5 text-[11px] font-semibold leading-relaxed text-white/60 sm:mt-6 sm:flex">
                <SparkIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#febd69]" />
                AI body measurement &amp; garment fitting technology
              </div>
            </div>

            {/* ── Right: upload panel ── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Scrollable content */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:pt-14">
                <div>
                  <p className="text-base font-extrabold tracking-tight text-[#0F1111] sm:text-lg">Your photo</p>
                  <p className="mt-0.5 text-[13px] text-gray-500">Upload a full-body photo for the best fit result</p>
                </div>

                {/* Drop zone */}
                <div
                  id="tryon-dropzone"
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative h-80 overflow-hidden rounded-xl border-2 border-dashed transition-colors cursor-pointer sm:h-96
                    ${isDragging ? "border-[#FF9900] bg-[#FFFBF0]" : personPreview ? "border-[#D5D9D9] bg-[#F0F2F2]" : "border-[#D5D9D9] bg-[#F7F8F8] hover:border-[#FF9900] hover:bg-[#FFFBF0]"}`}
                >
                  {personPreview ? (
                    <>
                      <img
                        src={personPreview}
                        alt="Your photo"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-[#007600] px-3 py-1.5 text-xs font-extrabold text-white shadow">
                        <CheckIcon className="h-2.5 w-2.5" />
                        Photo ready
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="absolute top-3 right-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm"
                      >
                        Change photo
                      </button>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D5D9D9] bg-white">
                        <PersonIcon className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-[#0F1111]">
                          {isDragging ? "Release to upload!" : "Drop your full-body photo here"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">or tap to browse · JPG, PNG · max 10 MB</p>
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                  />
                </div>

                {/* Error */}
                {(errorMsg || phase === "error") && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#F5C6CB] bg-[#FFF2F2] p-3 text-xs text-[#CC0C39]">
                    <span className="text-base">⚠️</span>
                    <p>{errorMsg}</p>
                  </div>
                )}

                {/* Tip chips */}
                <div>
                  <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-400">Photo tips</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TIPS.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEDED] bg-[#F7F8F8] px-2.5 py-1 text-[11.5px] font-semibold text-gray-600"
                      >
                        <CheckIcon className="h-2.5 w-2.5 flex-shrink-0 text-[#007600]" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* CTA footer — sticky, always reachable */}
              <div
                className="flex-shrink-0 border-t border-[#EAEDED] bg-white p-3 sm:px-6 sm:py-4"
                style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
              >
                <button
                  id="tryon-generate-btn"
                  onClick={handleTryOn}
                  disabled={!personFile}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-bold transition-all
                    ${personFile
                      ? "border-[#e07000] text-white shadow-sm active:scale-[0.99]"
                      : "cursor-not-allowed border-[#D5D9D9] bg-[#F0F2F2] text-gray-400"}`}
                  style={personFile ? { background: "linear-gradient(180deg, #ffac31, #FF9900)" } : {}}
                >
                  {personFile ? (
                    <>
                      <ScanIcon className="h-4 w-4" />
                      Start Try-On
                    </>
                  ) : (
                    "Upload a photo to continue"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════ PHASE: PROCESSING — full-page takeover ══════════════ */}
      {open && phase === "processing" && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#F7F8F8]">
          {/* Sticky header */}
          <div
            className="flex flex-shrink-0 items-center justify-between gap-3 bg-[#232F3E] px-4 py-3"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#febd69]">
                <PersonIcon className="h-4 w-4" />
              </span>
              <p className="text-sm font-bold text-white">Virtual Try-On</p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Scan visual + progress */}
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
            <div className="relative mb-7 h-32 w-32 sm:h-36 sm:w-36">
              <svg viewBox="0 0 150 150" className="absolute inset-0 h-full w-full animate-[spin_2.7s_linear_infinite]">
                <circle cx="75" cy="75" r="68" stroke="#FF9900" strokeWidth="3" strokeDasharray="66 360" strokeLinecap="round" fill="none" opacity=".55" />
              </svg>
              <svg viewBox="0 0 150 150" className="absolute inset-0 h-full w-full animate-[spin_4.4s_linear_infinite_reverse]">
                <circle cx="75" cy="75" r="54" stroke="#febd69" strokeWidth="2" strokeDasharray="36 300" strokeLinecap="round" fill="none" opacity=".4" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <PersonIcon className="h-12 w-12 text-[#FF9900] sm:h-14 sm:w-14" />
              </div>
            </div>

            <div className="mb-6 space-y-1 text-center">
              <p className="text-xl font-extrabold tracking-tight text-[#0F1111] sm:text-2xl">Fitting your look…</p>
              <p className="text-sm text-gray-500">Revive AI is working its magic</p>
            </div>

            {/* Progress bar */}
            <div className="mb-6 w-full max-w-sm">
              <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-[#F0F2F2]">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #febd69, #FF9900)" }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{PROCESSING_STEPS[stepIndex]}</span>
                <span className="font-extrabold text-[#FF9900]">{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Step list */}
            <div className="w-full max-w-sm space-y-3">
              {PROCESSING_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-[13.5px] transition-colors
                    ${i < stepIndex ? "font-semibold text-[#007600]" : i === stepIndex ? "font-bold text-[#0F1111]" : "text-gray-400"}`}
                >
                  <div
                    className={`flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all
                      ${i < stepIndex ? "border-[#007600] bg-[#007600]"
                        : i === stepIndex ? "border-[#febd69] bg-[#232F3E]" : "border-[#D5D9D9] bg-[#F0F2F2]"}`}
                  >
                    {i < stepIndex && <CheckIcon className="h-3 w-3 text-white" />}
                    {i === stepIndex && <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#febd69]" />}
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══════════════ PHASE: RESULT — result card with before/after/split ══════════════ */}
      {open && phase === "result" && resultImage && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/65 sm:items-center sm:p-4"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div
            className="flex w-full flex-col overflow-hidden bg-white sm:rounded-2xl sm:shadow-2xl"
            style={{ maxHeight: "92dvh", maxWidth: "672px" }}
          >
            {/* Sticky header */}
            <div
              className="flex flex-shrink-0 items-center gap-3 bg-[#232F3E] px-4 py-3"
              style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#febd69]">
                <PersonIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  Virtual Try-On <span className="font-normal text-white/40">· Result</span>
                </p>
                <p className="text-[10.5px] text-white/35">Powered by Revive AI</p>
              </div>

              {/* View toggle — desktop */}
              {personPreview && (
                <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.08] p-1 sm:flex">
                  {[
                    { id: "result", label: "After" },
                    { id: "before", label: "Before" },
                    { id: "split", label: "Split" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setResultView(id)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                        resultView === id ? "bg-[#febd69] text-[#131921]" : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleClose}
                aria-label="Close"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            {/* View toggle — mobile */}
            {personPreview && (
              <div className="flex flex-shrink-0 items-center gap-1 border-b border-[#EAEDED] bg-white p-1.5 sm:hidden">
                {[
                  { id: "result", label: "After" },
                  { id: "before", label: "Before" },
                  { id: "split", label: "Split" },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setResultView(id)}
                    className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                      resultView === id ? "bg-[#232F3E] text-[#febd69]" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Garment info strip */}
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-[#EAEDED] bg-white px-4 py-2.5">
              <img
                src={garmentImage}
                alt={garmentTitle}
                className="h-10 w-10 flex-shrink-0 rounded-md border border-[#EAEDED] bg-[#F7F8F8] object-contain p-0.5"
                onError={(e) => { e.target.src = "https://via.placeholder.com/40x40?text=Item"; }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#0F1111]">{garmentTitle}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {price != null && <span className="text-xs font-bold text-[#0F1111]">{inr(price)}</span>}
                  {savePct && <span className="text-[10.5px] font-semibold text-[#CC0C39]">{savePct}% off</span>}
                  {grade && (
                    <span className={`hidden items-center rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${GRADE_PILL[grade] || GRADE_PILL.B}`}>
                      {gradeLabel || `Grade ${grade}`}
                    </span>
                  )}
                </div>
              </div>
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-extrabold text-green-700">
                <SparkIcon className="h-3 w-3 text-[#FF9900]" />
                AI Generated
              </span>
            </div>

            {/* Image area */}
            <div className="flex-1 overflow-hidden bg-[#F7F8F8]">
              {resultView === "split" && personPreview ? (
                <div className="flex h-full">
                  {/* Before */}
                  <div className="relative flex flex-1 flex-col overflow-hidden border-r border-[#EAEDED]">
                    <div className="flex-shrink-0 bg-[#1F2A38] px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/50">
                      Before
                    </div>
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F0F2F2]">
                      <img src={personPreview} alt="Before" className="h-full w-full object-contain" style={{ maxHeight: "52vh" }} />
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white">
                        Your photo
                      </span>
                    </div>
                  </div>
                  {/* After */}
                  <div className="relative flex flex-1 flex-col overflow-hidden">
                    <div
                      className="flex-shrink-0 px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-[#131921]"
                      style={{ background: "linear-gradient(135deg, #ffd99e, #febd69)" }}
                    >
                      After · AI Try-On
                    </div>
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F0F2F2]">
                      <img src={resultImage} alt="After" className="h-full w-full object-contain" style={{ maxHeight: "52vh" }} />
                      <span
                        className="absolute bottom-2 right-2 rounded px-2 py-0.5 text-[9px] font-bold text-[#131921] shadow-sm"
                        style={{ background: "linear-gradient(135deg, #ffd99e, #febd69)" }}
                      >
                        AI Try-On
                      </span>
                    </div>
                  </div>
                </div>
              ) : resultView === "before" && personPreview ? (
                <div className="flex h-full flex-col">
                  <div className="flex-shrink-0 bg-[#1F2A38] px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/50">
                    Before — Your photo
                  </div>
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F0F2F2]">
                    <img src={personPreview} alt="Your photo" className="h-full w-full object-contain" style={{ maxHeight: "56vh" }} />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="flex-shrink-0 bg-[#232F3E] px-4 py-1.5 text-[10.5px] font-extrabold uppercase tracking-widest text-[#febd69]">
                    Wearing {garmentTitle}
                  </div>
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#F0F2F2]">
                    <img src={resultImage} alt="Virtual Try-On Result" className="h-full w-full object-contain" style={{ maxHeight: "56vh" }} />
                    <span
                      className="absolute top-3 right-3 rounded px-2.5 py-1 text-[10px] font-bold text-[#131921] shadow"
                      style={{ background: "linear-gradient(135deg, #ffd99e, #febd69)" }}
                    >
                      AI Try-On
                    </span>
                    {personPreview && (
                      <button
                        onClick={() => setResultView("split")}
                        className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                      >
                        <BeforeAfterIcon className="h-3.5 w-3.5" />
                        Compare
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <p className="flex-shrink-0 bg-[#F7F8F8] py-1.5 text-center text-[10.5px] text-gray-400">
              AI-generated preview. Actual fit may vary. Results are not stored.
            </p>

            {/* Footer actions */}
            <div
              className="flex flex-shrink-0 gap-2 border-t border-[#EAEDED] bg-white p-3 sm:px-5 sm:py-4"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#D5D9D9] py-2.5 text-sm font-bold text-[#007185] transition-colors hover:bg-[#F7F8F8]"
              >
                <DownloadIcon className="h-4 w-4" />
                Download
              </button>
              <button
                onClick={reset}
                className="flex-1 rounded-lg border border-[#e07000] py-2.5 text-sm font-bold text-white shadow-sm transition-all active:scale-[0.99]"
                style={{ background: "linear-gradient(180deg, #ffac31, #FF9900)" }}
              >
                Try Another Photo
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default VirtualTryOn;
