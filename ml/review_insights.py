"""
ml/review_insights.py
---------------------
Pillar-4 review intelligence: turn a product's REAL Amazon reviews into
(a) an offline sizing/fit signal and (b) a multi-agent "review panel" summary that
drives both the product-page "What buyers say" card and the checkout return nudge.

Two public entry points:
    mine_fit_signal(reviews)                       -> dict | None   (offline, deterministic)
    review_panel(asin, title, category, reviews)   -> dict          (cached LLM panel)

The panel runs ONCE at seed time and is cached by ASIN to
ml/artifacts/review_summary_cache.json, so it's free at request time and fails open
offline (no key → deterministic fit signal + a heuristic return_risk, empty LLM text).

"Multi-agent" = a panel of specialist roles (Fit, Quality/Durability, Expectation-Gap,
Pros/Cons) merged by a synthesizer. Default execution is ONE cached structured call
that fills every section; set REVIEW_PANEL_MULTI=1 to fan out one call per specialist.
"""
from __future__ import annotations
import json
import logging
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

# ── JSON cache, keyed by ASIN (mirrors ml/captioner.py) ──────────────────────
CACHE_FILE = Path(__file__).parent / "artifacts" / "review_summary_cache.json"
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
        logger.warning(f"[review_insights] cache write failed: {e}")


# ── Category return-rate priors (aligns with ml/prevent.CATEGORY_RETURN_RATES) ─
_CATEGORY_PRIOR = {
    "Footwear": 0.32, "Apparel": 0.28, "Phone": 0.12, "Laptop": 0.12,
    "Monitor": 0.12, "Electronics": 0.12, "default": 0.15,
}
_FIT_CATEGORIES = {"Apparel", "Footwear"}


def _review_text(reviews: List[Dict]) -> List[str]:
    out = []
    for r in reviews:
        t = ((r.get("title") or "") + ". " + (r.get("body") or r.get("text") or "")).strip()
        if t:
            out.append(t)
    return out


# ── Fit Analyst (offline, deterministic) ─────────────────────────────────────
# Signed sizing cues — negative = runs small (buyer wants to size up), positive = large.
_SMALL_CUES = (
    r"runs?\s+small", r"run\s+a?\s*bit\s+small", r"sizes?\s+small", r"size\s+up",
    r"order\s+(?:a\s+)?size\s+up", r"too\s+(?:tight|small|snug)", r"\btight\b",
    r"\bsnug\b", r"smaller\s+than\s+expected", r"narrow",
)
_LARGE_CUES = (
    r"runs?\s+(?:big|large)", r"sizes?\s+(?:big|large)", r"size\s+down",
    r"order\s+(?:a\s+)?size\s+down", r"too\s+(?:big|large|loose|baggy)",
    r"\bloose\b", r"\bbaggy\b", r"\broomy\b", r"bigger\s+than\s+expected",
)
_TRUE_CUES = (
    r"true\s+to\s+size", r"fits?\s+(?:perfect|perfectly|great|well)",
    r"\btts\b", r"as\s+expected\s+size", r"perfect\s+fit", r"right\s+size",
)
_SMALL_RE = re.compile("|".join(_SMALL_CUES), re.I)
_LARGE_RE = re.compile("|".join(_LARGE_CUES), re.I)
_TRUE_RE = re.compile("|".join(_TRUE_CUES), re.I)


def mine_fit_signal(reviews: List[Dict]) -> Optional[Dict[str, Any]]:
    """Deterministic sizing direction from review text — offline, no API.

    Returns {direction, confidence, mentions} or None when there's no fit signal.
    direction ∈ {runs_small, true_to_size, runs_large} (matches FitTwin.jsx)."""
    small = large = true = 0
    mentions: List[str] = []
    for txt in _review_text(reviews):
        s, l, t = _SMALL_RE.search(txt), _LARGE_RE.search(txt), _TRUE_RE.search(txt)
        if s:
            small += 1
        if l:
            large += 1
        if t:
            true += 1
        if (s or l) and len(mentions) < 4:
            snippet = txt.strip().replace("\n", " ")
            mentions.append(snippet[:140])
    total = small + large + true
    if total == 0:
        return None
    # Decide direction from the dominant skew; "true" only wins with no real skew.
    if small > large and small >= max(1, true):
        direction, lean = "runs_small", small
    elif large > small and large >= max(1, true):
        direction, lean = "runs_large", large
    else:
        direction, lean = "true_to_size", true
    confidence = round(min(0.95, 0.4 + lean / max(total, 1) * 0.55), 2)
    return {"direction": direction, "confidence": confidence, "mentions": mentions}


# ── OpenRouter text call (reuses the ml/captioner.py client pattern) ──────────
def _parse_json(raw: str) -> dict:
    cleaned = re.sub(r"```(?:json)?\s*", "", raw or "").strip().rstrip("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}


def _llm_json(prompt: str, max_tokens: int = 700) -> dict:
    """One text completion via the configured provider, parsed as JSON. Raises on
    any failure so callers can fail open."""
    provider = os.environ.get("LLM_PROVIDER", "openrouter").lower()
    if provider == "anthropic" or (provider == "openrouter"
                                   and not os.environ.get("OPENROUTER_API_KEY")
                                   and os.environ.get("ANTHROPIC_API_KEY")):
        import anthropic
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5"),
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json(resp.content[0].text)
    # default: OpenRouter (OpenAI-compatible)
    from openai import OpenAI
    client = OpenAI(
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://revive.amazon-hackon.dev",
            "X-Title": "REVIVE Review Panel",
        },
    )
    model = os.environ.get("OPENROUTER_REVIEW_MODEL",
                           os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3-haiku"))
    resp = client.chat.completions.create(
        model=model, max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return _parse_json(resp.choices[0].message.content or "")


_PANEL_PROMPT = """\
You are a panel of e-commerce return-prevention analysts reviewing REAL customer reviews
for this product so a shopper can decide before buying.

Product: {title}
Category: {category}
Reviews (verbatim, one per line):
{reviews}

Act as four specialists, then synthesize:
  - FIT ANALYST: sizing/fit tendency (apparel/footwear). {fit_hint}
  - QUALITY/DURABILITY ANALYST: build quality, longevity, defects, "stopped working".
  - EXPECTATION-GAP ANALYST: "not as described/pictured", wrong color/material/size — the
    biggest non-sizing reason people return things.
  - SENTIMENT ANALYST: the strongest pros and cons buyers actually mention.

Return ONLY valid JSON, no markdown:
{{
  "tldr": "<one neutral sentence a shopper reads first>",
  "pros": ["<short>", "..."],            // max 4, from real praise
  "cons": ["<short>", "..."],            // max 4, from real complaints
  "fit_verdict": "<one sentence on sizing, or '' if not apparel/footwear>",
  "return_risk": <0.0-1.0>,              // likelihood a typical buyer returns it
  "return_reasons": [{{"reason": "<short>", "share": <0.0-1.0>}}],  // top 1-3 drivers
  "nudge_line": "<one helpful checkout sentence to prevent a return, or ''>"
}}"""


def _heuristic_summary(category: str, fit_signal: Optional[Dict]) -> Dict[str, Any]:
    """Offline fallback: no LLM text, but a usable return_risk + fit-derived nudge."""
    prior = _CATEGORY_PRIOR.get(category, _CATEGORY_PRIOR["default"])
    nudge = ""
    reasons = []
    if fit_signal and fit_signal.get("direction") != "true_to_size":
        small = fit_signal["direction"] == "runs_small"
        prior = min(0.9, prior + 0.10 * fit_signal.get("confidence", 0.5))
        nudge = (f"Buyers say this runs {'small' if small else 'large'} — "
                 f"consider sizing {'up' if small else 'down'}.")
        reasons = [{"reason": "sizing / fit", "share": round(fit_signal.get("confidence", 0.5), 2)}]
    return {
        "tldr": "", "pros": [], "cons": [],
        "fit_verdict": nudge, "return_risk": round(prior, 3),
        "return_reasons": reasons, "nudge_line": nudge,
    }


def _coerce(summary: dict, category: str, fit_signal: Optional[Dict]) -> Dict[str, Any]:
    """Clamp/normalise an LLM payload into the persisted schema, filling a fit-based
    nudge_line when the model didn't give one but the offline signal says size matters."""
    def _list(x):
        return [str(v)[:120] for v in (x or []) if str(v).strip()][:4]
    try:
        risk = float(summary.get("return_risk"))
    except (TypeError, ValueError):
        risk = _CATEGORY_PRIOR.get(category, _CATEGORY_PRIOR["default"])
    risk = max(0.0, min(1.0, risk))
    reasons = []
    for r in (summary.get("return_reasons") or [])[:3]:
        if isinstance(r, dict) and r.get("reason"):
            try:
                share = max(0.0, min(1.0, float(r.get("share", 0))))
            except (TypeError, ValueError):
                share = 0.0
            reasons.append({"reason": str(r["reason"])[:60], "share": round(share, 2)})
    nudge = str(summary.get("nudge_line") or "").strip()[:140]
    if not nudge and fit_signal and fit_signal.get("direction") != "true_to_size":
        small = fit_signal["direction"] == "runs_small"
        nudge = (f"Buyers say this runs {'small' if small else 'large'} — "
                 f"consider sizing {'up' if small else 'down'}.")
    return {
        "tldr": str(summary.get("tldr") or "").strip()[:240],
        "pros": _list(summary.get("pros")),
        "cons": _list(summary.get("cons")),
        "fit_verdict": str(summary.get("fit_verdict") or "").strip()[:200],
        "return_risk": round(risk, 3),
        "return_reasons": reasons,
        "nudge_line": nudge,
    }


def _reconcile_fit(summary: Dict[str, Any], fit_signal: Optional[Dict]) -> Dict[str, Any]:
    """Force the summary's sizing claim to agree with the deterministic, review-mined
    fit signal — the SAME signal that drives the FitTwin "Buyers report…" line and the
    checkout nudge. The LLM occasionally states the wrong direction (e.g. says "runs
    large, size down" when the reviews say it runs small); the regex over the real
    review text is the single source of truth, so we overwrite fit_verdict/nudge_line
    here. With no skew (true to size / no signal) we drop any size-up/down claim."""
    direction = (fit_signal or {}).get("direction")
    if direction == "runs_small":
        line = "Buyers report this runs small — consider sizing up."
    elif direction == "runs_large":
        line = "Buyers report this runs large — consider sizing down."
    else:
        # true_to_size or no fit signal: don't assert a sizing skew at all.
        if direction == "true_to_size":
            summary["fit_verdict"] = "Buyers find this fits true to size."
        else:
            summary["fit_verdict"] = ""
        # strip any leftover "size up/down" nudge the LLM produced
        nl = (summary.get("nudge_line") or "")
        if re.search(r"size\s+(?:up|down)|runs?\s+(?:small|large|big)", nl, re.I):
            summary["nudge_line"] = ""
        return summary
    summary["fit_verdict"] = line
    summary["nudge_line"] = line
    return summary


def review_panel(asin: str, title: str, category: str,
                 reviews: List[Dict]) -> Dict[str, Any]:
    """Run (or load cached) the review panel for one product. Always returns the
    review_summary schema; fails open to a heuristic summary offline."""
    fit_signal = mine_fit_signal(reviews) if category in _FIT_CATEGORIES else None

    cache = _load_cache()
    if asin and asin in cache:
        # Reconcile even cached entries so a stale/wrong LLM fit claim never survives.
        result = dict(cache[asin])
        if category in _FIT_CATEGORIES:
            result = _reconcile_fit(result, fit_signal)
        return result

    sample = _review_text(reviews)[:18]
    if not sample:
        return _heuristic_summary(category, fit_signal)

    fit_hint = (f"Offline analysis suggests it {fit_signal['direction'].replace('_', ' ')}; "
                f"confirm or correct from the reviews."
                if fit_signal else "Only if this is apparel/footwear.")
    prompt = _PANEL_PROMPT.format(
        title=title[:140], category=category, fit_hint=fit_hint,
        reviews="\n".join(f"- {s}" for s in sample)[:6000],
    )

    try:
        if os.environ.get("REVIEW_PANEL_MULTI") == "1":
            summary = _multi_panel(title, category, sample, fit_hint)
        else:
            summary = _llm_json(prompt)
        if not summary:
            raise ValueError("empty panel response")
        result = _coerce(summary, category, fit_signal)
    except Exception as e:
        logger.info(f"[review_insights] panel fail-open for {asin}: {e}")
        result = _heuristic_summary(category, fit_signal)

    if category in _FIT_CATEGORIES:
        result = _reconcile_fit(result, fit_signal)

    if asin:
        cache[asin] = result
        _save_cache(cache)
    return result


# ── Optional true multi-call fan-out (REVIEW_PANEL_MULTI=1) ───────────────────
_SPECIALIST_PROMPTS = {
    "quality": "List build-quality / durability pros and cons buyers mention. JSON: "
               '{{"pros":[],"cons":[]}}\nProduct: {title}\nReviews:\n{reviews}',
    "gap": 'Find "not as described/pictured" mismatches (color, material, size). JSON: '
           '{{"reasons":[{{"reason":"","share":0.0}}]}}\nProduct: {title}\nReviews:\n{reviews}',
    "sentiment": 'Give a one-line tldr and top pros/cons. JSON: '
                 '{{"tldr":"","pros":[],"cons":[]}}\nProduct: {title}\nReviews:\n{reviews}',
}


def _multi_panel(title: str, category: str, sample: List[str], fit_hint: str) -> dict:
    """One LLM call per specialist + a synthesis merge. Heavier; for showcase only."""
    joined = "\n".join(f"- {s}" for s in sample)[:6000]
    parts = {}
    for name, tmpl in _SPECIALIST_PROMPTS.items():
        try:
            parts[name] = _llm_json(tmpl.format(title=title[:140], reviews=joined), max_tokens=400)
        except Exception as e:
            logger.info(f"[review_insights] specialist {name} failed: {e}")
            parts[name] = {}
    pros = (parts.get("sentiment", {}).get("pros") or []) + (parts.get("quality", {}).get("pros") or [])
    cons = (parts.get("sentiment", {}).get("cons") or []) + (parts.get("quality", {}).get("cons") or [])
    reasons = parts.get("gap", {}).get("reasons") or []
    # Synthesize return_risk from the expectation-gap shares + category prior.
    prior = _CATEGORY_PRIOR.get(category, _CATEGORY_PRIOR["default"])
    gap = max((float(r.get("share", 0) or 0) for r in reasons), default=0.0)
    return {
        "tldr": parts.get("sentiment", {}).get("tldr", ""),
        "pros": pros, "cons": cons, "fit_verdict": "",
        "return_risk": min(1.0, prior + 0.4 * gap),
        "return_reasons": reasons, "nudge_line": "",
    }
