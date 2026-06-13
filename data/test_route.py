import sys
sys.path.insert(0, '.')
from ml.route import route_item

result = route_item(
    'lst_test',
    grade='B',
    category='Footwear',
    defects=[{'type': 'scratch on surface', 'severity': 'minor'}],
    geohash5='tbxx1',
    mrp=2999.0
)
print("chosen_path:", result["chosen_path"])
print("price: Rs.", round(result["price"]))
print("ev_breakdown:", result["ev_breakdown"])
print("km_saved:", result["km_saved"], "| co2:", result["co2_saved_kg"], "kg | credits:", result["green_credits_earned"])
print("demand_note:", result["demand_note"])
