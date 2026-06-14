"""Green Credits app — Pillar 5 wallet (final_idea §5)."""
from django.db.models import Sum, Q
from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from .models import CreditTransaction

CREDIT_VALUE_RUPEES = 0.10      # 1 credit = ₹0.10
REDEEM_CAP_FRACTION = 0.20      # max 20% of an item's price per transaction
DONATE_MINIMUM      = 50

# Category multipliers (mirror frontend utils/tier.js + final_idea §5)
CATEGORY_MULTIPLIER = {
    'footwear': 2.0, 'clothing': 2.0, 'fashion': 2.0,
    'electronics': 0.8, 'beauty': 0.8, 'jewelry': 0.8,
    'books': 0.5, 'toys': 0.5, 'stationery': 0.5,
    'home & kitchen': 1.0, 'sports': 1.0, 'other': 1.0,
}


def _wallet(user) -> dict:
    txns = CreditTransaction.objects.filter(user=user)
    earned = txns.filter(kind='earn', status='vested').aggregate(s=Sum('amount'))['s'] or 0
    spent  = txns.filter(kind__in=['spend', 'donate'], status='vested').aggregate(s=Sum('amount'))['s'] or 0
    pending = txns.filter(kind='earn', status='pending').aggregate(s=Sum('amount'))['s'] or 0
    balance = max(0, earned - spent)

    history = [{
        'id': t.id,
        'kind': t.kind,
        'status': t.status,
        'amount': t.amount,
        'reason': t.reason,
        'category': t.category,
        'created_at': t.created_at.isoformat() if t.created_at else None,
        'vests_at': t.vests_at.isoformat() if t.vests_at else None,
    } for t in txns[:40]]

    return {
        'balance': balance,
        'pending': pending,
        'lifetime_earned': earned,
        'value_rupees': round(balance * CREDIT_VALUE_RUPEES, 2),
        'redeem_cap_fraction': REDEEM_CAP_FRACTION,
        'credit_value_rupees': CREDIT_VALUE_RUPEES,
        'history': history,
        'multipliers': CATEGORY_MULTIPLIER,
    }


class CreditsMeView(APIView):
    """GET /api/credits/me/ — the logged-in buyer's wallet."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_wallet(request.user))


class CreditsView(APIView):
    """GET /api/credits/<user_id>/ — legacy compatibility (computed from ledger)."""
    permission_classes = [AllowAny]

    def get(self, request, user_id):
        from core.models import User
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'user_id': user_id, 'balance': 0, 'pending': 0, 'history': []})
        w = _wallet(user)
        w['user_id'] = user_id
        return Response(w)


class CreditsVestView(APIView):
    """POST /api/credits/vest/ — vest pending credits whose window has closed."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        due = CreditTransaction.objects.filter(
            user=request.user, kind='earn', status='pending'
        ).filter(Q(vests_at__isnull=True) | Q(vests_at__lte=now))
        vested = due.count()
        due.update(status='vested')
        return Response({'vested': vested, **_wallet(request.user)})


class CreditsRedeemView(APIView):
    """
    POST /api/credits/redeem/  { listing_price }
    Returns the max credits/₹ applicable to this REVIVE item (20% cap).
    Records the spend if `commit` is true.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            price = float(request.data.get('listing_price', 0))
        except (TypeError, ValueError):
            price = 0.0
        commit = bool(request.data.get('commit', False))

        w = _wallet(request.user)
        balance = w['balance']
        max_discount = price * REDEEM_CAP_FRACTION
        max_credits_by_cap = int(max_discount / CREDIT_VALUE_RUPEES)
        credits_applied = max(0, min(balance, max_credits_by_cap))
        discount = round(credits_applied * CREDIT_VALUE_RUPEES, 2)

        if commit and credits_applied > 0:
            CreditTransaction.objects.create(
                user=request.user, kind='spend', status='vested',
                amount=credits_applied, reason='Redeemed on a REVIVE second-life item',
            )

        return Response({
            'credits_applied': credits_applied,
            'discount_rupees': discount,
            'cap_fraction': REDEEM_CAP_FRACTION,
            'balance_after': balance - credits_applied if commit else balance,
        })


class CreditsDonateView(APIView):
    """POST /api/credits/donate/ { amount } — donate credits to an NGO partner (min 50)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            amount = 0
        if amount < DONATE_MINIMUM:
            return Response({'error': f'Minimum {DONATE_MINIMUM} credits to donate.'},
                            status=status.HTTP_400_BAD_REQUEST)
        w = _wallet(request.user)
        if amount > w['balance']:
            return Response({'error': 'Not enough credits.'}, status=status.HTTP_400_BAD_REQUEST)
        CreditTransaction.objects.create(
            user=request.user, kind='donate', status='vested',
            amount=amount, reason='Donated to NGO partner (e-waste recycling / tree planting)',
        )
        return Response(_wallet(request.user))
