"""
ml/heatmap.py
-------------
Defect heatmap overlay renderer — Phoenix Pillar 1 demo wow-factor.

"live photo upload → defect heatmap overlay rendered on the image in real time"

Input:  image_bytes + grade_result (from grade_image())
Output: annotated image bytes (JPEG) with:
  - Colored bounding boxes per defect (severity-coded)
  - Defect labels with confidence badges
  - Grade badge overlay (A/B/C/D) with color
  - Gaussian heatmap glow around detected defects

Public interface:
    render_heatmap(image_bytes, grade_result) -> bytes   (JPEG)
    render_heatmap_b64(image_bytes, grade_result) -> str (base64)
"""
from __future__ import annotations
import base64
import io
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# ─── Severity → color (BGR for OpenCV, RGB for PIL) ──────────────────────────
SEVERITY_COLOR_RGB = {
    "minor":    (255, 200,  50),   # amber
    "moderate": (255, 120,  30),   # orange
    "severe":   (220,  50,  50),   # red
}

GRADE_COLOR_RGB = {
    "A": ( 50, 200, 100),   # green
    "B": (100, 180, 255),   # blue
    "C": (255, 180,  50),   # amber
    "D": (220,  50,  50),   # red
}


def render_heatmap(image_bytes: bytes, grade_result: Dict[str, Any]) -> bytes:
    """
    Render defect bounding boxes + grade badge onto image.

    Returns annotated JPEG bytes.
    Uses Pillow (always available). OpenCV used if installed (better rendering).
    """
    try:
        return _render_with_pillow(image_bytes, grade_result)
    except Exception as e:
        logger.warning(f"[heatmap] Pillow render failed: {e}")
        return image_bytes  # return original if rendering fails


def render_heatmap_b64(image_bytes: bytes, grade_result: Dict[str, Any]) -> str:
    """Return base64-encoded JPEG of the annotated image (for API/frontend)."""
    annotated = render_heatmap(image_bytes, grade_result)
    return base64.standard_b64encode(annotated).decode()


def _render_with_pillow(image_bytes: bytes, grade_result: Dict[str, Any]) -> bytes:
    """Pillow-based renderer — no OpenCV dependency."""
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    import math

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    w, h = img.size

    # ── Heatmap layer (Gaussian glow around defect centers) ───────────────────
    heatmap = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    heat_draw = ImageDraw.Draw(heatmap)

    defects = grade_result.get("defects", [])
    for defect in defects:
        bbox = defect.get("bbox")
        if not bbox or len(bbox) < 4:
            continue
        x0, y0, x1, y1 = [float(v) for v in bbox[:4]]
        severity = defect.get("severity", "minor")
        color = SEVERITY_COLOR_RGB.get(severity, (255, 200, 50))

        # Draw semi-transparent filled rectangle (the glow base)
        heat_draw.rectangle(
            [x0, y0, x1, y1],
            fill=(*color, 60),       # low alpha fill
            outline=(*color, 200),   # high alpha border
            width=3,
        )

        # Concentric ellipses for heatmap effect
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        rw, rh = (x1 - x0) / 2, (y1 - y0) / 2
        for i in range(3):
            scale = 1.0 + i * 0.3
            alpha = max(0, 50 - i * 18)
            heat_draw.ellipse(
                [cx - rw * scale, cy - rh * scale,
                 cx + rw * scale, cy + rh * scale],
                fill=(*color, alpha),
            )

    # Blur the heatmap layer for glow effect
    heatmap = heatmap.filter(ImageFilter.GaussianBlur(radius=8))

    # Composite heatmap onto image
    img = Image.alpha_composite(img, heatmap)
    draw = ImageDraw.Draw(img)

    # ── Bounding box labels ───────────────────────────────────────────────────
    try:
        font_label = ImageFont.truetype("arial.ttf", max(12, h // 50))
        font_badge = ImageFont.truetype("arialbd.ttf", max(16, h // 35))
    except Exception:
        font_label = ImageFont.load_default()
        font_badge = font_label

    for defect in defects:
        bbox = defect.get("bbox")
        if not bbox or len(bbox) < 4:
            continue
        x0, y0, x1, y1 = [float(v) for v in bbox[:4]]
        severity = defect.get("severity", "minor")
        color = SEVERITY_COLOR_RGB.get(severity, (255, 200, 50))
        dtype = defect.get("type", "defect").replace("_", " ")
        label = f"{dtype} [{severity}]"

        # Draw crisp bounding box border
        draw.rectangle([x0, y0, x1, y1], outline=(*color, 255), width=2)

        # Label pill background
        try:
            tw = draw.textlength(label, font=font_label)
        except Exception:
            tw = len(label) * 7
        th = max(12, h // 50)
        lx, ly = x0, max(0, y0 - th - 4)
        draw.rectangle([lx, ly, lx + tw + 8, ly + th + 4], fill=(*color, 220))
        draw.text((lx + 4, ly + 2), label, fill=(20, 20, 20), font=font_label)

    # ── Grade badge (top-right corner) ───────────────────────────────────────
    grade = grade_result.get("grade", "C")
    confidence = grade_result.get("confidence", 0.5)
    grade_color = GRADE_COLOR_RGB.get(grade, (200, 200, 200))
    badge_size = max(60, w // 8)
    badge_margin = 12

    # Rounded badge
    bx = w - badge_size - badge_margin
    by = badge_margin
    draw.ellipse(
        [bx, by, bx + badge_size, by + badge_size],
        fill=(*grade_color, 230),
    )
    # Grade letter
    try:
        gfont_size = badge_size // 2
        gfont = ImageFont.truetype("arialbd.ttf", gfont_size)
    except Exception:
        gfont = font_badge
    try:
        gtw = draw.textlength(grade, font=gfont)
    except Exception:
        gtw = gfont_size * 0.7
    draw.text(
        (bx + (badge_size - gtw) / 2, by + badge_size * 0.12),
        grade, fill=(255, 255, 255), font=gfont,
    )
    # Confidence sub-label
    conf_text = f"{confidence:.0%}"
    try:
        cfont = ImageFont.truetype("arial.ttf", badge_size // 5)
    except Exception:
        cfont = font_label
    try:
        ctw = draw.textlength(conf_text, font=cfont)
    except Exception:
        ctw = len(conf_text) * 6
    draw.text(
        (bx + (badge_size - ctw) / 2, by + badge_size * 0.68),
        conf_text, fill=(240, 240, 240), font=cfont,
    )

    # ── Condition summary bar (bottom strip) ─────────────────────────────────
    summary = grade_result.get("condition_summary", "")
    if summary:
        bar_h = max(30, h // 18)
        draw.rectangle([0, h - bar_h, w, h], fill=(20, 20, 20, 200))
        try:
            sfont = ImageFont.truetype("arial.ttf", max(11, bar_h // 2))
        except Exception:
            sfont = font_label
        # Truncate if too long
        max_chars = w // 7
        display = summary if len(summary) <= max_chars else summary[:max_chars - 3] + "..."
        draw.text((8, h - bar_h + 6), display, fill=(240, 240, 240), font=sfont)

    # ── Convert back to JPEG ─────────────────────────────────────────────────
    out = img.convert("RGB")
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def save_heatmap(image_bytes: bytes, grade_result: Dict[str, Any], out_path: str) -> str:
    """Render and save the heatmap image to disk. Returns the output path."""
    annotated = render_heatmap(image_bytes, grade_result)
    with open(out_path, "wb") as f:
        f.write(annotated)
    logger.info(f"[heatmap] Saved annotated image: {out_path}")
    return out_path
