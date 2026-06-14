import React, { useState, useRef, useCallback } from "react";
import api from "../../api/client";

/**
 * VirtualTryOn — 2D AI Virtual Try-On modal for clothing items.
 *
 * Props:
 *   garmentImage  {string}  — URL of the listing's clothing image (from ProductDetail)
 *   garmentTitle  {string}  — Name of the garment (used for garment_description)
 */
const VirtualTryOn = ({ garmentImage, garmentTitle }) => {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState("upload"); // "upload" | "processing" | "result" | "error"
  const [personPreview, setPersonPreview] = useState(null);
  const [personFile, setPersonFile] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [latency, setLatency] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setPhase("upload");
    setPersonPreview(null);
    setPersonFile(null);
    setResultImage(null);
    setErrorMsg("");
    setLatency(null);
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

      const { result_image_b64, latency_ms } = res.data;
      setResultImage(`data:image/jpeg;base64,${result_image_b64}`);
      setLatency(latency_ms);
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

  return (
    <>
      {/* Trigger button */}
      <button
        id="virtual-tryon-btn"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full py-2.5 px-4 rounded-lg border-2 border-dashed border-purple-400 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-sm transition-all hover:border-purple-500"
      >
        <span className="text-lg">👗</span>
        <span>Virtual Try-On</span>
        <span className="ml-auto text-[10px] font-normal bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">AI</span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <span className="text-xl">👗</span>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">Virtual Try-On</h2>
                  <p className="text-xs text-gray-500">Powered by IDM-VTON · AI diffusion model</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Garment preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <img
                  src={garmentImage}
                  alt={garmentTitle}
                  className="w-16 h-16 object-contain rounded-lg border bg-white"
                  onError={(e) => { e.target.src = "https://via.placeholder.com/64x64?text=Item"; }}
                />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">Trying on</p>
                  <p className="text-sm font-semibold text-gray-800 line-clamp-2">{garmentTitle}</p>
                </div>
              </div>

              {/* ── UPLOAD PHASE ─────────────────────────────────────────── */}
              {(phase === "upload" || phase === "error") && (
                <>
                  {/* Tips */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">📸 Photo tips for best results:</p>
                    <ul className="space-y-0.5 ml-3">
                      <li>• Stand straight, full body visible</li>
                      <li>• Plain or simple background</li>
                      <li>• Good lighting, arms slightly away from body</li>
                      <li>• Wear fitted clothing (not bulky layers)</li>
                    </ul>
                  </div>

                  {/* Drop zone */}
                  <div
                    id="tryon-dropzone"
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all
                      ${isDragging ? "border-purple-500 bg-purple-50" : "border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50"}`}
                  >
                    {personPreview ? (
                      <div className="flex flex-col items-center gap-2">
                        <img
                          src={personPreview}
                          alt="Your photo"
                          className="max-h-48 max-w-full rounded-lg object-contain border shadow"
                        />
                        <p className="text-xs text-gray-500">Click to change photo</p>
                      </div>
                    ) : (
                      <>
                        <div className="text-4xl">🖼️</div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-gray-700">
                            Drop your full-body photo here
                          </p>
                          <p className="text-xs text-gray-400 mt-1">or click to browse · JPG, PNG · max 10 MB</p>
                        </div>
                      </>
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
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                      <span className="text-base">⚠️</span>
                      <p>{errorMsg}</p>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    id="tryon-generate-btn"
                    onClick={handleTryOn}
                    disabled={!personFile}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                      ${personFile
                        ? "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                  >
                    {personFile ? "✨ Generate Try-On" : "Upload a photo to continue"}
                  </button>
                </>
              )}

              {/* ── PROCESSING PHASE ─────────────────────────────────────── */}
              {phase === "processing" && (
                <div className="flex flex-col items-center gap-5 py-8">
                  {/* Animated spinner */}
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-purple-600 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">👗</div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-semibold text-gray-800">AI is generating your try-on…</p>
                    <p className="text-xs text-gray-400">Using IDM-VTON diffusion model · typically 15–30 seconds</p>
                  </div>
                  {/* Progress steps */}
                  <div className="w-full space-y-2 max-w-xs">
                    {[
                      "Detecting body pose",
                      "Segmenting garment",
                      "Generating try-on with AI",
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        </div>
                        <p className="text-xs text-gray-600">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RESULT PHASE ─────────────────────────────────────────── */}
              {phase === "result" && resultImage && (
                <div className="space-y-4">
                  {/* Timing badge */}
                  {latency && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                        ✅ Generated in {(latency / 1000).toFixed(1)}s
                      </span>
                    </div>
                  )}

                  {/* Side-by-side comparison — same-height boxes, images scale to fit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Your Photo</p>
                      <div
                        className="bg-gray-50 border rounded-xl overflow-hidden flex items-center justify-center"
                        style={{ height: '420px' }}
                      >
                        <img
                          src={personPreview}
                          alt="Original"
                          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide text-center">✨ Try-On Result</p>
                      <div
                        className="bg-purple-50 border border-purple-100 rounded-xl overflow-hidden flex items-center justify-center"
                        style={{ height: '420px' }}
                      >
                        <img
                          src={resultImage}
                          alt="Virtual Try-On Result"
                          style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Disclaimer */}
                  <p className="text-[10px] text-gray-400 text-center">
                    AI-generated preview. Actual fit may vary. Results are not stored.
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2.5 rounded-xl border border-purple-300 text-purple-700 font-semibold text-sm hover:bg-purple-50 transition-colors"
                    >
                      ⬇ Download
                    </button>
                    <button
                      onClick={reset}
                      className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-colors"
                    >
                      Try Another Photo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VirtualTryOn;
