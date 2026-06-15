"""
python manage.py seed_demo  — self-contained DEMO catalog (NO dataset files).

Builds the whole storefront from the curated branded catalog in _demo_catalog.py
(phones, laptops, monitors, shoes, t-shirts/shirts/pants + a few Home/Books/Toys
extras). Every product is a normal Amazon NEW listing; a hand-picked subset is
ALSO listed as Revive (AI-graded, seller photos) or Renewed (professional) on the
SAME product, so the product page shows New + Used/Renewed buying options.

This replaces seed_real / the Amazon-dataset import (import_amazon_data.py,
download_datasets.py, data/meta_*.jsonl) for the demo — those are deprecated.

Run:
    python manage.py migrate
    python manage.py seed_demo

Logins: buyer demo@revive.in / demo12345 · sellers *.seller@revive.in / seller12345
"""
from datetime import timedelta
import os
import random

# Seed prices use the fast grade-based heuristic — never load the 2.3 GB Keras
# ensemble during seeding (it's only for the live Sell-It demo). Must be set
# before ml.route / ml.price_keras read it.
os.environ["REVIVE_USE_KERAS_PRICE"] = "0"

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Product, Listing, Order, User
from trust.models import HealthCard, LedgerEntry
from green.models import CreditTransaction
from core.management.commands.import_amazon_data import create_listing_for, _route_fn
from core.management.commands._demo_catalog import upsert_demo_catalog

SELLERS = [
    ("aarav.seller@revive.in", "Aarav", "Mehta", "tbxx1"),
    ("diya.seller@revive.in", "Diya", "Sharma", "tbxx2"),
    ("kabir.seller@revive.in", "Kabir", "Nair", "tbxx3"),
    ("ananya.seller@revive.in", "Ananya", "Rao", "tbxw1"),
    ("vivaan.seller@revive.in", "Vivaan", "Iyer", "tbxu1"),
]

# High-value electronics that go to Amazon Renewed (professional refurb).
RENEWED_CATS = {"Phone", "Laptop", "Monitor"}
# Categories that lead the Revive (AI-graded) second-life surface.
REVIVE_LEAD_CATS = ["Apparel", "Footwear"]


def _guarantee(tier):
    if tier == 3:
        return 90, "Amazon SPN"
    if tier == 2:
        return 30, "seller_escrow"
    return 7, "seller_escrow"


class Command(BaseCommand):
    help = "Seed the demo catalog (no dataset): curated New + Revive/Renewed on the same products."

    def add_arguments(self, parser):
        parser.add_argument("--renewed", type=int, default=10,
                            help="How many phones/laptops/monitors to also list as Renewed.")
        parser.add_argument("--revive", type=int, default=16,
                            help="How many items to also list as Revive (tees/shoes + a few open-box).")

    def handle(self, *args, **o):
        # 1) Demo sellers + buyer
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

        # 2) Wipe and rebuild the catalog
        self.stdout.write("Wiping existing catalog...")
        HealthCard.objects.all().delete()
        Order.objects.all().delete()
        Listing.objects.all().delete()
        Product.objects.all().delete()
        CreditTransaction.objects.filter(user=demo).delete()

        self.stdout.write("Building branded NEW catalog...")
        products = upsert_demo_catalog()   # each gets one NEW listing at MRP

        # 3) Curate second-life listings on a subset of the SAME products
        rng = random.Random(7)
        route_item = _route_fn()
        by_cat = {}
        for p in products:
            by_cat.setdefault(p.category, []).append(p)
        for lst in by_cat.values():
            lst.sort(key=lambda p: -float(p.mrp))   # highest value first

        def _round_robin(cats, pools, n, exclude=None):
            """Take items by round-robin across categories (each pool pre-sorted),
            so every category is represented — not dominated by one."""
            exclude = exclude or set()
            queues = {c: [p for p in pools.get(c, []) if p.id not in exclude] for c in cats}
            picks, i = [], 0
            while len(picks) < n and any(queues.values()):
                c = cats[i % len(cats)]
                if queues[c]:
                    picks.append(queues[c].pop(0))
                i += 1
            return picks

        # Renewed: a balanced spread of phones / laptops / MONITORS → professional refurb
        renewed_picks = _round_robin(["Monitor", "Laptop", "Phone"], by_cat, o["renewed"])
        renewed_ids = {p.id for p in renewed_picks}

        n_renewed = 0
        for p in renewed_picks:
            if create_listing_for(p, p.category, rng, sellers, route_item,
                                  grade=rng.choice(["A", "B"]), force_renewed=True):
                n_renewed += 1

        # Revive: lead with a balanced tees + shoes spread, then a few open-box electronics
        openbox = _round_robin(["Phone", "Laptop", "Monitor"], by_cat, 3, exclude=renewed_ids)
        openbox_ids = {p.id for p in openbox}
        lead = _round_robin(REVIVE_LEAD_CATS, by_cat, max(0, o["revive"] - len(openbox)),
                            exclude=renewed_ids | openbox_ids)
        revive_picks = lead + openbox

        n_revive = 0
        for p in revive_picks:
            is_elec = p.category in RENEWED_CATS
            grade = "A" if is_elec else rng.choice(["A", "B", "B", "C", "C", "D"])
            if create_listing_for(p, p.category, rng, sellers, route_item,
                                  grade=grade, force_renewed=False, with_photos=True):
                n_revive += 1

        # 4) Health Cards for every curated second-life listing
        self.stdout.write("Generating health cards...")
        sl = Listing.objects.exclude(source=Listing.Source.NEW).select_related("product")
        for listing in sl:
            tier = listing.tier or 1
            gdays, gholder = _guarantee(tier)
            inspected = "ai_spn" if tier == 3 else "ai_agent" if tier == 2 else "ai_only"
            is_elec = listing.product.category in RENEWED_CATS
            card = HealthCard.objects.create(
                listing=listing, tier=tier, grade=listing.grade or "B",
                confidence=0.9 if listing.grade == "A" else 0.82,
                defects=[], completeness=listing.completeness,
                condition_summary=listing.condition_summary, functional=True,
                box_present=(listing.grade == "A"), inspected_by=inspected,
                model_version="revive-grade-v1.0",
                previous_owners=(1 if listing.source == "renewed" else 0),
                battery_pct=(90 if (listing.source == "renewed" and is_elec
                                    and listing.product.category in ("Phone", "Laptop")) else None),
                guarantee_days=gdays, guarantee_holder=gholder)
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.GRADED, prev_hash="",
                data={"grade": listing.grade, "tier": tier, "inspected_by": inspected,
                      "route": listing.chosen_path, "disposition": listing.disposition})
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.LISTED,
                prev_hash=card.ledger.last().this_hash,
                data={"price": str(listing.price), "source": listing.source})

        # 5) Demo buyer orders ready to return — covering the demo categories
        self.stdout.write("Creating demo buyer orders + credits...")
        now = timezone.now()

        def _pick(category, title_contains=None):
            qs = Product.objects.filter(category=category)
            if title_contains:
                m = qs.filter(title__icontains=title_contains).first()
                if m:
                    return m
            return qs.order_by("-mrp").first()

        return_targets = [
            _pick("Phone", "iPhone 14"),
            _pick("Laptop", "Inspiron"),
            _pick("Monitor", "BenQ"),
            _pick("Apparel", "T-Shirt"),
            _pick("Footwear", "Air Max"),
        ]
        for prod in return_targets:
            if not prod:
                continue
            new_listing = Listing.objects.filter(product=prod, source=Listing.Source.NEW).first()
            if not new_listing:
                continue
            Order.objects.create(
                user=demo, listing=new_listing, status="delivered",
                is_p2p=False, escrow_released=True,
                return_window_closes=now + timedelta(days=5))

        for amt, reason, cat in [
            (120, "Kept monitor + kirana drop", "Monitor"),
            (80, "Kept cookware + kirana drop", "Home & Kitchen"),
            (60, "Kept t-shirt + kirana drop", "Apparel"),
            (40, "Kept sneakers + kirana drop", "Footwear")]:
            CreditTransaction.objects.create(user=demo, kind="earn", status="vested",
                                             amount=amt, reason=reason, category=cat)
        CreditTransaction.objects.create(user=demo, kind="earn", status="pending",
                                         amount=16, reason="Air Fryer — window closes in 4 days",
                                         category="Home & Kitchen", vests_at=now + timedelta(days=4))

        cats = ", ".join(f"{k}:{len(v)}" for k, v in sorted(by_cat.items(), key=lambda x: -len(x[1])))
        self.stdout.write(self.style.SUCCESS(
            f"\nDone! {Product.objects.count()} products · "
            f"{Listing.objects.filter(source='new').count()} New · "
            f"{n_revive} Revive · {n_renewed} Renewed · {HealthCard.objects.count()} cards.\n"
            f"Catalog mix: {cats}\n"
            f"Buyer: demo@revive.in / demo12345 · Sellers: *.seller@revive.in / seller12345"))
