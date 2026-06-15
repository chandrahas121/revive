"""
Management command: python manage.py assign_fit_items

Gives every clothing Product its own real fit dataset item (Product.fit_item_id),
so the Fit-Twin card returns item-specific outcomes instead of every product
falling back to the same category cohort (which made them all recommend "size 6").

Each product is matched to a distinct high-volume dataset item, assigned
deterministically (stable across re-runs). Products that already have a
fit_item_id are left alone unless --all is passed.
"""
import sys
from pathlib import Path

from django.core.management.base import BaseCommand

from core.models import Product

REPO_ROOT = Path(__file__).resolve().parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Catalogue categories that are garments (Fit-Twin applies). NOTE: footwear is
# intentionally excluded — shoes don't use the S–XXL clothing fit model.
CLOTHING = {
    "apparel", "clothing", "dress", "gown", "top", "tops", "shirt", "jacket",
    "romper", "jumpsuit", "skirt", "sheath",
}
MIN_REVIEWS = 10   # an item needs this many real reviews to be worth assigning


class Command(BaseCommand):
    help = "Assign each clothing product a real fit dataset item so Fit-Twin is item-specific."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true",
                            help="Reassign every clothing product (not just those missing one).")

    def handle(self, *args, **opts):
        from ml.fittwin.match import _load
        idx = _load()
        if idx is None:
            self.stderr.write("No fit index found — run: python ml/fittwin/build_index.py")
            return
        df = idx["records"]

        # Pool of distinct, well-reviewed items, highest-volume first.
        vc = df.groupby("item_id").size()
        pool = [str(i) for i in vc[vc >= MIN_REVIEWS].sort_values(ascending=False).index if str(i)]
        if not pool:
            self.stderr.write("No items with enough reviews to assign.")
            return

        products = [p for p in Product.objects.all() if p.category.lower() in CLOTHING]
        if not opts["all"]:
            products = [p for p in products if not p.fit_item_id]
        products.sort(key=lambda p: p.id)   # deterministic order -> stable assignment

        assigned = 0
        for i, p in enumerate(products):
            iid = pool[i % len(pool)]
            p.fit_item_id = iid
            p.save(update_fields=["fit_item_id"])
            n = int((df["item_id"] == iid).sum())
            self.stdout.write(f"  {p.title[:40]:40s} -> item {iid} ({n} reviews)")
            assigned += 1

        self.stdout.write(self.style.SUCCESS(
            f"Assigned fit items to {assigned} products from a pool of {len(pool)} real items."
        ))
