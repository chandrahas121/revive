"""
ml/inference/clip_model.py
--------------------------
Lazy-loaded CLIP singleton for:
  1. Computing completeness score: cosine similarity between uploaded image
     and catalog reference image.
  2. Generating CLIP embeddings for use in the hybrid recommender.

No Django dependency.
"""
from __future__ import annotations
import io
import logging
import numpy as np
from typing import List, Optional

logger = logging.getLogger(__name__)

_clip_model = None
_clip_preprocess = None
_device = "cpu"


def _load_clip() -> None:
    global _clip_model, _clip_preprocess, _device
    if _clip_model is not None:
        return
    try:
        import torch
        import clip  # openai-clip

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"[CLIP] Loading ViT-B/32 on {_device}...")
        _clip_model, _clip_preprocess = clip.load("ViT-B/32", device=_device)
        _clip_model.eval()
        logger.info("[CLIP] Model loaded.")
    except ImportError:
        logger.warning("[CLIP] openai-clip not installed. Trying open_clip...")
        _load_open_clip()
    except Exception as e:
        logger.error(f"[CLIP] Failed to load: {e}")


def _load_open_clip() -> None:
    """Fallback: use open_clip if openai-clip is unavailable."""
    global _clip_model, _clip_preprocess, _device
    try:
        import torch
        import open_clip

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        _clip_model, _, _clip_preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="openai"
        )
        _clip_model = _clip_model.to(_device)
        _clip_model.eval()
        logger.info("[CLIP] open_clip model loaded as fallback.")
    except Exception as e:
        logger.error(f"[CLIP] open_clip also failed: {e}")
        _clip_model = None


def get_image_embedding(image_bytes: bytes) -> Optional[np.ndarray]:
    """
    Return a normalized CLIP embedding (512-dim float32 ndarray) for the image.
    Returns None if CLIP is unavailable.
    """
    _load_clip()
    if _clip_model is None:
        return None

    try:
        import torch
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _clip_preprocess(image).unsqueeze(0).to(_device)

        with torch.no_grad():
            emb = _clip_model.encode_image(tensor)
            emb = emb / emb.norm(dim=-1, keepdim=True)

        return emb.squeeze(0).cpu().numpy().astype(np.float32)
    except Exception as e:
        logger.error(f"[CLIP] Embedding error: {e}")
        return None


# ── Completeness calibration ─────────────────────────────────────────────────
# Empirically measured CLIP ViT-B/32 image-image cosine vs a *generic category*
# reference (data/calibrate_clip.py):
#   good items (same category):  0.68 – 0.99
#   wrong item / wrong category: 0.48 – 0.57
# A raw cosine of ~0.85 looks "high" but is meaningless without rescaling, which
# is why the old (cos+1)/2 mapping compressed everything to 0.8-0.9 and never
# influenced the grade. We linearly map the meaningful band so that:
#   - good items   → completeness >= 0.70  (above downgrade thresholds)
#   - wrong items  → completeness <  0.50  (triggers grade <= C)
# Map:  completeness = (cosine - LO) / (HI - LO), clamped to [0, 1]
_COMPLETENESS_COSINE_LO = 0.22   # cosine at/below this → completeness 0.0 (definitely wrong item)
_COMPLETENESS_COSINE_HI = 0.88   # cosine at/above this → completeness 1.0 (matches reference)


def compute_completeness(
    uploaded_bytes: bytes, reference_bytes: bytes
) -> float:
    """
    Completeness score: how well the uploaded image matches the catalog reference.

    Low scores flag a wrong item, wrong category, or major missing content.
    Returns float in [0, 1]. Returns 0.75 as neutral fallback if CLIP unavailable.

    The raw CLIP cosine is rescaled (see calibration constants above) so the
    score has a real spread and only drops below 0.50 for genuine mismatches —
    ordinary good products stay >= 0.70 and are not penalised.
    """
    emb_uploaded = get_image_embedding(uploaded_bytes)
    emb_ref = get_image_embedding(reference_bytes)

    if emb_uploaded is None or emb_ref is None:
        logger.warning("[CLIP] Completeness fallback 0.75 (model unavailable)")
        return 0.75

    cosine = float(np.dot(emb_uploaded, emb_ref))
    completeness = (cosine - _COMPLETENESS_COSINE_LO) / (
        _COMPLETENESS_COSINE_HI - _COMPLETENESS_COSINE_LO
    )
    logger.debug(f"[CLIP] cosine={cosine:.3f} → completeness={completeness:.3f}")
    return max(0.0, min(1.0, completeness))


def cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    """Utility: cosine similarity between two L2-normalized vectors."""
    return float(np.dot(a, b))
