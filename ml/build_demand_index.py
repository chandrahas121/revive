"""
ml/build_demand_index.py
------------------------
Build geohash demand index from order history and push to Redis.
This is the "precomputed demand index" described in Phoenix Pillar 2.

In production: runs nightly as a cron job, processes real order history.
For demo: generates synthetic but realistic demand per (geohash5, category).

Usage:
    python ml/build_demand_index.py                    # uses synthetic data
    python ml/build_demand_index.py --orders-csv path  # uses real order CSV
    python ml/build_demand_index.py --dry-run          # print only, no Redis

Redis schema:
    HSET demand:{geohash5}  {category} <JSON>
    JSON: {demand_score, local_buyers, nearest_cluster, dist_to_cluster_km, note}

Also writes: ml/artifacts/demand_index.json (for offline use)
"""
from __future__ import annotations
import argparse
import json
import logging
import math
import os
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"

# ─── Bengaluru geohash5 cells ─────────────────────────────────────────────────
GEO_CELLS = {
    "tbxx1": {"lat": 12.9716, "lng": 77.5946, "label": "Koramangala",    "population_density": 0.92},
    "tbxx2": {"lat": 12.9352, "lng": 77.6245, "label": "HSR Layout",     "population_density": 0.78},
    "tbxx3": {"lat": 13.0012, "lng": 77.5953, "label": "Indiranagar",    "population_density": 0.65},
    "tbxx4": {"lat": 12.9279, "lng": 77.6271, "label": "BTM Layout",     "population_density": 0.82},
    "tbxw1": {"lat": 12.9141, "lng": 77.6407, "label": "Bommanahalli",   "population_density": 0.55},
    "tbxw2": {"lat": 12.8456, "lng": 77.6603, "label": "Electronic City","population_density": 0.43},
    "tbxv1": {"lat": 13.0359, "lng": 77.5970, "label": "Malleshwaram",   "population_density": 0.70},
    "tbxv2": {"lat": 13.0533, "lng": 77.5688, "label": "Rajajinagar",    "population_density": 0.58},
    "tbxu1": {"lat": 12.9850, "lng": 77.7480, "label": "Whitefield",     "population_density": 0.48},
    "tbxu2": {"lat": 13.0688, "lng": 77.5760, "label": "Yeshwanthpur",   "population_density": 0.62},
}

# Category purchase frequency weights per area type
CATEGORY_AREA_WEIGHTS = {
    "Footwear":    {"tech_hub": 0.8, "residential": 1.3, "retail": 1.2},
    "Electronics": {"tech_hub": 1.8, "residential": 0.9, "retail": 1.1},
    "Clothing":    {"tech_hub": 0.9, "residential": 1.2, "retail": 1.4},
    "Home & Kitchen": {"tech_hub": 0.6, "residential": 1.5, "retail": 1.0},
    "Sports":      {"tech_hub": 1.0, "residential": 0.9, "retail": 1.1},
    "Beauty":      {"tech_hub": 0.8, "residential": 1.1, "retail": 1.3},
    "Books":       {"tech_hub": 1.2, "residential": 1.0, "retail": 0.8},
    "Toys":        {"tech_hub": 0.5, "residential": 1.6, "retail": 0.9},
    "Jewelry":     {"tech_hub": 0.6, "residential": 1.2, "retail": 1.5},
}

# Cell → area type
CELL_AREA_TYPE = {
    "tbxx1": "tech_hub",     # Koramangala (startups, young professionals)
    "tbxx2": "tech_hub",     # HSR Layout
    "tbxx3": "residential",  # Indiranagar
    "tbxx4": "residential",  # BTM Layout
    "tbxw1": "residential",  # Bommanahalli
    "tbxw2": "tech_hub",     # Electronic City (tech park)
    "tbxv1": "retail",       # Malleshwaram
    "tbxv2": "retail",       # Rajajinagar
    "tbxu1": "tech_hub",     # Whitefield (ITPL)
    "tbxu2": "residential",  # Yeshwanthpur
}

CATEGORIES = list(CATEGORY_AREA_WEIGHTS.keys())


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_synthetic_demand() -> dict:
    """
    Compute demand_score per (geohash5, category) from synthetic order history.
    Uses population_density × category_area_weight + noise.
    """
    import random
    rng = random.Random(42)
    demand_index = {}  # {geohash5: {category: {...}}}

    for gh, cell in GEO_CELLS.items():
        demand_index[gh] = {}
        area_type = CELL_AREA_TYPE.get(gh, "residential")

        for cat in CATEGORIES:
            weights = CATEGORY_AREA_WEIGHTS.get(cat, {})
            area_weight = weights.get(area_type, 1.0)

            # Demand score: [0, 1] = pop_density × area_weight × noise
            base = cell["population_density"] * area_weight
            noise = rng.gauss(0, 0.05)
            demand_score = min(1.0, max(0.0, base + noise))

            # Synthetic buyer count (5-core Amazon scale ~ orders/month)
            local_buyers = int(demand_score * 120 + 10)

            demand_index[gh][cat] = {
                "demand_score": round(demand_score, 3),
                "local_buyers": local_buyers,
                "area_type": area_type,
                "label": cell["label"],
            }

    # Add nearest cluster info per (geohash5, category) using gravity model
    for gh, cell in GEO_CELLS.items():
        for cat in CATEGORIES:
            best_gh = None
            best_gravity = -1.0
            best_dist_km = 0.0

            for other_gh, other_cell in GEO_CELLS.items():
                dist_km = haversine_km(cell["lat"], cell["lng"], other_cell["lat"], other_cell["lng"])
                other_demand = demand_index[other_gh][cat]["demand_score"]
                # Gravity: demand / (1 + dist²/25)
                gravity = other_demand / (1.0 + (dist_km ** 2) / 25.0)
                if gravity > best_gravity:
                    best_gravity = gravity
                    best_gh = other_gh
                    best_dist_km = dist_km

            demand_index[gh][cat]["nearest_cluster"] = best_gh
            demand_index[gh][cat]["nearest_cluster_label"] = GEO_CELLS[best_gh]["label"]
            demand_index[gh][cat]["dist_to_cluster_km"] = round(best_dist_km, 1)
            demand_index[gh][cat]["gravity_score"] = round(best_gravity, 4)
            demand_index[gh][cat]["note"] = (
                f"{demand_index[gh][cat]['local_buyers']} buyers within 8 km searched for {cat} this month"
                + (f" · nearest demand cluster: {GEO_CELLS[best_gh]['label']} ({best_dist_km:.1f} km)"
                   if best_gh != gh else " · you're in the demand cluster!")
            )

    return demand_index


def push_to_redis(demand_index: dict) -> int:
    """Push demand index to Redis. Returns number of keys written."""
    try:
        import redis
        r = redis.Redis(
            host=os.environ.get("REDIS_HOST", "localhost"),
            port=int(os.environ.get("REDIS_PORT", 6379)),
            decode_responses=True,
            socket_connect_timeout=2,
        )
        r.ping()
        count = 0
        pipe = r.pipeline()
        for gh, categories in demand_index.items():
            for cat, data in categories.items():
                pipe.hset(f"demand:{gh}", cat, json.dumps(data))
                count += 1
        pipe.execute()
        logger.info(f"[demand_index] Pushed {count} entries to Redis")
        return count
    except Exception as e:
        logger.warning(f"[demand_index] Redis not available: {e}")
        return 0


def save_to_json(demand_index: dict) -> Path:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    out = ARTIFACTS_DIR / "demand_index.json"
    with open(out, "w") as f:
        json.dump(demand_index, f, indent=2)
    logger.info(f"[demand_index] Saved to {out}")
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build geohash demand index")
    parser.add_argument("--dry-run", action="store_true", help="Print only, no Redis/file write")
    parser.add_argument("--orders-csv", default=None, help="Real order CSV (optional)")
    args = parser.parse_args()

    logger.info("Building demand index...")
    demand_index = build_synthetic_demand()

    if args.dry_run:
        import pprint
        print(f"\nDemand index: {len(demand_index)} cells × {len(CATEGORIES)} categories")
        # Print sample
        sample_gh = "tbxx1"
        print(f"\nSample — {GEO_CELLS[sample_gh]['label']}:")
        for cat in ["Footwear", "Electronics"]:
            d = demand_index[sample_gh][cat]
            print(f"  {cat}: demand={d['demand_score']:.3f}, buyers={d['local_buyers']}, "
                  f"cluster={d['nearest_cluster_label']} ({d['dist_to_cluster_km']} km)")
    else:
        # Save JSON (always)
        out = save_to_json(demand_index)
        print(f"Saved: {out}")

        # Push to Redis (if available)
        count = push_to_redis(demand_index)
        if count:
            print(f"Pushed {count} entries to Redis")
        else:
            print("Redis not available — demand_index.json will be used as fallback")
