"""
green/credits.py
----------------
Live Green-Credits earn/cancel helpers (Pillar 5, final_idea §5).

Credits are BUYER-ONLY and earned for KEEPING an order: a PENDING earn is created
at purchase, vesting when the return window closes. Initiating a return CANCELS the
pending earn. Spending is handled by CreditsRedeemView. Sellers never earn.

The award amount mirrors the frontend estimator (utils/tier.js → estimateGreenCredits)
so the "+N credits" the buyer is promised at checkout is exactly what's granted.
"""
from __future__ import annotations
import logging

from .models import CreditTransaction

logger = logging.getLogger(__name__)

# category → return-rate multiplier (mirrors utils/tier.js + green.views.CATEGORY_MULTIPLIER),
# extended so the demo's real categories (Phone/Laptop/Monitor/Apparel) resolve correctly.
_MULT = {
    'footwear': 2.0, 'shoes': 2.0, 'clothing': 2.0, 'apparel': 2.0, 'fashion': 2.0,
    'electronics': 0.8, 'phone': 0.8, 'laptop': 0.8, 'monitor': 0.8, 'tablet': 0.8,
    'camera': 0.8, 'beauty': 0.8, 'jewelry': 0.8,
    'books': 0.5, 'toys': 0.5, 'stationery': 0.5,
    'home & kitchen': 1.0, 'sports': 1.0, 'other': 1.0,
}


def _multiplier(category: str) -> float:
    return _MULT.get((category or '').strip().lower(), 1.0)


def credit_amount(category: str, value) -> int:
    """Value band × category multiplier; flat 5 below ₹500 (matches the frontend)."""
    try:
        v = float(value or 0)
    except (TypeError, ValueError):
        v = 0.0
    if v < 500:
        return 5
    band = 10 if v < 2000 else (20 if v <= 10000 else 30)
    return int(round(band * _multiplier(category)))


def award_keep_credits(order):
    """Create a PENDING earn for keeping `order`; vests at its return-window close.
    Idempotent (one award per order). Returns the txn or None."""
    if not order or not getattr(order, 'listing', None) or not order.listing.product:
        return None
    if CreditTransaction.objects.filter(order=order, kind='earn').exists():
        return None
    category = order.listing.product.category
    amount = credit_amount(category, order.listing.price)
    if amount <= 0:
        return None
    return CreditTransaction.objects.create(
        user=order.user, kind='earn', status='pending', amount=amount,
        reason='Keep your order — vests when the return window closes',
        category=category, order=order, vests_at=order.return_window_closes,
    )


def cancel_pending_credits(order) -> int:
    """Return initiated → cancel any pending earn for that order. Returns # cancelled."""
    if not order:
        return 0
    return CreditTransaction.objects.filter(
        order=order, kind='earn', status='pending'
    ).update(status=CreditTransaction.Status.CANCELLED)
