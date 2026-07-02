"""
Seller Central — Phase A backend.

Turns the AI Grading Assistant's one-click actions into REAL state the rest of
REVIVE already understands: a confirmed relist creates a live `Listing` that shows
up on the consumer storefront under "Shop Revive". Kept intentionally small and
severable — no new models, reuses the existing catalog + Listing pipeline.
"""
import base64
import logging
import os
from decimal import Decimal

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from .models import Product, Listing
from .serializers import ListingSerializer

logger = logging.getLogger(__name__)

# Cache of product reference-image bytes so the integrity gate + grader don't
# re-download the catalog photo on every request.
_REF_CACHE = {}


def _product_ref_bytes(product):
    """Bytes of the product's catalog reference image (what the AI matches the
    seller's uploaded photos against). Fetches the URL or reads local media, then
    falls back to a generic category reference if that fails."""
    if product.id in _REF_CACHE:
        return _REF_CACHE[product.id]
    data = None
    url = product.reference_image_url or ''
    try:
        if url.startswith('http'):
            import requests
            r = requests.get(url, timeout=8)
            if r.ok and len(r.content) > 2000:
                data = r.content
        elif url:
            fp = os.path.join(settings.MEDIA_ROOT, url.split('media/')[-1].lstrip('/'))
            if os.path.exists(fp):
                data = open(fp, 'rb').read()
    except Exception as e:
        logger.warning(f"[seller] product ref fetch failed: {e}")
    if not data:
        try:
            from ml.catalog import get_reference_bytes
            data = get_reference_bytes(product.category)
        except Exception:
            data = None
    _REF_CACHE[product.id] = data
    return data

# The six demo return cases mirrored from the frontend grade mock. `source` and
# `condition_label` decide how the relisted unit appears on the storefront; the
# non-resellable cases (warranty/dispose/safet) intentionally create NO listing.
# `category` targets a category that actually exists in the seeded catalog so the
# relisted card reuses a coherent real product (real image + reviews).
CASE_MAP = {
    'hp':      {'category': 'Phone', 'grade': 'B', 'price': 1299, 'condition_label': 'Used - Very Good', 'source': 'return',
                'summary': 'Fully functional with strong Bluetooth pairing. Minor cosmetic scuffs on the left ear cup and light headband wear. All accessories and original box included.'},
    'kurta':   {'category': 'Apparel', 'grade': 'A', 'price': 1199, 'condition_label': 'New', 'source': 'new',
                'summary': 'Returned sealed and unopened. Factory poly-bag intact, all tags attached. Eligible to relist as New.'},
    'watch':   {'category': 'Phone', 'grade': 'A', 'price': 1274, 'condition_label': 'Open Box', 'source': 'return',
                'summary': 'Opened but flawless. Screen, buttons and sensors all functional. Original box and charging cable present.'},
    # Non-resellable outcomes — recorded but never listed to consumers.
    'phone':   {'action': 'warranty'},
    'hygiene': {'action': 'dispose'},
    'wrong':   {'action': 'safet'},
}

_DEFAULT_GEOHASH = 'tdr1v'   # Bengaluru-ish cell so it appears in local demand


def _pick_product(category):
    """Reuse a real seeded catalog product (real image + reviews) for the relist,
    preferring the given category. Falls back to any product."""
    qs = Product.objects.exclude(reference_image_url='')
    prod = qs.filter(category__icontains=category).order_by('-rating_count').first()
    return prod or qs.order_by('-rating_count').first() or Product.objects.first()


class SellerRelistView(APIView):
    """
    POST /api/seller/relist/  — confirm a grading-assistant recovery action.

    Body: { case: <caseId> }  OR explicit { category, grade, price, condition_label, source, summary }
    Returns: { listed: bool, action, listing_id?, product_id?, storefront_url? }

    Fails soft: if anything goes wrong the frontend still shows its optimistic
    success state, so the demo never dead-ends.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        case = request.data.get('case')
        cfg = CASE_MAP.get(case, {}) if case else {}

        # Non-resellable outcomes: acknowledge without creating a listing.
        action = cfg.get('action')
        if action in ('warranty', 'dispose', 'safet'):
            return Response({'listed': False, 'action': action}, status=status.HTTP_200_OK)

        category        = request.data.get('category')        or cfg.get('category', 'Electronics')
        grade           = request.data.get('grade')           or cfg.get('grade', 'B')
        price           = request.data.get('price')           or cfg.get('price', 999)
        condition_label = request.data.get('condition_label') or cfg.get('condition_label', 'Used - Good')
        source          = request.data.get('source')          or cfg.get('source', 'return')
        summary         = request.data.get('summary')         or cfg.get('summary', '')

        # Prefer the exact product the seller graded (queue is real-product-backed);
        # fall back to a category-matched pick for the legacy case-only payload.
        product = None
        pid = request.data.get('product_id')
        if pid:
            product = Product.objects.filter(pk=pid).first()
        if product is None:
            product = _pick_product(category)
        if product is None:
            # No catalog seeded — acknowledge so the UI still advances.
            return Response({'listed': False, 'action': 'relist', 'warning': 'no catalog product available'},
                            status=status.HTTP_200_OK)

        listing = Listing.objects.create(
            product=product,
            source=source,
            grade='' if source == 'new' else grade,
            condition_summary=summary,
            completeness=1.0,
            price=Decimal(str(round(float(price), 2))),
            geohash5=_DEFAULT_GEOHASH,
            status=Listing.Status.LISTED,
            seller=None,
            image_url=product.reference_image_url,
            condition_label=condition_label,
            disposition='RESTOCK_NEW' if source == 'new' else 'USED_P2P',
            risk_tier='LOW',
            tier=1,
        )

        data = {
            'listed': True,
            'action': 'relist',
            'listing_id': listing.id,
            'product_id': product.id,
            'condition_label': condition_label,
            'storefront_url': '/?source=revive',
            'listing': ListingSerializer(listing).data,
        }
        return Response(data, status=status.HTTP_201_CREATED)


# Return-queue slots, each bound at request time to a REAL seeded catalog product
# (real image + reviews) of the given category so the seller sees the actual item.
_QUEUE_SLOTS = [
    {'caseId': 'c1', 'category': 'Phone',    'reason': 'No longer needed',      'note': 'Arrived · opened, used',        'expect': 'used'},
    {'caseId': 'c2', 'category': 'Footwear', 'reason': 'Too tight',             'note': 'Arrived · light sole wear',     'expect': 'used'},
    {'caseId': 'c3', 'category': 'Apparel',  'reason': 'Wrong size',            'note': 'Arrived · sealed, tags on',     'expect': 'sealed', 'sealed': True},
    {'caseId': 'c4', 'category': 'Footwear', 'reason': 'Item defective',        'note': 'Arrived · sole separation',     'expect': 'defect', 'defect': True},
    {'caseId': 'c5', 'category': 'Apparel',  'reason': 'Changed my mind',       'note': 'Arrived · worn, minor marks',   'expect': 'used'},
    {'caseId': 'c6', 'category': 'Apparel',  'reason': 'Found a better price',   'note': 'Arrived · tags attached',       'expect': 'sealed', 'sealed': True},
]


class SellerQueueView(APIView):
    """
    GET /api/seller/queue/  — the 'Returns received' grading queue, backed by real
    catalog products so every case shows the actual returned item's image.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        used, rows = set(), []
        for i, slot in enumerate(_QUEUE_SLOTS):
            p = (Product.objects.exclude(reference_image_url='')
                 .filter(category=slot['category']).exclude(id__in=used)
                 .order_by('-rating_count').first())
            if p is None:
                p = Product.objects.exclude(reference_image_url='').exclude(id__in=used).order_by('-rating_count').first()
            if p is None:
                continue
            used.add(p.id)
            oid = f"{402 + i}-{1000000 + p.id * 7}-{2200000 + p.id}"
            rows.append({
                'caseId': slot['caseId'], 'product_id': p.id, 'orderId': oid,
                'date': 'Received recently', 'product': p.title, 'sku': p.asin,
                'image': p.reference_image_url, 'category': p.category,
                'mlCategory': p.category, 'mrp': float(p.mrp), 'reason': slot['reason'],
                'note': slot['note'], 'expect': slot['expect'],
                'sealed': slot.get('sealed', False), 'defect': slot.get('defect', False),
            })
        return Response({'cases': rows}, status=status.HTTP_200_OK)


class SellerGradeView(APIView):
    """
    POST /api/seller/grade/  — grade a return against ITS real catalog product.

    Body (multipart): images[] (seller's photos), product_id
    Runs the integrity gate (DINOv2 instance match vs the product's catalog image),
    then the real grading pipeline. A wrong item returns match=False (no grade).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        images = request.FILES.getlist('images') or ([request.FILES['image']] if 'image' in request.FILES else [])
        if not images:
            return Response({'error': 'At least one photo is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            product = Product.objects.get(pk=request.data.get('product_id'))
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Unknown product.'}, status=status.HTTP_404_NOT_FOUND)

        ref = _product_ref_bytes(product)
        cover = images[0].read(); images[0].seek(0)

        # ── Integrity gate: is the uploaded item the same as the catalog product? ──
        try:
            from ml.instance_match import instance_match
            inst = instance_match(cover, ref) if ref else {'checked': False, 'match': True}
            if inst.get('checked') and not inst.get('match'):
                return Response({
                    'match': False, 'instance_match': inst,
                    'message': (f"This doesn't look like the {product.title[:48]} from the order "
                                f"(similarity {inst.get('similarity', 0):.0%}). Grading halted — "
                                "please scan the correct returned item."),
                }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.warning(f"[seller] instance gate failed open: {e}")

        # ── Grade against the product's reference (completeness/defects) ──────────
        try:
            from ml.grade import grade_image
            gr = grade_image(image_bytes=cover, product_id=product.asin, operator='seller',
                             reference_bytes=ref, category=product.category, use_cache=True)
        except Exception as e:
            logger.warning(f"[seller] grade failed, fallback B: {e}")
            gr = {'grade': 'B', 'confidence': 0.75, 'defects': [], 'completeness': 0.9,
                  'condition_summary': 'Item appears used but functional. Manual review recommended.',
                  'functional': True, 'model_version': 'fallback-v0'}

        try:
            from ml.heatmap import render_heatmap_b64
            hb = render_heatmap_b64(cover, gr)
            gr['heatmap_b64'] = hb
            gr['angle_heatmaps'] = [{'angle_label': 'front', 'b64': hb, 'n_defects': len(gr.get('defects', []))}]
        except Exception as e:
            logger.warning(f"[seller] heatmap failed: {e}")

        gr['match'] = True
        gr['product'] = {'id': product.id, 'title': product.title, 'category': product.category, 'mrp': float(product.mrp)}
        return Response(gr, status=status.HTTP_200_OK)


class SellerDashboardView(APIView):
    """
    GET /api/seller/dashboard/ — live counters for the Returns dashboard.

    Blends real relisted-this-run counts with the seeded demo baseline so the
    dashboard reflects actions taken during the demo without needing full history.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        relisted = Listing.objects.filter(
            disposition__in=['USED_P2P', 'RESTOCK_NEW'],
            source__in=['return', 'new'],
            condition_label__in=['Used - Very Good', 'Open Box', 'New'],
        ).count()
        return Response({
            'relisted_live': relisted,
            'processed': 26,
            'recovered': 34970,
            'hours_saved': 38,
            'avg_confidence': 94,
        }, status=status.HTTP_200_OK)
