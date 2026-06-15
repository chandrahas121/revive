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
        video  = request.FILES.get('video')
        if not images and not video:
            return Response({'error': 'At least one image (or a video) is required.'},
                            status=status.HTTP_400_BAD_REQUEST)

        raw_category   = request.data.get('category', 'Electronics')
        _CATEGORY_MAP = {
            'fashion': 'Clothing', 'home & garden': 'Home & Kitchen',
            'toys & games': 'Toys', 'sports & outdoors': 'Sports',
            'beauty & health': 'Beauty', 'automotive': 'Other', 'music': 'Other',
        }
        category       = _CATEGORY_MAP.get(raw_category.lower(), raw_category)
        expected_title = request.data.get('expected_title', '')
        product_id     = request.data.get('product_id', 'return')
        operator       = request.data.get('operator', 'agent')
        geohash5       = request.data.get('geohash5', 'tbxx1')

        # Angle/slot for each uploaded image (front, sole, box, screen_on, …) so the
        # grader inspects the right thing per photo and the defect map is per-angle.
        slots = request.data.getlist('slots') if hasattr(request.data, 'getlist') else (request.data.get('slots') or [])
        slot_labels = list(slots)
        try:
            from ml.category_profiles import capture_prompts
            _lbl = {p['key']: p['label'] for p in capture_prompts(category)}
            slot_labels = [_lbl.get(s, s) for s in slots]
        except Exception:
            pass
        try:
            mrp = float(request.data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            mrp = 1000.0

        # v2: seller listing their OWN item (Sell It) passes skip_match=true, so the
        # fraud/instance gate (meant for returns) is bypassed. Dedup still runs.
        skip_match = str(request.data.get('skip_match', '')).lower() in ('true', '1', 'yes')

        # Read the cover image bytes once (used for the match gate + heatmap)
        cover_bytes = images[0].read() if images else None
        if cover_bytes is not None:
            images[0].seek(0)

        if cover_bytes is not None and not skip_match:
            try:
                from ml.verify import verify_match
                match = verify_match(cover_bytes, expected_category=category, expected_title=expected_title)
            except Exception as e:
                logger.warning(f"verify_match failed, failing open: {e}")
                match = {'match': True, 'checked': False, 'detected_object': '', 'detected_category': category, 'confidence': 0.0}

            if match.get('checked') and not match.get('match'):
                return Response({
                    'match': False,
                    'detected_object':   match.get('detected_object', ''),
                    'detected_category': match.get('detected_category', ''),
                    'confidence':        match.get('confidence', 0.0),
                    'message': (
                        f"This looks like {match.get('detected_object') or 'a different item'}, "
                        f"not the {expected_title or category} you're returning. "
                        "Please scan the correct item."
                    ),
                }, status=status.HTTP_200_OK)

            # ── Instance gate (v2 Q4): is it the SAME model, not just the same
            #    category? Compare against the catalog reference via DINOv2/CLIP. ─
            try:
                from ml.catalog import get_reference_bytes
                from ml.instance_match import instance_match
                ref_bytes = get_reference_bytes(category)
                inst = instance_match(cover_bytes, ref_bytes)
                if inst.get('checked') and not inst.get('match'):
                    return Response({
                        'match': False,
                        'instance_match': inst,
                        'message': (
                            f"This doesn't look like the same {expected_title or category} "
                            "in our catalogue (different model/variant). Please scan the correct item."
                        ),
                    }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.warning(f"instance_match failed, failing open: {e}")

        # ── Duplicate-photo gate (v2 Q6): reject the same shot in many slots ────
        # Only enforced for RETURNS (fraud control). A seller listing their OWN item
        # (skip_match=true) is never hard-blocked here — different angles of large
        # flat objects (laptops/monitors) can hash close together and must still grade.
        if len(images) > 1 and not skip_match:
            try:
                from ml.image_dedup import find_duplicates
                _all_bytes = []
                for f in images:
                    _all_bytes.append(f.read()); f.seek(0)
                dups = find_duplicates(_all_bytes)
                if dups:
                    return Response({
                        'match': True,
                        'duplicate_photos': True,
                        'duplicate_pairs': dups,
                        'message': (
                            "Some photos look identical. Please capture each angle "
                            "separately (e.g. front, back, soles) so we can verify the item."
                        ),
                    }, status=status.HTTP_200_OK)
            except Exception as e:
                logger.warning(f"duplicate check failed, skipping: {e}")

        # ── Grade: video → multi-image → single ───────────────────────────────
        grade_result = None
        frames_sampled = len(images)
        graded_bytes = []   # per-image bytes kept for the per-angle defect maps
        try:
            if video is not None:
                import tempfile, os as _os
                from ml.grade import grade_video
                suffix = _os.path.splitext(video.name)[1] or '.mp4'
                with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                    for chunk in video.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name
                try:
                    grade_result = grade_video(tmp_path, product_id=product_id, operator=operator, category=category)
                    frames_sampled = grade_result.get('frames_sampled', frames_sampled)
                finally:
                    try: _os.unlink(tmp_path)
                    except Exception: pass
            elif len(images) > 1:
                from ml.grade import grade_multi_image
                graded_bytes = [f.read() for f in images]
                grade_result = grade_multi_image(
                    graded_bytes, product_id=product_id, operator=operator,
                    category=category, slots=slots, slot_labels=slot_labels)
                frames_sampled = grade_result.get('frames_sampled', len(images))
        except Exception as e:
            logger.warning(f"multi/video grade failed, falling back to single image: {e}")
            grade_result = None

        if grade_result is None:
            grade_result = _run_grade(cover_bytes, product_id, category, operator)
            frames_sampled = 1

        if not graded_bytes and cover_bytes is not None:
            graded_bytes = [cover_bytes]

        # ── Defect map(s): render per-angle, drawing each image's OWN defects ─────
        # (Previously every aggregated defect was drawn on the cover image, which put
        #  a sole-photo defect onto the front photo. Now each angle gets its own map.)
        if graded_bytes:
            try:
                from ml.heatmap import render_heatmap_b64
                all_defects = grade_result.get('defects', [])
                angle_heatmaps = []
                for i, img_b in enumerate(graded_bytes):
                    frame_defects = [d for d in all_defects if d.get('image_index', 0) == i]
                    label = (slot_labels[i] if i < len(slot_labels)
                             else (slots[i] if i < len(slots) else (f'Angle {i+1}')))
                    b64 = render_heatmap_b64(img_b, {**grade_result, 'defects': frame_defects})
                    entry = {'angle': slots[i] if i < len(slots) else '', 'angle_label': label,
                             'b64': b64, 'n_defects': len(frame_defects)}
                    angle_heatmaps.append(entry)
                grade_result['angle_heatmaps'] = angle_heatmaps
                # Backward-compat cover map: prefer the angle with the most defects.
                cover = max(angle_heatmaps, key=lambda e: e['n_defects']) if angle_heatmaps else None
                grade_result['heatmap_b64'] = (cover or angle_heatmaps[0])['b64'] if angle_heatmaps else None
            except Exception as e:
                logger.warning(f"Heatmap generation failed: {e}")

        # ── Route ──────────────────────────────────────────────────────────────
        # Translate the multi-angle grading signals into the Disposition Gate's flags
        # so they actually DRIVE the disposition (sealed→Restock-New, not-functional
        # electronics→Renewed), not just the price. Previously these were left at the
        # gate's conservative defaults, so a sealed return could never restock as New.
        _sealed = grade_result.get('seal_intact') is True
        _completeness = grade_result.get('completeness')
        _complete = (_completeness is None) or (float(_completeness) >= 0.8) \
            or (grade_result.get('accessories_present') is True)
        try:
            from ml.route import route_item
            route_result = route_item(
                listing_id=str(product_id),
                grade=grade_result.get('grade', 'C'),
                category=category,
                defects=grade_result.get('defects', []),
                geohash5=geohash5,
                mrp=mrp,
                product_id=str(product_id),
                title=expected_title,
                condition_signals={
                    'box_present': grade_result.get('box_present'),
                    'accessories_present': grade_result.get('accessories_present'),
                    'functional': grade_result.get('functional'),
                    'tags_present': grade_result.get('tags_present'),
                    'completeness': grade_result.get('completeness'),
                },
                sealed=_sealed,
                opened=not _sealed,
                verified_match=True,
                complete=bool(_complete),
                functional_pass=grade_result.get('functional'),
            )
        except Exception as e:
            logger.warning(f"route_item() failed in inspect: {e}")
            route_result = {
                'chosen_path': 'resell_p2p', 'route_label': 'Resell Nearby',
                'customer_message': 'Your item will be resold to someone nearby',
                'tier': 1, 'price': mrp * 0.6, 'fallback': True,
            }

        grade_result['match'] = True
        grade_result['frames_sampled'] = frames_sampled
        grade_result['route'] = route_result
        grade_result['category'] = category
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
