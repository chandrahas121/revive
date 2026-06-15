"""
Import REAL product data from the Amazon Reviews 2023 dataset (UCSD/McAuley).

Every imported product becomes a normal Amazon NEW catalog listing (full MRP).
Second-life (Revive/Renewed) listings are created only for a CURATED subset —
see seed_real.py, which calls create_listing_for() for ~60 hand-picked items.
Smart per-item categorisation + v2-routed second-life pricing.
"""
import json
import random
from decimal import Decimal

from django.core.management.base import BaseCommand
from core.models import Product, Listing, User


GEOHASHES = ['tbxx1', 'tbxx2', 'tbxx3', 'tbxx4', 'tbxw1', 'tbxv1', 'tbxu1', 'tbxu2']

CATEGORY_RULES = [
    ("Phone",          ["smartphone", "cell phone", "cellphone", "iphone", "galaxy s",
                         "galaxy note", "pixel phone", "android phone", "oneplus", "moto g"]),
    ("Laptop",         ["laptop", "notebook computer", "macbook", "chromebook",
                         "ultrabook", "gaming laptop", "thinkpad"]),
    ("Footwear",       ["shoe", "sneaker", "footwear", "boot", "sandal", "loafer",
                         "heel", "running shoe", "cleat", "slipper", "flip flop"]),
    ("Apparel",        ["t-shirt", "tshirt", "shirt", "jeans", "dress", "jacket",
                         "hoodie", "sweater", "trouser", "kurta", "blouse", "apparel",
                         "clothing", "leggings", "shorts", "coat", "saree"]),
    ("Beauty",         ["beauty", "skincare", "lipstick", "shampoo", "cosmetic",
                         "moisturizer", "serum", "fragrance", "perfume", "makeup"]),
    ("Books",          ["paperback", "hardcover", "novel", "textbook", "books", " book", "book)"]),
    ("Toys",           ["toy", "lego", "puzzle", "action figure", "board game",
                         "plush", "doll"]),
    ("Jewelry",        ["necklace", "bracelet", "earring", "pendant", "jewelry",
                         "jewellery", "wristwatch", "smartwatch"]),
    ("Sports",         ["yoga", "dumbbell", "fitness", "treadmill", "bicycle",
                         "camping", "tent", "backpack", "sports", "outdoor"]),
    ("Home & Kitchen", ["kitchen", "cookware", "blender", "cooktop", "induction",
                         "mixer grinder", "saucepan", "vacuum", "appliance",
                         "bedsheet", "pillow", "home & kitchen", "home and kitchen"]),
    ("Electronics",    ["headphone", "earbud", "earphone", "speaker", "television",
                         " tv", "smart tv", "led tv", "camera", "dslr", "mouse", "keyboard",
                         "monitor", "tablet", "ipad", "router", "charger", "power bank",
                         "electronics", "console", "gpu", "ssd"]),
]


def infer_category(meta, default="Electronics"):
    """Title-first, then category breadcrumbs minus the ambiguous 'Clothing, Shoes
    & Jewelry' umbrella (its literal 'shoes' would mis-tag every shirt as Footwear)."""
    title = str(meta.get("title") or "").lower()
    for revive_cat, keywords in CATEGORY_RULES:
        if any(kw in title for kw in keywords):
            return revive_cat
    cats = meta.get("categories") or []
    crumbs = " ".join(str(c) for c in cats).lower() if isinstance(cats, list) else ""
    for umbrella in ("clothing, shoes & jewelry", "clothing, shoes and jewelry", "shoes & jewelry"):
        crumbs = crumbs.replace(umbrella, " ")
    crumbs += " " + str(meta.get("store") or "").lower()
    for revive_cat, keywords in CATEGORY_RULES:
        if any(kw in crumbs for kw in keywords):
            return revive_cat
    return default


def _first_image(meta):
    for im in (meta.get("images") or []):
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


_CONDITION_BY_GRADE = {
    "A": "Like new — minimal signs of use, original accessories.",
    "B": "Very good — light cosmetic wear, fully functional.",
    "C": "Good — visible wear, works perfectly.",
    "D": "Acceptable — heavier cosmetic wear, functional.",
}

# Category → realistic seller angle-shot labels (used for the Revive card photo strip)
_ANGLE_LABELS = {
    "Footwear": ["Top", "Side", "Sole", "Box"],
    "Apparel":  ["Front", "Back", "Fabric", "Tag"],
    "Phone":    ["Front", "Back", "Screen on", "Ports"],
    "Laptop":   ["Lid", "Open", "Keyboard", "Ports"],
}
_DEFAULT_ANGLES = ["Front", "Back", "Detail"]


def _route_fn():
    try:
        from ml.route import route_item
        return route_item
    except Exception:
        return None


def _new_listing(product):
    """Create/refresh the normal Amazon NEW catalog listing for a product."""
    Listing.objects.update_or_create(
        product=product, source=Listing.Source.NEW,
        defaults=dict(grade="", price=product.mrp, completeness=1.0,
                      condition_summary="", status=Listing.Status.LISTED,
                      image_url=product.reference_image_url, condition_label="New",
                      seller=None, tier=0, disposition="", risk_tier=""),
    )


def create_listing_for(product, category, rng, sellers, route_item,
                       grade=None, force_renewed=None, with_photos=False):
    """Create ONE second-life listing (Revive or Renewed), priced + routed by the
    v2 engine. `force_renewed` overrides the source; `with_photos` stores seller
    angle shots. Returns the Listing, or None if the item shouldn't be listed."""
    mrp = float(product.mrp)
    if grade is None:
        grade = rng.choice(["A", "B", "B", "C", "C", "D"])
    geo = rng.choice(GEOHASHES)
    route = None
    if route_item is not None:
        try:
            route = route_item(listing_id=str(product.asin), grade=grade, category=category,
                               defects=[], geohash5=geo, mrp=mrp, product_id=str(product.asin),
                               sealed=False, opened=True)
        except Exception:
            route = None
    if route:
        price = Decimal(str(round(float(route.get("price") or mrp * 0.5), 2)))
        tier = int(route.get("tier") or 1)
        chosen_path = route.get("chosen_path", "resell_p2p")
        disposition = route.get("disposition") or ""
        risk_tier = route.get("risk_tier") or ""
        condition_label = route.get("condition_label") or ""
        ev_data = route.get("ev_breakdown")
    else:
        recovery = {"A": 0.70, "B": 0.55, "C": 0.42, "D": 0.30}[grade]
        price = Decimal(str(round(mrp * recovery, 2)))
        tier = 1 if mrp < 2000 else 2 if mrp <= 10000 else 3
        chosen_path = "resell_p2p"
        disposition = "USED_P2P"
        risk_tier = "HIGH" if tier == 3 else "MEDIUM" if tier == 2 else "LOW"
        condition_label = {"A": "Used – Like New", "B": "Used – Very Good",
                           "C": "Used – Good", "D": "Used – Acceptable"}[grade]
        ev_data = None

    # Hygiene/sealed items that can't be resold once opened → skip.
    if disposition in ("RECYCLE_DONATE", "RESTOCK_NEW"):
        return None

    if force_renewed is True:
        source, seller, condition_label, chosen_path = Listing.Source.RENEWED, None, "Renewed", "refurbish"
    elif force_renewed is False:
        source = Listing.Source.P2P
        seller = rng.choice(sellers) if sellers else None
    else:
        is_renewed = chosen_path == "refurbish" or disposition == "RENEWED_SPN"
        if is_renewed:
            source, seller, condition_label, chosen_path = Listing.Source.RENEWED, None, "Renewed", "refurbish"
        else:
            source = Listing.Source.P2P
            seller = rng.choice(sellers) if sellers else None

    images = []
    if with_photos and source == Listing.Source.P2P:
        labels = _ANGLE_LABELS.get(category, _DEFAULT_ANGLES)
        images = [{"url": product.reference_image_url, "label": lb} for lb in labels]

    return Listing.objects.create(
        product=product, source=source, grade=grade, price=price,
        condition_summary=_CONDITION_BY_GRADE[grade],
        completeness={"A": 1.0, "B": 0.9, "C": 0.75, "D": 0.6}[grade],
        geohash5=geo, status=Listing.Status.LISTED, seller=seller, images=images,
        image_url=product.reference_image_url,
        tier=tier, chosen_path=chosen_path, ev_data=ev_data,
        risk_tier=risk_tier, disposition=disposition, condition_label=condition_label)


def import_meta_file(path, *, default_category="Electronics", limit=1500,
                     make_new=True, as_listings=0.0, usd_to_inr=83.0,
                     sellers=None, seed=42, stdout=None):
    """Import one meta_*.jsonl: create Products + (default) a NEW listing each.
    `as_listings` optionally also creates auto second-life listings (CLI use)."""
    rng = random.Random(seed)
    route_item = _route_fn()
    sellers = sellers or []
    n_prod = n_new = n_sl = 0
    by_cat = {}
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
            mrp = _price(m, usd_to_inr)
            if not title or not img or mrp is None or not (Decimal("50") <= mrp <= Decimal("500000")):
                continue
            category = infer_category(m, default_category)
            asin = m.get("parent_asin") or m.get("asin") or f"AZ-{rng.getrandbits(32):08x}"
            prod, _ = Product.objects.update_or_create(
                asin=asin,
                defaults=dict(title=title[:255], category=category,
                              brand=(m.get("store") or "")[:100], mrp=mrp,
                              reference_image_url=img[:500], description=_desc(m),
                              rating=float(m.get("average_rating") or 0.0),
                              rating_count=int(m.get("rating_number") or 0)))
            n_prod += 1
            by_cat[category] = by_cat.get(category, 0) + 1
            if make_new:
                _new_listing(prod)
                n_new += 1
            if as_listings and rng.random() < as_listings:
                if create_listing_for(prod, category, rng, sellers, route_item, with_photos=True):
                    n_sl += 1
    if stdout:
        cats = ", ".join(f"{k}:{v}" for k, v in sorted(by_cat.items()))
        stdout.write(f"  {path}: {n_prod} products [{cats}], {n_new} New, {n_sl} second-life")
    return n_prod, n_new, by_cat


class Command(BaseCommand):
    help = "Import real Amazon metadata: NEW catalog listings + optional second-life."

    def add_arguments(self, parser):
        parser.add_argument("--meta", required=True)
        parser.add_argument("--category", default="Electronics")
        parser.add_argument("--limit", type=int, default=1500)
        parser.add_argument("--as-listings", type=float, default=0.0)
        parser.add_argument("--usd-to-inr", type=float, default=83.0)

    def handle(self, *args, **o):
        sellers = list(User.objects.filter(email__contains="seller")[:20])
        n_prod, n_new, _ = import_meta_file(
            o["meta"], default_category=o["category"], limit=o["limit"],
            as_listings=o["as_listings"], usd_to_inr=o["usd_to_inr"],
            sellers=sellers, stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS(
            f"Imported {n_prod} products ({n_new} New listings)."))
