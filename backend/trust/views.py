"""Trust app — Pillar 3: Product Health Card with append-only ledger."""
import base64
import hashlib
import json
import logging
from io import BytesIO

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Listing
from .models import HealthCard, LedgerEntry

logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _guarantee_terms(tier: int, inspected_by: str) -> tuple:
    """Return (guarantee_days, guarantee_holder) based on tier and inspection type."""
    if tier == 3 or inspected_by == 'ai_spn':
        return 90, 'Amazon SPN'
    if tier == 2:
        return 30, 'seller_escrow'
    return 7, 'seller_escrow'


def _generate_qr_b64(data: str):
    """Return base64-encoded PNG QR code, or None if qrcode is not installed."""
    try:
        import qrcode
        qr = qrcode.QRCode(version=1, box_size=6, border=2)
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = BytesIO()
        img.save(buf, format='PNG')
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def _verify_chain(entries) -> dict:
    """Walk the ledger and verify the hash chain. Returns verification result."""
    broken_at = None
    for i, entry in enumerate(entries):
        expected = hashlib.sha256(
            json.dumps({
                'pk':        entry.pk,
                'card_id':   str(entry.card.card_id),
                'event':     entry.event,
                'data':      entry.data,
                'prev_hash': entry.prev_hash,
            }, sort_keys=True, default=str).encode()
        ).hexdigest()
        if expected != entry.this_hash:
            broken_at = i
            break
    return {
        'valid':     broken_at is None,
        'entries':   len(entries),
        'broken_at': broken_at,
    }


def _serialize_card(card: HealthCard) -> dict:
    entries = list(card.ledger.all())
    return {
        'card_id':           str(card.card_id),
        'listing_id':        card.listing_id,
        'tier':              card.tier,
        'grade':             card.grade,
        'confidence':        card.confidence,
        'defects':           card.defects,
        'completeness':      card.completeness,
        'condition_summary': card.condition_summary,
        'functional':        card.functional,
        'box_present':       card.box_present,
        'inspected_by':      card.inspected_by,
        'inspected_by_label': card.get_inspected_by_display(),
        'model_version':     card.model_version,
        'battery_pct':       card.battery_pct,
        'imei':              card.imei or None,
        'previous_owners':   card.previous_owners,
        'guarantee_days':    card.guarantee_days,
        'guarantee_holder':  card.guarantee_holder,
        'card_hash':         card.card_hash,
        'qr_data':           card.qr_data,
        'ledger': [
            {
                'event':      e.event,
                'event_label': e.get_event_display(),
                'data':       e.data,
                'prev_hash':  e.prev_hash,
                'this_hash':  e.this_hash,
                'created_at': e.created_at.isoformat() if e.created_at else None,
            }
            for e in entries
        ],
        'ledger_entries':   len(entries),
        'chain_valid':      _verify_chain(entries)['valid'],
        'created_at':       card.created_at.isoformat(),
        'updated_at':       card.updated_at.isoformat(),
    }


# ── views ─────────────────────────────────────────────────────────────────────

class HealthCardGenerateView(APIView):
    """
    POST /api/card/generate/

    Generate (or regenerate) a Health Card for a listing.
    Creates the card + the first 'graded' ledger entry.

    Body (JSON or multipart):
      listing_id    int     required
      grade_result  dict    from ml.grade.grade_image()
      route_result  dict    from ml.route.route_item()
      inspected_by  str     ai_only | ai_agent | ai_spn   (default: ai_only)
      battery_pct   int     optional — Tier 2 phones/laptops
      imei          str     optional — Tier 2 phones
    """
    permission_classes = [AllowAny]

    def post(self, request):
        payload      = request.data
        listing_id   = payload.get('listing_id')
        grade_result = payload.get('grade_result') or {}
        route_result = payload.get('route_result') or {}
        inspected_by = payload.get('inspected_by', 'ai_only')
        battery_pct  = payload.get('battery_pct')
        imei         = payload.get('imei', '')

        if not listing_id:
            return Response({'error': 'listing_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            listing = Listing.objects.select_related('product').get(pk=listing_id)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found'}, status=status.HTTP_404_NOT_FOUND)

        tier = route_result.get('tier') or listing.tier or 1
        guarantee_days, guarantee_holder = _guarantee_terms(tier, inspected_by)

        card, created = HealthCard.objects.get_or_create(listing=listing)

        # Determine prev_hash for the new ledger entry
        last_entry = card.ledger.last() if not created else None
        prev_hash  = last_entry.this_hash if last_entry else ''

        # Update card fields
        card.tier             = tier
        card.grade            = grade_result.get('grade', 'B')
        card.confidence       = float(grade_result.get('confidence') or 0.5)
        card.defects          = grade_result.get('defects') or []
        card.completeness     = float(grade_result.get('completeness') or 0.8)
        card.condition_summary = grade_result.get('condition_summary', '')
        card.functional       = bool(grade_result.get('functional', True))
        card.box_present      = bool(grade_result.get('box_present', False))
        card.inspected_by     = inspected_by
        card.model_version    = grade_result.get('model_version', 'revive-grade-v1.0')
        card.battery_pct      = int(battery_pct) if battery_pct is not None else None
        card.imei             = imei or ''
        card.previous_owners  = card.previous_owners if not created else 0
        card.guarantee_days   = guarantee_days
        card.guarantee_holder = guarantee_holder
        card.qr_data          = ''  # reset so save() regenerates
        card.save()

        # Append 'graded' ledger entry
        LedgerEntry.objects.create(
            card=card,
            event=LedgerEntry.Event.GRADED,
            prev_hash=prev_hash,
            data={
                'grade':        card.grade,
                'confidence':   card.confidence,
                'defects':      card.defects,
                'tier':         tier,
                'inspected_by': inspected_by,
                'route':        route_result.get('chosen_path', ''),
                'routed_price': route_result.get('price', ''),
                'km_saved':     route_result.get('km_saved', 0),
                'co2_saved_kg': route_result.get('co2_saved_kg', 0),
            },
        )

        return Response(
            _serialize_card(card),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class HealthCardView(APIView):
    """GET /api/card/<listing_id>/ — fetch full Health Card."""
    permission_classes = [AllowAny]

    def get(self, request, listing_id):
        try:
            card = HealthCard.objects.prefetch_related('ledger').get(listing_id=listing_id)
        except HealthCard.DoesNotExist:
            return Response(
                {'error': 'No health card for this listing yet'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize_card(card))


class HealthCardVerifyView(APIView):
    """
    GET /api/card/<listing_id>/verify/
    Returns hash-chain verification: valid=true/false, broken_at index if broken.
    """
    permission_classes = [AllowAny]

    def get(self, request, listing_id):
        try:
            card = HealthCard.objects.prefetch_related('ledger').get(listing_id=listing_id)
        except HealthCard.DoesNotExist:
            return Response({'error': 'No health card for this listing'}, status=status.HTTP_404_NOT_FOUND)

        entries = list(card.ledger.all())
        result  = _verify_chain(entries)

        # Also verify the card's own hash
        expected_card_hash = card.compute_hash()
        card_hash_valid    = expected_card_hash == card.card_hash

        return Response({
            'card_id':         str(card.card_id),
            'listing_id':      card.listing_id,
            'card_hash_valid': card_hash_valid,
            'chain_valid':     result['valid'],
            'chain_entries':   result['entries'],
            'broken_at':       result['broken_at'],
            'card_hash':       card.card_hash,
            'verified_at':     None,  # filled in frontend with current time
        })


class HealthCardQRView(APIView):
    """GET /api/card/<listing_id>/qr/ — returns base64 PNG QR code."""
    permission_classes = [AllowAny]

    def get(self, request, listing_id):
        try:
            card = HealthCard.objects.get(listing_id=listing_id)
        except HealthCard.DoesNotExist:
            return Response({'error': 'No health card for this listing'}, status=status.HTTP_404_NOT_FOUND)

        qr_b64 = _generate_qr_b64(card.qr_data)
        if not qr_b64:
            return Response(
                {'error': "Install 'qrcode[pil]' to enable QR generation", 'qr_data': card.qr_data},
                status=status.HTTP_501_NOT_IMPLEMENTED,
            )

        return Response({
            'qr_b64':   qr_b64,
            'qr_data':  card.qr_data,
            'card_id':  str(card.card_id),
        })


class LedgerAppendView(APIView):
    """
    POST /api/card/<listing_id>/ledger/
    Append a state-change event to the Health Card ledger.
    Used by the order/delivery/refurb flows.

    Body (JSON):
      event   str   sold | delivered | transferred | refurb_in | refurb_out | donated | recycled
      data    dict  event-specific payload (buyer info, refurb shop, etc.)
    """
    permission_classes = [AllowAny]

    def post(self, request, listing_id):
        try:
            card = HealthCard.objects.get(listing_id=listing_id)
        except HealthCard.DoesNotExist:
            return Response({'error': 'No health card for this listing'}, status=status.HTTP_404_NOT_FOUND)

        event = request.data.get('event')
        if event not in LedgerEntry.Event.values:
            return Response(
                {'error': f'Invalid event. Choices: {LedgerEntry.Event.values}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_data = request.data.get('data') or {}
        last_entry = card.ledger.last()
        prev_hash  = last_entry.this_hash if last_entry else card.card_hash

        entry = LedgerEntry.objects.create(
            card=card,
            event=event,
            prev_hash=prev_hash,
            data=event_data,
        )

        # Ownership transfer → increment counter
        if event == LedgerEntry.Event.TRANSFERRED:
            HealthCard.objects.filter(pk=card.pk).update(
                previous_owners=card.previous_owners + 1
            )

        return Response({
            'event':          entry.event,
            'event_label':    entry.get_event_display(),
            'this_hash':      entry.this_hash,
            'prev_hash':      entry.prev_hash,
            'ledger_entries': card.ledger.count(),
        }, status=status.HTTP_201_CREATED)
