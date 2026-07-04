"""
green/credits.py
----------------
Live Green-Credits earn/cancel helpers (Pillar 5).

Credits reward genuinely sustainable behaviour, scaled by the customer's GREEN
PROFILE (green/profile.py) rather than a hard-coded per-category rule. Keeping an
order creates a PENDING earn at purchase that vests when the return window closes;
the amount is a value band × the profile's earn multiplier, so a more sustainable
customer earns more. Initiating a return cancels the pending earn.
"""
from __future__ import annotations
import logging

from .models import CreditTransaction

logger = logging.getLogger(__name__)


def credit_amount(value, profile_mult: float = 1.0) -> int:
    """Value band × the customer's Green-Profile earn multiplier."""
    try:
        v = float(value or 0)
    except (TypeError, ValueError):
        v = 0.0
    base = 5 if v < 500 else (10 if v < 2000 else (20 if v <= 10000 else 30))
    return int(round(base * (profile_mult or 1.0)))


def award_keep_credits(order):
    """Create a PENDING earn for keeping `order`; vests at its return-window close.
    Amount scales with the buyer's Green Profile. Idempotent (one award per order)."""
    if not order or not getattr(order, 'listing', None) or not order.listing.product:
        return None
    if CreditTransaction.objects.filter(order=order, kind='earn').exists():
        return None
    from .profile import green_profile
    mult = green_profile(order.user).get('multiplier', 1.0)
    amount = credit_amount(order.listing.price, mult)
    if amount <= 0:
        return None
    return CreditTransaction.objects.create(
        user=order.user, kind='earn', status='pending', amount=amount,
        reason='Kept your order — a greener choice than returning it',
        category=order.listing.product.category, order=order,
        vests_at=order.return_window_closes,
    )


def cancel_pending_credits(order) -> int:
    """Return initiated → cancel any pending earn for that order. Returns # cancelled."""
    if not order:
        return 0
    return CreditTransaction.objects.filter(
        order=order, kind='earn', status='pending'
    ).update(status=CreditTransaction.Status.CANCELLED)
