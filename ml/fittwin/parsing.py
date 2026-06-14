"""
ml/fittwin/parsing.py
---------------------
Field parsers for the Rent the Runway / ModCloth clothing-fit dataset.

The raw dataset stores measurements as messy strings:
    height       "5' 8\""        -> 68.0  (inches)
    weight       "137lbs"        -> 137.0 (lbs)
    bust size    "34d"           -> 34.0  (band, inches) + small cup bump
    age          "28"            -> 28.0
    size         14 / "14"       -> 14.0  (catalogue size)
    fit          "fit"/"small"/"large"
    rating       "10"            -> 10.0  (RTR is 2..10; ModCloth 1..5)

All parsers are defensive: any unparseable / missing value returns None so the
builder can decide whether to drop or impute the row.
"""
from __future__ import annotations
import re
from typing import Optional

# Cup letters -> rough added inches over the band measurement.
_CUP_BUMP = {"aa": 0.0, "a": 0.5, "b": 1.0, "c": 1.5, "d": 2.0,
             "dd": 2.5, "e": 2.5, "ddd": 3.0, "f": 3.0, "g": 3.5}


def parse_height(val) -> Optional[float]:
    """'5\\' 8\"' -> 68.0 inches.  Also accepts already-numeric inches/cm-ish."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else None
    s = str(val).strip().lower()
    if not s:
        return None
    m = re.match(r"(\d+)\s*'\s*(\d+)", s)          # 5' 8"
    if m:
        feet, inch = int(m.group(1)), int(m.group(2))
        return float(feet * 12 + inch)
    m = re.match(r"(\d+(?:\.\d+)?)", s)            # bare number fallback
    if m:
        n = float(m.group(1))
        return n if 40 <= n <= 90 else None         # plausible inches only
    return None


def parse_weight(val) -> Optional[float]:
    """'137lbs' -> 137.0.  Strips units, keeps plausible range."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val > 0 else None
    m = re.match(r"(\d+(?:\.\d+)?)", str(val).strip().lower())
    if not m:
        return None
    n = float(m.group(1))
    return n if 60 <= n <= 400 else None


def parse_bust(val) -> Optional[float]:
    """'34d' -> 35.0 (band 34 + cup bump). Returns band+cup estimate in inches."""
    if val is None:
        return None
    s = str(val).strip().lower()
    m = re.match(r"(\d+)\s*([a-z]+)?", s)
    if not m:
        return None
    band = float(m.group(1))
    if not (26 <= band <= 50):
        return None
    cup = (m.group(2) or "").strip()
    return band + _CUP_BUMP.get(cup, 1.0)


def parse_age(val) -> Optional[float]:
    if val is None:
        return None
    m = re.match(r"(\d+)", str(val).strip())
    if not m:
        return None
    n = float(m.group(1))
    return n if 12 <= n <= 100 else None


def parse_size(val) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val) if val >= 0 else None
    m = re.match(r"(\d+(?:\.\d+)?)", str(val).strip())
    return float(m.group(1)) if m else None


def parse_fit(val) -> Optional[str]:
    """Normalise to {'small','fit','large'}."""
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("fit", "true to size", "true_to_size", "perfect"):
        return "fit"
    if "small" in s or "tight" in s:
        return "small"
    if "large" in s or "big" in s or "loose" in s:
        return "large"
    return None


def parse_rating(val) -> Optional[float]:
    if val is None:
        return None
    m = re.match(r"(\d+(?:\.\d+)?)", str(val).strip())
    return float(m.group(1)) if m else None


def norm_category(val) -> str:
    return str(val or "").strip().lower() or "unknown"
