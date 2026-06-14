"""
ml/tryon.py
-----------
2D Virtual Try-On using IDM-VTON via HuggingFace Spaces Gradio API.

Public interface:
    virtual_tryon(person_image_bytes, garment_image_bytes, garment_description) -> bytes

Uses the yisol/IDM-VTON HuggingFace Space — free, no API key required.
Falls back to an informative error if the space is unavailable.

Production upgrade path:
  - Duplicate the HF Space to your account with a dedicated GPU
  - Or swap to Replicate: cuuupid/idm-vton ($0.075/run)
"""
from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# HuggingFace Space to use — can be overridden via env var for production
HF_SPACE  = os.environ.get("TRYON_HF_SPACE", "yisol/IDM-VTON")

# IDM-VTON's fixed internal resolution — images are resized to this before diffusion.
# We letterbox to this size ourselves so the model sees the correct aspect ratio.
_MODEL_W, _MODEL_H = 768, 1024


def _letterbox(img_bytes: bytes) -> tuple[bytes, tuple[int, int, int, int]]:
    """
    Resize img_bytes to fit within (_MODEL_W, _MODEL_H) preserving aspect ratio,
    then center-pad with white to exactly (_MODEL_W, _MODEL_H).

    Returns (padded_jpeg_bytes, crop_box) where crop_box is the (left, top, right, bottom)
    rectangle inside the padded image that contains the original content — used to crop
    the model output back to the original aspect ratio.
    """
    try:
        from PIL import Image
    except ImportError:
        # Pillow not installed — pass image through unchanged and accept possible stretch
        logger.warning("[tryon] Pillow not installed; skipping letterbox. pip install Pillow")
        return img_bytes, (0, 0, _MODEL_W, _MODEL_H)

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    orig_w, orig_h = img.size

    scale = min(_MODEL_W / orig_w, _MODEL_H / orig_h)
    new_w, new_h = int(orig_w * scale), int(orig_h * scale)

    img_resized = img.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGB", (_MODEL_W, _MODEL_H), (255, 255, 255))
    paste_x = (_MODEL_W - new_w) // 2
    paste_y = (_MODEL_H - new_h) // 2
    canvas.paste(img_resized, (paste_x, paste_y))

    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=95)
    crop_box = (paste_x, paste_y, paste_x + new_w, paste_y + new_h)
    return buf.getvalue(), crop_box


def _crop_to_box(img_bytes: bytes, crop_box: tuple[int, int, int, int]) -> bytes:
    """Crop result image to crop_box, removing the letterbox padding."""
    try:
        from PIL import Image
    except ImportError:
        return img_bytes

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    cropped = img.crop(crop_box)
    buf = io.BytesIO()
    cropped.save(buf, format="JPEG", quality=95)
    return buf.getvalue()
TRYON_STEPS = int(os.environ.get("TRYON_STEPS", "30"))
TRYON_SEED  = int(os.environ.get("TRYON_SEED", "42"))
# HF_TOKEN: free account at huggingface.co gives ~1000s/day vs 60s anonymous.
# Get one at: https://huggingface.co/settings/tokens (Read token is enough)
HF_TOKEN  = os.environ.get("HF_TOKEN", "")


def virtual_tryon(
    person_image_bytes: bytes,
    garment_image_bytes: bytes,
    garment_description: str = "",
) -> bytes:
    """
    Run 2D virtual try-on using IDM-VTON via HuggingFace Spaces.

    Args:
        person_image_bytes:   Full-body photo of the user (JPEG/PNG bytes)
        garment_image_bytes:  Flat-lay or catalog photo of the garment (JPEG/PNG bytes)
        garment_description:  e.g. "Short Sleeve Round Neck T-shirt" (optional, improves quality)

    Returns:
        JPEG bytes of the generated try-on image

    Raises:
        RuntimeError: If the HuggingFace Space is unavailable or inference fails
    """
    try:
        from gradio_client import Client, handle_file
    except ImportError:
        raise RuntimeError(
            "gradio_client is not installed. Run: pip install gradio_client"
        )

    # Letterbox person image to model's native resolution so it isn't stretched
    person_padded, crop_box = _letterbox(person_image_bytes)

    # Write temp files — gradio_client requires file paths, not bytes
    with tempfile.TemporaryDirectory() as tmpdir:
        person_path  = Path(tmpdir) / "person.jpg"
        garment_path = Path(tmpdir) / "garment.jpg"

        person_path.write_bytes(person_padded)
        garment_path.write_bytes(garment_image_bytes)

        logger.info(f"[tryon] Connecting to HF Space: {HF_SPACE} (authenticated={bool(HF_TOKEN)})")

        # Authenticate via huggingface_hub — works across all gradio_client versions.
        # This increases ZeroGPU quota from 60s/day (anon) to ~1000s/day (free account).
        if HF_TOKEN:
            try:
                from huggingface_hub import login
                login(token=HF_TOKEN, add_to_git_credential=False)
            except Exception:
                pass  # non-fatal — will proceed as anonymous if login fails

        try:
            client = Client(HF_SPACE)
        except Exception as e:
            raise RuntimeError(
                f"Could not connect to HuggingFace Space '{HF_SPACE}'. "
                f"The space may be starting up — try again in 30 seconds. "
                f"Original error: {e}"
            )

        try:
            logger.info(f"[tryon] Running inference (steps={TRYON_STEPS}, seed={TRYON_SEED})")
            result = client.predict(
                # person image with auto-mask
                dict={
                    "background": handle_file(str(person_path)),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(str(garment_path)),
                garment_des=garment_description or "clothing item",
                is_checked=True,          # auto-masking (no manual mask needed)
                is_checked_crop=False,    # don't crop — keep full body visible
                denoise_steps=TRYON_STEPS,
                seed=TRYON_SEED,
                api_name="/tryon",
            )
        except Exception as e:
            raise RuntimeError(
                f"IDM-VTON inference failed: {e}. "
                f"The shared HuggingFace Space may be overloaded — try again in a moment."
            )

        # result is a tuple: (output_image_path, masked_person_image_path)
        # We only need the first (the try-on result)
        output_path = result[0] if isinstance(result, (list, tuple)) else result
        output_path = Path(output_path)

        if not output_path.exists():
            raise RuntimeError(f"IDM-VTON returned no output file at: {output_path}")

        output_bytes = output_path.read_bytes()
        # Crop out the letterbox padding so result matches original aspect ratio
        output_bytes = _crop_to_box(output_bytes, crop_box)
        logger.info(f"[tryon] Done — output {len(output_bytes)//1024}KB")
        return output_bytes


def virtual_tryon_b64(
    person_image_bytes: bytes,
    garment_image_bytes: bytes,
    garment_description: str = "",
) -> str:
    """
    Same as virtual_tryon() but returns a base64-encoded JPEG string
    suitable for embedding directly in a JSON API response.
    """
    result_bytes = virtual_tryon(person_image_bytes, garment_image_bytes, garment_description)
    return base64.b64encode(result_bytes).decode("utf-8")
