"""
ml/verify.py
------------
Product-match verification for the return / sell inspection flow.

Before we grade a returned item, we must confirm the photo actually shows the
product being returned — otherwise a customer could return a cheap item by
photographing an expensive one (or vice-versa), or simply scan the wrong thing.

final_idea.md Tier-2 fraud rule:
  "if agent's live photos differ significantly from the catalog reference
   (wrong model, wrong colour) → item flagged."

Implementation note: the Django backend venv only ships the OpenAI SDK (no
torch/CLIP), so this uses the same vision-LLM path as ml/captioner.py rather
than CLIP image embeddings. If the VLM is unavailable it fails OPEN
(match=True) so the demo never dead-ends on an infra hiccup.
"""
from __future__ import annotations
import base64
import json
import logging
import os
import re
from typing import Dict, Any

logger = logging.getLogger(__name__)

_VERIFY_PROMPT = """You are a product verification assistant for a re-commerce platform.

The customer says this item is: "{expected}" (category: {category}).

Look at the image and decide whether it plausibly shows that product (or at
least something in the same product category). Be lenient about brand/colour
but strict about category — headphones are NOT shoes, a phone is NOT a shirt.

Return ONLY valid JSON, no markdown:
{{
  "detected_object": "<short name of what you actually see, e.g. 'sneakers'>",
  "detected_category": "<one of: Electronics, Footwear, Clothing, Home & Kitchen, Books, Toys, Sports, Beauty, Jewelry, Other>",
  "is_match": <true if the image matches the expected category/product, else false>,
  "confidence": <0.0-1.0>
}}"""


def _parse_json(raw: str) -> Dict[str, Any]:
    cleaned = re.sub(r"```(?:json)?\s*", "", raw or "").strip().rstrip("`").strip()
    try:
        return json.loads(cleaned)
    except Exception:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


def verify_match(image_bytes: bytes, expected_category: str = "", expected_title: str = "") -> Dict[str, Any]:
    """
    Check that `image_bytes` shows the expected product/category.

    Returns:
      {
        "match": bool,
        "detected_object": str,
        "detected_category": str,
        "confidence": float,
        "checked": bool,    # False if the VLM was unavailable (failed open)
      }
    """
    expected = (expected_title or expected_category or "the product").strip()
    category = (expected_category or "Other").strip()

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return {"match": True, "detected_object": "", "detected_category": category,
                "confidence": 0.0, "checked": False}

    try:
        from openai import OpenAI
        model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
        if "claude-3-5-haiku" in model:
            model = "anthropic/claude-3-haiku"

        client = OpenAI(
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            default_headers={
                "HTTP-Referer": "https://revive.amazon-hackon.dev",
                "X-Title": "REVIVE Product Verify",
                "X-OpenRouter-Provider-Order": "Anthropic",
            },
        )
        b64 = base64.standard_b64encode(image_bytes).decode()
        prompt = _VERIFY_PROMPT.format(expected=expected, category=category)

        resp = client.chat.completions.create(
            model=model,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            }],
            timeout=20,
        )
        parsed = _parse_json(resp.choices[0].message.content or "")
        if not parsed:
            return {"match": True, "detected_object": "", "detected_category": category,
                    "confidence": 0.0, "checked": False}

        return {
            "match": bool(parsed.get("is_match", True)),
            "detected_object": str(parsed.get("detected_object", "")),
            "detected_category": str(parsed.get("detected_category", category)),
            "confidence": float(parsed.get("confidence", 0.5) or 0.5),
            "checked": True,
        }
    except Exception as e:
        logger.warning(f"[verify] VLM match check failed, failing open: {e}")
        return {"match": True, "detected_object": "", "detected_category": category,
                "confidence": 0.0, "checked": False}
