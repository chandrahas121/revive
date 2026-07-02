"""
Grade app — wired to real ml.grade_image() pipeline.
Gracefully falls back to a default B grade if ML is unavailable.
"""
import logging
import os
import threading
import uuid

from django.core.cache import cache
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


TRYON_SERVICE_URL = os.environ.get('TRYON_SERVICE_URL', '')


class TryOnView(APIView):
    """
    POST /api/tryon/
    Body (multipart): person_image (file), garment_image_url (str), garment_description (str)
    Returns 202 { job_id, status: "processing" } — poll GET /api/tryon/status/<job_id>/.

    Try-On is slow (15-60s HuggingFace call), so it is never run inline on a web
    worker. Two modes, chosen by the TRYON_SERVICE_URL env var:

      * Set   → proxy to the standalone tryon-service (the microservice path).
                In docker, nginx routes /api/tryon/ straight to that service, so
                this shim only runs if Django is hit directly.
      * Unset → run in a local background thread (pure-local dev, no extra service).

    Both modes return the SAME async contract, so the frontend is identical.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        person_file = request.FILES.get('person_image')
        if not person_file:
            return Response({'error': 'person_image is required.'}, status=status.HTTP_400_BAD_REQUEST)

        garment_url = request.data.get('garment_image_url', '')
        if not garment_url:
            return Response({'error': 'garment_image_url is required.'}, status=status.HTTP_400_BAD_REQUEST)
        garment_description = request.data.get('garment_description', 'clothing item')

        # ── Mode 1: proxy to the standalone tryon-service ────────────────────
        if TRYON_SERVICE_URL:
            import requests as _requests
            try:
                person_file.seek(0)
                resp = _requests.post(
                    f"{TRYON_SERVICE_URL.rstrip('/')}/api/tryon/",
                    files={'person_image': (
                        person_file.name,
                        person_file.read(),
                        getattr(person_file, 'content_type', None) or 'image/jpeg',
                    )},
                    data={'garment_image_url': garment_url, 'garment_description': garment_description},
                    timeout=10,   # fast — the service returns a job_id immediately
                )
                return Response(resp.json(), status=resp.status_code)
            except Exception as e:
                logger.error(f"[tryon] proxy to service failed: {e}")
                return Response({'error': 'Virtual try-on service is temporarily unavailable.'},
                                status=status.HTTP_503_SERVICE_UNAVAILABLE)

        # ── Mode 2: local background-thread fallback (no separate service) ───
        person_bytes = person_file.read()
        job_id = uuid.uuid4().hex
        cache.set(f'tryon_job:{job_id}', {'status': 'processing'}, 3600)

        def _worker():
            import time
            import urllib.request
            try:
                req = urllib.request.Request(garment_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=15) as resp:
                    garment_bytes = resp.read()
                from ml.tryon import virtual_tryon_b64
                t0 = time.time()
                result_b64 = virtual_tryon_b64(person_bytes, garment_bytes, garment_description)
                cache.set(f'tryon_job:{job_id}', {
                    'status': 'done',
                    'result_image_b64': result_b64,
                    'latency_ms': int((time.time() - t0) * 1000),
                }, 3600)
            except Exception as exc:
                logger.error(f"[tryon] local job {job_id} failed: {exc}")
                cache.set(f'tryon_job:{job_id}', {
                    'status': 'error',
                    'error': str(exc) or 'Virtual try-on failed. Please try again.',
                }, 3600)

        threading.Thread(target=_worker, daemon=True).start()
        return Response({'job_id': job_id, 'status': 'processing'}, status=status.HTTP_202_ACCEPTED)


class TryOnStatusView(APIView):
    """
    GET /api/tryon/status/<job_id>/
    Mirrors the async grading status endpoint. Proxies to the tryon-service when
    configured, otherwise reads the local background-thread result from cache.
    """
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        if TRYON_SERVICE_URL:
            import requests as _requests
            try:
                resp = _requests.get(
                    f"{TRYON_SERVICE_URL.rstrip('/')}/api/tryon/status/{job_id}/",
                    timeout=8,
                )
                return Response(resp.json(), status=resp.status_code)
            except Exception as e:
                logger.error(f"[tryon] status proxy failed: {e}")
                return Response({'error': 'Virtual try-on service is temporarily unavailable.'},
                                status=status.HTTP_503_SERVICE_UNAVAILABLE)

        result = cache.get(f'tryon_job:{job_id}')
        if result is None:
            return Response({'error': 'Job not found or expired.'}, status=status.HTTP_404_NOT_FOUND)
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


class InspectAndRouteView(APIView):
    """
    POST /api/grade/inspect/   — the RETURN inspection endpoint.

    Multi-angle (and optional video) inspection with a product-match fraud gate,
    then routing. This is what the return flow calls so a customer cannot return
    a headphone by photographing a shoe.

    Body (multipart):
      images        file[]  — one or more angle photos (front, back, label, …)
      video         file    — optional 15s clip (used if frame sampling available)
      expected_title str    — the product the customer is returning
      category      str
      product_id    str
      mrp           float
      geohash5      str
      operator      str

    Response:
      { match: bool, detected_object, detected_category,   # fraud gate
        grade, confidence, defects, condition_summary, completeness,
        heatmap_b64?, frames_sampled, route: {...} }
      If match is False, NO grade is returned — the caller must show a mismatch.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        images = request.FILES.getlist('images') or ([request.FILES['image']] if 'image' in request.FILES else [])
        video = request.FILES.get('video')
        if not images and not video:
            return Response({'error': 'At least one image (or a video) is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        raw_category = request.data.get('category', 'Electronics')
        category = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        expected_title = request.data.get('expected_title', '')
        product_id = request.data.get('product_id', 'return')
        operator = request.data.get('operator', 'agent')
        geohash5 = request.data.get('geohash5', 'tbxx1')
        slots = list(request.data.getlist('slots')) if hasattr(request.data, 'getlist') else []
        # Seller listing their OWN item (Sell It) passes skip_match=true → gates bypassed.
        skip_match = str(request.data.get('skip_match', '')).lower() in ('true', '1', 'yes')
        try:
            mrp = float(request.data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            mrp = 1000.0

        images_bytes = [f.read() for f in images]
        video_bytes = video.read() if video else None
        video_suffix = (os.path.splitext(video.name)[1] or '.mp4') if video else '.mp4'

        from grade.inspect import run_return_inspect
        result = run_return_inspect(
            images=images_bytes, slots=slots, category=category,
            expected_title=expected_title, product_id=product_id, operator=operator,
            geohash5=geohash5, mrp=mrp, skip_match=skip_match,
            video_bytes=video_bytes, video_suffix=video_suffix,
        )
        return Response(result)


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


_CATEGORY_MAP = {
    'fashion': 'Clothing', 'home & garden': 'Home & Kitchen',
    'toys & games': 'Toys', 'sports & outdoors': 'Sports',
    'beauty & health': 'Beauty', 'automotive': 'Other', 'music': 'Other',
}


class AsyncGradeView(APIView):
    """
    POST /api/grade/async/

    Non-blocking grading with automatic mode selection:

    Production (REDIS_URL set on Render):
      Django encodes image as base64 → pushes job to Upstash Redis queue →
      returns job_id in <5ms → Celery worker picks it up → writes result.
      Multiple workers can run concurrently — true horizontal ML scaling.

    Local dev (no REDIS_URL):
      Falls back to a daemon background thread. Caller sees identical behaviour.

    Poll GET /api/grade/status/<job_id>/ until result["status"] == "done".
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import base64 as _b64
        from django.conf import settings as _settings

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'image file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        image_bytes = image_file.read()
        product_id = request.data.get('product_id', 'UNKNOWN')
        raw_category = request.data.get('category', 'Electronics')
        category = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        operator = request.data.get('operator', 'seller')
        job_id = uuid.uuid4().hex

        cache.set(f'grade_job:{job_id}', {'status': 'processing', 'job_id': job_id}, 3600)

        if os.environ.get('REDIS_URL'):
            # Production: dispatch to Celery worker via Upstash Redis queue
            from grade.tasks import grade_image_task
            image_b64 = _b64.b64encode(image_bytes).decode('utf-8')
            grade_image_task.delay(image_b64, product_id, category, operator, job_id)
        else:
            # Local dev: background thread (no separate worker process needed)
            def _worker():
                try:
                    result = _run_grade(image_bytes, product_id, category, operator)
                    result['status'] = 'done'
                    result['job_id'] = job_id
                except Exception as exc:
                    result = {**_FALLBACK, 'status': 'done', 'job_id': job_id, 'error': str(exc)}
                cache.set(f'grade_job:{job_id}', result, 3600)
            threading.Thread(target=_worker, daemon=True).start()

        return Response({'job_id': job_id, 'status': 'processing'}, status=status.HTTP_202_ACCEPTED)


class GradeStatusView(APIView):
    """
    GET /api/grade/status/<job_id>/

    Returns {status: "processing"} while the background thread is running,
    or the full grade result (same shape as POST /api/grade/) once done.
    Returns 404 if the job_id is unknown or the result has expired (>1 hour).
    """
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        result = cache.get(f'grade_job:{job_id}')
        if result is None:
            return Response({'error': 'Job not found or expired.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class AsyncInspectView(APIView):
    """
    POST /api/grade/inspect/async/

    Non-blocking multi-angle seller grade + route. Same inputs as
    /api/grade/inspect/ (images[], slots[], category, expected_title, mrp, …) but
    returns a job_id immediately so a slow multi-second ML grade never ties up a
    web worker. Poll GET /api/grade/inspect/status/<job_id>/ until status=="done".

    Mode selection mirrors AsyncGradeView:
      * REDIS_URL set → dispatch to a Celery worker (true horizontal scaling)
      * else          → local background thread (dev, no separate worker)
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import base64 as _b64

        images = request.FILES.getlist('images') or (
            [request.FILES['image']] if 'image' in request.FILES else [])
        if not images:
            return Response({'error': 'At least one image is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        raw_category = request.data.get('category', 'Electronics')
        category = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        expected_title = request.data.get('expected_title', '')
        product_id = request.data.get('product_id', 'P2P-TEMP')
        operator = request.data.get('operator', 'seller')
        geohash5 = request.data.get('geohash5', 'tbxx1')
        slots = list(request.data.getlist('slots')) if hasattr(request.data, 'getlist') else []
        try:
            mrp = float(request.data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            mrp = 1000.0

        images_bytes = [f.read() for f in images]
        job_id = uuid.uuid4().hex
        cache.set(f'inspect_job:{job_id}', {'status': 'processing', 'job_id': job_id}, 3600)

        if os.environ.get('REDIS_URL'):
            from grade.tasks import seller_inspect_task
            images_b64 = [_b64.b64encode(b).decode('utf-8') for b in images_bytes]
            seller_inspect_task.delay(images_b64, slots, category, expected_title,
                                      product_id, operator, geohash5, mrp, job_id)
        else:
            def _worker():
                try:
                    from grade.inspect import run_seller_grade
                    result = run_seller_grade(
                        images=images_bytes, slots=slots, category=category,
                        expected_title=expected_title, product_id=product_id,
                        operator=operator, geohash5=geohash5, mrp=mrp,
                    )
                    result['status'] = 'done'
                    result['job_id'] = job_id
                except Exception as exc:
                    logger.error(f"[inspect] local job {job_id} failed: {exc}")
                    result = {
                        'status': 'done', 'job_id': job_id, 'grade': None,
                        'message': 'AI grading is temporarily unavailable — you can still submit manually.',
                        'error': str(exc),
                    }
                cache.set(f'inspect_job:{job_id}', result, 3600)

            threading.Thread(target=_worker, daemon=True).start()

        return Response({'job_id': job_id, 'status': 'processing'}, status=status.HTTP_202_ACCEPTED)


class InspectStatusView(APIView):
    """
    GET /api/grade/inspect/status/<job_id>/
    Returns {status:"processing"} while grading, or the full inspect result once
    done (grade + defects + angle_heatmaps + route). 404 if unknown/expired.
    """
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        result = cache.get(f'inspect_job:{job_id}')
        if result is None:
            return Response({'error': 'Job not found or expired.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result)


class AsyncReturnInspectView(APIView):
    """
    POST /api/grade/inspect/return/async/

    Non-blocking RETURN inspection — keeps the full fraud/instance/duplicate gates
    (unlike the seller path). Returns a job_id immediately so the heavy multi-image
    + video ML never ties up a web worker. Poll GET /api/grade/inspect/status/<id>/.

    Media handling:
      * images        → base64 through the queue (small, same as grading)
      * video_url     → a presigned storage URL; the worker fetches it (large video
                        stays out of the queue — avoids Redis size/command blowup)
      * video (file)  → fallback when storage isn't configured (base64 through queue)

    A gate failure comes back as the job result ({status:"done", match:false, …}),
    which the frontend handles exactly like the synchronous endpoint did.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        import base64 as _b64

        images = request.FILES.getlist('images') or (
            [request.FILES['image']] if 'image' in request.FILES else [])
        video = request.FILES.get('video')
        video_url = (request.data.get('video_url') or '').strip()
        if not images and not video and not video_url:
            return Response({'error': 'At least one image (or a video) is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        raw_category = request.data.get('category', 'Electronics')
        category = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        expected_title = request.data.get('expected_title', '')
        product_id = request.data.get('product_id', 'return')
        operator = request.data.get('operator', 'agent')
        geohash5 = request.data.get('geohash5', 'tbxx1')
        slots = list(request.data.getlist('slots')) if hasattr(request.data, 'getlist') else []
        try:
            mrp = float(request.data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            mrp = 1000.0

        images_bytes = [f.read() for f in images]
        video_suffix = (os.path.splitext(video.name)[1] or '.mp4') if video else '.mp4'
        job_id = uuid.uuid4().hex
        cache.set(f'inspect_job:{job_id}', {'status': 'processing', 'job_id': job_id}, 3600)

        if os.environ.get('REDIS_URL'):
            from grade.tasks import return_inspect_task
            images_b64 = [_b64.b64encode(b).decode('utf-8') for b in images_bytes]
            # Prefer a presigned video URL; only base64 a raw video file as a fallback.
            video_b64 = _b64.b64encode(video.read()).decode('utf-8') if (video and not video_url) else ''
            return_inspect_task.delay(images_b64, video_url, video_b64, video_suffix, slots,
                                      category, expected_title, product_id, operator,
                                      geohash5, mrp, job_id)
        else:
            video_bytes_local = video.read() if video else None

            def _worker():
                try:
                    vb = video_bytes_local
                    if vb is None and video_url:
                        import urllib.request
                        from core.storage import to_internal_url
                        req = urllib.request.Request(to_internal_url(video_url),
                                                     headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(req, timeout=30) as resp:
                            vb = resp.read()
                    from grade.inspect import run_return_inspect
                    result = run_return_inspect(
                        images=images_bytes, slots=slots, category=category,
                        expected_title=expected_title, product_id=product_id, operator=operator,
                        geohash5=geohash5, mrp=mrp, skip_match=False,
                        video_bytes=vb, video_suffix=video_suffix,
                    )
                    result['status'] = 'done'
                    result['job_id'] = job_id
                except Exception as exc:
                    logger.error(f"[return_inspect] local job {job_id} failed: {exc}")
                    result = {
                        'status': 'done', 'job_id': job_id, 'grade': None,
                        'message': 'AI grading is temporarily unavailable — showing the last verified grade.',
                        'error': str(exc),
                    }
                cache.set(f'inspect_job:{job_id}', result, 3600)

            threading.Thread(target=_worker, daemon=True).start()

        return Response({'job_id': job_id, 'status': 'processing'}, status=status.HTTP_202_ACCEPTED)
