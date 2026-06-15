"""
prevent/fit_profile.py
----------------------
Derive a shopper's fit_size_profile from their REAL kept orders — the sizes they
bought and did NOT return, per category. This is what lets Fit-Twin personalise
without ever asking for measurements.

A returned order means the size did not work, so returned/cancelled orders are
excluded. The profile is {dataset_category: median kept size}.
"""
from statistics import median

# Catalogue category -> clothing-fit dataset category (single source of truth).
CATEGORY_TO_FIT = {
    "clothing": "dress", "dress": "dress", "gown": "gown", "top": "top",
    "shirt": "top", "tops": "top", "romper": "romper", "jumpsuit": "jumpsuit",
    "skirt": "skirt", "jacket": "jacket", "sheath": "sheath",
}

# Orders in these states do not count as a kept, well-fitting purchase.
_EXCLUDED_STATES = {"returned", "cancelled", "pending"}


# The clothing-fit dataset has no brand field, so brand sizing tendencies are
# curated from well-known real-world sizing behaviour (demo scope). Direction is
# one of: runs_small | runs_large | true_to_size.
BRAND_BIAS = {
    "zara":            ("runs_small",   "Zara tends to run small — many shoppers size up."),
    "h&m":             ("runs_small",   "H&M tends to run small — consider sizing up."),
    "nike":            ("runs_small",   "Nike's athletic cut runs small — size up for comfort."),
    "wrogn":           ("runs_small",   "Wrogn's slim cut runs small — consider sizing up."),
    "spykar":          ("runs_small",   "Spykar's skinny fit runs small — consider sizing up."),
    "flying machine":  ("runs_small",   "Flying Machine runs slightly small — consider sizing up."),
    "u.s. polo assn.": ("runs_large",   "U.S. Polo Assn. tends to run large — consider sizing down."),
    "raymond":         ("runs_large",   "Raymond tends to run a touch large — consider sizing down."),
    "adidas":          ("true_to_size", "Adidas generally fits true to size."),
    "puma":            ("true_to_size", "Puma generally fits true to size."),
    "levi's":          ("true_to_size", "Levi's denim fits true to size."),
    "wrangler":        ("true_to_size", "Wrangler fits true to size."),
    "pepe jeans":      ("true_to_size", "Pepe Jeans fits true to size."),
    "jack & jones":    ("true_to_size", "Jack & Jones fits true to size."),
    "allen solly":     ("true_to_size", "Allen Solly fits true to size."),
    "peter england":   ("true_to_size", "Peter England fits true to size."),
    "van heusen":      ("true_to_size", "Van Heusen fits true to size."),
    "louis philippe":  ("true_to_size", "Louis Philippe fits true to size."),
    "arrow":           ("true_to_size", "Arrow fits true to size."),
    "park avenue":     ("true_to_size", "Park Avenue fits true to size."),
    "tommy hilfiger":  ("true_to_size", "Tommy Hilfiger fits true to size."),
    "studio revive":   ("true_to_size", "Studio Revive is designed to fit true to size."),
}


def brand_bias(brand):
    """Curated sizing tendency for a known brand, or None if we don't track it."""
    if not brand:
        return None
    hit = BRAND_BIAS.get(brand.strip().lower())
    if not hit:
        return None
    direction, label = hit
    return {"brand": brand, "direction": direction, "label": label}


def resolve_category(raw):
    raw = (raw or "").strip().lower()
    return CATEGORY_TO_FIT.get(raw, raw or None)


def update_fit_size_profile(user, save=True):
    """Update user.fit_size_profile from their kept orders, MERGING into whatever
    is already there. Kept orders are the freshest signal so they win per-category,
    but categories with no order data (e.g. a seeded demo profile) are preserved —
    we never wipe a profile just because the shopper has no orders yet."""
    if user is None or not getattr(user, "is_authenticated", False):
        return {}

    # local import to avoid app-loading cycles
    from core.models import Order

    existing = user.fit_size_profile if isinstance(user.fit_size_profile, dict) else {}

    sizes_by_cat = {}
    orders = (
        Order.objects
        .filter(user=user)
        .exclude(status__in=_EXCLUDED_STATES)
        .select_related("listing__product")
    )
    for o in orders:
        if o.size is None or not o.listing or not o.listing.product:
            continue
        cat = resolve_category(o.listing.product.category)
        if not cat:
            continue
        sizes_by_cat.setdefault(cat, []).append(float(o.size))

    from_orders = {cat: median(sizes) for cat, sizes in sizes_by_cat.items() if sizes}
    profile = {**existing, **from_orders}   # order signal wins per category

    if save and profile != existing:
        user.fit_size_profile = profile
        user.save(update_fields=["fit_size_profile"])
    return profile
