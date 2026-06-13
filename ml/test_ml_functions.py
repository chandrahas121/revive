"""
Quick smoke test — validates all 4 ML functions are importable and return correct schemas.
Run: python ml/test_ml_functions.py
"""
import sys
import json
import os
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding != 'utf-8':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

sys.path.insert(0, str(Path(__file__).parent.parent))

PASS = "[PASS]"
FAIL = "[FAIL]"

def test_route():
    print("\n--- Testing route_item() ---")
    from ml.route import route_item
    result = route_item(
        listing_id="test_001",
        grade="B",
        category="Footwear",
        defects=[{"type": "scratch on surface", "severity": "minor"}],
        geohash5="tbxx1",
        mrp=2999.0,
    )
    assert "chosen_path" in result, "Missing chosen_path"
    assert "ev_breakdown" in result, "Missing ev_breakdown"
    assert "km_saved" in result, "Missing km_saved"
    assert "co2_saved_kg" in result, "Missing co2_saved_kg"
    assert "green_credits_earned" in result, "Missing green_credits_earned"
    print(f"  {PASS} chosen_path = {result['chosen_path']}")
    print(f"  {PASS} EV breakdown: {result['ev_breakdown']}")
    print(f"  {PASS} km_saved = {result['km_saved']} | CO₂ = {result['co2_saved_kg']} kg | Credits = {result['green_credits_earned']}")
    return True

def test_prevent():
    print("\n--- Testing score_risk() ---")
    from ml.prevent import score_risk
    result = score_risk(
        user_id="user_priya_001",
        cart_items=[{
            "product_id": "B09G9HD6PD",
            "category": "Footwear",
            "brand": "Nike",
            "size": 8.0,
            "is_gift": False,
        }],
        user_history={"return_rate": 0.25, "size_history": {"Footwear": 7.5}},
    )
    assert "risk" in result, "Missing risk"
    assert "nudge_text" in result, "Missing nudge_text"
    assert "flagged_item_id" in result, "Missing flagged_item_id"
    print(f"  {PASS} risk = {result['risk']}")
    print(f"  {PASS} nudge = {result['nudge_text'][:60]}...")
    print(f"  {PASS} credit_promise = {result['credit_promise']}")
    return True

def test_recommend():
    print("\n--- Testing recommend() ---")
    from ml.recommend import recommend
    import numpy as np
    # Synthetic listings
    listings = [
        {"listing_id": "lst_001", "product_id": "prod_001", "grade": "A", "source": "p2p", "geohash5": "tbxx1", "price": 500.0},
        {"listing_id": "lst_002", "product_id": "prod_002", "grade": "B", "source": "warehouse", "geohash5": "tbxx2", "price": 1200.0},
        {"listing_id": "lst_003", "product_id": "prod_003", "grade": "C", "source": "renewed", "geohash5": "tbxx1", "price": 800.0},
        {"listing_id": "lst_004", "product_id": "prod_004", "grade": "A", "source": "p2p", "geohash5": "tbxx1", "price": 2500.0},
    ]
    result = recommend(
        user_id="user_buyer_001",
        n=3,
        geohash5="tbxx1",
        available_listings=listings,
    )
    # Should return max 3 (excludes grade C)
    assert len(result) <= 3, f"Expected ≤3 results, got {len(result)}"
    for item in result:
        assert item["grade"] in ("A", "B"), f"Grade C should be filtered: {item}"
        assert "score" in item
        assert "reason" in item
    print(f"  {PASS} {len(result)} recommendations returned (grade C filtered)")
    for r in result:
        print(f"     listing_id={r['listing_id']} grade={r['grade']} score={r['score']:.4f} reason='{r['reason']}'")
    return True

def test_grade_no_llm():
    """Test grade pipeline without LLM (will use fallback/heuristic)."""
    print("\n--- Testing grade_image() (no-LLM fallback) ---")
    import os
    # Clear any API keys to force fallback
    saved_keys = {}
    for key in ("ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"):
        saved_keys[key] = os.environ.pop(key, None)
    os.environ["LLM_PROVIDER"] = "local"  # Will fail gracefully since no GPU

    from ml.grade import grade_image
    # Create a synthetic test image
    from PIL import Image
    import io
    img = Image.new("RGB", (200, 200), (180, 120, 80))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    image_bytes = buf.getvalue()

    result = grade_image(image_bytes, product_id="test_prod", operator="self")

    # Restore keys
    for key, val in saved_keys.items():
        if val:
            os.environ[key] = val

    assert "grade" in result, "Missing grade"
    assert result["grade"] in ("A", "B", "C", "D"), f"Invalid grade: {result['grade']}"
    assert "defects" in result, "Missing defects"
    assert "confidence" in result, "Missing confidence"
    assert "latency_ms" in result, "Missing latency_ms"
    print(f"  {PASS} grade = {result['grade']}")
    print(f"  {PASS} confidence = {result['confidence']}")
    print(f"  {PASS} latency_ms = {result['latency_ms']}")
    print(f"  {PASS} defects = {len(result['defects'])}")
    return True

def test_all():
    results = {}
    tests = [
        ("route_item", test_route),
        ("score_risk", test_prevent),
        ("recommend", test_recommend),
        ("grade_image", test_grade_no_llm),
    ]

    for name, fn in tests:
        try:
            fn()
            results[name] = PASS
        except Exception as e:
            results[name] = f"{FAIL} {e}"
            import traceback
            traceback.print_exc()

    print("\n" + "="*50)
    print("ML Function Smoke Test Results:")
    all_pass = True
    for name, status in results.items():
        print(f"  {status} {name}")
        if FAIL in str(status):
            all_pass = False
    print("="*50)
    return all_pass

if __name__ == "__main__":
    ok = test_all()
    sys.exit(0 if ok else 1)
