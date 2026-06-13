"""
ml/pregrade_demo.py
--------------------
Pre-grade all demo items into the grade cache before the presentation.
This ensures zero-latency (cache hit) for every live demo on stage.

Usage:
    python ml/pregrade_demo.py --images demo_items/

Demo items:
  - Priya's shoes (photo + video)
  - Rahul's baby monitor
  - 3 Small Seller batch items (12 items total simulated)
  - PDP prevention product

Set environment variables first:
    ANTHROPIC_API_KEY=sk-ant-...       (or)
    OPENROUTER_API_KEY=sk-or-...
    LLM_PROVIDER=anthropic             (or openrouter)
"""
from __future__ import annotations
import argparse
import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Add parent to path so ml package is importable
sys.path.insert(0, str(Path(__file__).parent.parent))


DEMO_FIXTURES = [
    # Priya's shoes (Scenario 1)
    {
        "name": "priya_shoes",
        "product_id": "B08SHOE001",
        "category": "Footwear",
        "mrp": 2999.0,
        "operator": "self",
        "expected_grade": "B",
    },
    # Rahul's baby monitor (Scenario 2)
    {
        "name": "rahul_baby_monitor",
        "product_id": "B07BABY001",
        "category": "Electronics",
        "mrp": 5999.0,
        "operator": "self",
        "expected_grade": "A",
    },
    # Small Seller batch items (Scenario 3)
    {
        "name": "batch_item_1",
        "product_id": "B06CLOTH01",
        "category": "Clothing",
        "mrp": 1299.0,
        "operator": "seller",
        "expected_grade": "B",
    },
    {
        "name": "batch_item_2",
        "product_id": "B06CLOTH02",
        "category": "Clothing",
        "mrp": 999.0,
        "operator": "seller",
        "expected_grade": "C",
    },
    {
        "name": "batch_item_3",
        "product_id": "B06ELECT01",
        "category": "Electronics",
        "mrp": 4500.0,
        "operator": "seller",
        "expected_grade": "A",
    },
    # PDP prevention product (Scenario 4)
    {
        "name": "pdp_nike_shoe",
        "product_id": "B09G9HD6PD",
        "category": "Footwear",
        "mrp": 3499.0,
        "operator": "self",
        "expected_grade": "A",
    },
]


def create_synthetic_image(width: int = 400, height: int = 400, color: tuple = (200, 150, 100)) -> bytes:
    """Create a synthetic JPEG image for demo when no real photos available."""
    try:
        from PIL import Image, ImageDraw, ImageFont
        import io
        img = Image.new("RGB", (width, height), color)
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, width-20, height-20], outline=(50, 50, 50), width=3)
        draw.text((width//4, height//2 - 20), "DEMO PRODUCT", fill=(50, 50, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"Could not create PIL image: {e}")
        # Return a minimal valid JPEG
        return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9'


def pregrade_all(images_dir: str = None, force: bool = False):
    """Pre-grade all demo items and cache results."""
    from ml.grade import grade_image
    from ml.route import route_item

    images_path = Path(images_dir) if images_dir else None
    results = {}

    for item in DEMO_FIXTURES:
        name = item["name"]
        logger.info(f"\n{'='*50}")
        logger.info(f"Pre-grading: {name}")

        # Try to load real image, fall back to synthetic
        image_bytes = None
        if images_path:
            for ext in ("jpg", "jpeg", "png", "webp"):
                img_file = images_path / f"{name}.{ext}"
                if img_file.exists():
                    image_bytes = img_file.read_bytes()
                    logger.info(f"  Using real image: {img_file}")
                    break

        if image_bytes is None:
            logger.info(f"  No real image found — using synthetic placeholder")
            colors = {
                "priya_shoes": (180, 120, 80),
                "rahul_baby_monitor": (80, 100, 180),
                "batch_item_1": (120, 180, 80),
                "batch_item_2": (80, 160, 120),
                "batch_item_3": (160, 80, 120),
                "pdp_nike_shoe": (50, 80, 200),
            }
            image_bytes = create_synthetic_image(color=colors.get(name, (150, 150, 150)))

        t0 = time.monotonic()
        grade_result = grade_image(
            image_bytes,
            product_id=item["product_id"],
            operator=item["operator"],
            use_cache=True,
        )
        latency = round((time.monotonic() - t0) * 1000)

        logger.info(f"  Grade: {grade_result['grade']} (expected: {item['expected_grade']})")
        logger.info(f"  Confidence: {grade_result['confidence']:.2f}")
        logger.info(f"  Latency: {latency}ms (from_cache={grade_result.get('from_cache', False)})")
        logger.info(f"  Defects: {len(grade_result.get('defects', []))} detected")

        # Also pre-compute routing
        route_result = route_item(
            listing_id=grade_result.get("listing_id", name),
            grade=grade_result["grade"],
            category=item["category"],
            defects=grade_result.get("defects", []),
            geohash5="tbxx1",  # Bengaluru demo geohash
            mrp=item["mrp"],
            product_id=item["product_id"],
        )
        logger.info(f"  Route: {route_result['chosen_path']} | EV ₹{route_result['ev_breakdown'][route_result['chosen_path']]:.0f} vs Liquidate ₹{route_result['ev_breakdown']['recycle']:.0f}")
        logger.info(f"  km saved: {route_result['km_saved']:.0f} | CO₂ saved: {route_result['co2_saved_kg']:.1f} kg | Credits: {route_result['green_credits_earned']}")

        results[name] = {
            "grade": grade_result,
            "route": route_result,
        }

    # Summary
    logger.info(f"\n{'='*50}")
    logger.info("✅ Pre-grading complete!")
    logger.info(f"   {len(results)} items graded and cached")
    logger.info("   Second run (cache hit) will be <5ms for all items")

    # Save combined pre-grade results
    out_path = Path(__file__).parent / "artifacts" / "pregrade_results.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        # Make JSON serializable
        json.dump(results, f, indent=2, default=str)
    logger.info(f"   Results saved to {out_path}")

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pre-grade all demo items into cache")
    parser.add_argument("--images", default=None, help="Directory containing demo product images")
    parser.add_argument("--force", action="store_true", help="Force re-grade even if cached")
    args = parser.parse_args()
    pregrade_all(args.images, args.force)
