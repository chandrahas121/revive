"""
ml/grade.py
-----------
Main grading pipeline — the primary Track A deliverable.

Public interface:
    grade_image(image_bytes, product_id, operator, reference_bytes=None) -> dict
    grade_video(video_path, product_id, operator) -> dict

Pipeline per image:
  1. SHA-256 cache check (Redis in prod / file in dev)
  2. Grounding DINO zero-shot defect detection → bounding boxes
  3. CLIP cosine(uploaded, reference) → completeness score
  4. LLM caption (OpenRouter/Claude/Bedrock/local) → grade/defects/summary
  5. Grading head: fuse DINO + CLIP + LLM → final grade A-D + confidence
  6. Cache & return result

Target latency: <2s (cached: ~0ms, uncached GPU: ~1.5s, CPU: ~4s)
"""
from __future__ import annotations
import hashlib
import logging
import time
import uuid
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

# ─── Grade → numerical severity weight mapping ─────────────────────────────
_GRADE_WEIGHTS = {"A": 1.0, "B": 0.75, "C": 0.5, "D": 0.25}
_SEVERITY_WEIGHTS = {"minor": 0.2, "moderate": 0.5, "severe": 1.0}

# Mapping: (defect_count, severity_max) → grade override floor
# Keeps the LLM grade honest when DINO finds obvious severe defects
_SEVERE_OVERRIDE: Dict[str, str] = {
    # if LLM says A but DINO found a severe defect → downgrade to B
}


# Defect types that are structurally severe at any noticeable size
_SEVERE_DEFECT_LABELS = {
    "torn fabric", "large tear", "large tear in fabric",
    "hole in fabric", "damaged area", "missing part"
}


def _severity_from_bbox(
    bbox_area_pct: float, dino_conf: float, label: str = "", category: Optional[str] = None
) -> str:
    """
    Determine defect severity from bbox area + label type + product category.

    The same physical defect size means different things per category:
      - Electronics: a small screen scratch is serious (tight thresholds)
      - Footwear: scuffs are expected wear (loose thresholds)
      - Clothing/default: moderate thresholds

    Structural defects (torn, hole, missing part) are severe at low area in all categories.
    """
    label_lower = label.lower()
    is_structural = any(s in label_lower for s in [
        "torn", "tear", "hole", "missing", "damaged", "large tear"
    ])

    # Structural defects are severe at a much lower area threshold (category-independent)
    if is_structural and bbox_area_pct > 0.04:
        return "severe"

    cat = (category or "").lower().strip()

    # Electronics/appliances — surfaces and screens; small defects matter more
    if cat in ("electronics", "appliances"):
        if bbox_area_pct > 0.10:
            return "severe"
        elif bbox_area_pct > 0.02:
            return "moderate"
        elif bbox_area_pct > 0.005 and dino_conf > 0.30:
            return "moderate"
        return "minor"

    # Footwear — scuffs/wear are expected; require larger area for higher severity
    if cat in ("footwear", "shoes"):
        if bbox_area_pct > 0.22:
            return "severe"
        elif bbox_area_pct > 0.08:
            return "moderate"
        return "minor"

    # Clothing / default
    if bbox_area_pct > 0.15:
        return "severe"
    elif bbox_area_pct > 0.05:
        return "moderate"
    elif bbox_area_pct > 0.02 and dino_conf > 0.35:
        return "moderate"
    else:
        return "minor"


def _compute_grading_head(
    llm_result: dict,
    dino_detections: List[dict],
    completeness: float,
    category: Optional[str] = None,
) -> dict:
    """
    Fuse LLM caption, DINO boxes, and CLIP completeness into final grade.

    Severity is determined by BBOX AREA (fraction of image), not DINO confidence.

    Override rules (applied after LLM grade):
      - Any DINO severe defect (bbox > 15% image)  → grade ≤ C, confidence ≤ 0.65
      - ≥2 DINO severe defects                     → grade = D, confidence ≤ 0.55
      - LLM says severe defect explicitly           → grade ≤ C
      - Completeness < 0.50                         → grade ≤ C
      - Completeness < 0.70 and grade A             → grade ≤ B
    """
    grade = llm_result.get("grade", "C")
    confidence = float(llm_result.get("confidence", 0.6))
    defects = llm_result.get("defects", [])

    # Build enriched DINO detections with area-based severity
    enriched_dino = []
    for d in dino_detections:
        area_pct = d.get("bbox_area_pct", 0.0)
        sev = _severity_from_bbox(area_pct, d.get("confidence", 0), d.get("label", ""), category)
        enriched_dino.append({**d, "severity": sev})

    # Count by severity
    n_severe   = sum(1 for d in enriched_dino if d["severity"] == "severe")
    n_moderate = sum(1 for d in enriched_dino if d["severity"] == "moderate")

    # ── Grade override rules ──────────────────────────────────────────────────
    # Industry 4-tier taxonomy:
    #   A = Like New, B = Very Good, C = Good (visible but minor), D = Heavy damage
    grade_order = {"A": 4, "B": 3, "C": 2, "D": 1}

    # Check for structural DINO defects (torn, hole, large tear).
    # Shape + threshold filtering in dino.py already removes pocket linings /
    # design elements before they reach here.
    structural_labels = {"torn", "tear", "hole", "missing", "damaged"}
    has_structural_severe = any(
        d["severity"] == "severe" and
        any(s in d.get("label", "").lower() for s in structural_labels)
        for d in enriched_dino
    )

    # Rule 1: Structural severe defect (large tear, hole) → D directly
    # A shirt with a large tear is NOT "Good" (C) — it's "Heavy damage" (D)
    if has_structural_severe:
        grade = "D"
        confidence = min(confidence, 0.60)
        logger.info("[grade_head] Downgraded to D: structural severe defect (torn/hole)")

    # Rule 1b: Any other severe defect (e.g. large dent, crack) → at most C
    elif n_severe >= 1 and grade_order.get(grade, 0) > grade_order["C"]:
        grade = "C"
        confidence = min(confidence, 0.65)
        logger.info(f"[grade_head] Downgraded to C: {n_severe} severe DINO detections")

    # Rule 2: Multiple severe defects of any type → D
    if n_severe >= 2 and grade != "D":
        grade = "D"
        confidence = min(confidence, 0.55)
        logger.info(f"[grade_head] Downgraded to D: {n_severe} severe detections")

    # Rule 3: LLM explicitly flagged structural damage (torn, hole, missing)
    structural_llm_types = {"tear", "torn", "hole", "rip", "missing_part"}
    llm_structural = any(
        any(s in d.get("type", "").lower() for s in structural_llm_types)
        for d in defects
        if d.get("source") != "dino"
    )
    if llm_structural and grade == "C" and n_severe >= 1:
        # DINO confirmed structural + LLM saw it too → keep D or push to D
        grade = "D"
        confidence = min(confidence, 0.60)

    # Rule 4: Low completeness
    if completeness < 0.50 and grade_order.get(grade, 0) > grade_order["C"]:
        grade = "C"
        confidence = min(confidence, 0.65)
    elif completeness < 0.70 and grade == "A":
        grade = "B"
        confidence = min(confidence, 0.80)

    # Rule 5: Multi-defect confidence penalty
    total_defects = len(defects) + len(enriched_dino)
    if total_defects >= 4 and n_severe >= 1:
        confidence = min(confidence, 0.55)   # heavy damage
    elif total_defects >= 3 and n_moderate >= 1:
        confidence = min(confidence, 0.62)
    elif total_defects >= 2:
        confidence = min(confidence, 0.72)

    # ── Merge DINO detections into defects list (with correct severity + bbox) ─
    # Build a set of LLM defect types (normalized) for dedup
    llm_labels = {d.get("type", "").lower().strip() for d in defects}
    for d in enriched_dino:
        dino_label = d["label"].lower().strip()
        # Require strong match: exact OR DINO label is a meaningful substring
        # Prevent "fabric" matching "fabric_damage" (too broad)
        already_covered = any(
            dino_label == ll or
            (len(dino_label) >= 6 and ll.startswith(dino_label) and ll != dino_label) or
            (len(dino_label) >= 6 and dino_label.startswith(ll) and dino_label != ll)
            for ll in llm_labels
        )
        if d.get("confidence", 0) > 0.20 and not already_covered:
            defects.append(
                {
                    "type": d["label"],
                    "severity": d["severity"],
                    "location": d.get("location", "unknown"),
                    "bbox": d.get("bbox"),
                    "bbox_area_pct": d.get("bbox_area_pct"),
                    "source": "dino",
                }
            )
            llm_labels.add(dino_label)

    # Enrich LLM defects that match a DINO detection with its bbox
    for defect in defects:
        if defect.get("bbox") is None:
            for d in enriched_dino:
                dino_label = d["label"].lower()
                defect_type = defect.get("type", "").lower()
                # Strong match only: avoid "fabric" enriching "fabric_damage" incorrectly
                is_match = (
                    dino_label == defect_type or
                    (len(dino_label) >= 6 and dino_label in defect_type) or
                    (len(defect_type) >= 6 and defect_type in dino_label)
                )
                if is_match:
                    defect["bbox"] = d.get("bbox")
                    defect["bbox_area_pct"] = d.get("bbox_area_pct")
                    sev_rank = {"minor": 1, "moderate": 2, "severe": 3}
                    if sev_rank.get(d["severity"], 0) > sev_rank.get(defect.get("severity"), 0):
                        defect["severity"] = d["severity"]
                    break

    # Post-merge dedup: drop defects sharing the same bbox (different sources)
    seen_bboxes: dict = {}
    deduped = []
    for defect in defects:
        bbox = defect.get("bbox")
        if bbox is not None:
            key = tuple(round(v) for v in bbox)
            if key in seen_bboxes:
                # Keep highest-severity entry
                sev_rank = {"minor": 1, "moderate": 2, "severe": 3}
                existing = seen_bboxes[key]
                if sev_rank.get(defect.get("severity"), 0) > sev_rank.get(existing.get("severity"), 0):
                    deduped.remove(existing)
                    deduped.append(defect)
                    seen_bboxes[key] = defect
                # else keep existing, skip this one
                continue
            seen_bboxes[key] = defect
        deduped.append(defect)
    defects = deduped

    return {
        "grade": grade,
        "confidence": round(min(1.0, max(0.0, confidence)), 3),
        "defects": defects,
        "completeness": round(completeness, 3),
        "n_dino_detections": len(dino_detections),
    }


def grade_image(
    image_bytes: bytes,
    product_id: str = "unknown",
    operator: str = "self",
    reference_bytes: Optional[bytes] = None,
    category: Optional[str] = None,
    use_cache: bool = True,
) -> dict:
    """
    Grade a single product image.

    Args:
        image_bytes:     Raw JPEG/PNG bytes of the product photo.
        product_id:      Amazon ASIN or internal product ID (used for reference lookup).
        operator:        "self" | "agent" | "seller" — affects confidence floor.
        reference_bytes: Catalog reference image bytes for CLIP completeness.
                         If None, completeness defaults to 0.80.
        use_cache:       Check/write SHA-256 file cache (default True).

    Returns:
        {
          "listing_id": str (ephemeral UUID if no listing exists yet),
          "grade": "A|B|C|D",
          "confidence": float,
          "defects": [{type, severity, location, bbox?, source?}],
          "completeness": float,
          "condition_summary": str,
          "functional": bool,
          "box_present": bool,
          "latency_ms": int,
          "model_version": str,
          "image_hash": str,
        }
    """
    t_start = time.monotonic()

    # Accept file path strings as well as raw bytes
    if isinstance(image_bytes, str):
        import pathlib
        p = pathlib.Path(image_bytes)
        if p.exists():
            image_bytes = p.read_bytes()
        else:
            raise FileNotFoundError(f"grade_image: file not found: {image_bytes}")

    # 1. Cache check
    image_hash = hashlib.sha256(image_bytes).hexdigest()
    if use_cache:
        from ml.captioner import _load_cache
        cache = _load_cache()
        key = image_hash[:24]
        if key in cache:
            cached = dict(cache[key])
            cached["from_cache"] = True
            cached["latency_ms"] = 0
            return cached

    # ── CLIP completeness runs in parallel with DINO+Claude ───────────────────
    # CLIP is independent of DINO/Claude, so we overlap it (ref fetch + 2 embeddings)
    # under the DINO→Claude critical path instead of running it sequentially.
    def _clip_completeness() -> float:
        comp = 0.80  # neutral fallback only if catalog fetch fails
        ref = reference_bytes
        if ref is None and category:
            try:
                from ml.catalog import get_reference_bytes
                ref = get_reference_bytes(category)
                if ref:
                    logger.info(f"[grade] Using catalog reference for category: {category}")
            except Exception as e:
                logger.warning(f"[grade] Catalog fetch failed: {e}")
        if ref:
            try:
                from ml.inference.clip_model import compute_completeness
                comp = compute_completeness(image_bytes, ref)
                logger.info(f"[grade] CLIP completeness: {comp:.3f}")
            except Exception as e:
                logger.error(f"[grade] CLIP completeness failed: {e}")
        return comp

    from concurrent.futures import ThreadPoolExecutor
    executor = ThreadPoolExecutor(max_workers=1)
    clip_future = executor.submit(_clip_completeness)

    # 2. DINO defect detection (pass category for category-specific prompts)
    try:
        from ml.inference.dino import detect_defects
        dino_detections = detect_defects(image_bytes, category=category)
    except Exception as e:
        logger.error(f"[grade] DINO failed: {e}")
        dino_detections = []

    # 3. LLM caption (primary intelligence; consumes DINO detections as context)
    try:
        from ml.captioner import caption
        llm_result = caption(image_bytes, dino_detections)
    except Exception as e:
        logger.error(f"[grade] Captioner failed: {e}")
        llm_result = {
            "grade": "C",
            "confidence": 0.4,
            "defects": [],
            "completeness": 0.80,
            "condition_summary": "Automated grading temporarily unavailable.",
            "box_present": False,
            "functional": True,
        }

    # 4. Join CLIP completeness (already computed in parallel above)
    try:
        completeness = clip_future.result()
    except Exception as e:
        logger.error(f"[grade] CLIP task failed: {e}")
        completeness = 0.80
    finally:
        executor.shutdown(wait=False)

    # 5. Grading head — fuse all signals
    fused = _compute_grading_head(llm_result, dino_detections, completeness, category=category)

    latency_ms = round((time.monotonic() - t_start) * 1000)

    result = {
        "listing_id": str(uuid.uuid4()),
        "grade": fused["grade"],
        "confidence": fused["confidence"],
        "defects": fused["defects"],
        "completeness": fused["completeness"],
        "condition_summary": llm_result.get("condition_summary", ""),
        "functional": llm_result.get("functional", True),
        "box_present": llm_result.get("box_present", False),
        "latency_ms": latency_ms,
        "model_version": "revive-grade-v1.0",
        "image_hash": image_hash[:24],
        "n_dino_detections": fused["n_dino_detections"],
        "from_cache": False,
    }

    # 6. Write to cache
    if use_cache:
        from ml.captioner import _load_cache, _save_cache
        cache = _load_cache()
        cache[image_hash[:24]] = result
        _save_cache(cache)

    return result


def _aggregate_frame_results(frame_results: List[dict], source: str) -> dict:
    """
    Aggregate per-frame/per-image grade results into a single verdict.

    Rules:
      - Worst grade wins (A > B > C > D — most damage takes precedence)
      - Defects: union across all frames, keeping highest severity per type
      - Confidence/completeness: average across frames
      - condition_summary: from the highest-confidence frame
      - functional: True only if ALL frames say functional
      - box_present: True if ANY frame detected a box
    """
    grade_order = {"A": 4, "B": 3, "C": 2, "D": 1}
    sev_rank = {"minor": 1, "moderate": 2, "severe": 3}

    grades = [r["grade"] for r in frame_results]
    worst_grade = min(grades, key=lambda g: grade_order.get(g, 0))

    all_defects: Dict[str, dict] = {}
    for r in frame_results:
        for d in r.get("defects", []):
            dtype = d.get("type", "other")
            if dtype not in all_defects or sev_rank.get(d.get("severity"), 0) > sev_rank.get(
                all_defects[dtype].get("severity"), 0
            ):
                all_defects[dtype] = d

    best_frame = max(frame_results, key=lambda r: r.get("confidence", 0))
    avg_confidence = sum(r.get("confidence", 0) for r in frame_results) / len(frame_results)
    avg_completeness = sum(r.get("completeness", 0) for r in frame_results) / len(frame_results)
    total_latency = sum(r.get("latency_ms", 0) for r in frame_results)

    return {
        "listing_id": str(uuid.uuid4()),
        "grade": worst_grade,
        "confidence": round(avg_confidence, 3),
        "defects": list(all_defects.values()),
        "completeness": round(avg_completeness, 3),
        "condition_summary": best_frame.get("condition_summary", ""),
        "functional": all(r.get("functional", True) for r in frame_results),
        "box_present": any(r.get("box_present", False) for r in frame_results),
        "latency_ms": total_latency,
        "model_version": "revive-grade-v1.0",
        "source": source,
        "frames_sampled": len(frame_results),
        "per_frame_grades": grades,
        "from_cache": False,
    }


def grade_multi_image(
    images: List[bytes],
    product_id: str = "unknown",
    operator: str = "self",
    reference_bytes: Optional[bytes] = None,
    category: Optional[str] = None,
) -> dict:
    """
    Grade a product from multiple angle photos (e.g. front, back, sides).

    Each image is graded independently in parallel, then results are aggregated
    with worst-grade-wins logic so no defect angle is missed.

    Args:
        images:          List of raw JPEG/PNG bytes (one per angle/photo).
        product_id:      ASIN or internal ID.
        operator:        "self" | "agent" | "seller".
        reference_bytes: Catalog reference for CLIP completeness.
        category:        Product category string (e.g. "Footwear").

    Returns:
        Same schema as grade_image() plus:
        {
          "source": "multi_image",
          "frames_sampled": int,         # number of photos graded
          "per_frame_grades": [list],    # grade per photo in input order
        }
    """
    if not images:
        return {
            "error": "No images provided",
            "grade": "C",
            "confidence": 0.3,
            "defects": [],
            "completeness": 0.75,
            "condition_summary": "No images to grade.",
            "latency_ms": 0,
            "model_version": "revive-grade-v1.0",
            "source": "multi_image",
            "frames_sampled": 0,
        }

    from concurrent.futures import ThreadPoolExecutor

    def _grade_one(img_bytes: bytes) -> dict:
        return grade_image(
            img_bytes,
            product_id=product_id,
            operator=operator,
            reference_bytes=reference_bytes,
            category=category,
            use_cache=True,
        )

    # Grade all images in parallel (each already parallelises CLIP internally)
    with ThreadPoolExecutor(max_workers=min(len(images), 4)) as pool:
        frame_results = list(pool.map(_grade_one, images))

    return _aggregate_frame_results(frame_results, source="multi_image")


def grade_video(
    video_path: str,
    product_id: str = "unknown",
    operator: str = "self",
    reference_bytes: Optional[bytes] = None,
    category: Optional[str] = None,
    n_frames: int = 5,
) -> dict:
    """
    Grade a short video clip by sampling frames and aggregating results.

    Args:
        video_path: Path to the video file (MP4, MOV, AVI).
        n_frames:   Number of frames to sample (default 5).

    Returns:
        Same schema as grade_image() but with video-specific fields:
        {
          ...grade_image fields...,
          "source": "video",
          "frames_sampled": int,
          "per_frame_grades": [list of grade letters],
        }
    """
    from ml.video_sampler import sample_frames

    frames = sample_frames(video_path, n_frames)
    if not frames:
        logger.error(f"[grade_video] No frames extracted from {video_path}")
        return {
            "error": "Could not extract frames from video",
            "grade": "C",
            "confidence": 0.3,
            "defects": [],
            "completeness": 0.75,
            "condition_summary": "Video processing failed.",
            "latency_ms": 0,
            "model_version": "revive-grade-v1.0",
            "source": "video",
            "frames_sampled": 0,
        }

    frame_results = [
        grade_image(
            frame_bytes,
            product_id=product_id,
            operator=operator,
            reference_bytes=reference_bytes,
            category=category,
            use_cache=True,
        )
        for frame_bytes in frames
    ]

    return _aggregate_frame_results(frame_results, source="video")
