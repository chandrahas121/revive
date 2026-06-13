"""
Full end-to-end pipeline test:
  grade_image() [Claude Haiku] → route_item() [LightGBM + Geohash gravity]
"""
import sys, os
sys.path.insert(0, '.')

from pathlib import Path
env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

import urllib.request, tempfile, time
from ml.grade import grade_image
from ml.route import route_item

print("=" * 65)
print("PHOENIX Full Pipeline — Grade → Route")
print("Priya's Nike shoe, Koramangala (tbxx1), MRP Rs. 2999")
print("=" * 65)

# Download image
url = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"
tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
urllib.request.urlretrieve(url, tmp.name)

# Step 1: Grade
print("\n[1/2] Grading image with Claude Haiku...")
t0 = time.perf_counter()
grade_result = grade_image(tmp.name)
grade_ms = (time.perf_counter() - t0) * 1000

print(f"      Grade      : {grade_result['grade']}")
print(f"      Confidence : {grade_result['confidence']:.0%}")
print(f"      Condition  : {grade_result.get('condition_summary', '')}")
print(f"      Defects    : {len(grade_result.get('defects', []))}")
print(f"      Latency    : {grade_ms:.0f} ms {'(cached!)' if grade_result.get('from_cache') else ''}")

# Step 2: Route using the graded result
print("\n[2/2] Routing with EV optimizer + geohash gravity...")
t1 = time.perf_counter()
route_result = route_item(
    listing_id="lst_priya_e2e_001",
    grade=grade_result["grade"],
    category="Footwear",
    defects=grade_result.get("defects", []),
    geohash5="tbxx1",
    mrp=2999.0,
)
route_ms = (time.perf_counter() - t1) * 1000

print(f"      Decision   : {route_result['chosen_path'].upper()}")
print(f"      Price      : Rs. {route_result['price']:.0f}")
print(f"      EV won     : Rs. {route_result['ev_breakdown'][route_result['chosen_path']]:.0f}")
print(f"      km saved   : {route_result['km_saved']:.0f} km")
print(f"      CO2 saved  : {route_result['co2_saved_kg']:.1f} kg")
print(f"      Credits    : {route_result['green_credits_earned']}")
print(f"      Latency    : {route_ms:.0f} ms")
print(f"      MCDA note  : {route_result['mcda_note']}")

print("\n" + "=" * 65)
print("FULL PIPELINE RESULT")
print("=" * 65)
print(f"  Input  : Nike shoe photo (Unsplash)")
print(f"  Grade  : {grade_result['grade']} ({grade_result['confidence']:.0%} confidence) — '{grade_result.get('condition_summary','')}'")
print(f"  Action : {route_result['chosen_path'].upper()} at Rs. {route_result['price']:.0f}")
print(f"  Impact : {route_result['km_saved']:.0f} km saved · {route_result['co2_saved_kg']:.1f} kg CO2 · {route_result['green_credits_earned']} credits")
print(f"  Total pipeline latency : {grade_ms + route_ms:.0f} ms")
