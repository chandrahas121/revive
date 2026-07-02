"""
route/tasks.py
--------------
Scheduled routing tasks. Currently: rebuild the geohash demand index.

Runs in the Celery Beat schedule (see revive/celery.py) every 6 hours so the
EV-routing demand gravity always reflects recent order history instead of
seed-time data. Reuses the exact logic from ml/build_demand_index.py — the
Celery task is just a scheduled wrapper around it.
"""
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name='route.tasks.rebuild_demand_index')
def rebuild_demand_index():
    """Rebuild the (geohash5, category) demand index and push it to Redis."""
    try:
        from ml.build_demand_index import build_synthetic_demand, save_to_json, push_to_redis

        demand_index = build_synthetic_demand()
        save_to_json(demand_index)
        keys_written = push_to_redis(demand_index)

        logger.info('[demand_index] rebuilt — %s Redis keys written', keys_written)
        return {'status': 'ok', 'keys_written': keys_written}
    except Exception as exc:  # never let a scheduled job crash the worker
        logger.error('[demand_index] rebuild failed: %s', exc)
        return {'status': 'error', 'error': str(exc)}
