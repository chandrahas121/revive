"""
ml/category_profiles.py
-----------------------
v2 CORE CORRECTION (final_idea_v2.md §2 Axis A).

A product's CATEGORY decides what we capture and how we grade it — NOT its price.
This module is the single source of truth for, per category:
  - capture prompts  (what photos/evidence to request from the customer/agent)
  - rubric           (what an inspector/AI should grade)
  - condition labels (the category-appropriate "best" states + used grades)
  - flags            (is_electronics, sealed_only, needs_functional_test)

The frontend mirrors this in frontend/src/utils/categoryProfiles.js — keep them
in sync. (A ₹6,000 Nike Air Max is Footwear here and will NEVER be asked for a
"powered-on screen" photo, regardless of value.)
"""
from __future__ import annotations
from typing import Dict, Any, List

# Generic capture slot definitions reused across profiles
_DEFECTS_SLOT = {"key": "defects", "label": "Any defects", "hint": "Close-up (optional)", "required": False}

CATEGORY_PROFILES: Dict[str, Dict[str, Any]] = {
    "Apparel": {
        "capture": [
            {"key": "front",  "label": "Front",        "hint": "Whole garment, well lit", "required": True},
            {"key": "back",   "label": "Back",         "hint": "Reverse side",            "required": True},
            {"key": "fabric", "label": "Fabric close-up", "hint": "Show the weave/knit",  "required": True},
            {"key": "label",  "label": "Label / Tag",  "hint": "Brand, size & care tag",  "required": True},
            _DEFECTS_SLOT,
        ],
        "rubric": ["pilling", "stains", "holes_tears", "fading_shrinkage", "zippers_buttons", "tags_present", "alterations"],
        "conditions": ["New with tags", "Like new", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": False,
        "sealed_only": False,
        "needs_functional_test": False,
    },
    "Footwear": {
        "capture": [
            {"key": "top",    "label": "Top",     "hint": "Looking down at the pair", "required": True},
            {"key": "side",   "label": "Side",    "hint": "Profile view",             "required": True},
            {"key": "sole",   "label": "Soles",   "hint": "Underside — show wear",    "required": True},
            {"key": "insole", "label": "Insole",  "hint": "Inside heel/footbed",      "required": True},
            {"key": "box",    "label": "Box / Tag", "hint": "Box or brand tag (optional)", "required": False},
            _DEFECTS_SLOT,
        ],
        "rubric": ["sole_wear", "sole_separation", "insole", "upper_creasing", "scuffs", "odor", "box_laces"],
        "conditions": ["New with tags", "Like new", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": False,
        "sealed_only": False,
        "needs_functional_test": False,
    },
    "Phone": {
        "capture": [
            {"key": "front",       "label": "Front",            "hint": "Whole device",          "required": True},
            {"key": "back",        "label": "Back",             "hint": "Reverse side",          "required": True},
            {"key": "screen_on",   "label": "Screen (powered on)", "hint": "Show it boots",      "required": True},
            {"key": "ports",       "label": "Ports",            "hint": "Charging / audio ports","required": True},
            {"key": "accessories", "label": "Accessories",      "hint": "Charger, cable, box",   "required": True},
            _DEFECTS_SLOT,
        ],
        "rubric": ["screen_cracks_pixels", "boots_powers_on", "battery_pct", "ports", "body_dents", "accessories"],
        "conditions": ["New (sealed)", "Open box", "Renewed", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": True,
        "sealed_only": False,
        "needs_functional_test": True,
    },
    "Laptop": {
        "capture": [
            {"key": "lid",         "label": "Lid",              "hint": "Closed, top",           "required": True},
            {"key": "base",        "label": "Base",             "hint": "Underside",             "required": True},
            {"key": "screen_on",   "label": "Screen (powered on)", "hint": "Show it boots",      "required": True},
            {"key": "keyboard",    "label": "Keyboard",         "hint": "Keys & trackpad",       "required": True},
            {"key": "ports",       "label": "Ports",            "hint": "All sides",             "required": True},
            {"key": "accessories", "label": "Accessories",      "hint": "Charger, box",          "required": True},
            _DEFECTS_SLOT,
        ],
        "rubric": ["screen", "boots_powers_on", "battery_health", "keyboard_trackpad", "hinges", "ports", "body_dents"],
        "conditions": ["New (sealed)", "Open box", "Renewed", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": True,
        "sealed_only": False,
        "needs_functional_test": True,
    },
    "Home & Kitchen": {
        "capture": [
            {"key": "front",       "label": "Front",       "hint": "Whole item",            "required": True},
            {"key": "back",        "label": "Back",        "hint": "Reverse side",          "required": True},
            {"key": "plug",        "label": "Plug / Cord", "hint": "If electrical",         "required": False},
            {"key": "accessories", "label": "Accessories", "hint": "Parts & manual",        "required": False},
            _DEFECTS_SLOT,
        ],
        "rubric": ["dents", "cracks", "electrical_function", "completeness", "hygiene"],
        "conditions": ["Open box", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": False,
        "sealed_only": False,
        "needs_functional_test": False,
    },
    "Books": {
        "capture": [
            {"key": "cover", "label": "Cover",  "hint": "Front cover",        "required": True},
            {"key": "spine", "label": "Spine",  "hint": "Show the binding",   "required": True},
            {"key": "pages", "label": "Pages",  "hint": "Inside / any marks", "required": True},
        ],
        "rubric": ["binding", "page_wear", "markings", "water_damage"],
        "conditions": ["Like new", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": False,
        "sealed_only": False,
        "needs_functional_test": False,
    },
    "Beauty": {
        "capture": [
            {"key": "sealed", "label": "Sealed packaging", "hint": "Show seal intact", "required": True},
            {"key": "label",  "label": "Label / Expiry",   "hint": "Batch & expiry",   "required": True},
        ],
        "rubric": ["seal_intact", "expiry_date", "packaging"],
        "conditions": ["New (sealed)"],   # hygiene: cannot be resold once opened
        "is_electronics": False,
        "sealed_only": True,
        "needs_functional_test": False,
    },
    "Toys": {
        "capture": [
            {"key": "front", "label": "Front",       "hint": "Whole toy",      "required": True},
            {"key": "back",  "label": "Back",        "hint": "Reverse side",   "required": True},
            {"key": "parts", "label": "Parts",       "hint": "All parts laid out", "required": True},
            _DEFECTS_SLOT,
        ],
        "rubric": ["completeness", "function", "safety", "packaging"],
        "conditions": ["New with tags", "Used A", "Used B", "Used C", "Used D"],
        "is_electronics": False,
        "sealed_only": False,
        "needs_functional_test": False,
    },
}

# A generic fallback profile for anything uncategorised.
_DEFAULT_PROFILE = {
    "capture": [
        {"key": "front",   "label": "Front",   "hint": "Whole item",  "required": True},
        {"key": "back",    "label": "Back",    "hint": "Reverse side","required": True},
        {"key": "label",   "label": "Label",   "hint": "Any label",   "required": False},
        _DEFECTS_SLOT,
    ],
    "rubric": ["general_wear", "completeness", "damage"],
    "conditions": ["Like new", "Used A", "Used B", "Used C", "Used D"],
    "is_electronics": False,
    "sealed_only": False,
    "needs_functional_test": False,
}

# Map loosely-typed / legacy category strings → canonical profile keys.
_CATEGORY_ALIASES: Dict[str, str] = {
    "footwear": "Footwear", "shoes": "Footwear", "sneakers": "Footwear", "sandals": "Footwear",
    "clothing": "Apparel", "apparel": "Apparel", "fashion": "Apparel", "tops": "Apparel",
    "shirt": "Apparel", "t-shirt": "Apparel", "dress": "Apparel", "kurta": "Apparel",
    "phone": "Phone", "smartphone": "Phone", "mobile": "Phone", "tablet": "Phone",
    "laptop": "Laptop", "notebook": "Laptop", "macbook": "Laptop",
    "electronics": "Phone",  # default electronics → functional-test profile
    "home & kitchen": "Home & Kitchen", "home": "Home & Kitchen", "kitchen": "Home & Kitchen",
    "appliance": "Home & Kitchen", "appliances": "Home & Kitchen",
    "books": "Books", "book": "Books", "media": "Books",
    "beauty": "Beauty", "cosmetics": "Beauty", "skincare": "Beauty", "grocery": "Beauty",
    "toys": "Toys", "toy": "Toys", "games": "Toys",
}


def canonical_category(category: str) -> str:
    """Map any input category string to a canonical profile key."""
    if not category:
        return "Other"
    c = category.strip()
    if c in CATEGORY_PROFILES:
        return c
    return _CATEGORY_ALIASES.get(c.lower(), "Other")


def get_profile(category: str) -> Dict[str, Any]:
    """Return the Category Profile for a given category (with safe fallback)."""
    key = canonical_category(category)
    return CATEGORY_PROFILES.get(key, _DEFAULT_PROFILE)


def capture_prompts(category: str) -> List[Dict[str, Any]]:
    """Photo/evidence prompts for a category — replaces tier-keyed prompts (Q1/Q7)."""
    return get_profile(category)["capture"]


def rubric(category: str) -> List[str]:
    """Per-category grading checklist (Q8)."""
    return get_profile(category)["rubric"]


def condition_labels(category: str) -> List[str]:
    """Category-aware condition labels (Q11 broken-seal handling)."""
    return get_profile(category)["conditions"]


def is_electronics(category: str) -> bool:
    return get_profile(category)["is_electronics"]


def needs_functional_test(category: str) -> bool:
    return get_profile(category)["needs_functional_test"]


def sealed_only(category: str) -> bool:
    """True for hygiene/consumable categories that can't be resold once opened."""
    return get_profile(category)["sealed_only"]
