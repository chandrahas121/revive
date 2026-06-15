"""
python manage.py seed_demo  — storefront catalog: curated brands + REAL Amazon data.

Builds the storefront from two sources:
  • the curated branded catalog in _demo_catalog.py (phones, laptops, monitors,
    shoes, t-shirts/shirts/pants + a few Home/Books/Toys extras) — guarantees the
    Sell-It catalog search + recognizable demo brands; and
  • real Amazon ASINs from data/catalog_{bucket}.jsonl (real image + title + price),
    each carrying its OWN ASIN's real reviews 1:1 (see _real_catalog.py).
Real products are skipped gracefully if the catalog files aren't present (e.g. the
dataset host wasn't reachable) — the storefront then runs on the curated set alone.

Every product is a normal Amazon NEW listing; a hand-picked subset is ALSO listed as
Revive (AI-graded, seller photos) or Renewed (professional) on the SAME product. Each
product's reviews are mined by the Pillar-4 review panel (ml/review_insights.py) into a
fit signal + a "What buyers say" summary that also drives the checkout return nudge.

This replaces seed_real / the legacy Amazon-dataset import (import_amazon_data.py,
download_datasets.py, data/meta_*.jsonl) for the demo — those are deprecated.

Run:
    python manage.py migrate
    python manage.py seed_demo

Logins: buyer demo@revive.in / demo12345 · sellers *.seller@revive.in / seller12345
"""
from datetime import timedelta, date
from decimal import Decimal
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
from core.management.commands._real_catalog import upsert_real_catalog

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
    "phone": "Phone", "laptop": "Laptop", "monitor": "Monitor",
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


# ── Demo hero phone ──────────────────────────────────────────────────────────
# One curated, recognisable phone the presenter orders + returns live. Uses the
# locally-supplied product photo (frontend/public/iqoo_neo_7_pro.jpg, served at
# /iqoo_neo_7_pro.jpg) so the image is exactly right on screen, and carries its
# OWN hand-written reviews (asin IQOO_ASIN) so they read as real for this product.
IQOO_ASIN = "IQOO-NEO7PRO"
IQOO_IMAGE = "/iqoo_neo_7_pro.jpg"

_IQOO_REVIEWS = [
    dict(rating=5, title="Insane performance for the price",
         text="Snapdragon 8+ Gen 1 absolutely flies. PUBG and BGMI at max settings "
              "with zero lag, and it barely warms up. Best value flagship-killer right now.",
         author_id="iqoo-rv-01", verified=True, helpful=42, timestamp=1686700000000),
    dict(rating=5, title="120W charging is a game changer",
         text="0 to 100 in about 25 minutes. I just plug it in while getting ready and "
              "it's full. The 120Hz AMOLED display is gorgeous too.",
         author_id="iqoo-rv-02", verified=True, helpful=31, timestamp=1687300000000),
    dict(rating=4, title="Great phone, software has a few ads",
         text="Performance and battery are top notch. Funtouch OS shows occasional "
              "recommendations you have to turn off, but once cleaned up it's smooth.",
         author_id="iqoo-rv-03", verified=True, helpful=18, timestamp=1688100000000),
    dict(rating=5, title="Camera is better than I expected",
         text="The 50MP main sensor takes sharp, punchy daylight shots and night mode is "
              "usable. Not a Pixel but for this segment it's very good.",
         author_id="iqoo-rv-04", verified=True, helpful=12, timestamp=1689000000000),
    dict(rating=4, title="Battery easily lasts a full day",
         text="Getting 6-7 hours screen-on time with heavy use. The 5000mAh cell plus "
              "fast charging means range anxiety is gone.",
         author_id="iqoo-rv-05", verified=True, helpful=9, timestamp=1690200000000),
    dict(rating=5, title="No regrets, upgraded from a OnePlus",
         text="Feels faster than my old OnePlus Nord, lighter in hand, and the haptics "
              "are crisp. Display gets bright enough outdoors.",
         author_id="iqoo-rv-06", verified=True, helpful=7, timestamp=1691400000000),
    dict(rating=3, title="Good phone but it's a fingerprint magnet",
         text="Performance is great, no complaints there. The glossy back picks up "
              "smudges instantly so use the included case.",
         author_id="iqoo-rv-07", verified=True, helpful=5, timestamp=1692600000000),
    dict(rating=5, title="Display + speakers are excellent for content",
         text="Stereo speakers are loud and clear, and the AMOLED panel makes Netflix "
              "pop. Great media phone for the money.",
         author_id="iqoo-rv-08", verified=True, helpful=4, timestamp=1693800000000),
]


def _upsert_iqoo_hero():
    """Create/refresh the iQOO Neo 7 Pro hero phone (local image) + its NEW listing.
    Returns the Product so it joins the normal review + listing pipeline."""
    prod, _ = Product.objects.update_or_create(
        asin=IQOO_ASIN,
        defaults=dict(
            title="iQOO Neo 7 Pro 5G (12GB RAM, 256GB, Dark Storm)",
            category="Phone", brand="iQOO", mrp=Decimal("34999"),
            reference_image_url=IQOO_IMAGE,
            description=("iQOO Neo 7 Pro 5G with Snapdragon 8+ Gen 1, 6.78\" 120Hz "
                         "AMOLED display, 50MP OIS main camera, 5000mAh battery with "
                         "120W FlashCharge, and an independent gaming chip. Brand-new, "
                         "full manufacturer warranty."),
            rating=4.4, rating_count=2873),
    )
    Listing.objects.update_or_create(
        product=prod, source=Listing.Source.NEW,
        defaults=dict(grade="", price=prod.mrp, completeness=1.0,
                      condition_summary="", status=Listing.Status.LISTED,
                      image_url=IQOO_IMAGE, condition_label="New",
                      seller=None, tier=0, disposition="", risk_tier=""),
    )
    return prod


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
    def _borrow_assign(self, pool, curated_targets, category):
        """Existing category-matched borrowing for CURATED (DEMO-xxx) products that
        have no real ASIN of their own. Returns {product_id: [review records]}."""
        if not curated_targets:
            return {}
        by_asin = {}
        for rec in pool:
            a = rec.get("asin", "")
            if not _ptitle_ok(rec.get("ptitle", ""), category):
                continue
            by_asin.setdefault(a, []).append(rec)

        def _avg(recs):
            return sum(int(r.get("rating", 5) or 5) for r in recs) / len(recs)
        asins = [a for a, recs in by_asin.items()
                 if a and len(recs) >= 5 and _avg(recs) >= 3.8]
        asins.sort(key=lambda a: (-_avg(by_asin[a]), -len(by_asin[a])))
        if not asins:
            asins = sorted((a for a, recs in by_asin.items() if a and len(recs) >= 5),
                           key=lambda a: -len(by_asin[a]))
        if category in ("Apparel", "Footwear"):
            kept = [a for a in asins if not _asin_is_wrong(by_asin[a], category)]
            if len(kept) >= 8:
                asins = kept
        if not asins:
            return {}

        out = {}
        if category == "Apparel":
            from collections import defaultdict
            group_pool = defaultdict(list)
            for a in asins:
                ptitle = next((r.get("ptitle") for r in by_asin[a] if r.get("ptitle")), "")
                agg = ptitle or " ".join((r.get("title", "") + " " + r.get("text", ""))
                                         for r in by_asin[a])
                group_pool[_apparel_group(agg)].append(a)
            gi = defaultdict(int)
            for p in curated_targets:
                g = _apparel_group(p.title)
                lst = group_pool.get(g) or asins
                out[p.id] = by_asin[lst[gi[g] % len(lst)]]
                gi[g] += 1
        else:
            for i, p in enumerate(curated_targets):
                out[p.id] = by_asin[asins[i % len(asins)]]
        return out

    @transaction.atomic
    def _seed_reviews(self, products):
        by_cat = {}
        for p in products:
            by_cat.setdefault(p.category, []).append(p)

        # Each demo product gets ONE real product's full review set. A REAL Amazon
        # product gets its OWN ASIN's reviews 1:1 (identity is exact); a curated
        # DEMO product borrows a category/garment-matched real product's reviews.
        rng = random.Random(11)
        total = 0
        seeded = []   # (product, attached records, category) → review-panel input
        for bucket, category in REVIEW_BUCKETS.items():
            pool = _load_reviews(bucket)
            if bucket == "phone":
                # The iQOO hero ships its own reviews (keyed by IQOO_ASIN) so it gets
                # an exact 1:1 attach like any real ASIN.
                pool = pool + [{**r, "asin": IQOO_ASIN} for r in _IQOO_REVIEWS]
            targets = by_cat.get(category, [])
            if not pool or not targets:
                self.stdout.write(f"  reviews[{bucket}]: no data/targets — skipped")
                continue

            # All reviews grouped by their real product ASIN (1:1 lookup for real items).
            raw_by_asin = {}
            for rec in pool:
                a = rec.get("asin", "")
                if a:
                    raw_by_asin.setdefault(a, []).append(rec)

            real_targets = [p for p in targets if p.asin in raw_by_asin]
            curated_targets = [p for p in targets if p.asin not in raw_by_asin]

            prod_recs = {p.id: raw_by_asin[p.asin] for p in real_targets}   # 1:1
            prod_recs.update(self._borrow_assign(pool, curated_targets, category))

            objs = []
            seeded_targets = []
            for p in targets:
                recs = [r for r in (prod_recs.get(p.id) or [])
                        if not _title_accessory(r.get("title", ""))]
                if not recs:
                    continue
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
                seeded_targets.append(p)
                seeded.append((p, recs, category))
            Review.objects.bulk_create(objs)
            Product.objects.bulk_update(targets, ["rating"])
            self.stdout.write(
                f"  reviews[{bucket}->{category}]: {len(objs)} reviews across "
                f"{len(seeded_targets)} products ({len(real_targets)} real 1:1, "
                f"{len(curated_targets)} curated borrowed)")

        # Pillar-4 review intelligence: mine fit signal + run the cached review panel
        # on everything that received reviews (fit_signal for apparel/footwear; the
        # review_summary card + return signal for all graded categories).
        self._run_review_panel(seeded)
        return total

    def _run_review_panel(self, seeded):
        """Populate Product.fit_signal + Product.review_summary from the attached
        reviews. Fails open per-product (offline → heuristic summary, no crash)."""
        if not seeded:
            return
        import sys
        from pathlib import Path as _P
        repo_root = str(_P(__file__).resolve().parents[4])
        if repo_root not in sys.path:
            sys.path.insert(0, repo_root)
        try:
            from ml.review_insights import review_panel, mine_fit_signal
        except Exception as e:
            self.stdout.write(f"  review panel unavailable ({e}) — skipping insights")
            return

        FIT_CATS = {"Apparel", "Footwear"}
        updated, with_fit = [], 0
        for p, recs, category in seeded:
            try:
                p.review_summary = review_panel(p.asin, p.title, category, recs)
                if category in FIT_CATS:
                    fs = mine_fit_signal(recs)
                    p.fit_signal = fs
                    if fs:
                        with_fit += 1
            except Exception:
                continue
            updated.append(p)
        if updated:
            Product.objects.bulk_update(updated, ["fit_signal", "review_summary"])
        self.stdout.write(f"  review panel: {len(updated)} summaries · {with_fit} fit signals")

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

        self.stdout.write("Building catalog (curated + real Amazon)...")
        # Curated phones/laptops/monitors used reused stock photos + borrowed reviews,
        # so we skip them and let the REAL Amazon electronics (real image + own 1:1
        # reviews) stand alone. Curated apparel/footwear/extras stay for brand variety.
        curated = upsert_demo_catalog(skip_categories=RENEWED_CATS)
        real = upsert_real_catalog()       # real Amazon ASINs (real image/title/price/reviews)
        iqoo = _upsert_iqoo_hero()         # one recognisable hero phone with local photo
        products = curated + real + [iqoo]
        self.stdout.write(f"  catalog: {len(curated)} curated + {len(real)} real + 1 hero "
                          f"= {len(products)} products")

        # 2b) Attach REAL Amazon reviews (UCSD Amazon Reviews 2023). Real products get
        #     their OWN ASIN's reviews 1:1; curated products borrow a matched real set.
        #     Each product's star rating is recomputed from the reviews it received,
        #     then the review panel mines fit_signal + the "What buyers say" summary.
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

        # Hero return targets — one concrete product per demo category. Real ASINs
        # have arbitrary titles, so pick the highest-value item in each category
        # (the brand literals are kept only as a hint for the curated catalog).
        return_targets = [
            _pick("Phone", "iQOO Neo 7"),
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
