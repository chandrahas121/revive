"""
python manage.py seed_real  — replace the demo seed with the REAL Amazon catalog.

  1. import every data/meta_*.jsonl as the normal Amazon NEW catalog (full MRP),
  2. CURATE a small second-life set for the demo (default 40 Revive + 20 Renewed) —
     NOT every product; the rest stay New, just like real Amazon,
  3. generate Health Cards for the curated second-life listings,
  4. seed demo sellers/buyer + orders + Green-Credit history.

Get data first (free):
    python data/download_datasets.py --meta --category Electronics --max-items 4000
    python data/download_datasets.py --meta --category Clothing    --max-items 4000
then:  python manage.py seed_real

Flags: --keep-demo, --per-file N (default 1500), --revive N (default 40), --renewed N (default 20)
"""
from datetime import timedelta
from glob import glob
from pathlib import Path
import random

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Product, Listing, Order, User
from trust.models import HealthCard, LedgerEntry
from green.models import CreditTransaction
from core.management.commands.import_amazon_data import import_meta_file, create_listing_for, _route_fn
from core.management.commands._demo_catalog import upsert_demo_catalog

DATA_DIR = Path(settings.BASE_DIR).parent / "data"

SELLERS = [
    ("aarav.seller@revive.in", "Aarav", "Mehta", "tbxx1"),
    ("diya.seller@revive.in", "Diya", "Sharma", "tbxx2"),
    ("kabir.seller@revive.in", "Kabir", "Nair", "tbxx3"),
    ("ananya.seller@revive.in", "Ananya", "Rao", "tbxw1"),
    ("vivaan.seller@revive.in", "Vivaan", "Iyer", "tbxu1"),
]
RENEWED_CATS = {"Phone", "Laptop", "Electronics"}
NO_RESELL_CATS = {"Beauty"}   # hygiene — can't be resold once opened


def _guarantee(tier):
    if tier == 3:
        return 90, "Amazon SPN"
    if tier == 2:
        return 30, "seller_escrow"
    return 7, "seller_escrow"


class Command(BaseCommand):
    help = "Replace demo seed with the real Amazon catalog + a curated second-life set."

    def add_arguments(self, parser):
        parser.add_argument("--keep-demo", action="store_true")
        parser.add_argument("--per-file", type=int, default=1500)
        parser.add_argument("--revive", type=int, default=40)
        parser.add_argument("--renewed", type=int, default=20)

    def handle(self, *args, **o):
        meta_files = sorted(glob(str(DATA_DIR / "meta_*.jsonl")))
        if not meta_files:
            self.stderr.write(self.style.ERROR(
                f"No data/meta_*.jsonl files in {DATA_DIR}. Download first, e.g.:\n"
                "  python data/download_datasets.py --meta --category Electronics --max-items 4000"))
            return

        self.stdout.write("Ensuring demo sellers + buyer...")
        sellers = []
        for email, first, last, geo in SELLERS:
            u, created = User.objects.get_or_create(
                email=email,
                defaults={"username": email, "first_name": first, "last_name": last, "geohash5": geo})
            if created:
                u.set_password("seller12345"); u.save()
            sellers.append(u)
        demo, created = User.objects.get_or_create(
            email="demo@revive.in",
            defaults={"username": "demo@revive.in", "first_name": "Demo",
                      "last_name": "Buyer", "geohash5": "tbxx1"})
        if created:
            demo.set_password("demo12345"); demo.save()

        if not o["keep_demo"]:
            self.stdout.write("Wiping existing catalog (use --keep-demo to skip)...")
            HealthCard.objects.all().delete()
            Order.objects.all().delete()
            Listing.objects.all().delete()
            Product.objects.all().delete()

        # 1) import the NEW catalog (one New listing per product)
        self.stdout.write(f"Importing NEW catalog from {len(meta_files)} file(s)...")
        agg_cat = {}
        for i, mf in enumerate(meta_files):
            np_, nn_, by_cat = import_meta_file(
                mf, limit=o["per_file"], make_new=True, as_listings=0.0,
                sellers=sellers, seed=42 + i, stdout=self.stdout)
            for k, v in by_cat.items():
                agg_cat[k] = agg_cat.get(k, 0) + v

        # 1b) guaranteed branded demo products (Nike/Samsung/Vivo/Dell/… + tees/shirts/pants)
        self.stdout.write("Adding guaranteed branded demo catalog...")
        demo_products = upsert_demo_catalog()
        for p in demo_products:
            agg_cat[p.category] = agg_cat.get(p.category, 0) + 1

        # 2) CURATE the second-life set (a minority — the rest stay New)
        rng = random.Random(7)
        route_item = _route_fn()
        products = list(Product.objects.all())
        rng.shuffle(products)

        # Renewed: high-value electronics, top by popularity
        renewed_pool = sorted(
            [p for p in products if p.category in RENEWED_CATS and float(p.mrp) >= 12000],
            key=lambda p: -p.rating_count)
        renewed_picks = renewed_pool[:o["renewed"]]
        renewed_ids = {p.id for p in renewed_picks}

        n_renewed = 0
        for p in renewed_picks:
            if create_listing_for(p, p.category, rng, sellers, route_item,
                                  grade=rng.choice(["A", "B"]), force_renewed=True):
                n_renewed += 1

        # Revive: spread across categories (round-robin), with seller photos
        by_cat_products = {}
        for p in products:
            if p.id in renewed_ids or p.category in NO_RESELL_CATS:
                continue
            by_cat_products.setdefault(p.category, []).append(p)
        for lst in by_cat_products.values():
            lst.sort(key=lambda p: -p.rating_count)
        revive_picks, cats_cycle = [], list(by_cat_products.keys())
        ci = 0
        while len(revive_picks) < o["revive"] and any(by_cat_products.values()):
            cat = cats_cycle[ci % len(cats_cycle)]
            if by_cat_products[cat]:
                revive_picks.append(by_cat_products[cat].pop(0))
            ci += 1

        n_revive = 0
        for p in revive_picks:
            if create_listing_for(p, p.category, rng, sellers, route_item,
                                  grade=rng.choice(["A", "B", "B", "C", "C", "D"]),
                                  force_renewed=False, with_photos=True):
                n_revive += 1

        # 3) Health Cards for every curated second-life listing
        self.stdout.write("Generating health cards for curated second-life listings...")
        sl = Listing.objects.exclude(source=Listing.Source.NEW).select_related("product")
        for listing in sl:
            tier = listing.tier or 1
            gdays, gholder = _guarantee(tier)
            inspected = "ai_spn" if tier == 3 else "ai_agent" if tier == 2 else "ai_only"
            card = HealthCard.objects.create(
                listing=listing, tier=tier, grade=listing.grade or "B",
                confidence=0.9 if listing.grade == "A" else 0.82,
                defects=[], completeness=listing.completeness,
                condition_summary=listing.condition_summary, functional=True,
                box_present=(listing.grade == "A"), inspected_by=inspected,
                model_version="revive-grade-v1.0", previous_owners=(1 if listing.source == "renewed" else 0),
                battery_pct=(90 if (listing.source == "renewed" and listing.product.category in ("Phone", "Laptop")) else None),
                guarantee_days=gdays, guarantee_holder=gholder)
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.GRADED, prev_hash="",
                data={"grade": listing.grade, "tier": tier, "inspected_by": inspected,
                      "route": listing.chosen_path, "disposition": listing.disposition})
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.LISTED,
                prev_hash=card.ledger.last().this_hash,
                data={"price": str(listing.price), "source": listing.source})

        # 4) demo buyer orders + credits
        self.stdout.write("Creating demo buyer orders + credits...")
        Order.objects.filter(user=demo).delete()
        CreditTransaction.objects.filter(user=demo).delete()
        now = timezone.now()
        for src in (Listing.Source.P2P, Listing.Source.RENEWED):
            l = Listing.objects.filter(source=src).first()
            if l:
                Order.objects.create(
                    user=demo, listing=l, status="delivered",
                    is_p2p=(src == Listing.Source.P2P), escrow_released=True,
                    return_window_closes=now + timedelta(days=5))
        for amt, reason, cat in [
            (120, "Kept monitor + kirana drop", "Electronics"),
            (80, "Kept cookware + kirana drop", "Home & Kitchen"),
            (60, "Kept kurta + kirana drop", "Apparel"),
            (40, "Kept sneakers + kirana drop", "Footwear")]:
            CreditTransaction.objects.create(user=demo, kind="earn", status="vested",
                                             amount=amt, reason=reason, category=cat)
        CreditTransaction.objects.create(user=demo, kind="earn", status="pending",
                                         amount=16, reason="Air Fryer — window closes in 4 days",
                                         category="Home & Kitchen", vests_at=now + timedelta(days=4))

        cats = ", ".join(f"{k}:{v}" for k, v in sorted(agg_cat.items(), key=lambda x: -x[1]))
        self.stdout.write(self.style.SUCCESS(
            f"\nDone! {Product.objects.count()} products · "
            f"{Listing.objects.filter(source='new').count()} New · "
            f"{n_revive} Revive · {n_renewed} Renewed · {HealthCard.objects.count()} cards.\n"
            f"Catalog mix: {cats}\n"
            f"Buyer: demo@revive.in / demo12345 · Sellers: *.seller@revive.in / seller12345"))
