from decimal import Decimal
from datetime import timedelta
import logging
import uuid

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.files.storage import default_storage
from django.utils import timezone

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

logger = logging.getLogger(__name__)

from .models import Listing, Product, Order
from .serializers import (
    RegisterSerializer, UserSerializer, ListingSerializer,
    CreateListingSerializer, OrderSerializer,
)


def _set_auth_cookies(response, refresh_token_obj):
    jwt_settings = settings.SIMPLE_JWT
    response.set_cookie(
        jwt_settings['AUTH_COOKIE'],
        str(refresh_token_obj.access_token),
        max_age=int(jwt_settings['ACCESS_TOKEN_LIFETIME'].total_seconds()),
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
    )
    response.set_cookie(
        jwt_settings['AUTH_COOKIE_REFRESH'],
        str(refresh_token_obj),
        max_age=int(jwt_settings['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=jwt_settings['AUTH_COOKIE_HTTP_ONLY'],
        secure=jwt_settings['AUTH_COOKIE_SECURE'],
        samesite=jwt_settings['AUTH_COOKIE_SAMESITE'],
    )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        response = Response(
            {'user': UserSerializer(user).data, 'message': 'Account created successfully.'},
            status=status.HTTP_201_CREATED,
        )
        _set_auth_cookies(response, refresh)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({'error': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        refresh = RefreshToken.for_user(user)
        response = Response({'user': UserSerializer(user).data})
        _set_auth_cookies(response, refresh)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_cookie = settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']
        refresh_token = request.COOKIES.get(refresh_cookie)
        response = Response({'message': 'Logged out.'})
        if refresh_token:
            try:
                RefreshToken(refresh_token).blacklist()
            except TokenError:
                pass
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'])
        response.delete_cookie(refresh_cookie)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ListingListView(APIView):
    """GET /api/listings/ — public list. POST /api/listings/ — create P2P listing (auth required)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        qs = (Listing.objects.filter(status='listed')
              .select_related('product', 'seller')
              .prefetch_related('product__listings'))

        category = request.query_params.get('category')
        source = request.query_params.get('source')
        grade = request.query_params.get('grade')
        search = request.query_params.get('q')
        condition = request.query_params.get('condition')

        if category:
            qs = qs.filter(product__category__icontains=category)
        if not source:
            qs = qs.filter(source='new')
        elif source == 'revive':
            qs = qs.filter(source__in=['p2p', 'return', 'warehouse'])
        elif source == 'all':
            pass
        else:
            qs = qs.filter(source=source)
        if grade:
            qs = qs.filter(grade=grade)
        if condition:
            qs = qs.filter(condition_label__icontains=condition)
        if search:
            qs = qs.filter(product__title__icontains=search)

        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        near_geohash = request.query_params.get('near') or ''
        if (lat and lng) or near_geohash:
            try:
                from ml.geohash import geohash_encode, geohash_decode
                from ml.route import _haversine_km
                if lat and lng:
                    blat, blng = float(lat), float(lng)
                else:
                    blat, blng = geohash_decode(near_geohash)
                listings = list(qs[:200])

                def _dist(l):
                    if not l.geohash5:
                        return 9_999.0
                    slat, slng = geohash_decode(l.geohash5)
                    return _haversine_km(blat, blng, slat, slng)

                listings.sort(key=_dist)
                data = []
                for l in listings[:40]:
                    d = ListingSerializer(l).data
                    d['distance_km'] = round(_dist(l), 1)
                    data.append(d)
                return Response({'results': data, 'count': len(listings), 'near': True})
            except Exception as e:
                logger.warning(f"near-me sort failed, falling back to recency: {e}")

        if not source or source == 'new':
            qs = qs.order_by('-product__rating_count', '-product__rating')
            limit = 120
        else:
            qs = qs.order_by('-created_at')
            limit = 60
        return Response({'results': ListingSerializer(qs[:limit], many=True).data, 'count': qs.count()})

    def post(self, request):
        serializer = CreateListingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        image_bytes = None
        image_url = ''
        image_file = request.FILES.get('image')
        if image_file:
            image_bytes = image_file.read()
            image_file.seek(0)
            filename = f"listings/{uuid.uuid4().hex}_{image_file.name}"
            path = default_storage.save(filename, image_file)
            image_url = request.build_absolute_uri(settings.MEDIA_URL + path)

        grade_result = {
            'grade': 'B',
            'condition_summary': data.get('condition_summary', ''),
            'completeness': 1.0,
            'confidence': 0.0,
            'defects': [],
            'from_cache': False,
        }
        grade_override = request.data.get('grade_override')
        if grade_override in ('A', 'B', 'C', 'D', 'E', 'F'):
            grade_result['grade'] = grade_override
            try:
                grade_result['completeness'] = float(request.data.get('completeness_override', 1.0))
            except (TypeError, ValueError):
                pass
        elif image_bytes:
            try:
                from ml.grade import grade_image
                grade_result = grade_image(
                    image_bytes=image_bytes,
                    product_id='P2P-TEMP',
                    operator='seller',
                    category=data['category'],
                    use_cache=True,
                )
                logger.info(f"Graded listing: grade={grade_result.get('grade')} confidence={grade_result.get('confidence')}")
            except Exception as e:
                logger.warning(f"grade_image() failed, using defaults: {e}")

        condition_summary = (
            data.get('condition_summary') or
            grade_result.get('condition_summary', '')
        )

        mrp_val = data.get('mrp') or (data['price'] * Decimal('2'))
        geohash5 = data.get('geohash5', '') or (request.user.geohash5 if request.user else '')
        lat, lng = data.get('lat'), data.get('lng')
        if not geohash5 and lat is not None and lng is not None:
            try:
                from ml.geohash import geohash_encode
                geohash5 = geohash_encode(float(lat), float(lng), 5)
            except Exception as e:
                logger.warning(f"geohash_encode failed: {e}")
        if request.user and lat is not None and lng is not None:
            request.user.lat, request.user.lng = float(lat), float(lng)
            if geohash5:
                request.user.geohash5 = geohash5
            request.user.save(update_fields=['lat', 'lng', 'geohash5'])

        product = Product.objects.create(
            asin=f'P2P-{uuid.uuid4().hex[:8].upper()}',
            title=data['title'],
            category=data['category'],
            mrp=mrp_val,
            reference_image_url=image_url,
            description=data.get('description', ''),
        )

        # v2: persist the seller's uploaded angle shots on the listing for the Revive card
        listing_images = []
        if image_url:
            listing_images.append({'url': image_url, 'label': 'Main'})
        extra = request.data.getlist('photos') if hasattr(request.data, 'getlist') else []
        for u in extra:
            if u:
                listing_images.append({'url': u, 'label': 'Angle'})

        listing = Listing.objects.create(
            product=product,
            source=Listing.Source.P2P,
            grade=grade_result.get('grade', 'B'),
            condition_summary=condition_summary,
            completeness=grade_result.get('completeness', 1.0),
            price=data['price'],
            geohash5=geohash5,
            status=Listing.Status.LISTED,
            seller=request.user,
            image_url=image_url,
            images=listing_images,
        )

        route_result = {}
        try:
            from ml.route import route_item
            route_result = route_item(
                listing_id=str(listing.pk),
                grade=grade_result.get('grade', 'B'),
                category=data['category'],
                defects=grade_result.get('defects', []),
                geohash5=geohash5,
                mrp=float(mrp_val),
            )
            listing.chosen_path = route_result.get('chosen_path', '')
            listing.tier = route_result.get('tier', 1)
            listing.ev_data = route_result.get('ev_breakdown', {})
            listing.risk_tier = route_result.get('risk_tier') or ''
            listing.disposition = route_result.get('disposition') or ''
            listing.condition_label = route_result.get('condition_label') or ''
            routed_price = route_result.get('price')
            if routed_price and routed_price > 0:
                listing.price = Decimal(str(routed_price))
            listing.save()
            logger.info(f"Routed listing {listing.pk}: path={listing.chosen_path} tier={listing.tier}")
        except Exception as e:
            logger.warning(f"route_item() failed for listing {listing.pk}: {e}")

        response_data = ListingSerializer(listing).data
        response_data['grade_result'] = {
            'grade': grade_result.get('grade'),
            'confidence': grade_result.get('confidence'),
            'condition_summary': grade_result.get('condition_summary'),
            'defects': grade_result.get('defects', []),
            'completeness': grade_result.get('completeness'),
            'from_cache': grade_result.get('from_cache', False),
        }
        response_data['route_result'] = route_result
        return Response(response_data, status=status.HTTP_201_CREATED)


class ListingDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            listing = Listing.objects.select_related('product', 'seller').get(pk=pk)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
        data = ListingSerializer(listing).data
        siblings = (Listing.objects.filter(product_id=listing.product_id, status='listed')
                    .select_related('product', 'seller'))
        order = {'new': 0, 'renewed': 1}
        opts = sorted(siblings, key=lambda l: (order.get(l.source, 2), float(l.price)))
        data['buying_options'] = ListingSerializer(opts, many=True).data
        return Response(data)


class RecommendView(APIView):
    permission_classes = [AllowAny]

    _GRADE_BOOST = {'A': 1.0, 'B': 0.8, 'C': 0.4, 'D': 0.0}
    _SOURCE_BOOST = {'renewed': 0.30, 'p2p': 0.20, 'warehouse': 0.10, 'return': 0.10}

    def get(self, request):
        try:
            n = min(int(request.query_params.get('n', 8)), 20)
        except (TypeError, ValueError):
            n = 8

        user_geo = request.user.geohash5 if getattr(request, 'user', None) and request.user.is_authenticated else ''

        qs = (Listing.objects
              .filter(status='listed', grade__in=['A', 'B'])
              .select_related('product', 'seller'))

        scored = []
        for l in qs[:200]:
            grade_boost = self._GRADE_BOOST.get(l.grade, 0.4)
            source_boost = self._SOURCE_BOOST.get(l.source, 0.1)
            prox = 0.25 if (user_geo and l.geohash5 and user_geo[:4] == l.geohash5[:4]) else 0.0
            score = 0.55 * grade_boost + 0.30 * source_boost + 0.15 * prox

            reasons = []
            if prox > 0:        reasons.append('available near you')
            if l.source == 'renewed': reasons.append('Amazon Renewed')
            elif l.source == 'p2p':   reasons.append('Amazon-verified P2P')
            reasons.append(f'Grade {l.grade} certified')
            scored.append((score, l, ' · '.join(reasons[:2])))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:n]

        results = []
        for score, l, reason in top:
            data = ListingSerializer(l).data
            data['rec_score'] = round(score, 4)
            data['rec_reason'] = reason
            results.append(data)
        return Response({'results': results, 'count': len(results)})


class MyListingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Listing.objects
            .filter(seller=request.user)
            .select_related('product')
            .order_by('-created_at')
        )
        return Response({'results': ListingSerializer(qs, many=True).data, 'count': qs.count()})


class CatalogSuggestView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        category = request.query_params.get('category') or ''
        grade = request.query_params.get('grade') or 'B'
        if len(q) < 3:
            return Response({'results': []})

        qs = Product.objects.all()
        if category:
            qs = qs.filter(category__icontains=category)
        qs = qs.filter(title__icontains=q)[:8]

        try:
            from ml.route import _predict_price
        except Exception:
            _predict_price = None

        results = []
        for p in qs:
            mrp = float(p.mrp)
            suggested = (_predict_price(grade, p.category, mrp) if _predict_price
                         else round(mrp * 0.5, 2))
            results.append({
                'asin': p.asin, 'title': p.title, 'brand': p.brand,
                'category': p.category, 'mrp': mrp,
                'image': p.reference_image_url,
                'rating': p.rating, 'rating_count': p.rating_count,
                'suggested_price': round(float(suggested), 2),
                'price_band': [round(float(suggested) * 0.85, 2), round(float(suggested) * 1.15, 2)],
            })
        return Response({'results': results})


class ManageListingView(APIView):
    permission_classes = [IsAuthenticated]

    _ALLOWED = {
        'delist': Listing.Status.DELISTED,
        'pause':  Listing.Status.PAUSED,
        'relist': Listing.Status.LISTED,
    }

    def post(self, request, pk):
        action = (request.data.get('action') or '').lower()
        if action not in self._ALLOWED:
            return Response({'error': "action must be one of: delist, pause, relist"},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            listing = Listing.objects.get(pk=pk, seller=request.user)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found or not yours.'},
                            status=status.HTTP_404_NOT_FOUND)
        if listing.status == Listing.Status.SOLD:
            return Response({'error': 'Sold items cannot be changed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        listing.status = self._ALLOWED[action]
        listing.save(update_fields=['status', 'updated_at'])
        return Response({'id': listing.pk, 'status': listing.status,
                         'message': f'Listing {action}ed.'})


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = (
            Order.objects
            .filter(user=request.user)
            .select_related('listing__product')
            .order_by('-created_at')
        )
        return Response({'results': OrderSerializer(orders, many=True).data, 'count': orders.count()})

    def post(self, request):
        listing_id = request.data.get('listing_id')
        if not listing_id:
            return Response({'error': 'listing_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            listing = Listing.objects.get(pk=listing_id, status='listed')
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not available.'}, status=status.HTTP_400_BAD_REQUEST)

        size = request.data.get('size')
        try:
            size = float(size) if size is not None else None
        except (TypeError, ValueError):
            size = None

        order = Order.objects.create(
            user=request.user,
            listing=listing,
            size=size,
            status='confirmed',
            is_p2p=(listing.source == 'p2p'),
            return_window_closes=timezone.now() + timedelta(days=7),
        )
        if listing.source != 'new':
            listing.status = Listing.Status.SOLD
            listing.save()

        try:
            from prevent.fit_profile import update_fit_size_profile
            update_fit_size_profile(request.user)
        except Exception:
            pass

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
