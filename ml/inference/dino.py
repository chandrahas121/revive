"""
ml/inference/dino.py
--------------------
Lazy-loaded Grounding DINO (tiny) singleton for zero-shot defect detection.
No Django dependency. Importable standalone.

Usage:
    from ml.inference.dino import detect_defects
    boxes = detect_defects(image_bytes, category="Footwear")  # returns list[dict]
"""
from __future__ import annotations
import io
import math
import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── Category-specific prompts ──────────────────────────────────────────────────
# Using narrow, category-relevant phrases prevents cross-category false positives:
#   - "hole in fabric" fires on shoe lace eyelets → removed from Footwear
#   - "torn fabric" fires on knit shoe texture → removed from Footwear
#   - "crack on surface" / "dent on surface" irrelevant for soft Clothing
#
# Each category only gets prompts that make sense for that product type.

_CLOTHING_PROMPTS = [
    "stain on fabric",
    "dark stain on clothing",
    "fabric ripped open",
    "large tear in fabric",
    "hole in garment",
    "missing part",
    "worn out area",
    "discoloration on surface",
    "broken piece",
]

_FOOTWEAR_PROMPTS = [
    "scratch on surface",
    "scuff on shoe",
    "stain on surface",
    "dark stain on surface",
    "crack on sole",
    "worn out area",
    "discoloration on surface",
    "broken piece",
    "missing part",
    "damaged area",
]

_ELECTRONICS_PROMPTS = [
    "scratch on surface",
    "dent on surface",
    "crack on surface",
    "broken piece",
    "missing part",
    "damaged area",
    "discoloration on surface",
    "worn out area",
]

_DEFAULT_PROMPTS = [
    "scratch on surface",
    "dent on surface",
    "stain on fabric",
    "dark stain on clothing",
    "torn fabric",
    "large tear in fabric",
    "missing part",
    "damaged area",
    "crack on surface",
    "broken piece",
    "worn out area",
    "discoloration on surface",
    "hole in fabric",
]

_BOOKS_PROMPTS = [
    "stain on page",
    "torn page",
    "water damage on book",
    "bent cover",
    "damaged spine",
    "missing page",
    "writing on page",
    "discoloration on surface",
    "worn out area",
]

_HOME_KITCHEN_PROMPTS = [
    "dent on metal",
    "dent on surface",
    "scratch on surface",
    "stain on surface",
    "crack on surface",
    "broken piece",
    "missing part",
    "damaged area",
    "worn out area",
]

_PROMPTS_BY_CATEGORY: Dict[str, List[str]] = {
    "clothing":      _CLOTHING_PROMPTS,
    "footwear":      _FOOTWEAR_PROMPTS,
    "shoes":         _FOOTWEAR_PROMPTS,
    "electronics":   _ELECTRONICS_PROMPTS,
    "appliances":    _ELECTRONICS_PROMPTS,
    "home & kitchen":_HOME_KITCHEN_PROMPTS,
    "home & garden": _HOME_KITCHEN_PROMPTS,
    "sports":        _HOME_KITCHEN_PROMPTS,
    "toys":          _HOME_KITCHEN_PROMPTS,
    "books":         _BOOKS_PROMPTS,
}

SCORE_THRESHOLD = 0.20   # Global minimum — per-type thresholds applied below

# Per-type confidence floors (applied on top of global threshold)
PER_TYPE_MIN_CONF = {
    "stain on":      0.40,   # fires on shadows — raise high
    "dark stain":    0.28,   # weak hits are shadows/sole-marks; real stains score >=0.28
    "discoloration": 0.30,   # fires on shadows easily
    "worn out":      0.28,
    "scratch":       0.25,
    "scuff":         0.25,
    "damaged area":  0.28,
    "tear":          0.45,   # design stripes fire at lower conf; raise to suppress them
    "torn":          0.45,
    "hole":          0.40,
    "ripped":        0.40,
}

# Standalone single-word labels that GDINO produces when it half-matches a prompt.
# e.g. "fabric" from "torn fabric", "hole" from "hole in fabric", "surface" from
# "crack on surface". These are meaningless without the qualifying words.
_INVALID_STANDALONE_LABELS = {
    # Product-part words — not defect descriptions
    "fabric", "surface", "area", "part", "piece", "clothing",
    "shoe", "sole", "upper", "lace",
    # Single-word defect words that lack enough context when alone
    # (GDINO truncates "hole in fabric" → "hole", "crack on surface" → "crack", etc.)
    "hole", "crack", "stain", "scratch", "dent", "tear",
    # Size/quantity words with no defect meaning on their own
    "large", "small", "dark", "broken", "worn", "damaged",
}

# Partial labels (GDINO sometimes returns truncated text ending in a preposition)
_PARTIAL_LABEL_ENDINGS = (
    " on", " in", " at", " of", " the", " a", " an",
    "stain on",
    "crack on",
    "scratch on",
    "dent on",
    "discoloration on",
    "scuff on",
)

# GDINO sometimes produces labels that START with a preposition/article
# (e.g. "on dark stain" from "dark stain on surface", "on surface" from
# "crack on surface"). These are backwards truncations and meaningless.
_INVALID_LABEL_PREFIXES = ("on ", "at ", "in ", "of ", "the ", "a ", "an ")

# A genuine defect is localised — a bbox covering >35% of the image is the
# product boundary, not a defect (DINO sometimes boxes the entire object).
_MAX_DEFECT_AREA_PCT = 0.35

# ── lazy singleton ──────────────────────────────────────────────────────────
_processor = None
_model = None
_device = "cpu"
_load_attempted = False   # so a failed load isn't retried on every grade call


def _load_model() -> None:
    """Load Grounding DINO tiny on first call. Thread-safe via GIL.

    If the load fails (e.g. transformers/weights mismatch in this env), we record
    the attempt and DON'T retry on subsequent calls — otherwise every grading
    request re-downloads + re-initialises 978 weights only to fail again, which is
    what was making AI grading take ~1.5 min. After a failed attempt detect_defects
    returns [] immediately (grading proceeds on CLIP + heuristics)."""
    global _processor, _model, _device, _load_attempted
    if _model is not None or _load_attempted:
        return
    _load_attempted = True

    try:
        import torch
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

        _device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"[DINO] Loading on {_device}...")

        model_id = "IDEA-Research/grounding-dino-tiny"
        _processor = AutoProcessor.from_pretrained(model_id)
        _model = AutoModelForZeroShotObjectDetection.from_pretrained(
            model_id, 
            low_cpu_mem_usage=False
        ).to(_device)
        _model.eval()
        logger.info("[DINO] Model loaded.")
    except Exception as e:
        logger.error(f"[DINO] Failed to load: {e}")
        _model = None
        _processor = None


def _bbox_to_location(bbox: List[float], img_width: int, img_height: int) -> str:
    """Map a bounding-box centre to a 3×3 grid cell description."""
    x1, y1, x2, y2 = bbox
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    col = math.floor(cx / img_width * 3)
    row = math.floor(cy / img_height * 3)
    col = min(col, 2)
    row = min(row, 2)
    col_names = ["left", "center", "right"]
    row_names = ["top", "center", "bottom"]
    if row_names[row] == "center" and col_names[col] == "center":
        return "center"
    return f"{row_names[row]}-{col_names[col]}"


def _iou(b1: List[float], b2: List[float]) -> float:
    """IoU between two bboxes [x0,y0,x1,y1]."""
    ix0 = max(b1[0], b2[0])
    iy0 = max(b1[1], b2[1])
    ix1 = min(b1[2], b2[2])
    iy1 = min(b1[3], b2[3])
    inter = max(0, ix1 - ix0) * max(0, iy1 - iy0)
    if inter == 0:
        return 0.0
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    return inter / (a1 + a2 - inter)


def _filter_and_dedup(detections: List[Dict]) -> List[Dict]:
    """
    Post-process DINO detections:
      1. Drop empty or partial/standalone labels (truncated GDINO output)
      2. Drop product-boundary boxes (area > 35% of image)
      3. Apply per-type minimum confidence thresholds
      4. Confidence+area gate for tear/hole labels (pocket linings / design features)
      5. NMS: deduplicate same-type detections with high IoU
    """
    filtered = []
    for d in detections:
        label = d["label"].strip().lower()
        conf = d["confidence"]
        area_pct = d.get("bbox_area_pct", 0.0)

        # 1a. Drop empty labels
        if not label:
            continue

        # 1b. Drop subword-token artifacts (GDINO leaks BERT continuation tokens
        #     like "##uff" from "scuff" when a word straddles the prompt boundary).
        if "##" in label:
            logger.debug(f"[DINO] Dropped subword-token artifact: '{d['label']}' conf={conf:.2f}")
            continue

        # 1c. Drop standalone single-word labels (truncated DINO output)
        if label in _INVALID_STANDALONE_LABELS:
            logger.debug(f"[DINO] Dropped standalone/invalid label: '{d['label']}' conf={conf:.2f}")
            continue

        # 1d. Drop labels that start with a preposition/article
        # (GDINO "on dark stain", "on surface" — backwards truncation artifacts)
        if any(label.startswith(p) for p in _INVALID_LABEL_PREFIXES):
            logger.debug(f"[DINO] Dropped preposition-start label: '{d['label']}' conf={conf:.2f}")
            continue

        # 1e. Drop partial labels ending in a preposition/article
        is_partial = any(label == p.strip().lower() or label.endswith(p)
                         for p in _PARTIAL_LABEL_ENDINGS)
        if is_partial:
            logger.debug(f"[DINO] Dropped partial label: '{d['label']}' conf={conf:.2f}")
            continue

        # 2. Drop product-boundary boxes (bbox covers too much of the image)
        if area_pct > _MAX_DEFECT_AREA_PCT:
            logger.debug(
                f"[DINO] Dropped product-boundary box: '{d['label']}' area={area_pct:.3f}"
            )
            continue

        # 3. Per-type confidence threshold
        min_conf = SCORE_THRESHOLD
        for keyword, threshold in PER_TYPE_MIN_CONF.items():
            if keyword in label:
                min_conf = max(min_conf, threshold)
                break
        if conf < min_conf:
            logger.debug(
                f"[DINO] Below per-type threshold ({min_conf:.2f}): '{d['label']}' conf={conf:.2f}"
            )
            continue

        # 4. Confidence+area gate for tear/hole labels.
        #    Pocket linings and design features are BOTH low-confidence AND small.
        #    Real tears are either higher-confidence (>=0.30) OR cover more area (>=0.08).
        is_tear_like = any(t in label for t in ("tear", "torn", "hole", "ripped"))
        if is_tear_like:
            if conf < 0.35 and area_pct < 0.08:
                logger.debug(
                    f"[DINO] Suppressed likely design-feature false positive: "
                    f"'{d['label']}' conf={conf:.2f} area={area_pct:.3f}"
                )
                continue

            # Stripe-shape filter: design stripes are very tall and narrow (aspect ratio > 4:1).
            # Real tears are roughly equidimensional or at most 3:1.
            x0, y0, x1, y1 = d["bbox"]
            bw = max(x1 - x0, 1)
            bh = max(y1 - y0, 1)
            if bh / bw > 4.0:
                logger.debug(
                    f"[DINO] Suppressed stripe-shaped tear (design feature): "
                    f"'{d['label']}' aspect={bh/bw:.1f} conf={conf:.2f}"
                )
                continue

        filtered.append(d)

    # 5. NMS: remove duplicate same-type detections (high IoU)
    filtered.sort(key=lambda x: x["confidence"], reverse=True)
    kept = []
    for d in filtered:
        label = d["label"].strip().lower()
        bbox = d["bbox"]
        suppress = False
        for k in kept:
            k_label = k["label"].strip().lower()
            same_type = (label == k_label or
                         label in k_label or k_label in label or
                         ("stain" in label and "stain" in k_label))
            if same_type and _iou(bbox, k["bbox"]) > 0.30:
                suppress = True
                logger.debug(
                    f"[DINO] NMS suppressed: '{d['label']}' conf={d['confidence']:.2f} IoU with '{k['label']}'"
                )
                break
        if not suppress:
            kept.append(d)

    return kept


def detect_defects(image_bytes: bytes, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Run Grounding DINO on image bytes.

    Args:
        image_bytes: Raw JPEG/PNG bytes.
        category:    Product category string (e.g. "Footwear", "Clothing", "Electronics").
                     Selects a category-specific prompt set to reduce cross-category false positives.

    Returns a list of dicts:
        [{"label": str, "confidence": float, "bbox": [x1,y1,x2,y2],
          "bbox_area_pct": float, "location": str}]
    Falls back to empty list if model unavailable.
    """
    _load_model()

    if _model is None or _processor is None:
        logger.warning("[DINO] Model not available – returning empty detections.")
        return []

    # Select prompt set based on category
    cat_key = (category or "").lower().strip()
    prompts = _PROMPTS_BY_CATEGORY.get(cat_key, _DEFAULT_PROMPTS)
    logger.info(f"[DINO] Using {'category-specific' if cat_key in _PROMPTS_BY_CATEGORY else 'default'} "
                f"prompts for category='{category}' ({len(prompts)} prompts)")

    try:
        import torch
        from PIL import Image

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        w, h = image.size

        text_prompt = " . ".join(prompts) + " ."

        inputs = _processor(
            images=image,
            text=text_prompt,
            return_tensors="pt",
        ).to(_device)

        with torch.no_grad():
            outputs = _model(**inputs)

        try:
            results = _processor.post_process_grounded_object_detection(
                outputs,
                inputs["input_ids"],
                box_threshold=SCORE_THRESHOLD,
                text_threshold=SCORE_THRESHOLD,
                target_sizes=[image.size[::-1]],
            )[0]
        except TypeError:
            results = _processor.post_process_grounded_object_detection(
                outputs,
                inputs["input_ids"],
                threshold=SCORE_THRESHOLD,
                target_sizes=[image.size[::-1]],
            )[0]

        raw_detections = []
        # transformers ≥4.51 returns integer ids in "labels"; the human-readable
        # phrases move to "text_labels". Prefer text_labels so defect names stay strings.
        labels = results.get("text_labels") or results.get("labels")
        for score, label, box in zip(
            results["scores"], labels, results["boxes"]
        ):
            conf = round(float(score), 3)
            label_str = label if isinstance(label, str) else str(label)
            bbox = [round(float(v), 2) for v in box.tolist()]
            x0, y0, x1, y1 = bbox
            bbox_area_pct = ((x1 - x0) * (y1 - y0)) / (w * h)
            raw_detections.append({
                "label": label_str,
                "confidence": conf,
                "bbox": bbox,
                "bbox_area_pct": round(bbox_area_pct, 4),
                "location": _bbox_to_location(bbox, w, h),
            })

        detections = _filter_and_dedup(raw_detections)
        logger.info(
            f"[DINO] {len(raw_detections)} raw → {len(detections)} after filter "
            f"(threshold={SCORE_THRESHOLD})"
        )
        return detections

    except Exception as e:
        logger.error(f"[DINO] Inference error: {e}")
        return []
