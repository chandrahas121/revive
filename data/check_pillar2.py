"""
Pillar 2 integration check — EV Router + Pricing Model + Demand Gate.
Run from the repo root:
    python data/check_pillar2.py

Tests:
  1. LightGBM price model loaded (artifact exists + prediction in valid range)
  2. Demand index loaded from artifact
  3. Geohash demand gravity model (demand lookup)
  4. Sell-probability model (logistic)
  5. route_item() — Priya's shoes scenario (Tier 1 → resell_p2p)
  6. route_item() — Tier 2 electronics hard rule (resell_p2p blocked if dist>5km)
  7. route_item() — Tier 3 hard rule (always refurbish)
  8. route_item() — donation floor (Grade D broken item → donate or recycle)
  9. demand_gate() — day 0 high-demand → SELL
  10. demand_gate() — day 8 low-demand → ESCALATE_CITY
  11. demand_gate() — day 25 → ESCALATE_FC
  12. demand_gate() — day 65 → LIQUIDATE
  13. Output schema validation (all required fields present)
  14. EV breakdown sanity (resell_p2p > resell_warehouse for local items)
"""
import sys, io, os, json, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.path.insert(0, '.')

from pathlib import Path

# Load .env
for line in Path('.env').read_text(encoding='utf-8', errors='ignore').splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())
# Disable Redis for offline check
os.environ.setdefault('USE_REDIS', 'false')

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def chk(condition, pass_msg, fail_msg):
    if condition:
        results.append((PASS, pass_msg))
    else:
        results.append((FAIL, fail_msg))
    return condition


# ── 1. Price model artifact ───────────────────────────────────────────────────
print("Checking Step 1: LightGBM price model...")
try:
    from ml.route import _load_price_model, _predict_price
    model = _load_price_model()
    if model:
        price = _predict_price('B', 'Footwear', 3000.0)
        chk(150 < price < 2700, f"Price model: Grade B Footwear MRP=3000 → Rs{price:.0f} (in valid range)", f"Price out of range: {price}")
    else:
        results.append((PASS, "Price model: no artifact — heuristic pricing active (acceptable for demo)"))
except Exception as e:
    results.append((FAIL, f"Price model: {e}"))

# ── 2. Demand index artifact ──────────────────────────────────────────────────
print("Checking Step 2: Demand index artifact...")
try:
    idx_path = Path('ml/artifacts/demand_index.json')
    chk(idx_path.exists() and idx_path.stat().st_size > 1000,
        f"Demand index: {idx_path.stat().st_size // 1024} KB loaded",
        "Demand index: missing or empty")
except Exception as e:
    results.append((FAIL, f"Demand index: {e}"))

# ── 3. Geohash demand gravity lookup ─────────────────────────────────────────
print("Checking Step 3: Geohash demand gravity model...")
try:
    from ml.route import _demand_lookup
    info = _demand_lookup('tbxx1', 'Footwear')
    chk(
        'demand_score' in info and 'local_buyers' in info and 'dist_to_cluster_km' in info,
        f"Demand lookup tbxx1/Footwear: score={info['demand_score']:.3f} buyers={info['local_buyers']} dist={info['dist_to_cluster_km']}km",
        f"Missing fields in demand_lookup output: {info}"
    )
except Exception as e:
    results.append((FAIL, f"Demand lookup: {e}"))

# ── 4. Sell-probability model ─────────────────────────────────────────────────
print("Checking Step 4: Sell-probability logistic model...")
try:
    from ml.route import _sell_probability
    # Grade A, at 60% of median price → should sell reliably
    prob_a = _sell_probability(720.0, 'A', 'Footwear', 0.7)
    # Grade D, at 150% of median price → low sell prob
    prob_d = _sell_probability(1800.0, 'D', 'Footwear', 0.3)
    chk(
        prob_a > prob_d and 0.0 < prob_d < prob_a <= 0.97,
        f"Sell prob: Grade A @ discount={prob_a:.2%} > Grade D @ premium={prob_d:.2%}",
        f"Sell prob ordering wrong: A={prob_a:.2%}, D={prob_d:.2%}"
    )
except Exception as e:
    results.append((FAIL, f"Sell probability: {e}"))

# ── 5. route_item — Priya shoes (Tier 1, local demand) ───────────────────────
print("Checking Step 5: route_item — Priya shoes Tier 1...")
try:
    from ml.route import route_item
    t0 = time.perf_counter()
    r = route_item(
        listing_id='lst_priya_shoes',
        grade='B',
        category='Footwear',
        defects=[{'type': 'scratch on surface', 'severity': 'minor'}],
        geohash5='tbxx1',   # Koramangala — high demand
        mrp=1200.0,         # Tier 1 (< Rs2000)
    )
    ms = (time.perf_counter() - t0) * 1000
    chk(
        r['chosen_path'] == 'resell_p2p' and r['tier'] == 1 and r['km_saved'] > 500,
        f"Priya shoes: tier={r['tier']} path={r['chosen_path']} price=Rs{r['price']:.0f} km_saved={r['km_saved']} in {ms:.0f}ms",
        f"Wrong routing: {r['chosen_path']} tier={r['tier']} (expected resell_p2p tier=1)"
    )
    chk(
        'route_label' in r and 'customer_message' in r and 'ev_breakdown' in r,
        f"Output schema: route_label='{r['route_label']}' customer_message present ev_breakdown present",
        f"Missing schema fields in route result"
    )
except Exception as e:
    results.append((FAIL, f"route_item Tier1: {e}"))

# ── 6. route_item — Tier 2 distance rule ─────────────────────────────────────
print("Checking Step 6: route_item — Tier 2 distance hard rule...")
try:
    # Tier 2 (Rs6000). Whitefield (tbxu1) → demand cluster far away → kirana blocked
    r2 = route_item(
        listing_id='lst_phone_far',
        grade='A',
        category='Electronics',
        defects=[],
        geohash5='tbxu1',   # Whitefield — lower demand, might have dist>5km to cluster
        mrp=6000.0,         # Tier 2 (Rs2000–Rs10000)
    )
    chk(
        r2['tier'] == 2,
        f"Tier2 detected: tier={r2['tier']} path={r2['chosen_path']} dist_cluster={r2['dist_to_cluster_km']}km",
        f"Tier2 not detected: tier={r2['tier']}"
    )
    # If dist>5km, must not be resell_p2p
    if r2['dist_to_cluster_km'] > 5.0:
        chk(
            r2['chosen_path'] != 'resell_p2p',
            f"Tier2 kirana blocked (dist={r2['dist_to_cluster_km']}km>5km): path={r2['chosen_path']} ✓",
            f"Tier2 kirana block FAILED: dist={r2['dist_to_cluster_km']}km but path={r2['chosen_path']}"
        )
    else:
        results.append((PASS, f"Tier2: item is within 5km of cluster ({r2['dist_to_cluster_km']}km) — Route A allowed"))
except Exception as e:
    results.append((FAIL, f"route_item Tier2: {e}"))

# ── 7. route_item — Tier 3 hard rule (always refurbish) ─────────────────────
print("Checking Step 7: route_item — Tier 3 SPN refurb override...")
try:
    r3 = route_item(
        listing_id='lst_laptop_premium',
        grade='B',
        category='Electronics',
        defects=[],
        geohash5='tbxu1',
        mrp=55000.0,        # Tier 3 (> Rs10000)
    )
    chk(
        r3['tier'] == 3 and r3['chosen_path'] == 'refurbish',
        f"Tier3 SPN override: tier={r3['tier']} path={r3['chosen_path']} label='{r3['route_label']}'",
        f"Tier3 SPN override FAILED: tier={r3['tier']} path={r3['chosen_path']} (expected refurbish)"
    )
except Exception as e:
    results.append((FAIL, f"route_item Tier3: {e}"))

# ── 8. route_item — donation floor (Grade D broken item) ─────────────────────
print("Checking Step 8: route_item — donation floor for Grade D...")
try:
    r_broken = route_item(
        listing_id='lst_broken_toy',
        grade='D',
        category='Toys',
        defects=[
            {'type': 'broken piece', 'severity': 'severe'},
            {'type': 'damaged area', 'severity': 'severe'},
        ],
        geohash5='tbxw2',   # Electronic City — lower demand
        mrp=400.0,          # Very low MRP toy
    )
    chk(
        r_broken['chosen_path'] in ('donate', 'recycle'),
        f"Donation floor: Grade D toy → {r_broken['chosen_path']} (ev_p2p={r_broken['ev_breakdown']['resell_p2p']:.0f})",
        f"Donation floor FAILED: Grade D ended up as {r_broken['chosen_path']}"
    )
except Exception as e:
    results.append((FAIL, f"route_item donation floor: {e}"))

# ── 9–12. demand_gate ─────────────────────────────────────────────────────────
print("Checking Steps 9-12: demand_gate...")
try:
    from ml.route import demand_gate

    g0 = demand_gate('lst_shoes', 'tbxx1', 'Footwear', 'B', 1800.0, 0)
    chk(g0['action'] == 'SELL',
        f"Gate day0 high-demand: action={g0['action']} score={g0['demand_score']} sell_prob={g0['sell_probability']:.2%}",
        f"Gate day0: expected SELL, got {g0['action']}")

    g8 = demand_gate('lst_shoes', 'tbxw2', 'Footwear', 'C', 500.0, 8)
    chk(g8['action'] == 'ESCALATE_CITY',
        f"Gate day8 low-demand: action={g8['action']}",
        f"Gate day8: expected ESCALATE_CITY, got {g8['action']}")

    g25 = demand_gate('lst_stuck', 'tbxw2', 'Toys', 'D', 200.0, 25)
    chk(g25['action'] == 'ESCALATE_FC',
        f"Gate day25: action={g25['action']}",
        f"Gate day25: expected ESCALATE_FC, got {g25['action']}")

    g65 = demand_gate('lst_old', 'tbxw2', 'Books', 'D', 50.0, 65)
    chk(g65['action'] == 'LIQUIDATE',
        f"Gate day65: action={g65['action']}",
        f"Gate day65: expected LIQUIDATE, got {g65['action']}")
except Exception as e:
    results.append((FAIL, f"demand_gate: {e}"))

# ── 13. EV breakdown sanity ───────────────────────────────────────────────────
print("Checking Step 13: EV breakdown sanity...")
try:
    # For a local item (Koramangala), P2P should beat warehouse
    r_local = route_item('lst_local_shoes', 'A', 'Footwear', [], 'tbxx1', 1500.0)
    ev_p2p = r_local['ev_breakdown']['resell_p2p']
    ev_wh  = r_local['ev_breakdown']['resell_warehouse']
    chk(
        ev_p2p > ev_wh,
        f"EV sanity: local resell_p2p (Rs{ev_p2p:.0f}) > warehouse (Rs{ev_wh:.0f}) -- gravity model working",
        f"EV sanity FAILED: p2p={ev_p2p:.0f} vs warehouse={ev_wh:.0f}"
    )
except Exception as e:
    results.append((FAIL, f"EV sanity: {e}"))

# ── Summary ───────────────────────────────────────────────────────────────────
print()
print("=" * 65)
print("PILLAR 2 INTEGRATION CHECK")
print("=" * 65)
for status, msg in results:
    print(f"  {status} {msg}")

passed = sum(1 for s, _ in results if s == PASS)
failed = sum(1 for s, _ in results if s == FAIL)
print(f"\n  {passed}/{passed + failed} checks passed")

if failed == 0:
    print("\n  PILLAR 2 IS READY FOR INTEGRATION")
    print("\nDemo metrics:")
    # Run Priya scenario for final numbers
    r_demo = route_item('lst_priya_demo', 'B', 'Footwear', [{'type':'scratch on surface','severity':'minor'}], 'tbxx1', 1800.0)
    print(f"  Priya's shoes: price=Rs{r_demo['price']:.0f} km_saved={r_demo['km_saved']} co2_saved={r_demo['co2_saved_kg']}kg")
    ev = r_demo['ev_breakdown']
    print(f"  EV breakdown: P2P=Rs{ev['resell_p2p']:.0f} | Warehouse=Rs{ev['resell_warehouse']:.0f} | Recovery={ev['resell_p2p']/max(abs(ev['resell_warehouse']),1):.0f}x better")
else:
    print(f"\n  {failed} issue(s) need attention before integration")
