"""
trust/services.py
-----------------
Reusable Product Health Card generation.

Shared by HealthCardGenerateView (the synchronous POST /api/card/generate/) and
the async return-graded fan-out (core.tasks.generate_health_card_task), so both
paths build byte-identical cards + ledger entries and can never drift.
"""
from __future__ import annotations

from .models import HealthCard, LedgerEntry


def guarantee_terms(tier: int, inspected_by: str) -> tuple:
    """Return (guarantee_days, guarantee_holder) based on tier and inspection type."""
    if tier == 3 or inspected_by == 'ai_spn':
        return 90, 'Amazon SPN'
    if tier == 2:
        return 30, 'seller_escrow'
    return 7, 'seller_escrow'


def generate_health_card(listing, *, grade_result=None, route_result=None,
                         inspected_by='ai_only', battery_pct=None, imei=''):
    """
    Create (or regenerate) the Health Card for `listing` and append a 'graded'
    ledger entry. Returns (card, created).
    """
    grade_result = grade_result or {}
    route_result = route_result or {}

    tier = route_result.get('tier') or listing.tier or 1
    guarantee_days, guarantee_holder = guarantee_terms(tier, inspected_by)

    card, created = HealthCard.objects.get_or_create(listing=listing)

    # prev_hash chains the new ledger entry to the previous one (tamper evidence).
    last_entry = card.ledger.last() if not created else None
    prev_hash = last_entry.this_hash if last_entry else ''

    card.tier              = tier
    card.grade             = grade_result.get('grade', 'B')
    card.confidence        = float(grade_result.get('confidence') or 0.5)
    card.defects           = grade_result.get('defects') or []
    card.completeness      = float(grade_result.get('completeness') or 0.8)
    card.condition_summary = grade_result.get('condition_summary', '')
    card.functional        = bool(grade_result.get('functional', True))
    card.box_present       = bool(grade_result.get('box_present', False))
    card.inspected_by      = inspected_by
    card.model_version     = grade_result.get('model_version', 'revive-grade-v1.0')
    card.battery_pct       = int(battery_pct) if battery_pct is not None else None
    card.imei              = imei or ''
    card.previous_owners   = card.previous_owners if not created else 0
    card.guarantee_days    = guarantee_days
    card.guarantee_holder  = guarantee_holder
    card.qr_data           = ''  # reset so save() regenerates
    card.save()

    LedgerEntry.objects.create(
        card=card,
        event=LedgerEntry.Event.GRADED,
        prev_hash=prev_hash,
        data={
            'grade':        card.grade,
            'confidence':   card.confidence,
            'defects':      card.defects,
            'tier':         tier,
            'inspected_by': inspected_by,
            'route':        route_result.get('chosen_path', ''),
            'routed_price': route_result.get('price', ''),
            'km_saved':     route_result.get('km_saved', 0),
            'co2_saved_kg': route_result.get('co2_saved_kg', 0),
        },
    )

    return card, created
