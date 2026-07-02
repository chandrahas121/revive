import os

from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'revive.settings')

app = Celery('revive')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ─── Scheduled (Celery Beat) jobs ────────────────────────────────────────────
# These run in a dedicated `celery beat` process (see docker-compose) so the
# demand index and review panels stay fresh without any manual command.
app.conf.beat_schedule = {
    # Rebuild the geohash demand index from order history → Redis, every 6 hours.
    # Without this the index reflects only seed-time data and routing goes stale.
    'rebuild-demand-index': {
        'task': 'route.tasks.rebuild_demand_index',
        'schedule': crontab(minute=0, hour='*/6'),
    },
    # Fill in "What buyers say" panels for products that have reviews but no
    # summary yet (e.g. new P2P listings). Runs nightly at 02:30 IST.
    'refresh-review-panels': {
        'task': 'core.tasks.refresh_stale_review_panels',
        'schedule': crontab(minute=30, hour=2),
    },
}
