from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        # Register signal handlers (review-panel fan-out on Product creation).
        import core.signals  # noqa: F401
