"""
data/download_reviews.py
------------------------
Pull REAL customer reviews from the **Amazon Reviews 2023 (UCSD/McAuley)** raw
review files and bucket them by the storefront category they belong to, so the
product pages can show authentic Amazon-style reviews.

The raw per-category files are multi-GB. We stream the gzip over HTTP and
EARLY-STOP after collecting `--per-bucket` usable reviews per bucket, so we only
pull a few MB — never the whole file. Each kept review is lightly relevance- and
quality-filtered (keyword match to the product type, sane length, real title).

Output (one JSONL per storefront bucket; consumed by `manage.py seed_demo`):
    data/reviews_phone.jsonl
    data/reviews_laptop.jsonl
    data/reviews_footwear.jsonl
    data/reviews_apparel.jsonl

Each line: {rating,title,text,author_id,asin,verified,helpful,timestamp}

Usage:
    python data/download_reviews.py                  # all buckets, 600 each
    python data/download_reviews.py --per-bucket 800
    python data/download_reviews.py --bucket phone
"""
from __future__ import annotations
import argparse
import gzip
import json
import logging
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent
_REVIEW_BASE = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/review_categories/"

# storefront bucket → (UCSD review file, core keywords, accessory exclusions).
# Buckets mirror the demo catalog categories: Phone / Laptop / Footwear / Apparel.
# `kw`    — at least one must appear (review is actually about the product type)
# `block` — if any appears IN THE TITLE, the review is about an accessory, not the
#           product itself (cases, backpacks, hats…) → skip. Titles in this dataset
#           reliably name the reviewed item ("Great case", "Best backpack").
BUCKETS = {
    "phone": {
        "file": "Cell_Phones_and_Accessories.jsonl.gz",
        "kw": ("phone", "smartphone", "iphone", "galaxy", "android",
               "battery life", "camera quality", "the display", "this device"),
        "block": ("case", "cover", "protector", "tempered", "cable", "charger",
                  "charging", "holder", "mount", "popsocket", "pop socket", "stylus",
                  "adapter", "earphone", "earbud", "headphone", "ring", "lens",
                  "strap", "stand", "grip", "wallet", "skin", "sticker"),
    },
    "laptop": {
        "file": "Electronics.jsonl.gz",
        "kw": ("laptop", "notebook", "macbook", "ultrabook", "this computer"),
        "block": ("backpack", "bag", "sleeve", "case", "mouse", "cable", "charger",
                  "adapter", "stand", "cooling", "hub", "dock", "webcam", "headset",
                  "ssd", "hard drive", "ram ", "monitor", "keyboard", "skin", "screen protector"),
    },
    "footwear": {
        "file": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "kw": ("shoe", "shoes", "sneaker", "sneakers", "boot", "boots",
               "loafer", "running shoe", "trainers"),
        "block": ("sock", "insole", "lace", "shoe horn", "cleaner", "jewelry",
                  "watch", "hat", "necklace", "bracelet", "earring", "bag"),
    },
    "apparel": {
        "file": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "kw": ("shirt", "t-shirt", "tee", "jeans", "trouser", "pant", "chino",
               "polo", "hoodie", "jacket", "sweatshirt", "blazer"),
        "block": ("hat", "cap", "sock", "glove", "scarf", "belt", "wallet", "bag",
                  "jewelry", "necklace", "ring", "watch", "sunglass", "underwear",
                  "boxer", "tie", "shoe", "boot", "sneaker", "earring", "bracelet"),
    },
}


def _clean(s: str) -> str:
    """Repair the curly-quote mojibake (U+FFFD) common in this dump, collapse
    the <br /> HTML the dataset embeds, and trim."""
    if not s:
        return ""
    return (s.replace("�", "'")
             .replace("<br />", " ").replace("<br>", " ")
             .replace("\n", " ").strip())


def _usable(r: dict, spec: dict) -> bool:
    text = (r.get("text") or "")
    title = (r.get("title") or "").strip()
    rating = r.get("rating")
    if not title or rating is None:
        return False
    if not (40 <= len(text) <= 650):
        return False
    title_low = title.lower()
    # Title names an accessory, not the product itself → skip.
    if any(b in title_low for b in spec["block"]):
        return False
    low = (title + " " + text).lower()
    return any(k in low for k in spec["kw"])


def fetch_bucket(bucket: str, per_bucket: int) -> Path:
    spec = BUCKETS[bucket]
    url = _REVIEW_BASE + spec["file"]
    out_path = DATA_DIR / f"reviews_{bucket}.jsonl"
    logger.info(f"[{bucket}] streaming {url}")
    logger.info(f"[{bucket}]   → {out_path} (keeping first {per_bucket} usable)")

    kept = scanned = 0
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (REVIVE demo seed)"})
    with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310 (trusted academic host)
        with gzip.GzipFile(fileobj=resp) as gz:
            with open(out_path, "w", encoding="utf-8") as out:
                for raw in gz:
                    if kept >= per_bucket:
                        break
                    scanned += 1
                    try:
                        r = json.loads(raw)
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue
                    if not _usable(r, spec):
                        continue
                    rec = {
                        "rating": int(round(float(r.get("rating", 0)))),
                        "title": _clean(r.get("title", ""))[:140],
                        "text": _clean(r.get("text", ""))[:650],
                        "author_id": r.get("user_id", ""),
                        "asin": r.get("asin", ""),
                        "verified": bool(r.get("verified_purchase", False)),
                        "helpful": int(r.get("helpful_vote", 0) or 0),
                        "timestamp": r.get("timestamp", 0),
                    }
                    out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    kept += 1
                    if kept % 100 == 0:
                        print(f"\r  [{bucket}] kept {kept}/{per_bucket} (scanned {scanned})",
                              end="", flush=True)
    print()
    logger.info(f"[{bucket}] ✅ wrote {kept} reviews (scanned {scanned} lines)")
    return out_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Download real Amazon reviews per storefront bucket")
    ap.add_argument("--bucket", choices=list(BUCKETS), help="only this bucket (default: all)")
    ap.add_argument("--per-bucket", type=int, default=600, help="usable reviews to keep per bucket")
    args = ap.parse_args()

    targets = [args.bucket] if args.bucket else list(BUCKETS)
    for b in targets:
        fetch_bucket(b, args.per_bucket)
