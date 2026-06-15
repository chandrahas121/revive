"""
data/download_datasets.py
--------------------------
Download all required datasets for Project REVIVE ML training.

Datasets:
  1. Mercari Price Suggestion (Kaggle) — price model training
  2. Amazon Reviews 2023 (UCSD) — ALS recommender + prevention priors

Usage:
    # Mercari (needs Kaggle API key configured):
    python data/download_datasets.py --mercari

    # Amazon Reviews (direct download):
    python data/download_datasets.py --amazon-reviews --category Electronics

    # Both:
    python data/download_datasets.py --mercari --amazon-reviews
"""
from __future__ import annotations
import argparse
import gzip
import json
import logging
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent


# ─── Amazon Reviews 2023 ──────────────────────────────────────────────────────
AMAZON_REVIEWS_URLS = {
    "Electronics": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/Electronics.jsonl.gz",
    "Clothing": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/Clothing_Shoes_and_Jewelry.jsonl.gz",
    "Sports": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/Sports_and_Outdoors.jsonl.gz",
    "Home": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/Home_and_Kitchen.jsonl.gz",
}

# Fallback: smaller pre-processed 5-core versions
AMAZON_5CORE_URLS = {
    "Electronics": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/benchmark/5core/rating_only/Electronics.csv.gz",
    "Clothing": "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/benchmark/5core/rating_only/Clothing_Shoes_and_Jewelry.csv.gz",
}

# ─── Amazon Reviews 2023 — ITEM METADATA (titles/prices/images/brand/rating) ────
# These are what the catalog importer (manage.py import_amazon_data / seed_real)
# needs. One friendly name → one UCSD meta_*.jsonl.gz file.
_META_BASE = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/meta_categories/"
AMAZON_META_URLS = {
    "Electronics": _META_BASE + "meta_Electronics.jsonl.gz",
    "Phones":      _META_BASE + "meta_Cell_Phones_and_Accessories.jsonl.gz",
    "Clothing":    _META_BASE + "meta_Clothing_Shoes_and_Jewelry.jsonl.gz",
    "Home":        _META_BASE + "meta_Home_and_Kitchen.jsonl.gz",
    "Sports":      _META_BASE + "meta_Sports_and_Outdoors.jsonl.gz",
    "Toys":        _META_BASE + "meta_Toys_and_Games.jsonl.gz",
    "Beauty":      _META_BASE + "meta_Beauty_and_Personal_Care.jsonl.gz",
    "Books":       _META_BASE + "meta_Books.jsonl.gz",
}


def download_amazon_meta(category: str = "Electronics", max_items: int = 4000) -> Path:
    """Stream a meta_*.jsonl.gz and write only the first `max_items` items that
    have a usable (title + image + price). Streaming + early-stop means you pull
    a few MB, not the multi-GB full file. Output: data/meta_<category>.jsonl
    """
    url = AMAZON_META_URLS.get(category)
    if not url:
        raise ValueError(f"Unknown meta category: {category}. Options: {list(AMAZON_META_URLS)}")

    out_path = DATA_DIR / f"meta_{category.lower()}.jsonl"
    if out_path.exists():
        logger.info(f"Already exists: {out_path}")
        return out_path

    logger.info(f"Streaming metadata: {url}")
    logger.info(f"  → {out_path}  (keeping first {max_items} usable items)")

    kept = scanned = 0
    # Stream the gzip over HTTP and decode line-by-line; stop as soon as we have
    # enough usable items (so we never download the whole multi-GB file).
    with urllib.request.urlopen(url) as resp:  # noqa: S310 (trusted academic host)
        with gzip.GzipFile(fileobj=resp) as gz:
            with open(out_path, "w", encoding="utf-8") as out:
                for raw in gz:
                    if kept >= max_items:
                        break
                    scanned += 1
                    try:
                        m = json.loads(raw)
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
                    title = (m.get("title") or "").strip()
                    imgs = m.get("images") or []
                    has_img = any(isinstance(im, dict) and (im.get("large") or im.get("hi_res") or im.get("thumb")) for im in imgs)
                    price = m.get("price")
                    has_price = price not in (None, "", "None")
                    if not (title and has_img and has_price):
                        continue
                    out.write(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
                    kept += 1
                    if kept % 500 == 0:
                        print(f"\r  kept {kept}/{max_items} (scanned {scanned})", end="", flush=True)
    print()
    logger.info(f"✅ Wrote {kept} items to {out_path} (scanned {scanned} lines)")
    return out_path


def _download_with_progress(url: str, dest: Path) -> None:
    logger.info(f"Downloading: {url}")
    logger.info(f"       → {dest}")

    def _reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            pct = min(100, downloaded * 100 // total_size)
            if block_num % 200 == 0:
                print(f"\r  {pct}% ({downloaded // 1_048_576} MB / {total_size // 1_048_576} MB)", end="", flush=True)

    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest, reporthook=_reporthook)
    print()  # newline after progress


def download_amazon_reviews(category: str = "Electronics", use_5core: bool = True) -> Path:
    """Download and decompress Amazon Reviews dataset."""
    urls = AMAZON_5CORE_URLS if use_5core else AMAZON_REVIEWS_URLS
    url = urls.get(category)
    if not url:
        raise ValueError(f"Unknown category: {category}. Options: {list(urls.keys())}")

    gz_path = DATA_DIR / f"amazon_reviews_{category.lower()}.jsonl.gz"
    out_path = DATA_DIR / f"amazon_reviews_{category.lower()}.jsonl"

    if out_path.exists():
        logger.info(f"Already exists: {out_path}")
        return out_path

    _download_with_progress(url, gz_path)

    logger.info(f"Decompressing {gz_path}…")
    with gzip.open(gz_path, "rb") as f_in:
        with open(out_path, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    gz_path.unlink(missing_ok=True)
    logger.info(f"✅ Amazon Reviews saved: {out_path}")
    return out_path


def download_mercari_kaggle() -> Path:
    """Download Mercari Price Suggestion from Kaggle."""
    out_path = DATA_DIR / "mercari_train.tsv"
    if out_path.exists():
        logger.info(f"Already exists: {out_path}")
        return out_path

    try:
        logger.info("Downloading Mercari dataset via Kaggle API…")
        subprocess.run(
            ["kaggle", "competitions", "download", "-c", "mercari-price-suggestion-challenge",
             "-f", "train.tsv.7z", "-p", str(DATA_DIR)],
            check=True,
        )
        # Try to extract 7z
        import py7zr
        with py7zr.SevenZipFile(DATA_DIR / "train.tsv.7z", mode="r") as z:
            z.extractall(DATA_DIR)
        (DATA_DIR / "train.tsv").rename(out_path)
        logger.info(f"✅ Mercari data saved: {out_path}")
    except FileNotFoundError:
        logger.error(
            "Kaggle CLI not found. Install: pip install kaggle\n"
            "Configure API key: https://www.kaggle.com/docs/api\n"
            "Or download manually from: https://www.kaggle.com/c/mercari-price-suggestion-challenge/data"
        )
        # Create a minimal synthetic Mercari-format file for testing
        _create_synthetic_mercari(out_path)

    return out_path


def _create_synthetic_mercari(path: Path, n: int = 10_000) -> None:
    """Create a small synthetic Mercari TSV for testing when real data unavailable."""
    import random
    rng = random.Random(42)
    categories = [
        "Women/Tops & Blouses/T-Shirts",
        "Electronics/Computers/Laptops",
        "Sporting Goods/Exercise & Fitness/Cardio Equipment",
        "Kids/Shoes",
        "Home/Bedding/Comforter Sets",
    ]
    brands = ["Nike", "Apple", "Samsung", "Zara", "H&M", "Unknown", "Adidas"]
    rows = ["train_id\tname\titem_condition_id\tcategory_name\tbrand_name\tprice\tshipping\titem_description"]
    for i in range(n):
        cat = rng.choice(categories)
        brand = rng.choice(brands)
        cond = rng.randint(1, 5)
        price = round(max(1.0, rng.gauss(50, 30)), 2)
        rows.append(f"{i}\tItem {i}\t{cond}\t{cat}\t{brand}\t{price}\t{rng.randint(0,1)}\tSynthetic item description")
    path.write_text("\n".join(rows))
    logger.info(f"✅ Synthetic Mercari dataset created: {path} ({n} rows)")



# ─── Clothing Fit (Rent the Runway / ModCloth) ─ Pillar 4 Fit-Twin ──────
def download_clothing_fit() -> Path:
    """Download the clothing-fit dataset (Rent the Runway + ModCloth) from Kaggle.

    Produces:
        data/renttherunway_final_data.json
        data/modcloth_final_data.json
    """
    rtr = DATA_DIR / "renttherunway_final_data.json"
    if rtr.exists():
        logger.info(f"Already exists: {rtr}")
        return rtr
    try:
        logger.info("Downloading clothing-fit dataset via Kaggle API\u2026")
        subprocess.run(
            ["kaggle", "datasets", "download", "-d",
             "rmisra/clothing-fit-dataset-for-size-recommendation",
             "-p", str(DATA_DIR), "--unzip"],
            check=True,
        )
        logger.info(f"\u2705 Clothing-fit data saved to {DATA_DIR}")
    except FileNotFoundError:
        logger.error(
            "Kaggle CLI not found. Install: pip install kaggle\n"
            "Configure API key: see data/KAGGLE_SETUP.md\n"
            "Or download manually: "
            "https://www.kaggle.com/datasets/rmisra/clothing-fit-dataset-for-size-recommendation"
        )
    return rtr


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download REVIVE ML datasets")
    parser.add_argument("--mercari", action="store_true", help="Download Mercari Price Suggestion")
    parser.add_argument("--fit", action="store_true", help="Download clothing-fit (Rent the Runway / ModCloth)")
    parser.add_argument("--amazon-reviews", action="store_true", help="Download Amazon Reviews 2023 (review data)")
    parser.add_argument("--meta", action="store_true",
                        help="Download Amazon Reviews 2023 ITEM METADATA (for the catalog importer)")
    parser.add_argument("--category", default="Electronics",
                        help="Category (reviews: %s ; meta: %s)" % (
                            list(AMAZON_REVIEWS_URLS.keys()), list(AMAZON_META_URLS.keys())))
    parser.add_argument("--max-items", type=int, default=4000,
                        help="(--meta) keep first N usable items so you pull MB not GB")
    parser.add_argument("--full", action="store_true", help="Download full (not 5-core) Amazon reviews")
    args = parser.parse_args()

    if not args.mercari and not args.amazon_reviews and not args.fit and not args.meta:
        parser.print_help()
        sys.exit(1)

    if args.mercari:
        p = download_mercari_kaggle()
        print(f"Mercari: {p}")

    if args.fit:
        p = download_clothing_fit()
        print(f"Clothing-fit: {p}")

    if args.amazon_reviews:
        p = download_amazon_reviews(args.category, use_5core=not args.full)
        print(f"Amazon Reviews: {p}")

    if args.meta:
        p = download_amazon_meta(args.category, max_items=args.max_items)
        print(f"Amazon metadata: {p}")
