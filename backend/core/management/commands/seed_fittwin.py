"""
Management command: python manage.py seed_fittwin

Seeds REAL demo data for Fit-Twin (Pillar 4) straight from the clothing-fit
dataset — no synthetic users:

  * picks a handful of real shoppers (with rich review history) and creates
    demo User accounts carrying their actual measurements + a fit_size_profile
    derived from the sizes that genuinely fit them;
  * picks the highest-volume real items per category and creates catalogue
    Products linked to them (Product.fit_item_id), each with one Listing, so the
    storefront has fashion items whose Fit-Twin cohorts are real.

Run AFTER building the index:
    python ml/fittwin/build_index.py          # needs the downloaded dataset
    cd backend && python manage.py migrate
    python manage.py seed_fittwin

Options:
    --input  path to dataset json (default: data/renttherunway_final_data.json,
             falling back to data/_sample_renttherunway.json)
    --users  number of demo users   (default 4)
    --products-per-category  (default 1)
    --password  demo account password (default revive123)
"""
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
import sys

from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import User, Product, Listing

REPO_ROOT = Path(__file__).resolve().parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from ml.fittwin import parsing  # noqa: E402
from ml.fittwin.build_index import _iter_records, DATA_DIR  # noqa: E402

# Categories we want to surface as demo storefront products.
DEMO_CATEGORIES = ["dress", "gown", "top", "jacket", "romper"]

TITLE_TEMPLATES = {
    "dress": "Wrap Midi Dress", "gown": "Floor-Length Evening Gown",
    "top": "Draped Blouse", "jacket": "Tailored Blazer",
    "romper": "Linen Romper", "skirt": "A-Line Skirt",
    "jumpsuit": "Wide-Leg Jumpsuit", "sheath": "Sheath Dress",
}
IMG = "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=400&fit=crop"


def _load_rows(path: Path):
    rows = []
    for r in _iter_records(path):
        h = parsing.parse_height(r.get("height"))
        w = parsing.parse_weight(r.get("weight"))
        size = parsing.parse_size(r.get("size"))
        fit = parsing.parse_fit(r.get("fit"))
        if None in (h, w, size, fit):
            continue
        rows.append({
            "user_id": str(r.get("user_id", "")),
            "item_id": str(r.get("item_id", "")),
            "category": parsing.norm_category(r.get("category")),
            "body_type": str(r.get("body type") or "").strip().lower(),
            "height_in": h, "weight_lb": w,
            "bust_in": parsing.parse_bust(r.get("bust size")),
            "age": parsing.parse_age(r.get("age")),
            "size": size, "fit": fit,
        })
    return rows


class Command(BaseCommand):
    help = "Seed real demo users + fashion products for Fit-Twin from the dataset."

    def add_arguments(self, parser):
        parser.add_argument("--input", default=None)
        parser.add_argument("--users", type=int, default=4)
        parser.add_argument("--products-per-category", type=int, default=1)
        parser.add_argument("--password", default="revive123")

    def handle(self, *args, **opts):
        # resolve dataset path
        if opts["input"]:
            path = Path(opts["input"])
        else:
            real = DATA_DIR / "renttherunway_final_data.json"
            path = real if real.exists() else DATA_DIR / "_sample_renttherunway.json"
        if not path.exists():
            self.stderr.write(self.style.ERROR(f"Dataset not found: {path}"))
            return
        self.stdout.write(f"Reading {path.name} …")
        rows = _load_rows(path)
        self.stdout.write(f"  {len(rows)} usable rows")

        self._seed_products(rows, opts["products_per_category"])
        self._seed_users(rows, opts["users"], opts["password"])
        self.stdout.write(self.style.SUCCESS("Fit-Twin demo seed complete."))

    # ── demo storefront products linked to real dataset items ────────────────
    @transaction.atomic
    def _seed_products(self, rows, per_cat):
        by_cat_item = defaultdict(Counter)
        for r in rows:
            if r["category"] in DEMO_CATEGORIES and r["item_id"]:
                by_cat_item[r["category"]][r["item_id"]] += 1

        created = 0
        for cat in DEMO_CATEGORIES:
            top_items = [iid for iid, _ in by_cat_item[cat].most_common(per_cat)]
            for n, iid in enumerate(top_items):
                asin = f"RTR-{iid}"
                title = f"{TITLE_TEMPLATES.get(cat, cat.title())}"
                prod, made = Product.objects.update_or_create(
                    asin=asin,
                    defaults=dict(
                        title=title, category=cat, brand="Studio Revive",
                        mrp=Decimal("2499.00"), reference_image_url=IMG,
                        description=f"Demo {cat} linked to real fit data.",
                        fit_item_id=iid,
                    ),
                )
                Listing.objects.get_or_create(
                    product=prod, source="warehouse", grade="A",
                    defaults=dict(price=Decimal("1799.00"),
                                  condition_summary="New with tags.", status="listed"),
                )
                created += 1
        self.stdout.write(f"  products: {created} fashion items linked to real items")

    # ── demo users carrying real measurements + derived size profile ─────────
    @transaction.atomic
    def _seed_users(self, rows, n_users, password):
        by_user = defaultdict(list)
        for r in rows:
            if r["user_id"]:
                by_user[r["user_id"]].append(r)

        # prefer users with several reviews and complete body data
        def score(recs):
            complete = all(recs[0].get(k) is not None for k in ("bust_in", "age"))
            return (len(recs), complete)

        ranked = sorted(by_user.items(), key=lambda kv: score(kv[1]), reverse=True)
        picked = ranked[:n_users]

        for i, (uid, recs) in enumerate(picked, start=1):
            base = recs[0]
            # fit_size_profile: per category, the size that actually fit them
            prof = {}
            cat_fit_sizes = defaultdict(list)
            for r in recs:
                if r["fit"] == "fit":
                    cat_fit_sizes[r["category"]].append(r["size"])
            for cat, sizes in cat_fit_sizes.items():
                sizes.sort()
                prof[cat] = sizes[len(sizes) // 2]  # median fitting size

            email = f"fittwin{i}@revive.test"
            user, _ = User.objects.update_or_create(
                email=email,
                defaults=dict(
                    username=f"fittwin{i}",
                    height_in=base["height_in"], weight_lb=base["weight_lb"],
                    bust_in=base["bust_in"], age=int(base["age"]) if base["age"] else None,
                    body_type=base["body_type"], fit_size_profile=prof,
                    return_rate=round(sum(1 for r in recs if r["fit"] != "fit") / len(recs), 3),
                ),
            )
            user.set_password(password)
            user.save()
            self.stdout.write(
                f"  user {email}: {base['height_in']:.0f}in / {base['weight_lb']:.0f}lb "
                f"/ {base['body_type'] or 'n/a'} / {len(recs)} reviews / profile={prof}"
            )
