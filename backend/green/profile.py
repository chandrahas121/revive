"""
green/profile.py
----------------
The customer's **Green Profile** — a behaviour score that drives Green Credits.

Instead of a hard-coded "didn't return → fixed credits" rule, credits scale with
how genuinely sustainable a customer's behaviour is, measured from their real
activity:

  • Return discipline   — how much of what they order they keep (not return)
  • Second-life buyer    — how many pre-owned / Renewed items they've bought
  • Circular seller      — how many of their own items they've resold

The score maps to a tier, and the tier gives an earn MULTIPLIER: the more
sustainable the profile, the more each green action is worth. Only positive,
customer-facing signals are exposed here — no fraud/abuse internals.
"""
from __future__ import annotations

# (min_score, name, multiplier, emoji, blurb)
_TIERS = [
    (0,  'Seedling',        1.0,  '🌱', 'Just getting started — every green choice grows your profile.'),
    (40, 'Sprout',          1.2,  '🌿', 'Building good habits — you keep more and waste less.'),
    (65, 'Grove',           1.35, '🌳', 'A consistently sustainable shopper — credits earn faster.'),
    (85, 'Forest Guardian', 1.5,  '🌲', 'Top-tier green behaviour — you earn the highest rewards.'),
]

_SECOND_LIFE_SOURCES = ('p2p', 'return', 'renewed', 'warehouse')


def _tier_for(score: int):
    tier = _TIERS[0]
    for t in _TIERS:
        if score >= t[0]:
            tier = t
    idx = _TIERS.index(tier)
    nxt = _TIERS[idx + 1] if idx + 1 < len(_TIERS) else None
    return tier, nxt


def green_profile(user) -> dict:
    """Derive the user's Green Profile from their orders + listings."""
    from core.models import Order, Listing

    orders = list(Order.objects.filter(user=user).select_related('listing'))
    total = len(orders)
    returned = sum(1 for o in orders if o.status == 'returned')
    kept = total - returned
    keep_rate = (kept / total) if total else None
    second_life = sum(
        1 for o in orders
        if getattr(o.listing, 'source', 'new') in _SECOND_LIFE_SOURCES
    )
    resold = Listing.objects.filter(seller=user, source='p2p').count()

    # Score (0–100): return discipline dominates, with boosts for buying second-life
    # and reselling. A brand-new customer starts low with room to grow.
    if total == 0 and resold == 0:
        score = 15
    else:
        kr = keep_rate if keep_rate is not None else 1.0
        score = round(min(100,
            kr * 55                      # return discipline        (0–55)
            + min(second_life, 6) * 5    # second-life purchases    (0–30)
            + min(resold, 5) * 3         # items resold             (0–15)
        ))

    tier, nxt = _tier_for(score)
    _, name, mult, emoji, blurb = tier

    dimensions = [
        {
            'key': 'keep',
            'label': 'Orders kept',
            'value': f'{round(keep_rate * 100)}%' if keep_rate is not None else '—',
            'sub': 'you send back less than you keep',
        },
        {
            'key': 'second_life',
            'label': 'Second-life bought',
            'value': second_life,
            'sub': 'pre-owned items you gave a new home',
        },
        {
            'key': 'resold',
            'label': 'Items resold',
            'value': resold,
            'sub': 'your items given a second life',
        },
    ]

    return {
        'score': score,
        'tier': name,
        'tier_emoji': emoji,
        'blurb': blurb,
        'multiplier': mult,
        'next_tier': (nxt[1] if nxt else None),
        'points_to_next': (max(0, nxt[0] - score) if nxt else 0),
        'dimensions': dimensions,
    }
