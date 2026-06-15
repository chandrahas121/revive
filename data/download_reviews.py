"""
data/download_reviews.py
------------------------
Pull REAL customer reviews from the **Amazon Reviews 2023 (UCSD/McAuley)** dataset
so the product pages can show authentic Amazon-style reviews that genuinely match
the product.

Why two streams (meta + reviews):
    Filtering review *text* alone can't tell a real shoe from a "shoe horn" or
    "boot dryer" — they all mention "shoe". So we GROUND each product's identity in
    the dataset's **product title** (the meta file), then attach that exact ASIN's
    real reviews:
      1. stream meta_<category>.jsonl.gz → keep ASINs whose TITLE is genuinely the
         product type (a shoe / a men's shirt / a phone / a laptop) and NOT an
         accessory or a women's/niche item;
      2. stream the review file → collect reviews for those exact ASINs, grouped by
         ASIN, until enough products each have >= min reviews.
    Both files are multi-GB; we stream + early-stop, pulling a slice not the whole.

Output (one JSONL per storefront bucket; consumed by `manage.py seed_demo`):
    data/reviews_{phone,laptop,footwear,apparel}.jsonl
    Each line: {rating,title,text,author_id,asin,ptitle,verified,helpful,timestamp}
    (`ptitle` = the real product title the review belongs to.)

Usage:
    python data/download_reviews.py                       # all buckets
    python data/download_reviews.py --bucket footwear
    python data/download_reviews.py --asins 55 --min-per-asin 6
"""
from __future__ import annotations
import argparse
import gzip
import json
import logging
import re
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent
_BASE = "https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/"
_REVIEW_BASE = _BASE + "review_categories/"
_META_BASE = _BASE + "meta_categories/"

# storefront bucket → review file, meta file, and TITLE rules used to keep only
# real products of the right type.
#   need  — the product title must contain at least one (whole word)
#   avoid — if the title contains any (whole word) it's an accessory / wrong item
BUCKETS = {
    "phone": {
        "review": "Cell_Phones_and_Accessories.jsonl.gz",
        "meta": "Cell_Phones_and_Accessories.jsonl.gz",
        "need": ("smartphone", "unlocked phone", "cell phone", "iphone", "galaxy",
                 "pixel", "oneplus", "moto g", "5g phone"),
        "avoid": ("case", "cover", "protector", "tempered", "cable", "charger", "holder",
                  "mount", "stylus", "adapter", "earphone", "earbud", "headphone", "lens",
                  "strap", "stand", "grip", "wallet", "skin", "sticker", "glass", "ring",
                  "battery", "charm", "popsocket", "kickstand", "armband", "lanyard",
                  "band", "gear", "watch", "replacement", "tripod", "selfie", "gimbal",
                  "dock", "speaker", "tablet", "screen", "kit", "tool", "repair"),
    },
    "laptop": {
        "review": "Electronics.jsonl.gz",
        "meta": "Electronics.jsonl.gz",
        "need": ("laptop", "notebook", "macbook", "ultrabook", "chromebook"),
        "avoid": ("bag", "sleeve", "case", "charger", "adapter", "stand", "cooling",
                  "hub", "dock", "webcam", "headset", "ssd", "hard drive", "ram",
                  "memory", "mouse", "keyboard", "skin", "protector", "battery",
                  "replacement", "cable", "fan", "screen"),
    },
    "footwear": {
        "review": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "meta": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "need": ("shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "loafer",
                 "loafers", "trainer", "trainers", "running shoe"),
        "avoid": ("horn", "tree", "trees", "polish", "oil", "conditioner", "lace",
                  "laces", "insole", "insoles", "sock", "socks", "cleaner", "brush",
                  "spray", "rack", "dryer", "goo", "stretcher", "protector", "deodorizer",
                  "cream", "wax", "bag", "keychain", "charm", "grabber", "holder", "mat",
                  "women", "womens", "girls", "kids", "toddler", "heel", "heels", "pump",
                  "stiletto", "sandal", "slipper"),
    },
    "apparel": {
        "review": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "meta": "Clothing_Shoes_and_Jewelry.jsonl.gz",
        "need": ("shirt", "t-shirt", "tshirt", "tee", "jeans", "trouser", "trousers",
                 "chino", "chinos", "polo", "hoodie", "jacket", "sweatshirt", "blazer",
                 "sweater", "henley"),
        "avoid": ("women", "womens", "girl", "girls", "ladies", "dress", "gown", "skirt",
                  "blouse", "bra", "panty", "panties", "pantyhose", "stockings", "lingerie",
                  "swimsuit", "bikini", "pajama", "pajamas", "robe", "costume", "belt",
                  "wallet", "watch", "sock", "socks", "tie", "scarf", "glove", "gloves",
                  "hat", "cap", "sunglasses", "necklace", "bracelet", "earring", "shoe",
                  "boot", "sneaker", "maternity", "nursing", "leggings", "tights"),
    },
}


def _clean(s: str) -> str:
    """Repair the curly-quote mojibake (U+FFFD), collapse the <br /> HTML, trim."""
    if not s:
        return ""
    return (s.replace("�", "'")
             .replace("<br />", " ").replace("<br>", " ")
             .replace("\n", " ").strip())


def _has(low: str, words) -> bool:
    """Whole-word match (optional plural) — 'pant' never matches 'pantyhose'."""
    return any(re.search(r"\b" + re.escape(w) + r"(?:s|es)?\b", low) for w in words)


def _title_ok(title: str, spec: dict) -> bool:
    t = (title or "").lower()
    if not t or len(t) < 6:
        return False
    if _has(t, spec["avoid"]):
        return False
    return _has(t, spec["need"])


def _collect_good_asins(bucket: str, spec: dict, want: int, scan_cap: int) -> dict:
    """Stream the meta file; keep {asin: title} for real products of this type."""
    url = _META_BASE + "meta_" + spec["meta"]
    logger.info(f"[{bucket}] meta: {url}")
    good: dict[str, str] = {}
    scanned = 0
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (REVIVE seed)"})
    with urllib.request.urlopen(req, timeout=180) as resp:  # noqa: S310
        with gzip.GzipFile(fileobj=resp) as gz:
            for raw in gz:
                if len(good) >= want or scanned >= scan_cap:
                    break
                scanned += 1
                try:
                    m = json.loads(raw)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                asin = m.get("parent_asin") or m.get("asin") or ""
                title = (m.get("title") or "").strip()
                if asin and asin not in good and _title_ok(title, spec):
                    good[asin] = title[:120]
                    if len(good) % 50 == 0:
                        print(f"\r  [{bucket}] real products found {len(good)}/{want} "
                              f"(scanned {scanned})", end="", flush=True)
    print()
    logger.info(f"[{bucket}] {len(good)} real products from meta (scanned {scanned})")
    return good


def fetch_bucket(bucket: str, target_asins: int, min_per_asin: int,
                 max_per_asin: int = 20, meta_cap: int = 500_000,
                 scan_cap: int = 3_000_000) -> Path:
    spec = BUCKETS[bucket]
    out_path = DATA_DIR / f"reviews_{bucket}.jsonl"

    # 1) Real products of this type, by title. Collect a LARGE pool so the review
    #    join hits often (fast) — every kept review is from a title-verified product.
    good = _collect_good_asins(bucket, spec, want=60_000, scan_cap=meta_cap)
    if not good:
        logger.warning(f"[{bucket}] no real products found in meta — skipping")
        return out_path

    # 2) Their real reviews, grouped by ASIN.
    url = _REVIEW_BASE + spec["review"]
    logger.info(f"[{bucket}] reviews: {url} (need {target_asins} products "
                f">= {min_per_asin} reviews)")
    acc: dict[str, list] = {}
    qualifying: set[str] = set()
    scanned = kept = 0
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (REVIVE seed)"})
    with urllib.request.urlopen(req, timeout=180) as resp:  # noqa: S310
        with gzip.GzipFile(fileobj=resp) as gz:
            for raw in gz:
                if len(qualifying) >= target_asins or scanned >= scan_cap:
                    break
                scanned += 1
                try:
                    r = json.loads(raw)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue
                asin = r.get("parent_asin") or r.get("asin") or ""
                if asin not in good:
                    continue
                text = r.get("text") or ""
                title = (r.get("title") or "").strip()
                if not title or r.get("rating") is None or not (40 <= len(text) <= 650):
                    continue
                lst = acc.setdefault(asin, [])
                if len(lst) >= max_per_asin:
                    continue
                lst.append({
                    "rating": int(round(float(r.get("rating", 0)))),
                    "title": _clean(title)[:140],
                    "text": _clean(text)[:650],
                    "author_id": r.get("user_id", ""),
                    "asin": asin,
                    "ptitle": good[asin],
                    "verified": bool(r.get("verified_purchase", False)),
                    "helpful": int(r.get("helpful_vote", 0) or 0),
                    "timestamp": r.get("timestamp", 0),
                })
                kept += 1
                if len(lst) == min_per_asin:
                    qualifying.add(asin)
                    print(f"\r  [{bucket}] products ready {len(qualifying)}/{target_asins} "
                          f"(kept {kept}, scanned {scanned})", end="", flush=True)
    print()
    written = 0
    with open(out_path, "w", encoding="utf-8") as out:
        for asin in qualifying:
            for rec in acc[asin]:
                out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                written += 1
    logger.info(f"[{bucket}] ✅ {len(qualifying)} products · {written} reviews "
                f"(scanned {scanned} review lines)")
    return out_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Download real Amazon reviews grounded on product titles")
    ap.add_argument("--bucket", choices=list(BUCKETS), help="only this bucket (default: all)")
    ap.add_argument("--asins", type=int, default=55, help="distinct products per bucket")
    ap.add_argument("--min-per-asin", type=int, default=6, help="min reviews per product")
    ap.add_argument("--scan-cap", type=int, default=3_000_000, help="max review lines to stream")
    args = ap.parse_args()

    for b in ([args.bucket] if args.bucket else list(BUCKETS)):
        fetch_bucket(b, args.asins, args.min_per_asin, scan_cap=args.scan_cap)
