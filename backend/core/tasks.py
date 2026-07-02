"""
core/tasks.py
-------------
Async review-panel ("What buyers say") generation.

At seed time the panel is precomputed onto Product.review_summary. But a product
created live (e.g. a new P2P listing) has no summary yet. Rather than block the
request on an LLM call, we run the panel in a Celery worker:

    Product created ─signal─▶ run_review_panel_for_product.delay(pk)
    Celery Beat (nightly) ──▶ refresh_stale_review_panels() → queues any stragglers

The frontend treats a null review_summary as "panel pending" and simply omits the
card until it is filled in.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)

# How many stale products to enqueue per nightly sweep (keeps LLM cost bounded).
_MAX_PER_SWEEP = 50


@shared_task(name='core.tasks.refresh_stale_review_panels')
def refresh_stale_review_panels():
    """Queue a panel run for products that have reviews but no summary yet."""
    from core.models import Product

    stale = list(
        Product.objects
        .filter(review_summary__isnull=True, reviews__isnull=False)
        .distinct()
        .values_list('pk', flat=True)[:_MAX_PER_SWEEP]
    )
    for pk in stale:
        run_review_panel_for_product.delay(pk)

    logger.info('[review_panel] queued %s stale product(s)', len(stale))
    return {'queued': len(stale)}


@shared_task(name='core.tasks.run_review_panel_for_product')
def run_review_panel_for_product(product_pk: int):
    """Run the multi-agent review panel for one product and persist the result."""
    from core.models import Product
    from ml.review_insights import review_panel

    try:
        product = Product.objects.get(pk=product_pk)
    except Product.DoesNotExist:
        logger.warning('[review_panel] product %s no longer exists', product_pk)
        return {'status': 'missing'}

    reviews = [
        {'title': t, 'body': b, 'rating': r}
        for t, b, r in product.reviews.values_list('title', 'body', 'rating')
    ]
    if not reviews:
        return {'status': 'no_reviews'}

    try:
        summary = review_panel(
            asin=product.asin,
            title=product.title,
            category=product.category,
            reviews=reviews,
        )
        product.review_summary = summary
        product.save(update_fields=['review_summary'])
        return {'status': 'ok', 'product': product_pk}
    except Exception as exc:  # fail-open — a missing card is fine, a crash is not
        logger.warning('[review_panel] product %s failed: %s', product_pk, exc)
        return {'status': 'error', 'error': str(exc)}


# ── return_graded event-bus consumers (see core/signals.on_return_graded) ─────
# Each is an independent reaction to one "return graded" event. They run in the
# Celery worker in parallel and never block the return API response.

@shared_task(name='core.tasks.generate_health_card_task')
def generate_health_card_task(listing_pk: int, route_result: dict = None):
    """Generate the Product Health Card for a staged return listing."""
    from core.models import Listing
    from trust.services import generate_health_card

    try:
        listing = Listing.objects.select_related('product').get(pk=listing_pk)
    except Listing.DoesNotExist:
        return {'status': 'missing'}

    route_result = route_result or {}
    tier = route_result.get('tier') or listing.tier or 1
    inspected_by = 'ai_spn' if tier == 3 else ('ai_agent' if tier == 2 else 'ai_only')
    grade_result = {
        'grade': listing.grade,
        'completeness': float(listing.completeness or 1.0),
        'condition_summary': listing.condition_summary or '',
        'confidence': 0.8,
        'functional': True,
        'defects': [],
        'model_version': 'revive-grade-v1.0',
    }

    card, created = generate_health_card(
        listing, grade_result=grade_result, route_result=route_result, inspected_by=inspected_by,
    )
    return {'status': 'ok', 'card_id': str(card.card_id), 'created': created}


@shared_task(name='core.tasks.record_local_supply_task')
def record_local_supply_task(geohash5: str, category: str):
    """Bump the local-supply counter for (geohash5, category) — O(1) Redis write.
    Feeds the demand-gravity routing signal without a full index rebuild."""
    from django.core.cache import cache

    key = f'supply:{geohash5}:{category}'
    try:
        count = cache.incr(key)
    except ValueError:  # key doesn't exist yet
        cache.set(key, 1, None)
        count = 1
    return {'status': 'ok', 'key': key, 'count': count}


@shared_task(name='core.tasks.notify_return_outcome_task')
def notify_return_outcome_task(user_id, listing_pk: int, disposition: str):
    """Notify the user of their return's outcome. Placeholder sink (cache + log) —
    in production this pushes to email/SMS/websocket; the point is it runs
    independently of the API response."""
    from django.core.cache import cache

    if not user_id:
        return {'status': 'skipped'}
    cache.set(f'notify:user:{user_id}:latest', {
        'type': 'return_processed',
        'listing_id': listing_pk,
        'disposition': disposition,
    }, 86400)
    logger.info('[notify] user %s: return listing %s → %s', user_id, listing_pk, disposition)
    return {'status': 'ok'}
