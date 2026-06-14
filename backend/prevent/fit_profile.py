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
