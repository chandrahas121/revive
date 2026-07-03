"""
Central LLM helper for the ARCA returns agents (condition report, fault
reasoning, claim drafting). Talks to the configured provider (OpenRouter by
default via LLM_PROVIDER / OPENROUTER_API_KEY) and ALWAYS fails open — every
caller must supply a deterministic fallback so the pipeline runs with no key.
"""
import base64
import json
import logging
import os
import re

logger = logging.getLogger(__name__)


def llm_available() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY") or os.environ.get("ANTHROPIC_API_KEY"))


def _extract_json(text: str):
    """Pull the first JSON object out of an LLM reply (handles ```json fences)."""
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    raw = m.group(1) if m else None
    if raw is None:
        # first balanced-ish {...}
        s, e = text.find("{"), text.rfind("}")
        raw = text[s:e + 1] if s != -1 and e > s else None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _client():
    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return None, None
    try:
        from openai import OpenAI
    except Exception as e:
        logger.warning(f"[llm] openai sdk missing: {e}")
        return None, None
    model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3-haiku")
    if "claude-3-5-haiku" in model:  # non-vision route — avoid for grading
        model = "anthropic/claude-3-haiku"
    client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://revive.amazon-hackon.dev",
            "X-Title": "REVIVE ARCA Returns Agent",
        },
    )
    return client, model


def llm_json(system: str, user: str, images=None, max_tokens: int = 800, timeout: int = 25):
    """Return a dict parsed from the model's JSON reply, or None on any failure.
    `images` is an optional list of raw image bytes for vision reasoning."""
    client, model = _client()
    if client is None:
        return None
    content = []
    for img in (images or []):
        try:
            b64 = base64.standard_b64encode(img).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
        except Exception:
            pass
    content.append({"type": "text", "text": user})
    try:
        resp = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": content},
            ],
            timeout=timeout,
        )
        return _extract_json(resp.choices[0].message.content or "")
    except Exception as e:
        logger.warning(f"[llm] call failed, failing open: {e}")
        return None


def llm_text(system: str, user: str, max_tokens: int = 500, timeout: int = 25):
    """Return plain text from the model, or None on failure (for claim narratives)."""
    client, model = _client()
    if client is None:
        return None
    try:
        resp = client.chat.completions.create(
            model=model, max_tokens=max_tokens,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
            timeout=timeout,
        )
        return (resp.choices[0].message.content or "").strip() or None
    except Exception as e:
        logger.warning(f"[llm] text call failed: {e}")
        return None
