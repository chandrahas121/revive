"""
Route app — wired to ml.route.route_item() and ml.route.demand_gate().

Endpoints:
  POST /api/route/          → Stage 2 EV routing (when a buyer exists / item listed)
  POST /api/route/gate/     → Stage 1 demand gate (runs every 6 hours while item waits)
  GET  /api/route/heatmap/  → Demand heatmap GeoJSON for S9 Ops Console (Leaflet)
"""
import json
import logging
from pathlib import Path

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

logger = logging.getLogger(__name__)

# ─── Fallback responses when ML is unavailable ───────────────────────────────

_ROUTE_FALLBACK = {
    "listing_id": "lst_unknown",
    "chosen_path": "resell_p2p",
    "route_label": "Resell Nearby",
    "customer_message": "Your item will be resold to someone nearby",
    "tier": 1,
    "ev_breakdown": {
        "resell_p2p": 200.0,
        "resell_warehouse": -40.0,
        "refurbish": 100.0,
        "donate": 60.0,
        "recycle": 15.0,
    },
    "price": 600.0,
    "price_post_refurb": 750.0,
    "refurb_cost": 0.0,
    "sell_probability": 0.65,
    "km_saved": 570.0,
    "co2_saved_kg": 119.7,
    "demand_score": 0.7,
    "local_buyers": 45,
    "demand_note": "45 buyers within 8 km searched for this category this month",
    "nearest_cluster": "Koramangala",
    "dist_to_cluster_km": 2.0,
    "green_credits_earned": 30,
    "mcda_note": "EV optimizer: resell_p2p wins (fallback)",
    "fallback": True,
}

_GATE_FALLBACK = {
    "item_id": "lst_unknown",
    "action": "SELL",
    "reason": "Fallback: assuming local demand is sufficient",
    "demand_score": 0.7,
    "sell_probability": 0.65,
    "expected_local_value": 250.0,
    "holding_cost_per_day": 2.5,
    "days_listed": 0,
    "local_buyers": 45,
    "demand_note": "",
    "fallback": True,
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _run_route(listing_id, grade, category, defects, geohash5, mrp, product_id):
    try:
        from ml.route import route_item
        return route_item(
            listing_id=listing_id,
            grade=grade,
            category=category,
            defects=defects,
            geohash5=geohash5,
            mrp=mrp,
            product_id=product_id,
        )
    except Exception as e:
        logger.warning(f"route_item() failed, returning fallback: {e}")
        result = dict(_ROUTE_FALLBACK)
        result["listing_id"] = listing_id
        result["price"] = mrp * 0.6
        return result


def _run_demand_gate(listing_id, location_geohash, category, grade, asking_price, days_listed):
    try:
        from ml.route import demand_gate
        return demand_gate(
            item_id=listing_id,
            location_geohash=location_geohash,
            category=category,
            grade=grade,
            asking_price=asking_price,
            days_listed=days_listed,
        )
    except Exception as e:
        logger.warning(f"demand_gate() failed, returning fallback: {e}")
        result = dict(_GATE_FALLBACK)
        result["item_id"] = listing_id
        return result


# ─── Views ───────────────────────────────────────────────────────────────────

class RouteView(APIView):
    """
    POST /api/route/
    Stage 2 EV routing — fires once when a buyer checks out or seller lists.

    Request body (JSON):
      listing_id  str       — item ID (or "lst_unknown")
      grade       str       — A | B | C | D  (from Pillar 1 grading)
      category    str       — e.g. "Footwear", "Electronics"
      defects     list      — [{type, severity}, ...] from grade result
      geohash5    str       — seller/return location geohash5 cell
      mrp         float     — original MRP in ₹ (determines Tier 1/2/3)
      product_id  str       — ASIN or internal ID (optional)

    Response includes:
      chosen_path, route_label, customer_message, tier, ev_breakdown,
      price, sell_probability, km_saved, co2_saved_kg, green_credits_earned,
      demand_score, local_buyers, nearest_cluster, mcda_note
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        listing_id  = data.get('listing_id', 'lst_unknown')
        grade       = data.get('grade', 'B')
        category    = data.get('category', 'Electronics')
        defects     = data.get('defects', [])
        geohash5    = data.get('geohash5', 'tbxx1')
        product_id  = data.get('product_id', 'unknown')

        try:
            mrp = float(data.get('mrp', 1000.0))
        except (TypeError, ValueError):
            return Response({'error': 'mrp must be a number'}, status=status.HTTP_400_BAD_REQUEST)

        if grade not in ('A', 'B', 'C', 'D', 'E', 'F'):   # v2: E (parts), F (recycle)
            return Response({'error': 'grade must be one of A, B, C, D, E, F'}, status=status.HTTP_400_BAD_REQUEST)

        result = _run_route(listing_id, grade, category, defects, geohash5, mrp, product_id)
        return Response(result)


class DemandGateView(APIView):
    """
    POST /api/route/gate/
    Stage 1 demand gate — called every 6 hours while an item waits for a buyer.

    Request body (JSON):
      listing_id        str    — item ID
      location_geohash  str    — item's geohash5 cell
      category          str    — product category
      grade             str    — A | B | C | D
      asking_price      float  — current listing price in ₹
      days_listed       int    — how many days the item has been waiting

    Response:
      action: SELL | HOLD | ESCALATE_CITY | ESCALATE_FC | LIQUIDATE
      reason, demand_score, sell_probability, expected_local_value
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        listing_id       = data.get('listing_id', 'lst_unknown')
        location_geohash = data.get('location_geohash', 'tbxx1')
        category         = data.get('category', 'Electronics')
        grade            = data.get('grade', 'B')

        try:
            asking_price = float(data.get('asking_price', 1000.0))
            days_listed  = int(data.get('days_listed', 0))
        except (TypeError, ValueError):
            return Response({'error': 'asking_price must be a number and days_listed an integer'},
                            status=status.HTTP_400_BAD_REQUEST)

        result = _run_demand_gate(listing_id, location_geohash, category, grade, asking_price, days_listed)
        return Response(result)


class ApplyRouteView(APIView):
    """
    POST /api/route/apply/<listing_id>/
    Persist a routing decision to the Listing model.
    Accepts the full route_result dict (e.g. from /api/route/) and saves
    chosen_path, tier, ev_data, and optionally price back to the listing.

    Body (JSON): the route_result dict (chosen_path, tier, ev_breakdown, price)
    """
    permission_classes = [AllowAny]

    def post(self, request, listing_id):
        from core.models import Listing
        from decimal import Decimal

        try:
            listing = Listing.objects.get(pk=listing_id)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        chosen_path = data.get('chosen_path', '')
        tier        = data.get('tier', 1)
        ev_data     = data.get('ev_breakdown') or {}
        price       = data.get('price')

        listing.chosen_path = chosen_path
        listing.tier        = int(tier)
        listing.ev_data     = ev_data
        if price:
            try:
                listing.price = Decimal(str(price))
            except Exception:
                pass
        listing.save()

        return Response({
            'listing_id':  listing.pk,
            'chosen_path': listing.chosen_path,
            'tier':        listing.tier,
            'price':       str(listing.price),
        })


class HeatmapDataView(APIView):
    """
    GET /api/route/heatmap/?category=Electronics
    Returns all Bengaluru demand cells as a GeoJSON FeatureCollection.
    Used by S9 Ops Console Leaflet heatmap.

    Each feature has:
      geometry.coordinates: [lng, lat]
      properties: { geohash, label, demand_score, local_buyers, category }
    """
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get('category', 'Electronics')

        # Load demand index from artifact
        idx_path = Path(__file__).resolve().parent.parent.parent / 'ml' / 'artifacts' / 'demand_index.json'
        try:
            with open(idx_path) as f:
                demand_index = json.load(f)
        except Exception:
            demand_index = {}

        # Synthetic cell coordinates (always available as fallback)
        try:
            from ml.route import SYNTHETIC_DEMAND_INDEX
        except Exception:
            SYNTHETIC_DEMAND_INDEX = {}

        features = []
        for geohash, cell_data in SYNTHETIC_DEMAND_INDEX.items():
            if geohash == "00000":
                continue
            cat_data = demand_index.get(geohash, {}).get(category, {})
            base_demand = cell_data.get('demand', 0.5)
            demand_score = cat_data.get('demand_score', base_demand)
            local_buyers = cat_data.get('local_buyers', int(demand_score * 80 + 5))
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [cell_data["lng"], cell_data["lat"]],
                },
                "properties": {
                    "geohash":      geohash,
                    "label":        cell_data.get("label", geohash),
                    "demand_score": round(demand_score, 3),
                    "local_buyers": local_buyers,
                    "category":     category,
                },
            })

        return Response({
            "type": "FeatureCollection",
            "category": category,
            "features": features,
        })


class LocalDemandView(APIView):
    """
    GET /api/route/local-demand/?lat=<>&lng=<>&category=<>   (or ?geohash5=<>)
    v2: converts the buyer's live location to a geohash cell and returns the
    local demand signal for the storefront "Near me" banner + Sell It demand hint.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get('category', 'Electronics')
        geohash5 = request.query_params.get('geohash5', '')
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')

        if not geohash5 and lat is not None and lng is not None:
            try:
                from ml.geohash import geohash_encode
                geohash5 = geohash_encode(float(lat), float(lng), 5)
            except (TypeError, ValueError):
                return Response({'error': 'lat/lng must be numbers'},
                                status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                logger.warning(f"geohash_encode failed: {e}")

        if not geohash5:
            geohash5 = (request.user.geohash5
                        if getattr(request, 'user', None) and request.user.is_authenticated else 'tdr1w')

        try:
            from ml.route import _demand_lookup
            info = _demand_lookup(geohash5, category)
        except Exception as e:
            logger.warning(f"_demand_lookup failed: {e}")
            info = {"demand_score": 0.6, "local_buyers": 30,
                    "note": "Demand estimate unavailable", "nearest_cluster_label": ""}

        score = info.get("demand_score", 0.5)
        level = "High" if score >= 0.66 else "Moderate" if score >= 0.33 else "Low"
        return Response({
            "geohash5": geohash5,
            "category": category,
            "demand_level": level,
            "demand_score": score,
            "local_buyers": info.get("local_buyers", 0),
            "note": info.get("note", ""),
            "nearest_cluster": info.get("nearest_cluster_label", ""),
        })
