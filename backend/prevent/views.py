"""Prevent app — wired to real ml.prevent.score_risk()."""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response

logger = logging.getLogger(__name__)

_FALLBACK = {
    "risk": 0.2,
    "flagged_item_id": None,
    "nudge_text": "Low return risk detected. Your Green Credits will vest in 15 days.",
    "credit_promise": 45,
    "breakdown": [],
}


class RiskView(APIView):
    """POST /api/prevent/risk/"""

    def post(self, request):
        user_id = str(request.user.id) if request.user.is_authenticated else "anonymous"
        cart_items = request.data.get('cart', [])

        try:
            from ml.prevent import score_risk
            result = score_risk(user_id=user_id, cart_items=cart_items)
        except Exception as e:
            logger.warning(f"score_risk() failed, returning fallback: {e}")
            result = {**_FALLBACK}

        return Response(result)
