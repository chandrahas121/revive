"""
engine.py — 2D virtual try-on via IDM-VTON on HuggingFace Spaces.

Self-contained on purpose: this service owns its try-on logic and shares no code
with the Django monolith, so it can be built and deployed entirely on its own
(the microservice boundary). Public interface:

    virtual_tryon_b64(person_bytes, garment_bytes, description) -> base64 JPEG str
"""
from __future__ import annotations

import base64
import io
import logging
import tempfile
from pathlib import Path

from .config import settings

logger = logging.getLogger(__name__)

# gradio_client talks to the Space over httpx, which logs every request at INFO —
# including the harmless 404 heartbeat pings. Keep only warnings+ so the worker
# log stays readable.
logging.getLogger("httpx").setLevel(logging.WARNING)

# IDM-VTON's fixed internal resolution — letterbox to this so the person image
# is never stretched, then crop the padding back off the result.
_MODEL_W, _MODEL_H = 768, 1024
_STEPS = 30
_SEED = 42


def _letterbox(img_bytes: bytes) -> tuple[bytes, tuple[int, int, int, int]]:
    """Fit image inside (_MODEL_W, _MODEL_H) preserving aspect ratio, pad white.
    Returns (padded_jpeg, crop_box) so the output can be cropped back."""
    from PIL import Image

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    orig_w, orig_h = img.size
    scale = min(_MODEL_W / orig_w, _MODEL_H / orig_h)
    new_w, new_h = int(orig_w * scale), int(orig_h * scale)

    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGB", (_MODEL_W, _MODEL_H), (255, 255, 255))
    paste_x, paste_y = (_MODEL_W - new_w) // 2, (_MODEL_H - new_h) // 2
    canvas.paste(resized, (paste_x, paste_y))

    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=95)
    return buf.getvalue(), (paste_x, paste_y, paste_x + new_w, paste_y + new_h)


def _crop_to_box(img_bytes: bytes, crop_box: tuple[int, int, int, int]) -> bytes:
    from PIL import Image

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    buf = io.BytesIO()
    img.crop(crop_box).save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def virtual_tryon(person_bytes: bytes, garment_bytes: bytes, description: str = "") -> bytes:
    """Run IDM-VTON and return JPEG bytes of the result. Raises on failure."""
    from gradio_client import Client, handle_file

    person_padded, crop_box = _letterbox(person_bytes)

    with tempfile.TemporaryDirectory() as tmp:
        person_path = Path(tmp) / "person.jpg"
        garment_path = Path(tmp) / "garment.jpg"
        person_path.write_bytes(person_padded)
        garment_path.write_bytes(garment_bytes)

        # A free HF account token lifts the ZeroGPU quota from ~60s/day to ~1000s/day.
        if settings.hf_token:
            try:
                from huggingface_hub import login
                login(token=settings.hf_token, add_to_git_credential=False)
            except Exception:
                pass  # non-fatal — proceed anonymously

        logger.info("[tryon] connecting to HF Space %s", settings.hf_space)
        try:
            client = Client(settings.hf_space)
        except Exception as e:
            raise RuntimeError(
                f"Could not connect to HuggingFace Space '{settings.hf_space}' "
                f"(it may be waking up — retry in ~30s). {e}"
            )

        try:
            result = client.predict(
                dict={"background": handle_file(str(person_path)), "layers": [], "composite": None},
                garm_img=handle_file(str(garment_path)),
                garment_des=description or "clothing item",
                is_checked=True,        # auto-mask (no manual mask needed)
                is_checked_crop=False,  # keep full body
                denoise_steps=_STEPS,
                seed=_SEED,
                api_name="/tryon",
            )

            output_path = Path(result[0] if isinstance(result, (list, tuple)) else result)
            if not output_path.exists():
                raise RuntimeError(f"IDM-VTON returned no output file at {output_path}")

            out = _crop_to_box(output_path.read_bytes(), crop_box)
            logger.info("[tryon] done — %dKB", len(out) // 1024)
            return out
        finally:
            # Stop gradio_client's background heartbeat thread (otherwise it keeps
            # pinging /heartbeat and 404-spams the log after the result is done).
            try:
                client.close()
            except Exception:
                pass


def virtual_tryon_b64(person_bytes: bytes, garment_bytes: bytes, description: str = "") -> str:
    """Same as virtual_tryon() but returns a base64 JPEG string for JSON transport."""
    return base64.b64encode(virtual_tryon(person_bytes, garment_bytes, description)).decode("utf-8")
