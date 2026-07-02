"""
core/signals.py
---------------
Domain signals for the core app.

Keeping side-effects in signals (rather than inline in views) means a new Product
fans out to async work without the request path knowing or waiting. This is the
same "one event → independent reactions" shape as an event bus, built on the
Celery + Redis infrastructure we already run.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from .events import return_graded
from .models import Product

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Product)
def trigger_review_panel(sender, instance, created, **kwargs):
    """
    Queue a "What buyers say" panel for newly created P2P products only.

    Seeded catalogue products (real Amazon ASINs) already get their panel at seed
    time, so we skip them here — otherwise a bulk seed would enqueue thousands of
    tasks. Live P2P listings use an asin like ``P2P-A1B2C3D4``.
    """
    if not created:
        return
    if not (instance.asin or '').startswith('P2P-'):
        return
    if instance.review_summary:
        return

    try:
        from core.tasks import run_review_panel_for_product
        run_review_panel_for_product.delay(instance.pk)
    except Exception as exc:  # Redis/broker down must never block Product creation
        logger.warning('[signals] could not queue review panel for %s: %s', instance.pk, exc)


@receiver(return_graded)
def on_return_graded(sender, listing, order=None, route_result=None, **kwargs):
    """
    Fan out the "return graded" event to independent Celery tasks.

    Each task reacts on its own — a failure in one never blocks the others. This
    is the same shape as N Kafka consumers on one topic, built on Celery + Redis:

        return_graded ─┬─► generate_health_card_task   (Pillar 3 card + ledger)
                       ├─► record_local_supply_task     (demand/supply signal, O(1))
                       └─► notify_return_outcome_task    (user notification)
    """
    from core.tasks import (
        generate_health_card_task,
        record_local_supply_task,
        notify_return_outcome_task,
    )
    route_result = route_result or {}
    try:
        generate_health_card_task.delay(listing.pk, route_result)
        record_local_supply_task.delay(listing.geohash5 or '', listing.product.category)
        notify_return_outcome_task.delay(
            order.user_id if order else None, listing.pk, listing.disposition or '',
        )
    except Exception as exc:  # broker down must never break the return response
        logger.warning('[signals] return_graded fan-out could not enqueue: %s', exc)
