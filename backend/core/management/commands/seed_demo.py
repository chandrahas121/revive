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

from django.core.management import call_command
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


# Apparel garment groups — so a shirt product gets shirt reviews, jeans get jeans
# reviews, etc. (the dataset mixes all garment types in one clothing file). Order
# matters: more specific groups are checked before the bare "shirt".
_APPAREL_GROUPS = [
    ("bottoms",   ("jeans", "jean", "denim pant", "trouser", "trousers", "chino",
                   "chinos", "pant", "pants", "jogger", "joggers", "khaki", "slacks")),
    ("outerwear", ("jacket", "bomber", "blazer", "hoodie", "hooded", "sweatshirt",
                   "sweater", "coat", "fleece", "windbreaker")),
    ("tee",       ("t-shirt", "tshirt", "tee", "tees", "henley", "polo", "tank")),
    ("shirt",     ("shirt", "button-down", "button down", "flannel")),
]


# A review whose TITLE names an accessory is about the wrong product even if its
# body happens to mention "jeans"/"phone" — drop it ("BUY this belt!").
_DROP_TITLE = ("belt", "wallet", "watch", "sock", "socks", "hat", "cap", "tie",
               "scarf", "glove", "gloves", "purse", "handbag", "necklace", "bracelet",
               "earring", "sunglasses", "case", "charger", "cable", "tripod",
               "protector", "pantyhose", "panties", "bra", "stockings")


def _title_accessory(title: str) -> bool:
    import re
    t = (title or "").lower()
    return any(re.search(r"\b" + w + r"\b", t) for w in _DROP_TITLE)


# A whole real product (ASIN) can BE an accessory or a garment we don't sell that
# merely mentions our keywords ("great belt, keeps my pants up"; "love this shoe
# horn"; "warm snow suit"). If a large fraction of an ASIN's reviews look like one
# of these, drop the whole ASIN from the pool.
_ACCESSORY_TERMS = ("belt", "buckle", "suspender", "suspenders", "wallet", "watch",
                    "sunglasses", "cufflink", "cufflinks", "bowtie", "scarf", "glove",
                    "gloves", "beanie", "purse", "handbag", "jewelry", "necklace",
                    "bracelet", "earring", "sock", "socks", "lace", "laces", "insole",
                    "insoles", "shoehorn", "shoe horn", "horn", "shoe tree", "shoe trees",
                    "polish", "orthotic", "orthotics", "arch support", "shoe stretcher",
                    "inserts", "deodorizer", "shoe rack")
# Garments the catalog doesn't sell (women's / niche) — wrong product for our items.
_WRONG_GARMENT = ("snowsuit", "snow suit", "ski suit", "snow pants", "snowpants",
                  "coverall", "coveralls", "onesie", "pajama", "pajamas", "pyjama",
                  "robe", "nightshirt", "nightgown", "costume", "swimsuit", "swim trunks",
                  "wetsuit", "apron", "scrubs", "lingerie", "dress", "gown", "skirt",
                  "leggings", "tights", "romper", "jumpsuit", "bikini", "saree", "kurti")
# Shoe-CARE products (not shoes) that pollute the footwear file by mentioning "shoes".
_SHOE_CARE = ("mink", "mink oil", "polish", "conditioner", "waterproofing", "weatherproof",
              "wax", "renovator", "restorer", "dye", "freshener", "stretcher", "grabber",
              "leather conditioner", "leather cream", "suede brush", "saddle soap",
              "protectant", "water repellent", "cleaner")


# Final safety gate on the REAL product title (ptitle) — catches accessories the
# download-time title filter missed (e.g. a phone "Flip Shell", laptop "Headphones").
_PTITLE_AVOID = {
    "Phone": ("case", "cover", "shell", "flip", "folio", "pouch", "purse", "bag",
              "crossbody", "sling", "holster", "clip", "pocket", "protector", "tempered",
              "cable", "charger", "holder", "mount", "stylus", "adapter", "earphone",
              "earbud", "headphone", "headphones", "headset", "lens", "strap", "stand",
              "grip", "wallet", "skin", "sticker", "glass", "ring", "battery", "band",
              "gear", "watch", "replacement", "tripod", "selfie", "gimbal", "dock",
              "speaker", "tablet", "screen", "kit", "tool", "repair", "armband", "lanyard",
              "sleeve", "car", "keychain"),
    "Laptop": ("bag", "backpack", "briefcase", "messenger", "tote", "sleeve", "case",
               "charger", "adapter", "stand", "cooling", "hub", "dock", "webcam", "headset",
               "headphone", "headphones", "earphone", "earbud", "ssd", "hard drive", "hdd",
               "drive", "dvd", "enclosure", "external", "ram", "memory", "mouse", "keyboard",
               "skin", "protector", "battery", "replacement", "cable", "fan", "screen",
               "sleep", "riser", "tray", "lock", "light", "pad", "stylus", "pen"),
    "Footwear": _ACCESSORY_TERMS + ("women", "womens", "girls", "kids", "toddler", "heel",
                                     "heels", "pump", "stiletto", "sandal", "slipper"),
    "Apparel": _WRONG_GARMENT + ("belt", "wallet", "watch", "sock", "tie", "scarf", "glove",
                                 "hat", "cap", "sunglasses", "necklace", "bracelet", "earring",
                                 "shoe", "boot", "sneaker", "women", "womens", "ladies", "girl"),
}


def _ptitle_ok(ptitle, category) -> bool:
    """Keep an ASIN only if its real product title isn't an accessory / wrong item."""
    if not ptitle:
        return True
    import re
    t = ptitle.lower()
    avoid = _PTITLE_AVOID.get(category, ())
    return not any(re.search(r"\b" + re.escape(w) + r"\b", t) for w in avoid)


def _asin_is_wrong(recs, category) -> bool:
    """True if a large fraction of the ASIN's reviews look like an accessory, a
    shoe-care product, or a garment we don't sell — i.e. the ASIN isn't really one
    of our products."""
    import re
    extra = _WRONG_GARMENT if category == "Apparel" else _SHOE_CARE
    bad_terms = _ACCESSORY_TERMS + extra
    pat = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in bad_terms) + r")\b")
    n_bad = sum(1 for r in recs
                if pat.search((r.get("title", "") + " " + r.get("text", "")).lower()))
    return n_bad >= max(2, 0.35 * len(recs))


def _apparel_group(text: str) -> str:
    """Coarse garment group for a product title or an aggregate of its reviews."""
    import re
    t = (text or "").lower()
    best, best_n = "shirt", 0
    for group, kws in _APPAREL_GROUPS:
        n = sum(len(re.findall(r"\b" + re.escape(k) + r"\b", t)) for k in kws)
        if n > best_n:
            best, best_n = group, n
    return best


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

        # Reviews are grouped BY REAL PRODUCT (ASIN) in the dataset files. We give
        # each demo product ONE real product's full review set, so every review on a
        # page is genuinely about a single real product of the right category — no
        # cross-product mismatches. (Same idea as Fit-Twin's per-item assignment.)
        rng = random.Random(11)
        total = 0
        for bucket, category in REVIEW_BUCKETS.items():
            pool = _load_reviews(bucket)
            targets = by_cat.get(category, [])
            if not pool or not targets:
                self.stdout.write(f"  reviews[{bucket}]: no data/targets — skipped")
                continue

            # Group the bucket's reviews by their real product (ASIN), dropping any
            # ASIN whose REAL product title is an accessory / wrong item.
            by_asin = {}
            for rec in pool:
                a = rec.get("asin", "")
                if not _ptitle_ok(rec.get("ptitle", ""), category):
                    continue
                by_asin.setdefault(a, []).append(rec)
            # Believable picks: enough reviews + a healthy average (so a flagship
            # never shows a 2★ product's reviews). Best-reviewed products first.
            def _avg(recs):
                return sum(int(r.get("rating", 5) or 5) for r in recs) / len(recs)
            asins = [a for a, recs in by_asin.items()
                     if a and len(recs) >= 5 and _avg(recs) >= 3.8]
            asins.sort(key=lambda a: (-_avg(by_asin[a]), -len(by_asin[a])))
            if not asins:   # relax the average floor if filtering left too few
                asins = sorted((a for a, recs in by_asin.items() if a and len(recs) >= 5),
                               key=lambda a: -len(by_asin[a]))
            # Drop ASINs that are really accessories (belts/socks/laces…) — they
            # slip past the keyword filter by mentioning "pants"/"shoes".
            if category in ("Apparel", "Footwear"):
                kept_asins = [a for a in asins if not _asin_is_wrong(by_asin[a], category)]
                if len(kept_asins) >= 8:   # prefer the clean pool (products may repeat)
                    asins = kept_asins

            if not asins:
                self.stdout.write(f"  reviews[{bucket}]: no product had enough reviews — skipped")
                continue

            # Apparel mixes garment types — match each product to a real product of
            # the SAME garment group (tee↔tee, jeans↔jeans, shirt↔shirt, …) so a
            # formal shirt never shows jeans reviews. Other buckets are single-type.
            prod_asin = {}
            if category == "Apparel":
                from collections import defaultdict
                group_pool = defaultdict(list)
                for a in asins:   # asins already sorted best-first
                    # Classify by the REAL product title (ptitle) when available —
                    # far more reliable than guessing from review text.
                    ptitle = next((r.get("ptitle") for r in by_asin[a] if r.get("ptitle")), "")
                    agg = ptitle or " ".join((r.get("title", "") + " " + r.get("text", ""))
                                             for r in by_asin[a])
                    group_pool[_apparel_group(agg)].append(a)
                gi = defaultdict(int)
                for p in targets:
                    g = _apparel_group(p.title)
                    lst = group_pool.get(g) or asins   # fall back to any if group empty
                    prod_asin[p.id] = lst[gi[g] % len(lst)]
                    gi[g] += 1
            else:
                for i, p in enumerate(targets):
                    prod_asin[p.id] = asins[i % len(asins)]

            objs = []
            for p in targets:
                recs = [r for r in by_asin[prod_asin[p.id]]
                        if not _title_accessory(r.get("title", ""))]   # one real product per item
                rng.shuffle(recs)
                recs = recs[:15]
                ratings = []
                for rec in recs:
                    rating = max(1, min(5, int(rec.get("rating", 5) or 5)))
                    ratings.append(rating)
                    ts = rec.get("timestamp") or 0
                    try:
                        rdate = date.fromtimestamp(ts / 1000) if ts else None
                    except (OSError, OverflowError, ValueError):
                        rdate = None
                    objs.append(Review(
                        product=p, author=_display_name(rec.get("author_id", ""), rng),
                        rating=rating, title=(rec.get("title") or "")[:160],
                        body=(rec.get("text") or "")[:650],
                        verified_purchase=bool(rec.get("verified", True)),
                        helpful_votes=int(rec.get("helpful", 0) or 0),
                        review_date=rdate, source_asin=(rec.get("asin") or "")[:20],
                    ))
                # Star rating from the real reviews; rating_count stays the large
                # catalogue figure (Amazon shows far more ratings than reviews).
                p.rating = round(sum(ratings) / len(ratings), 1) if ratings else p.rating
                total += len(recs)
            Review.objects.bulk_create(objs)
            Product.objects.bulk_update(targets, ["rating"])
            self.stdout.write(f"  reviews[{bucket}->{category}]: {len(objs)} reviews "
                              f"across {len(targets)} products ({len(asins)} real products in pool)")
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

        # 2c) Pillar 4 — Fit-Twin. Give every APPAREL product a real item from the
        #     Rent-the-Runway clothing-fit dataset (footwear is excluded — shoes
        #     don't use the S–XXL fit model), so the product page shows item-level
        #     "How this fits" from real fit outcomes. Then give the demo buyer a
        #     cross-category size profile so the advice is personalised ("shoppers
        #     similar to you"). No body measurements are ever asked.
        self.stdout.write("Assigning Fit-Twin items to apparel + demo size profile...")
        try:
            call_command("assign_fit_items", "--all", verbosity=0)
            n_fit = Product.objects.filter(category="Apparel").exclude(fit_item_id="").count()
            self.stdout.write(f"  fit items assigned to {n_fit} apparel products")
        except Exception as e:   # index missing → Fit-Twin just falls back gracefully
            self.stdout.write(f"  (skipped fit-item assignment: {e})")
        # Behavioral fit fingerprint for the demo buyer (dataset categories →
        # typical kept size). Lets Fit-Twin surface "shoppers similar to you".
        demo.fit_size_profile = {"dress": 8.0, "gown": 10.0, "sheath": 8.0, "top": 6.0}
        demo.save(update_fields=["fit_size_profile"])

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
