"""
Prevent app — Pillar 4 (Return Prevention).

Endpoints (all read-only):
    POST /api/prevent/risk/       legacy cart risk score (kept for compatibility)
    POST /api/prevent/fit-twin/   Fit-Twin: how this item really fit shoppers who
                                   wear your size  (no body measurements required)
"""
import logging
import sys
from pathlib import Path

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from .fit_profile import resolve_category, update_fit_size_profile

logger = logging.getLogger(__name__)

# Make the repo-root importable so `ml.fittwin` / `ml.prevent` resolve when the
# backend runs from backend/.
_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _user_size(request, fit_category, data):
    """The shopper's usual size in this category — NO body measurements asked.

    Priority:
      1. an explicit size in the request (e.g. the size they're choosing)
      2. the logged-in user's fit_size_profile[category] (from kept-order history);
         rebuilt on the fly from their orders if not present yet
      3. None -> the matcher returns the item's aggregate fit signal instead
    """
    explicit = data.get("size") if data.get("size") is not None else data.get("user_size")
    if explicit is not None:
        try:
            return float(explicit)
        except (TypeError, ValueError):
            pass

    u = request.user if request.user.is_authenticated else None
    if u is None or not fit_category:
        return None

    profile = getattr(u, "fit_size_profile", None)
    if not isinstance(profile, dict) or fit_category not in profile:
        # No cached size for this category — derive it from kept orders.
        try:
            profile = update_fit_size_profile(u)
        except Exception as e:
            logger.warning("fit_size_profile rebuild failed: %s", e)
            profile = profile if isinstance(profile, dict) else {}

    val = (profile or {}).get(fit_category)
    if val is not None:
        try:
            return float(val)
        except (TypeError, ValueError):
            pass
    return None


def _user_profile(request):
    """The shopper's full size profile across categories ({category: size}), used
    to find behavioral fit-twins. NO measurements — it's built from kept orders.
    Returns None for anonymous shoppers or those without purchase history yet."""
    u = request.user if request.user.is_authenticated else None
    if u is None:
        return None
    profile = getattr(u, "fit_size_profile", None)
    if not isinstance(profile, dict) or not profile:
        try:
            profile = update_fit_size_profile(u)
        except Exception as e:
            logger.warning("fit_size_profile rebuild failed: %s", e)
            profile = {}
    return profile or None


class RiskView(APIView):
    """POST /api/prevent/risk/ — legacy per-cart risk (kept so existing UI works)."""
    permission_classes = [AllowAny]

    def post(self, request):
        user_id = str(request.user.id) if request.user.is_authenticated else "anonymous"
        cart_items = request.data.get("cart", [])
        try:
            from ml.prevent import score_risk
            result = score_risk(user_id=user_id, cart_items=cart_items)
        except Exception as e:
            logger.warning("score_risk() failed: %s", e)
            result = {"risk": 0.0, "flagged_item_id": None, "nudge_text": "", "breakdown": []}
        return Response(result)


class FitTwinView(APIView):
    """
    POST /api/prevent/fit-twin/

    Body:
        {
          "category": "dress",     // mapped to a dataset category
          "item_id":  "2260466",   // optional — Product.fit_item_id -> item-level
          "size": 12               // optional — the size they're choosing; if absent
                                   //   we use the logged-in user's fit_size_profile
                                   //   (built from kept orders), else the item's
                                   //   aggregate fit signal
        }

    No height/weight/measurements are ever required.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data or {}
        fit_category = resolve_category(data.get("category"))
        item_id = data.get("item_id")
        user_size = _user_size(request, fit_category, data)
        user_profile = _user_profile(request)

        available_sizes = data.get("available_sizes") or None

        try:
            from ml.fittwin.match import find_fit_twins
            result = find_fit_twins(
                item_id=item_id, category=fit_category,
                user_size=user_size, user_profile=user_profile,
                available_sizes=available_sizes,
                k=int(data.get("k", 25)),
            )
        except Exception as e:
            logger.warning("find_fit_twins() failed: %s", e)
            result = {"available": False, "reason": "error", "nudge": "",
                      "twins_found": 0, "twins": []}
        return Response(result)
