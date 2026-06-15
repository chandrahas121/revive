"""
core/lifecycle.py
-----------------
The second-life LIFECYCLE state machine (final_idea_v2.md §6 + §10).

A returned / listed item does NOT appear in Revive/Renewed instantly. After the
Disposition Gate decides WHERE it goes, it progresses through a short, narratable
track of stages — mirroring how this works in the real world:

  RENEWED_SPN  → Pickup scheduled → Refurbishing → Certified & live → Sold
  USED/OPEN_BOX→ Held local (awaiting nearby demand) → Live near you → Sold
  RESTOCK_NEW  → Back as New (exits second-life, rejoins normal catalog)
  RECYCLE/DONATE → Recycled / Donated (exits the marketplace)

Key real-world insight (and our differentiator): low-value as-is returns are NOT
warehoused on arrival — that's what overwhelms returns warehouses. They stay local
and are only ACTIVATED when the geohash demand-gravity model finds a nearby buyer.

This module is the single source of truth; frontend/src/utils/lifecycle.js mirrors it.
"""
from __future__ import annotations
from typing import Optional, List, Tuple, Dict, Any

# (status_key, short_label, narration_sub)
_RENEWED: List[Tuple[str, str, str]] = [
    ("refurb_scheduled", "Pickup scheduled", "A Flex agent collects it for an Amazon-authorized center"),
    ("refurbishing",     "Refurbishing",     "Diagnostics, repairs & certified data wipe at the SPN center"),
    ("listed",           "Certified & live", "Renewed by Amazon — stocked in the FC and buyable"),
    ("sold",             "Sold",             "Purchased by a buyer"),
]
_REVIVE: List[Tuple[str, str, str]] = [
    ("awaiting_demand", "Held locally",  "Stays near the seller — not warehoused — until a nearby buyer appears"),
    ("listed",          "Live near you", "Local demand matched — now buyable in Revive"),
    ("sold",            "Sold",          "Purchased by a nearby buyer"),
]
_RESTOCK: List[Tuple[str, str, str]] = [
    ("listed", "Back as New", "Verified sealed & unopened — returned to the normal catalog at full price"),
]
_RECYCLE: List[Tuple[str, str, str]] = [
    ("recycled", "Recycled", "Routed to certified e-waste / recycling"),
]
_DONATE: List[Tuple[str, str, str]] = [
    ("donated", "Donated", "Routed to a verified NGO partner"),
]

_TRACK_LABEL = {
    "renewed": "Amazon Renewed",
    "revive":  "Revive",
    "restock": "Restock as New",
    "exit":    "Recycle / Donate",
}


def track_key(disposition: str = "", source: str = "", chosen_path: str = "") -> Optional[str]:
    """Which lifecycle track this listing is on. Returns None for a plain New
    catalog item (no second-life lifecycle)."""
    d = (disposition or "").upper()
    if d == "RESTOCK_NEW":
        return "restock"
    if d == "RENEWED_SPN":
        return "renewed"
    if d == "RECYCLE_DONATE":
        return "exit"
    if d in ("OPEN_BOX", "USED_P2P"):
        return "revive"
    # No disposition recorded (e.g. seeded items) — infer from source.
    if source == "renewed":
        return "renewed"
    if source in ("p2p", "return", "warehouse"):
        return "revive"
    return None


def _stages_for(track: Optional[str], chosen_path: str = "") -> List[Tuple[str, str, str]]:
    if track == "renewed":
        return _RENEWED
    if track == "revive":
        return _REVIVE
    if track == "restock":
        return _RESTOCK
    if track == "exit":
        return _DONATE if chosen_path == "donate" else _RECYCLE
    return []


def initial_status(disposition: str, chosen_path: str = "") -> str:
    """The status a freshly-dispositioned listing should START at (first stage)."""
    track = track_key(disposition=disposition, chosen_path=chosen_path)
    stages = _stages_for(track, chosen_path)
    return stages[0][0] if stages else "listed"


def next_status(current: str, disposition: str = "", source: str = "",
                chosen_path: str = "") -> Optional[str]:
    """The next stage after `current`, or None if already at the end."""
    track = track_key(disposition=disposition, source=source, chosen_path=chosen_path)
    stages = _stages_for(track, chosen_path)
    keys = [s[0] for s in stages]
    if current in keys:
        i = keys.index(current)
        if i + 1 < len(keys):
            return keys[i + 1]
    return None


def lifecycle_payload(*, status: str, disposition: str = "", source: str = "",
                      chosen_path: str = "") -> Optional[Dict[str, Any]]:
    """Build the front-end lifecycle descriptor for a listing, or None if the
    listing has no second-life lifecycle (a plain New catalog item)."""
    track = track_key(disposition=disposition, source=source, chosen_path=chosen_path)
    if track is None:
        return None
    stages = _stages_for(track, chosen_path)
    keys = [s[0] for s in stages]
    if status in keys:
        idx = keys.index(status)
    elif status in ("sold", "recycled", "donated"):
        idx = len(keys) - 1
    else:
        idx = 0
    return {
        "track":         track,
        "track_label":   _TRACK_LABEL.get(track, track),
        "current":       status,
        "current_index": idx,
        "live":          status == "listed",
        "sold":          status == "sold",
        "can_advance":   next_status(status, disposition=disposition, source=source,
                                     chosen_path=chosen_path) is not None,
        "stages": [
            {"key": k, "label": lbl, "sub": sub, "done": i < idx, "current": i == idx}
            for i, (k, lbl, sub) in enumerate(stages)
        ],
    }
