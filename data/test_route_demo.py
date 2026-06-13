"""
Demo test for route_item() — shows full Phoenix Pillar 2 output.
Tests Priya's shoes scenario from the plan.
"""
import sys
sys.path.insert(0, '.')
from ml.route import route_item

print("=" * 65)
print("PHOENIX Pillar 2 — EV Optimizer Demo")
print("Scenario: Priya's Nike shoes, Grade B, Bengaluru (Koramangala)")
print("=" * 65)

result = route_item(
    listing_id="lst_priya_shoes_001",
    grade="B",
    category="Footwear",
    defects=[
        {"type": "scratch on surface", "severity": "minor"},
        {"type": "worn out area",      "severity": "minor"},
    ],
    geohash5="tbxx1",   # Koramangala — high demand cell
    mrp=2999.0,
    product_id="B09G9HD6PD",
)

print(f"\nLightGBM predicted resale price : Rs. {result['price']:.0f}")
print(f"Sell probability (logistic)     : {result['sell_probability']:.2%}")
print(f"Refurb cost (defect lookup)     : Rs. {result['refurb_cost']:.0f}")
print(f"Post-refurb price               : Rs. {result['price_post_refurb']:.0f}")
print(f"\nGeohash Gravity Model:")
print(f"  Seller cell           : tbxx1 (Koramangala)")
print(f"  Nearest demand cluster: {result['nearest_cluster']} ({result['dist_to_cluster_km']:.1f} km)")
print(f"  Demand score          : {result['demand_score']:.3f}")
print(f"  Local buyers          : {result['local_buyers']}")
print(f"  Demand note           : {result['demand_note']}")
print(f"\nEV Breakdown (Phoenix formula):")
for path, ev in result['ev_breakdown'].items():
    marker = " <-- CHOSEN" if path == result['chosen_path'] else ""
    print(f"  {path:22s}: Rs. {ev:8.2f}{marker}")
print(f"\nDecision: {result['chosen_path'].upper()}")
print(f"  {result['mcda_note']}")
print(f"\nEnvironmental Impact (vs warehouse routing):")
print(f"  km saved    : {result['km_saved']:.0f} km")
print(f"  CO2 saved   : {result['co2_saved_kg']:.2f} kg")
print(f"  Green credits: {result['green_credits_earned']}")

print()
print("-" * 65)
print("Scenario: Grade D item (damaged laptop) — donation floor test")
print("-" * 65)

r2 = route_item(
    listing_id="lst_broken_laptop_001",
    grade="D",
    category="Electronics",
    defects=[
        {"type": "broken piece",  "severity": "severe"},
        {"type": "crack on surface", "severity": "moderate"},
    ],
    geohash5="tbxu1",   # Whitefield — low demand, far from clusters
    mrp=45000.0,
)
print(f"Price: Rs. {r2['price']:.0f} | Refurb cost: Rs. {r2['refurb_cost']:.0f}")
print(f"Decision: {r2['chosen_path'].upper()}")
print(f"  {r2['mcda_note']}")
print(f"\nEV Breakdown:")
for path, ev in r2['ev_breakdown'].items():
    marker = " <-- CHOSEN" if path == r2['chosen_path'] else ""
    print(f"  {path:22s}: Rs. {ev:8.2f}{marker}")
