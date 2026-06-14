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


class TryOnView(APIView):
    """
    POST /api/tryon/
    Body (multipart): person_image (file), garment_image_url (str), garment_description (str)
    Returns { result_image_b64: str, latency_ms: int }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import time
        import urllib.request

        person_file = request.FILES.get('person_image')
        if not person_file:
            return Response({'error': 'person_image is required.'}, status=status.HTTP_400_BAD_REQUEST)

        garment_url = request.data.get('garment_image_url', '')
        garment_description = request.data.get('garment_description', 'clothing item')

        if not garment_url:
            return Response({'error': 'garment_image_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            person_bytes = person_file.read()

            # Fetch garment image from URL
            req = urllib.request.Request(garment_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                garment_bytes = resp.read()

            t0 = time.time()
            from ml.tryon import virtual_tryon_b64
            result_b64 = virtual_tryon_b64(person_bytes, garment_bytes, garment_description)
            latency_ms = int((time.time() - t0) * 1000)

            return Response({'result_image_b64': result_b64, 'latency_ms': latency_ms})

        except Exception as e:
            logger.error(f"[tryon] Failed: {e}")
            return Response(
                {'error': str(e) or 'Virtual try-on service is temporarily unavailable.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


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
