"""
ml/instance_match.py
--------------------
v2 INSTANCE-LEVEL product verification (final_idea_v2.md §4.2, fixes Q4).

The VLM/CLIP category gate in verify.py answers "is this a shoe?" — it cannot
tell a DIFFERENT shoe from THIS shoe. This module adds the fine-grained gate:
cosine similarity between the uploaded photo and the matched catalog reference
image. DINOv2 is used because it is far stronger than CLIP on fine-grained
visual distinctions (texture/shape/pattern). CLIP is the fallback.

Backends, tried in order:
  1. DINOv2  (transformers: facebook/dinov2-small)   — best fine-grained
  2. CLIP    (openai-clip / open_clip / transformers) — fallback
  3. none    → fails OPEN (checked=False) so the demo never dead-ends

Usage:
    from ml.instance_match import instance_match
    r = instance_match(uploaded_bytes, reference_bytes)
    # {match: bool, similarity: float, checked: bool, backend: str}

Threshold is calibrated via env REVIVE_INSTANCE_THRESHOLD (default 0.55 for
DINOv2 CLS-cosine). Tune with data/calibrate_clip.py-style scripts.
"""
from __future__ import annotations
import io
import logging
import os
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

_DINO_THRESHOLD = float(os.environ.get("REVIVE_INSTANCE_THRESHOLD", "0.55"))
_CLIP_THRESHOLD = float(os.environ.get("REVIVE_INSTANCE_THRESHOLD_CLIP", "0.80"))

# Lazily-initialised singletons
_dino = {"loaded": False, "model": None, "proc": None}
_clip = {"loaded": False, "model": None, "preprocess": None, "torch": None}


def _load_image(b: bytes):
    from PIL import Image
    return Image.open(io.BytesIO(b)).convert("RGB")


# ─── DINOv2 backend ───────────────────────────────────────────────────────────
def _ensure_dino() -> bool:
    if _dino["loaded"]:
        return _dino["model"] is not None
    _dino["loaded"] = True
    try:
        import torch  # noqa: F401
        from transformers import AutoImageProcessor, AutoModel
        name = os.environ.get("REVIVE_DINO_MODEL", "facebook/dinov2-small")
        _dino["proc"] = AutoImageProcessor.from_pretrained(name)
        _dino["model"] = AutoModel.from_pretrained(name)
        _dino["model"].eval()
        logger.info(f"[instance_match] DINOv2 loaded: {name}")
        return True
    except Exception as e:
        logger.warning(f"[instance_match] DINOv2 unavailable: {e}")
        _dino["model"] = None
        return False


def _dino_embed(img):
    import torch
    proc, model = _dino["proc"], _dino["model"]
    inputs = proc(images=img, return_tensors="pt")
    with torch.no_grad():
        out = model(**inputs)
    # CLS token (pooler_output if present, else mean of last_hidden_state)
    if getattr(out, "pooler_output", None) is not None:
        emb = out.pooler_output[0]
    else:
        emb = out.last_hidden_state[0].mean(dim=0)
    return emb / emb.norm()


# ─── CLIP fallback ────────────────────────────────────────────────────────────
def _ensure_clip() -> bool:
    if _clip["loaded"]:
        return _clip["model"] is not None
    _clip["loaded"] = True
    try:
        import torch
        import clip  # openai-clip
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model, preprocess = clip.load("ViT-B/32", device=device)
        model.eval()
        _clip.update({"model": model, "preprocess": preprocess, "torch": torch, "device": device})
        logger.info("[instance_match] CLIP ViT-B/32 loaded (fallback)")
        return True
    except Exception as e:
        logger.warning(f"[instance_match] CLIP unavailable: {e}")
        _clip["model"] = None
        return False


def _clip_embed(img):
    torch = _clip["torch"]
    t = _clip["preprocess"](img).unsqueeze(0).to(_clip["device"])
    with torch.no_grad():
        emb = _clip["model"].encode_image(t)[0].float()
    return emb / emb.norm()


def instance_match(
    image_bytes: bytes,
    reference_bytes: Optional[bytes],
    threshold: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Decide whether `image_bytes` shows the SAME product instance/model as
    `reference_bytes` (the catalog reference). Fails OPEN if no backend or no
    reference is available.
    """
    if not image_bytes or not reference_bytes:
        return {"match": True, "similarity": 0.0, "checked": False, "backend": "none"}

    try:
        up = _load_image(image_bytes)
        ref = _load_image(reference_bytes)
    except Exception as e:
        logger.warning(f"[instance_match] image decode failed: {e}")
        return {"match": True, "similarity": 0.0, "checked": False, "backend": "none"}

    # 1) DINOv2
    if _ensure_dino():
        try:
            sim = float((_dino_embed(up) * _dino_embed(ref)).sum().item())
            thr = threshold if threshold is not None else _DINO_THRESHOLD
            return {"match": sim >= thr, "similarity": round(sim, 4),
                    "checked": True, "backend": "dinov2", "threshold": thr}
        except Exception as e:
            logger.warning(f"[instance_match] DINOv2 inference failed: {e}")

    # 2) CLIP fallback
    if _ensure_clip():
        try:
            sim = float((_clip_embed(up) * _clip_embed(ref)).sum().item())
            thr = threshold if threshold is not None else _CLIP_THRESHOLD
            return {"match": sim >= thr, "similarity": round(sim, 4),
                    "checked": True, "backend": "clip", "threshold": thr}
        except Exception as e:
            logger.warning(f"[instance_match] CLIP inference failed: {e}")

    # 3) Nothing available → fail open
    return {"match": True, "similarity": 0.0, "checked": False, "backend": "none"}
