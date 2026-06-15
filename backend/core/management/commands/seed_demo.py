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
from datetime import timedelta, date
from pathlib import Path
import json
import os
import random

# Seed prices use the fast grade-based heuristic — never load the 2.3 GB Keras
# ensemble during seeding (it's only for the live Sell-It demo). Must be set
# before ml.route / ml.price_keras read it.
os.environ["REVIVE_USE_KERAS_PRICE"] = "0"

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Product, Listing, Order, User, Review
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

# Where the downloaded real-review JSONL files live (repo_root/data).
DATA_DIR = Path(__file__).resolve().parents[4] / "data"
# storefront bucket file → catalogue category it feeds.
REVIEW_BUCKETS = {
    "phone": "Phone", "laptop": "Laptop",
    "footwear": "Footwear", "apparel": "Apparel",
}

# Real Amazon reviews are anonymised (opaque user_id) — give each a believable,
# deterministic display name so the page reads like Amazon. Mixed IN/US pool.
_FIRST = ["Arjun", "Priya", "Rohan", "Aisha", "Vikram", "Sneha", "Karan", "Neha",
          "Aditya", "Pooja", "Rahul", "Divya", "Sameer", "Ananya", "Nikhil",
          "Megha", "John", "Sarah", "Michael", "Emily", "David", "Jessica",
          "Daniel", "Laura", "Chris", "Amanda", "Kevin", "Rachel", "Manish",
          "Shreya", "Tarun", "Ritika", "Imran", "Fatima", "George", "Olivia"]
_LAST_INITIAL = list("ABCDFGHJKLMNPRSTVW")


def _display_name(author_id: str, rng: random.Random) -> str:
    """Deterministic-ish 'Firstname L.' from the dataset's opaque author_id."""
    seed = sum(ord(c) for c in (author_id or "anon")) or rng.randint(1, 9999)
    return f"{_FIRST[seed % len(_FIRST)]} {_LAST_INITIAL[(seed // 7) % len(_LAST_INITIAL)]}."


def _load_reviews(bucket: str):
    path = DATA_DIR / f"reviews_{bucket}.jsonl"
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return out


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

    # ── Real Amazon reviews → products, by category ──────────────────────────
    @transaction.atomic
    def _seed_reviews(self, products):
        by_cat = {}
        for p in products:
            by_cat.setdefault(p.category, []).append(p)

        # Amazon products skew positive — a flagship doesn't average 2.7★. We use
        # 100% REAL review TEXT, but deal each REAL star bucket round-robin across
        # every product in the category, so all products get the same positive
        # skew (~4.2★) instead of one item clumping the low-rated reviews.
        rng = random.Random(11)
        total = 0
        for bucket, category in REVIEW_BUCKETS.items():
            pool = _load_reviews(bucket)
            targets = by_cat.get(category, [])
            if not pool or not targets:
                self.stdout.write(f"  reviews[{bucket}]: no data/targets — skipped")
                continue

            # Bucket the real reviews by their real star rating, then cap the
            # low-star buckets so the blended average lands in the believable
            # 4.0–4.5 band (keep some critical reviews, just not a flood).
            star_pool = {s: [] for s in range(1, 6)}
            for rec in pool:
                s = max(1, min(5, int(rec.get("rating", 5) or 5)))
                star_pool[s].append(rec)
            for s in star_pool:
                rng.shuffle(star_pool[s])
            keep5 = len(star_pool[5])
            caps = {5: keep5, 4: keep5, 3: keep5 // 3, 2: keep5 // 6, 1: keep5 // 10}
            for s, cap in caps.items():
                star_pool[s] = star_pool[s][:max(0, cap)]

            per = max(8, sum(len(v) for v in star_pool.values()) // len(targets))
            counts = {p.id: 0 for p in targets}
            assign = {p.id: [] for p in targets}
            ti = 0
            for s in (5, 4, 3, 2, 1):           # deal best reviews first, round-robin
                for rec in star_pool[s]:
                    placed = False
                    for _ in range(len(targets)):
                        p = targets[ti % len(targets)]
                        ti += 1
                        if counts[p.id] < per:
                            assign[p.id].append((s, rec))
                            counts[p.id] += 1
                            placed = True
                            break
                    if not placed:
                        break

            objs = []
            for p in targets:
                pairs = assign[p.id]
                if not pairs:
                    continue
                ratings = [s for s, _ in pairs]
                for s, rec in pairs:
                    ts = rec.get("timestamp") or 0
                    try:
                        rdate = date.fromtimestamp(ts / 1000) if ts else None
                    except (OSError, OverflowError, ValueError):
                        rdate = None
                    objs.append(Review(
                        product=p, author=_display_name(rec.get("author_id", ""), rng),
                        rating=s, title=(rec.get("title") or "")[:160],
                        body=(rec.get("text") or "")[:650],
                        verified_purchase=bool(rec.get("verified", True)),
                        helpful_votes=int(rec.get("helpful", 0) or 0),
                        review_date=rdate, source_asin=(rec.get("asin") or "")[:20],
                    ))
                # Star rating from the real reviews; rating_count stays the large
                # catalogue figure (Amazon shows far more ratings than reviews).
                p.rating = round(sum(ratings) / len(ratings), 1)
                total += len(pairs)
            Review.objects.bulk_create(objs)
            Product.objects.bulk_update(targets, ["rating"])
            self.stdout.write(f"  reviews[{bucket}->{category}]: {len(objs)} across {len(targets)} products")
        return total

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
        Review.objects.all().delete()
        Listing.objects.all().delete()
        Product.objects.all().delete()
        CreditTransaction.objects.filter(user=demo).delete()

        self.stdout.write("Building branded NEW catalog...")
        products = upsert_demo_catalog()   # each gets one NEW listing at MRP

        # 2b) Attach REAL Amazon reviews (downloaded from the UCSD Amazon Reviews
        #     2023 dataset) to products, by category — and set each product's
        #     star rating from the real reviews it received.
        n_reviews = self._seed_reviews(products)

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
            f"{n_revive} Revive · {n_renewed} Renewed · {HealthCard.objects.count()} cards · "
            f"{n_reviews} real Amazon reviews.\n"
            f"Catalog mix: {cats}\n"
            f"Buyer: demo@revive.in / demo12345 · Sellers: *.seller@revive.in / seller12345"))
