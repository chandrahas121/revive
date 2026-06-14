"""
Import REAL product data from the Amazon Reviews 2023 dataset (UCSD/McAuley)
into the catalog (Product) + optionally create second-life Listings.

Replaces the dummy seed data with real titles, prices, images, brands, ratings.

HOW TO GET THE DATA (free, no login):
  1. Go to  https://amazon-reviews-2023.github.io/
  2. Under "Per-category data" download the **item metadata** .jsonl for the
     categories you want, e.g.:
        meta_Electronics.jsonl
        meta_Clothing_Shoes_and_Jewelry.jsonl
        meta_Home_and_Kitchen.jsonl
     (Each line is one product JSON: title, price, store, images, categories, …)
  3. Put the file(s) anywhere, then run, e.g.:

     python manage.py import_amazon_data \
        --meta /path/meta_Electronics.jsonl --category Phone --limit 300
     python manage.py import_amazon_data \
        --meta /path/meta_Clothing_Shoes_and_Jewelry.jsonl --category Footwear --limit 300 --as-listings 0.4

Flags:
  --meta FILE        path to a meta_*.jsonl file (required)
  --category NAME    REVIVE category to tag these as (Phone/Footwear/Apparel/…)
  --limit N          max products to import (default 200)
  --as-listings F    fraction (0..1) to also create as second-life Listings (default 0)
  --usd-to-inr R     price conversion (default 83)
"""
import json
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from core.models import Product, Listing


def _first_image(meta):
    imgs = meta.get("images") or []
    for im in imgs:
        for key in ("large", "hi_res", "thumb"):
            if isinstance(im, dict) and im.get(key):
                return im[key]
    return ""


def _price(meta, usd_to_inr):
    p = meta.get("price")
    try:
        if p in (None, "", "None"):
            return None
        return Decimal(str(round(float(str(p).replace("$", "").replace(",", "")) * usd_to_inr, 2)))
    except (ValueError, TypeError):
        return None


def _desc(meta):
    d = meta.get("description") or []
    if isinstance(d, list):
        d = " ".join(x for x in d if isinstance(x, str))
    feats = meta.get("features") or []
    if isinstance(feats, list):
        feats = " ".join(x for x in feats if isinstance(x, str))
    return (str(d) + " " + str(feats)).strip()[:2000]


class Command(BaseCommand):
    help = "Import real Amazon Reviews 2023 product metadata into the catalog."

    def add_arguments(self, parser):
        parser.add_argument("--meta", required=True, help="path to meta_*.jsonl")
        parser.add_argument("--category", default="Other")
        parser.add_argument("--limit", type=int, default=200)
        parser.add_argument("--as-listings", type=float, default=0.0)
        parser.add_argument("--usd-to-inr", type=float, default=83.0)

    def handle(self, *args, **o):
        path, category = o["meta"], o["category"]
        limit, frac, rate = o["limit"], o["as_listings"], o["usd_to_inr"]
        rng = random.Random(42)
        n_prod = n_list = 0

        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if n_prod >= limit:
                    break
                try:
                    m = json.loads(line)
                except json.JSONDecodeError:
                    continue
                title = (m.get("title") or "").strip()
                img = _first_image(m)
                mrp = _price(m, rate)
                if not title or not img or mrp is None or mrp <= 0:
                    continue  # need a real title, image, and price

                asin = m.get("parent_asin") or m.get("asin") or f"AZ-{rng.getrandbits(32):08x}"
                prod, _ = Product.objects.update_or_create(
                    asin=asin,
                    defaults=dict(
                        title=title[:255],
                        category=category,
                        brand=(m.get("store") or "")[:100],
                        mrp=mrp,
                        reference_image_url=img[:500],
                        description=_desc(m),
                        rating=float(m.get("average_rating") or 0.0),
                        rating_count=int(m.get("rating_number") or 0),
                    ),
                )
                n_prod += 1

                # Optionally create a second-life Listing (graded, discounted)
                if frac and rng.random() < frac:
                    grade = rng.choice(["A", "B", "B", "C"])
                    recovery = {"A": 0.7, "B": 0.55, "C": 0.4}[grade]
                    Listing.objects.create(
                        product=prod,
                        source=Listing.Source.P2P,
                        grade=grade,
                        condition_summary=f"{category} in {grade}-grade condition.",
                        completeness=1.0,
                        price=Decimal(str(round(float(mrp) * recovery, 2))),
                        geohash5="tdr1w",
                        status=Listing.Status.LISTED,
                        condition_label={"A": "Used – Like New", "B": "Used – Very Good",
                                         "C": "Used – Good"}[grade],
                    )
                    n_list += 1

        self.stdout.write(self.style.SUCCESS(
            f"Imported {n_prod} products ({category}) and created {n_list} listings."))
