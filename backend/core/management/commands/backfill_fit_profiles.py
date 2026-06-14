"""
python manage.py backfill_fit_profiles

Recompute every user's fit_size_profile from their kept orders. Useful after
importing orders or to refresh profiles in bulk.
"""
from django.core.management.base import BaseCommand
from core.models import User
from prevent.fit_profile import update_fit_size_profile


class Command(BaseCommand):
    help = "Rebuild fit_size_profile for all users from their kept orders."

    def handle(self, *args, **opts):
        n = 0
        for user in User.objects.all():
            profile = update_fit_size_profile(user)
            if profile:
                n += 1
                self.stdout.write(f"  {user.email}: {profile}")
        self.stdout.write(self.style.SUCCESS(f"Updated {n} users with a size profile."))
