"""
ml/captioner.py
---------------
Provider-abstracted vision LLM captioning.

LLM_PROVIDER env var:
    openrouter  (default demo) — OpenAI SDK → https://openrouter.ai/api/v1
    anthropic   — Direct Anthropic Claude API
    bedrock     — boto3 bedrock-runtime (production)
    local       — Qwen2.5-VL-3B offline (GPU fallback)

All backends return the same JSON schema:
{
  "grade": "A|B|C|D",
  "confidence": float,
  "defects": [{"type": str, "severity": "minor|moderate|severe", "location": str}],
  "completeness": float,
  "condition_summary": str,
  "box_present": bool,
  "functional": bool
}
"""
from __future__ import annotations
import base64
import hashlib
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── JSON cache (Redis in prod; file on local dev) ───────────────────────────
CACHE_FILE = Path(__file__).parent / "artifacts" / "grade_cache.json"
_cache: Optional[dict] = None


def _load_cache() -> dict:
    global _cache
    if _cache is None:
        if CACHE_FILE.exists():
            try:
                _cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            except Exception:
                _cache = {}
        else:
            _cache = {}
    return _cache


def _save_cache(cache: dict) -> None:
    global _cache
    _cache = cache
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    try:
        CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"[captioner] Cache write failed: {e}")


def _cache_key(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()[:24]


# ── Prompt ───────────────────────────────────────────────────────────────────
CONDITION_PROMPT = """\
You are a product condition assessor for a re-commerce platform (like Amazon Renewed).

Grounding DINO detector context: {detections}
Each detection is tagged as "confirmed" (high confidence) or "uncertain" (borderline).
Only include "uncertain" detections as defects if you can visually verify the damage yourself.
Intentional design features (seams, buttons, zippers, decorative elements) are never defects.

Assess the product in the image and return ONLY valid JSON with these exact fields:
{{
  "grade": "<A|B|C|D>",
  "confidence": <0.0-1.0>,
  "defects": [
    {{"type": "<scratch|dent|stain|tear|missing_part|other>",
      "severity": "<minor|moderate|severe>",
      "location": "<brief description>"}}
  ],
  "completeness": <0.0-1.0>,
  "condition_summary": "<one professional sentence>",
  "box_present": <true|false>,
  "functional": <true|false>
}}

Grade scale:
  A = Like new / mint — no visible defects, all accessories present
  B = Very good — light cosmetic wear only, fully functional
  C = Good — visible defects but functional
  D = Acceptable — heavy damage or significant missing parts

Return ONLY the JSON object — no markdown fences, no explanation."""


def _det_text(detections: List[Dict]) -> str:
    if not detections:
        return "no defects detected"
    parts = []
    for d in detections:
        conf = d.get("confidence", 0)
        reliability = "confirmed" if conf >= 0.45 else "uncertain"
        parts.append(
            f"{d['label']} at {d.get('location', 'unknown')} "
            f"(conf {conf:.2f}, {reliability})"
        )
    return ", ".join(parts)


def _parse_json_response(raw: str) -> dict:
    """Extract JSON from possibly-decorated LLM response."""
    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    # Ultimate fallback
    return {
        "grade": "C",
        "confidence": 0.5,
        "defects": [],
        "completeness": 0.75,
        "condition_summary": raw[:200],
        "box_present": False,
        "functional": True,
    }


# ── OpenRouter backend ───────────────────────────────────────────────────────
# Models known to support vision via OpenRouter (Anthropic-direct, not Bedrock)
_OPENROUTER_VISION_MODELS = [
    "anthropic/claude-3-haiku",          # cheapest vision-capable Claude
    "anthropic/claude-3-5-sonnet",       # best Claude vision
    "google/gemini-flash-1.5",           # fast + cheap, good vision
    "meta-llama/llama-3.2-11b-vision-instruct",  # open source vision
]

def _caption_openrouter(image_bytes: bytes, detections: List[Dict]) -> dict:
    """Call vision model via OpenRouter (OpenAI-compatible API)."""
    from openai import OpenAI

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3-haiku")

    # If model is claude-3-5-haiku, downgrade to claude-3-haiku for vision
    # (claude-3-5-haiku is routed via Bedrock on OpenRouter which blocks image input)
    if "claude-3-5-haiku" in model:
        logger.info("[captioner] claude-3-5-haiku doesn't support vision via Bedrock; using claude-3-haiku instead.")
        model = "anthropic/claude-3-haiku"

    client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://revive.amazon-hackon.dev",
            "X-Title": "REVIVE Grading System",
            # Force Anthropic provider (not Bedrock) so vision input works
            "X-OpenRouter-Provider-Order": "Anthropic",
        },
    )

    b64 = base64.standard_b64encode(image_bytes).decode()
    prompt = CONDITION_PROMPT.format(detections=_det_text(detections))

    response = client.chat.completions.create(
        model=model,
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = response.choices[0].message.content or ""
    return _parse_json_response(raw)


# ── Anthropic direct backend ─────────────────────────────────────────────────
def _caption_anthropic(image_bytes: bytes, detections: List[Dict]) -> dict:
    """Call Claude Haiku directly via Anthropic SDK."""
    import anthropic

    client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from env
    b64 = base64.standard_b64encode(image_bytes).decode()
    prompt = CONDITION_PROMPT.format(detections=_det_text(detections))

    response = client.messages.create(
        model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5"),
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = response.content[0].text
    return _parse_json_response(raw)


# ── AWS Bedrock backend ──────────────────────────────────────────────────────
def _caption_bedrock(image_bytes: bytes, detections: List[Dict]) -> dict:
    """Call Claude Haiku on AWS Bedrock (production path)."""
    import boto3

    client = boto3.client(
        "bedrock-runtime",
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
    )

    b64 = base64.standard_b64encode(image_bytes).decode()
    prompt = CONDITION_PROMPT.format(detections=_det_text(detections))
    model_id = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-haiku-20240307-v1:0")

    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 512,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
    )

    response = client.invoke_model(modelId=model_id, body=body)
    response_body = json.loads(response["body"].read())
    raw = response_body["content"][0]["text"]
    return _parse_json_response(raw)


# ── Local Qwen fallback ──────────────────────────────────────────────────────
_qwen_model = _qwen_processor = None


def _load_qwen():
    global _qwen_model, _qwen_processor
    if _qwen_model is not None:
        return
    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

    logger.info("[captioner] Loading Qwen2.5-VL-3B (local fallback)…")
    _qwen_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        "Qwen/Qwen2.5-VL-3B-Instruct",
        torch_dtype=torch.float16,
        device_map="auto",
    )
    _qwen_processor = AutoProcessor.from_pretrained("Qwen/Qwen2.5-VL-3B-Instruct")
    logger.info("[captioner] Qwen loaded.")


def _caption_local(image_bytes: bytes, detections: List[Dict]) -> dict:
    """Run Qwen2.5-VL-3B locally (GPU required)."""
    import tempfile, os as _os
    from qwen_vl_utils import process_vision_info

    _load_qwen()

    prompt = CONDITION_PROMPT.format(detections=_det_text(detections))

    # Write image to a temp file since Qwen processor needs a path or URL
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_bytes)
        tmp_path = tmp.name

    try:
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": f"file://{tmp_path}"},
                    {"type": "text", "text": prompt},
                ],
            }
        ]
        text = _qwen_processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, _ = process_vision_info(messages)
        inputs = _qwen_processor(
            text=[text], images=image_inputs, padding=True, return_tensors="pt"
        ).to(_qwen_model.device)

        import torch
        with torch.no_grad():
            output = _qwen_model.generate(**inputs, max_new_tokens=512)
        raw = _qwen_processor.batch_decode(
            output[:, inputs.input_ids.shape[1]:], skip_special_tokens=True
        )[0]
    finally:
        _os.unlink(tmp_path)

    return _parse_json_response(raw)


# ── Public entry point ────────────────────────────────────────────────────────
def caption(image_bytes: bytes, detections: List[Dict]) -> dict:
    """
    Call the configured LLM provider to grade and caption a product image.

    Provider selection (LLM_PROVIDER env var):
        openrouter  → OpenRouter API (default)
        anthropic   → Direct Anthropic SDK
        bedrock     → AWS Bedrock
        local       → Qwen2.5-VL-3B (offline GPU)

    Results are cached by SHA-256(image_bytes) → grade_cache.json.
    """
    cache = _load_cache()
    key = _cache_key(image_bytes)
    if key in cache:
        logger.debug(f"[captioner] Cache hit {key}")
        return cache[key]

    provider = os.environ.get("LLM_PROVIDER", "openrouter").lower()
    t0 = time.monotonic()

    result = None
    try:
        if provider == "anthropic":
            result = _caption_anthropic(image_bytes, detections)
        elif provider == "bedrock":
            result = _caption_bedrock(image_bytes, detections)
        elif provider == "local":
            result = _caption_local(image_bytes, detections)
        else:  # openrouter (default)
            # If no OpenRouter key, try Anthropic
            if not os.environ.get("OPENROUTER_API_KEY") and os.environ.get("ANTHROPIC_API_KEY"):
                logger.info("[captioner] No OPENROUTER_API_KEY; using anthropic direct.")
                result = _caption_anthropic(image_bytes, detections)
            else:
                result = _caption_openrouter(image_bytes, detections)
    except Exception as e:
        logger.error(f"[captioner] Provider '{provider}' failed: {e}. Trying local fallback.")
        try:
            result = _caption_local(image_bytes, detections)
        except Exception as e2:
            logger.error(f"[captioner] Local fallback also failed: {e2}. Using default.")
            result = {
                "grade": "C",
                "confidence": 0.4,
                "defects": [],
                "completeness": 0.75,
                "condition_summary": "Unable to assess condition automatically.",
                "box_present": False,
                "functional": True,
            }

    result["latency_ms"] = round((time.monotonic() - t0) * 1000)

    cache[key] = result
    _save_cache(cache)
    return result
