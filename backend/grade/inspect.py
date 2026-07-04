"""
grade/inspect.py
----------------
Reusable item inspection: (optional fraud gates) → multi-angle / video grade →
per-angle defect heatmaps → disposition/route.

Two public entry points, sharing one grade+route core so the sync view, the
async seller task, and the async return task can never drift:

  * run_seller_grade(...)   — seller's OWN item: no fraud gates (skip_match path).
  * run_return_inspect(...) — a RETURN: keeps the fraud/instance/duplicate gates
                              (a customer must not return a shoe photographed as
                              headphones). Supports an optional video.
"""
from __future__ import annotations

import logging
import os
import tempfile

logger = logging.getLogger(__name__)

_FALLBACK_GRADE = {
    "grade": "B",
    "confidence": 0.75,
    "defects": [],
    "completeness": 0.9,
    "condition_summary": "Item appears to be in good condition. Manual review recommended.",
    "functional": True,
    "model_version": "fallback-v0",
    "from_cache": False,
}


def _slot_labels(slots: list[str], category: str) -> list[str]:
    """Map raw slot keys (front/sole/screen_on…) to human labels for the defect maps."""
    try:
        from ml.category_profiles import capture_prompts
        label_of = {p['key']: p['label'] for p in capture_prompts(category)}
        return [label_of.get(s, s) for s in slots]
    except Exception:
        return list(slots)


_REF_CACHE: dict = {}


def _image_url_to_bytes(url: str) -> bytes | None:
    """Resolve a product image URL to bytes: an http(s) URL, a local media/ file, or
    a frontend public/ asset (e.g. /nike_downshifter_13.jpg served by Vite)."""
    if not url:
        return None
    try:
        if url.startswith('http'):
            import requests
            r = requests.get(url, timeout=8)
            return r.content if (r.ok and len(r.content) > 2000) else None
        from django.conf import settings
        name = url.lstrip('/')
        candidates = [
            os.path.join(str(settings.BASE_DIR.parent), 'apps', 'consumer', 'public', os.path.basename(name)),
            os.path.join(str(settings.MEDIA_ROOT), name.split('media/')[-1].lstrip('/')),
        ]
        for fp in candidates:
            if os.path.exists(fp):
                with open(fp, 'rb') as f:
                    return f.read()
    except Exception as e:
        logger.warning("image fetch failed for %s: %s", url, e)
    return None


def _reference_bytes_for(product_id: str, category: str, expected_title: str = "") -> bytes | None:
    """Image of the SPECIFIC product being returned — what the instance-match gate
    compares the uploaded photo against. Resolves the product by listing/product id
    first, then by its title (the frontend always sends expected_title, but may send
    product_id='return'); only falls back to a generic category reference when the
    product image genuinely can't be found."""
    key = f"{product_id}|{expected_title}"
    if key in _REF_CACHE:
        return _REF_CACHE[key]
    data = None
    try:
        from core.models import Listing, Product
        prod = None
        pid = str(product_id)
        if pid.isdigit():
            lst = Listing.objects.select_related('product').filter(pk=int(pid)).first()
            prod = lst.product if lst else Product.objects.filter(pk=int(pid)).first()
        # Fallback: identify the product by the title the customer is returning.
        if prod is None and expected_title.strip():
            prod = (Product.objects.filter(title__iexact=expected_title.strip()).first()
                    or Product.objects.filter(title__icontains=expected_title.strip()[:40]).first())
        if prod:
            data = _image_url_to_bytes(prod.reference_image_url or '')
    except Exception as e:
        logger.warning("reference product lookup failed for %s: %s", product_id, e)
    if not data:
        try:
            from ml.catalog import get_reference_bytes
            data = get_reference_bytes(category)
        except Exception:
            data = None
    _REF_CACHE[key] = data
    return data


def _fraud_gates(images: list[bytes], category: str, expected_title: str,
                 ref_bytes: bytes | None = None) -> dict | None:
    """
    Run the RETURN fraud gates on the cover image (+ set). Returns a gate-failure
    response dict (to hand straight back to the client) if any gate trips, else
    None. Every gate fails OPEN — an ML error never blocks a legitimate return.
    """
    if not images:
        return None
    cover_bytes = images[0]

    # 1) Category gate — is this even the right kind of thing?
    try:
        from ml.verify import verify_match
        match = verify_match(cover_bytes, expected_category=category, expected_title=expected_title)
    except Exception as e:
        logger.warning("verify_match failed, failing open: %s", e)
        match = {'match': True, 'checked': False, 'detected_object': '',
                 'detected_category': category, 'confidence': 0.0}

    if match.get('checked') and not match.get('match'):
        return {
            'match': False,
            'detected_object': match.get('detected_object', ''),
            'detected_category': match.get('detected_category', ''),
            'confidence': match.get('confidence', 0.0),
            'message': (
                f"This looks like {match.get('detected_object') or 'a different item'}, "
                f"not the {expected_title or category} you're returning. "
                "Please scan the correct item."
            ),
        }

    # 2) Instance gate — same model/variant, not just same category?
    #    Match against the SPECIFIC product being returned (ref_bytes), not a generic
    #    category image — otherwise a genuine return of e.g. a formal shoe fails
    #    against a generic "footwear" reference.
    try:
        from ml.instance_match import instance_match
        if ref_bytes is None:
            from ml.catalog import get_reference_bytes
            ref_bytes = get_reference_bytes(category)
        inst = instance_match(cover_bytes, ref_bytes)
        if inst.get('checked') and not inst.get('match'):
            return {
                'match': False,
                'instance_match': inst,
                'message': (
                    f"This doesn't look like the same {expected_title or category} "
                    "in our catalogue (different model/variant). Please scan the correct item."
                ),
            }
    except Exception as e:
        logger.warning("instance_match failed, failing open: %s", e)

    # 3) Duplicate-photo gate — reject the same shot pasted into many slots.
    if len(images) > 1:
        try:
            from ml.image_dedup import find_duplicates
            dups = find_duplicates(images)
            if dups:
                return {
                    'match': True,
                    'duplicate_photos': True,
                    'duplicate_pairs': dups,
                    'message': (
                        "Some photos look identical. Please capture each angle "
                        "separately (e.g. front, back, soles) so we can verify the item."
                    ),
                }
        except Exception as e:
            logger.warning("duplicate check failed, skipping: %s", e)

    return None


def _grade_heatmap_route(*, images: list[bytes], slots: list[str], category: str,
                         expected_title: str, product_id: str, operator: str,
                         geohash5: str, mrp: float,
                         video_bytes: bytes | None = None,
                         video_suffix: str = '.mp4') -> dict:
    """Shared core: grade (video → multi → single) → per-angle heatmaps → route."""
    slot_labels = _slot_labels(slots, category)
    grade_result = None
    frames_sampled = len(images)

    # ── Grade: video takes priority, else multi-image, else single ───────────
    try:
        if video_bytes:
            from ml.grade import grade_video
            with tempfile.NamedTemporaryFile(suffix=video_suffix, delete=False) as tmp:
                tmp.write(video_bytes)
                tmp_path = tmp.name
            try:
                grade_result = grade_video(tmp_path, product_id=product_id,
                                           operator=operator, category=category)
                frames_sampled = grade_result.get('frames_sampled', frames_sampled)
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        elif len(images) > 1:
            from ml.grade import grade_multi_image
            grade_result = grade_multi_image(
                images, product_id=product_id, operator=operator,
                category=category, slots=slots, slot_labels=slot_labels)
            frames_sampled = grade_result.get('frames_sampled', len(images))
    except Exception as e:
        logger.warning("multi/video grade failed, falling back to single image: %s", e)
        grade_result = None

    if grade_result is None:
        if images:
            try:
                from ml.grade import grade_image
                grade_result = grade_image(image_bytes=images[0], product_id=product_id,
                                           operator=operator, category=category, use_cache=True)
            except Exception as e:
                logger.warning("single grade failed, using fallback: %s", e)
                grade_result = {**_FALLBACK_GRADE}
        else:
            grade_result = {**_FALLBACK_GRADE}
        frames_sampled = frames_sampled if video_bytes else 1

    # ── Per-angle defect heatmaps (each photo draws its OWN defects) ──────────
    if images:
        try:
            from ml.heatmap import render_heatmap_b64
            all_defects = grade_result.get('defects', [])
            angle_heatmaps = []
            for i, img_bytes in enumerate(images):
                frame_defects = [d for d in all_defects if d.get('image_index', 0) == i]
                label = (slot_labels[i] if i < len(slot_labels)
                         else (slots[i] if i < len(slots) else f'Angle {i + 1}'))
                b64 = render_heatmap_b64(img_bytes, {**grade_result, 'defects': frame_defects})
                angle_heatmaps.append({
                    'angle': slots[i] if i < len(slots) else '',
                    'angle_label': label, 'b64': b64, 'n_defects': len(frame_defects),
                })
            grade_result['angle_heatmaps'] = angle_heatmaps
            # Cover image = the first ITEM angle (front/top), NOT the most-damaged one —
            # otherwise an old box (most defects) becomes the headline photo and it
            # looks like only the box was inspected.
            def _is_pkg(e):
                a = (e.get('angle', '') + ' ' + e.get('angle_label', '')).lower()
                return any(w in a for w in ('box', 'tag', 'packaging', 'label'))
            item_maps = [e for e in angle_heatmaps if not _is_pkg(e)]
            cover = (item_maps or angle_heatmaps)[0] if angle_heatmaps else None
            grade_result['heatmap_b64'] = cover['b64'] if cover else None
        except Exception as e:
            logger.warning("heatmap generation failed: %s", e)

    # ── Route (disposition + resale price) ───────────────────────────────────
    sealed = grade_result.get('seal_intact') is True
    completeness = grade_result.get('completeness')
    complete = (completeness is None) or (float(completeness) >= 0.8) \
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
            sealed=sealed,
            opened=not sealed,
            verified_match=True,
            complete=bool(complete),
            functional_pass=grade_result.get('functional'),
        )
    except Exception as e:
        logger.warning("route_item() failed in inspect: %s", e)
        route_result = {
            'chosen_path': 'resell_p2p', 'route_label': 'Resell Nearby',
            'customer_message': 'Your item will be resold to someone nearby',
            'tier': 1, 'price': mrp * 0.6, 'fallback': True,
        }

    grade_result['match'] = True
    grade_result['frames_sampled'] = frames_sampled
    grade_result['route'] = route_result
    grade_result['category'] = category
    return grade_result


def run_seller_grade(*, images: list[bytes], slots: list[str], category: str,
                     expected_title: str = "", product_id: str = "P2P-TEMP",
                     operator: str = "seller", geohash5: str = "tbxx1",
                     mrp: float = 1000.0) -> dict:
    """Grade a seller's OWN photo set (no fraud gates) + route. match is always True."""
    if not images:
        raise ValueError("run_seller_grade requires at least one image")
    return _grade_heatmap_route(
        images=images, slots=slots, category=category, expected_title=expected_title,
        product_id=product_id, operator=operator, geohash5=geohash5, mrp=mrp,
    )


def run_return_inspect(*, images: list[bytes], slots: list[str], category: str,
                       expected_title: str = "", product_id: str = "return",
                       operator: str = "agent", geohash5: str = "tbxx1",
                       mrp: float = 1000.0, skip_match: bool = False,
                       video_bytes: bytes | None = None,
                       video_suffix: str = '.mp4') -> dict:
    """
    Inspect a RETURN. Runs the fraud/instance/duplicate gates first (unless
    skip_match); if a gate trips, returns that gate response (no grade). Otherwise
    grades (image set or video) + routes. Same output shape as InspectAndRouteView.
    """
    if not images and not video_bytes:
        raise ValueError("run_return_inspect requires at least one image or a video")

    if not skip_match:
        ref_bytes = _reference_bytes_for(product_id, category, expected_title)
        gate = _fraud_gates(images, category, expected_title, ref_bytes=ref_bytes)
        if gate is not None:
            return gate

    return _grade_heatmap_route(
        images=images, slots=slots, category=category, expected_title=expected_title,
        product_id=product_id, operator=operator, geohash5=geohash5, mrp=mrp,
        video_bytes=video_bytes, video_suffix=video_suffix,
    )
