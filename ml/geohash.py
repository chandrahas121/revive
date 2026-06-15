"""
ml/geohash.py
-------------
Tiny dependency-free geohash encoder (v2 R5 fix).

route.py already had a geohash *decoder* (_geohash5_approx_center); v2 needs the
*encoder* so a live browser location (lat, lng) → demand cell. Standard geohash
base-32 algorithm, no external library required.
"""
from __future__ import annotations
from typing import Tuple

_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def geohash_encode(lat: float, lng: float, precision: int = 5) -> str:
    """Encode (lat, lng) → geohash string of the given precision (default 5 ≈ 5 km)."""
    lat_min, lat_max = -90.0, 90.0
    lng_min, lng_max = -180.0, 180.0
    geohash = []
    bits = [16, 8, 4, 2, 1]
    bit = 0
    ch = 0
    is_lng = True

    while len(geohash) < precision:
        if is_lng:
            mid = (lng_min + lng_max) / 2
            if lng > mid:
                ch |= bits[bit]
                lng_min = mid
            else:
                lng_max = mid
        else:
            mid = (lat_min + lat_max) / 2
            if lat > mid:
                ch |= bits[bit]
                lat_min = mid
            else:
                lat_max = mid
        is_lng = not is_lng

        if bit < 4:
            bit += 1
        else:
            geohash.append(_BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def geohash_decode(gh: str) -> Tuple[float, float]:
    """Decode a geohash → approximate (lat, lng) centre."""
    lat_min, lat_max = -90.0, 90.0
    lng_min, lng_max = -180.0, 180.0
    is_lng = True
    for char in gh.lower():
        idx = _BASE32.find(char)
        if idx < 0:
            break
        for mask in (16, 8, 4, 2, 1):
            if is_lng:
                mid = (lng_min + lng_max) / 2
                if idx & mask:
                    lng_min = mid
                else:
                    lng_max = mid
            else:
                mid = (lat_min + lat_max) / 2
                if idx & mask:
                    lat_min = mid
                else:
                    lat_max = mid
            is_lng = not is_lng
    return (lat_min + lat_max) / 2, (lng_min + lng_max) / 2
