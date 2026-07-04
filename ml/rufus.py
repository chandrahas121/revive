"""
ml/rufus.py
-----------
"Ask Rufus" — the product-page conversational shopping assistant.

Given ONE product's full context (title, condition, price, description, review
intel and a sample of real customer reviews) plus the shopper's question and the
prior turns of the chat, it returns a short, grounded answer — exactly like
Amazon's Rufus, but scoped to the item the shopper is looking at.

It reuses the same LLM-provider abstraction as ml/review_insights.py:
    LLM_PROVIDER = openrouter (default) | anthropic
    keys: OPENROUTER_API_KEY / ANTHROPIC_API_KEY

Public entry point:
    ask_rufus(context, question, history) -> {answer, model_version, latency_ms, grounded}

Fails open: with no API key configured it returns a deterministic, context-derived
answer so the UI still works end-to-end offline (demo-safe).
"""
from __future__ import annotations
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Keep answers tight — Rufus is a shopping helper, not an essay writer.
_MAX_TOKENS = 500

_SYSTEM_PROMPT = """\
You are Rufus, Amazon's friendly and knowledgeable AI shopping assistant.
A shopper is looking at ONE specific product and asking you about it.

Rules:
- Answer ONLY from the PRODUCT CONTEXT provided below. It is your single source of truth.
- If the context does not contain the answer, say so honestly and suggest what the
  shopper could check (e.g. the product details, seller, or reviews) — never invent
  specs, dimensions, compatibility, or claims that aren't in the context.
- This is a second-life / refurbished marketplace (Amazon Revive). When relevant,
  be transparent about the item's condition grade, what that grade means, and any
  cosmetic notes — that is exactly what builds buyer trust here.
- Be concise and conversational: 1-4 short sentences or a tight bullet list.
- Use the shopper's currency (₹) and never make up a price other than what's given.
- Be helpful and neutral — you can note trade-offs, but don't hard-sell.

PRODUCT CONTEXT:
{context}"""


def _format_context(ctx: Dict[str, Any]) -> str:
    """Render the product context dict into a compact, readable block for the model."""
    lines: List[str] = []

    def add(label: str, value: Any):
        if value in (None, "", [], {}):
            return
        lines.append(f"- {label}: {value}")

    add("Title", ctx.get("title"))
    add("Brand", ctx.get("brand"))
    add("Category", ctx.get("category"))
    add("Listing type", ctx.get("source_label") or ctx.get("source"))
    add("Condition grade", ctx.get("grade_display") or ctx.get("grade"))
    add("AI condition notes", ctx.get("condition_summary"))
    completeness = ctx.get("completeness")
    if completeness not in (None, ""):
        try:
            add("Included/complete", f"{round(float(completeness) * 100)}%")
        except (TypeError, ValueError):
            pass
    add("Price", f"₹{ctx['price']}" if ctx.get("price") not in (None, "") else None)
    if ctx.get("mrp") not in (None, ""):
        add("Original MRP", f"₹{ctx['mrp']}")
    add("Sold by", ctx.get("seller_name"))
    add("Customer rating", ctx.get("rating_line"))
    add("Available sizes", ctx.get("sizes"))
    add("Description", ctx.get("description"))

    # Pillar-4 mined review intelligence
    summary = ctx.get("review_summary") or {}
    if isinstance(summary, dict):
        add("Review summary", summary.get("tldr"))
        if summary.get("pros"):
            add("Buyers liked", "; ".join(map(str, summary["pros"][:4])))
        if summary.get("cons"):
            add("Buyers disliked", "; ".join(map(str, summary["cons"][:4])))
        add("Fit / sizing", summary.get("fit_verdict"))

    # A few verbatim reviews so Rufus can quote real buyer experience
    reviews = ctx.get("reviews") or []
    if reviews:
        lines.append("- Recent customer reviews:")
        for r in reviews[:6]:
            rating = r.get("rating", "")
            title = (r.get("title") or "").strip()
            body = (r.get("body") or r.get("text") or "").strip().replace("\n", " ")
            snippet = f"{title}. {body}".strip(". ")[:220]
            lines.append(f"    * {rating}★ {snippet}")

    return "\n".join(lines) if lines else "(no additional product details available)"


def _llm_text(system: str, messages: List[Dict[str, str]],
              max_tokens: int = _MAX_TOKENS) -> tuple[str, str]:
    """One chat completion via the configured provider. Returns (text, model_id).
    Raises on any failure so ask_rufus() can fail open. Mirrors the provider
    selection in ml/review_insights._llm_json."""
    provider = os.environ.get("LLM_PROVIDER", "openrouter").lower()
    if provider == "anthropic" or (
        provider == "openrouter"
        and not os.environ.get("OPENROUTER_API_KEY")
        and os.environ.get("ANTHROPIC_API_KEY")
    ):
        import anthropic
        client = anthropic.Anthropic()
        model = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5")
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
        return (resp.content[0].text or "").strip(), model

    # default: OpenRouter (OpenAI-compatible) — same client pattern as review_insights
    from openai import OpenAI
    client = OpenAI(
        api_key=os.environ.get("OPENROUTER_API_KEY", ""),
        base_url="https://openrouter.ai/api/v1",
        default_headers={
            "HTTP-Referer": "https://revive.amazon-hackon.dev",
            "X-Title": "REVIVE Ask Rufus",
        },
    )
    model = os.environ.get(
        "OPENROUTER_RUFUS_MODEL",
        os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3-haiku"),
    )
    resp = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, *messages],
    )
    return (resp.choices[0].message.content or "").strip(), model


def _sanitize_history(history: Any) -> List[Dict[str, str]]:
    """Keep only well-formed prior turns, cap length so the prompt stays small."""
    out: List[Dict[str, str]] = []
    if not isinstance(history, list):
        return out
    for turn in history[-8:]:  # last 4 exchanges
        if not isinstance(turn, dict):
            continue
        role = turn.get("role")
        content = str(turn.get("content") or "").strip()
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": content[:1500]})
    return out


def _fallback_answer(ctx: Dict[str, Any], question: str) -> str:
    """Deterministic, context-derived reply used when no LLM is configured or the
    call fails — keeps the demo working offline. Not clever, just honest."""
    title = ctx.get("title") or "this item"
    grade = ctx.get("grade_display") or ctx.get("grade")
    price = ctx.get("price")
    q = question.lower()

    if any(k in q for k in ("condition", "grade", "quality", "scratch", "damage", "work")):
        notes = ctx.get("condition_summary")
        base = f"This is a {grade} item." if grade else "Here's what I know about its condition."
        return f"{base} {notes}".strip() if notes else base
    if any(k in q for k in ("price", "cost", "how much", "cheap", "expensive")):
        if price not in (None, ""):
            mrp = ctx.get("mrp")
            extra = f" (original MRP ₹{mrp})" if mrp else ""
            return f"It's listed at ₹{price}{extra}."
    if any(k in q for k in ("review", "buyers", "people say", "rating")):
        summary = (ctx.get("review_summary") or {})
        if summary.get("tldr"):
            return summary["tldr"]
        if ctx.get("rating_line"):
            return f"Customer rating: {ctx['rating_line']}."

    desc = ctx.get("description")
    if desc:
        return f"Here's what the listing says about {title}: {str(desc)[:280]}"
    return (f"I can help with questions about {title} — its condition, price, sizing, "
            "or what buyers say. (AI assistant is running in offline mode right now.)")


def ask_rufus(context: Dict[str, Any], question: str,
              history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Answer one shopper question grounded in a single product's context.

    Returns {answer, model_version, latency_ms, grounded}. Always returns an
    answer — fails open to a deterministic context-derived reply on any error."""
    t0 = time.time()
    question = (question or "").strip()
    if not question:
        return {"answer": "What would you like to know about this item?",
                "model_version": "rufus-noop", "latency_ms": 0, "grounded": True}

    system = _SYSTEM_PROMPT.format(context=_format_context(context or {}))
    messages = _sanitize_history(history) + [{"role": "user", "content": question[:1500]}]

    try:
        answer, model = _llm_text(system, messages)
        if not answer:
            raise ValueError("empty model response")
        return {
            "answer": answer,
            "model_version": model,
            "latency_ms": int((time.time() - t0) * 1000),
            "grounded": True,
        }
    except Exception as e:
        logger.info(f"[rufus] fail-open ({e})")
        return {
            "answer": _fallback_answer(context or {}, question),
            "model_version": "rufus-fallback-v0",
            "latency_ms": int((time.time() - t0) * 1000),
            "grounded": False,
        }
