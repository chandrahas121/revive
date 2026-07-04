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
import os
import threading

from django.db.models.signals import post_save
from django.dispatch import receiver

from .events import return_graded
from .models import Product

logger = logging.getLogger(__name__)


def _run_async(fn, *args):
    """Dispatch a Celery task without stalling the request.

    With a real broker (REDIS_URL set) we enqueue via ``.delay()``. Without one
    (local dev), calling ``.delay()`` BLOCKS while kombu retries to reach a Redis
    broker that isn't running — which is what made "staging" and publishing feel
    slow. So when there's no broker, run the task body synchronously in a background
    daemon thread and return immediately.
    """
    if os.environ.get('REDIS_URL'):
        try:
            fn.delay(*args)
        except Exception as exc:  # broker hiccup must never block the request
            logger.warning('[signals] enqueue failed for %s: %s', getattr(fn, 'name', fn), exc)
        return

    def _bg():
        from django.db import close_old_connections
        close_old_connections()
        try:
            fn(*args)   # run the task body inline in this thread (no broker needed)
        except Exception as exc:
            logger.warning('[signals] background task failed for %s: %s', getattr(fn, 'name', fn), exc)
        finally:
            close_old_connections()

    threading.Thread(target=_bg, daemon=True).start()


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

    from core.tasks import run_review_panel_for_product
    _run_async(run_review_panel_for_product, instance.pk)


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
    _run_async(generate_health_card_task, listing.pk, route_result)
    _run_async(record_local_supply_task, listing.geohash5 or '', listing.product.category)
    _run_async(notify_return_outcome_task,
               order.user_id if order else None, listing.pk, listing.disposition or '')
