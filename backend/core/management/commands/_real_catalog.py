"""
Real Amazon catalog builder (companion to _demo_catalog.py).

Reads the `data/catalog_{bucket}.jsonl` files produced by `data/download_reviews.py`
and upserts each REAL Amazon product (real image + real title + real price + brand +
rating) as a normal NEW catalog listing — exactly like the curated demo catalog, so
everything downstream (second-life curation, fit items, health cards, reviews) treats
them identically. Each product's ASIN matches its review file, so seed_demo attaches
each real product its OWN reviews 1:1.

If the catalog files are absent (e.g. the dataset host wasn't reachable at seed time),
this is a no-op and the storefront falls back to the curated catalog alone.

Not a management command (leading underscore) — imported by seed_demo.
"""
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path

from core.models import Product, Listing
from core.management.commands.import_amazon_data import _new_listing

# Repo-root/data — same location download_reviews.py writes to.
DATA_DIR = Path(__file__).resolve().parents[4] / "data"

# catalog file bucket → storefront category (mirrors seed_demo.REVIEW_BUCKETS).
CATALOG_BUCKETS = {
    "phone": "Phone", "laptop": "Laptop", "monitor": "Monitor",
    "footwear": "Footwear", "apparel": "Apparel",
}


def _load_catalog(bucket: str):
    path = DATA_DIR / f"catalog_{bucket}.jsonl"
    if not path.exists():
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return out


def upsert_real_catalog():
    """Create/refresh real Amazon products + their NEW listings from catalog_*.jsonl.
    Returns the list of Product objects (possibly empty if no catalog files exist)."""
    import random
    products = []
    for bucket, category in CATALOG_BUCKETS.items():
        records = _load_catalog(bucket)
        # Collect all valid images in this category to use as realistic extra images
        bucket_images = [r.get("image").strip() for r in records if r.get("image") and r.get("image").strip()]
        
        for rec in records:
            asin = (rec.get("asin") or "").strip()
            title = (rec.get("title") or "").strip()
            image = (rec.get("image") or "").strip()
            if not asin or not title or not image:
                continue
            try:
                mrp = Decimal(str(rec.get("price_inr")))
            except (InvalidOperation, TypeError):
                continue
            
            # Pick 2 random extra images from the same category
            extra = []
            if len(bucket_images) > 2:
                extra = random.sample(bucket_images, 2)
            
            prod, _ = Product.objects.update_or_create(
                asin=asin[:20],
                defaults=dict(
                    title=title[:255], category=category,
                    brand=(rec.get("brand") or "")[:100],
                    mrp=mrp, reference_image_url=image[:500],
                    images=[image[:500]] + extra,
                    description=(rec.get("description") or "")[:2000],
                    rating=float(rec.get("avg_rating") or 0.0),
                    rating_count=int(rec.get("rating_number") or 0)),
            )
            _new_listing(prod)
            products.append(prod)
    return products
