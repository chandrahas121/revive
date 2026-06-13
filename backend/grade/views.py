"""
Grade app — wired to real ml.grade_image() pipeline.
Gracefully falls back to a default B grade if ML is unavailable.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

logger = logging.getLogger(__name__)

_FALLBACK = {
    "grade": "B",
    "confidence": 0.75,
    "defects": [],
    "completeness": 0.9,
    "condition_summary": "Item appears to be in good condition. Manual review recommended.",
    "functional": True,
    "latency_ms": 0,
    "model_version": "fallback-v0",
    "from_cache": False,
}


def _run_grade(image_bytes, product_id, category, operator):
    try:
        from ml.grade import grade_image
        return grade_image(
            image_bytes=image_bytes,
            product_id=product_id,
            operator=operator,
            category=category,
            use_cache=True,
        )
    except Exception as e:
        logger.warning(f"grade_image() failed, returning fallback: {e}")
        return {**_FALLBACK}


class GradeView(APIView):
    """
    POST /api/grade/
    Body (multipart): image (file), product_id, category, operator, include_heatmap
    Returns full grade result. Optionally includes heatmap_b64 defect overlay.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'image file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        image_bytes = image_file.read()
        product_id = request.data.get('product_id', 'UNKNOWN')
        raw_category = request.data.get('category', 'Electronics')
        # Normalise frontend category names to what dino.py prompt sets expect
        _CATEGORY_MAP = {
            'fashion': 'Clothing',
            'home & garden': 'Home & Kitchen',
            'toys & games': 'Toys',
            'sports & outdoors': 'Sports',
            'beauty & health': 'Beauty',
            'automotive': 'Other',
            'music': 'Other',
        }
        category = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        operator = request.data.get('operator', 'seller')
        include_heatmap = request.data.get('include_heatmap', 'false').lower() == 'true'

        result = _run_grade(image_bytes, product_id, category, operator)

        if include_heatmap:
            try:
                from ml.heatmap import render_heatmap_b64
                result['heatmap_b64'] = render_heatmap_b64(image_bytes, result)
            except Exception as e:
                logger.warning(f"Heatmap generation failed: {e}")
                result['heatmap_b64'] = None

        return Response(result)


class GradeAndRouteView(APIView):
    """
    POST /api/grade/route/
    Combined Pillar 1 → Pillar 2 pipeline in one call.
    Grades the image then immediately runs EV routing.

    This is the S3 demo endpoint — powers the AI Grading Result screen which
    shows grade + defect boxes + routing decision + environmental impact.

    Body (multipart):
      image         file    — product photo
      product_id    str
      category      str     — e.g. "Footwear"
      geohash5      str     — seller location cell (default tbxx1 = Koramangala)
      mrp           float   — original MRP in ₹ (determines Tier 1/2/3)
      operator      str     — self | agent | seller
      include_heatmap bool  — also render defect overlay heatmap

    Response: grade result merged with route result under key 'route'.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import json as _json
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'image file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        image_bytes  = image_file.read()
        product_id   = request.data.get('product_id', 'UNKNOWN')
        raw_category = request.data.get('category', 'Electronics')
        _CATEGORY_MAP = {
            'fashion': 'Clothing',
            'home & garden': 'Home & Kitchen',
            'toys & games': 'Toys',
            'sports & outdoors': 'Sports',
            'beauty & health': 'Beauty',
            'automotive': 'Other',
            'music': 'Other',
        }
        category         = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        geohash5         = request.data.get('geohash5', 'tbxx1')
        operator         = request.data.get('operator', 'seller')
        include_heatmap  = request.data.get('include_heatmap', 'false').lower() == 'true'

        try:
            mrp = float(request.data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            mrp = 1000.0

        # ── Pillar 1: Grade ──────────────────────────────────────────────────
        grade_result = _run_grade(image_bytes, product_id, category, operator)

        # Optional defect heatmap overlay
        if include_heatmap:
            try:
                from ml.heatmap import render_heatmap_b64
                grade_result['heatmap_b64'] = render_heatmap_b64(image_bytes, grade_result)
            except Exception as e:
                logger.warning(f"Heatmap generation failed: {e}")
                grade_result['heatmap_b64'] = None

        # ── Pillar 2: Route ──────────────────────────────────────────────────
        grade   = grade_result.get('grade', 'C')
        defects = grade_result.get('defects', [])

        try:
            from ml.route import route_item
            route_result = route_item(
                listing_id=grade_result.get('listing_id', 'lst_unknown'),
                grade=grade,
                category=category,
                defects=defects,
                geohash5=geohash5,
                mrp=mrp,
                product_id=product_id,
            )
        except Exception as e:
            logger.warning(f"route_item() failed in grade+route: {e}")
            route_result = {
                "chosen_path": "resell_p2p",
                "route_label": "Resell Nearby",
                "customer_message": "Your item will be resold to someone nearby",
                "tier": 1,
                "price": mrp * 0.6,
                "km_saved": 570.0,
                "co2_saved_kg": 119.7,
                "demand_score": 0.7,
                "local_buyers": 45,
                "green_credits_earned": 30,
                "fallback": True,
            }

        # Merge: grade result is the envelope; route is a nested key
        grade_result['route'] = route_result
        grade_result['category'] = category  # echo back so front-end has full context

        return Response(grade_result)


class HeatmapView(APIView):
    """
    POST /api/grade/heatmap/
    Body (multipart): image (file), grade_result (JSON string)
    Returns { heatmap_b64: str } — base64 JPEG with defect boxes overlaid.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import json
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'image is required.'}, status=status.HTTP_400_BAD_REQUEST)

        image_bytes = image_file.read()
        grade_result_raw = request.data.get('grade_result', '{}')
        try:
            grade_result = json.loads(grade_result_raw) if isinstance(grade_result_raw, str) else grade_result_raw
        except Exception:
            grade_result = {}

        try:
            from ml.heatmap import render_heatmap_b64
            heatmap_b64 = render_heatmap_b64(image_bytes, grade_result)
            return Response({'heatmap_b64': heatmap_b64})
        except Exception as e:
            logger.error(f"Heatmap failed: {e}")
            return Response({'error': 'Heatmap generation failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
