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


# ─── Auth views ──────────────────────────────────────────────────────────────

class RegisterView(APIView):
    """POST /api/auth/register/"""
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
    """POST /api/auth/login/"""
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
    """POST /api/auth/logout/"""
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
    """GET /api/auth/me/"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


# ─── Listing views ────────────────────────────────────────────────────────────

class ListingListView(APIView):
    """GET /api/listings/ — public list. POST /api/listings/ — create P2P listing (auth required)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request):
        qs = Listing.objects.filter(status='listed').select_related('product', 'seller')

        category = request.query_params.get('category')
        source = request.query_params.get('source')
        grade = request.query_params.get('grade')
        search = request.query_params.get('q')

        if category:
            qs = qs.filter(product__category__icontains=category)
        if source:
            qs = qs.filter(source=source)
        if grade:
            qs = qs.filter(grade=grade)
        if search:
            qs = qs.filter(product__title__icontains=search)

        qs = qs.order_by('-created_at')
        return Response({'results': ListingSerializer(qs[:40], many=True).data, 'count': qs.count()})

    def post(self, request):
        serializer = CreateListingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Read bytes first so grade_image() can run before/after storage save
        image_bytes = None
        image_url = ''
        image_file = request.FILES.get('image')
        if image_file:
            image_bytes = image_file.read()
            image_file.seek(0)  # reset so default_storage can read it again
            filename = f"listings/{uuid.uuid4().hex}_{image_file.name}"
            path = default_storage.save(filename, image_file)
            image_url = request.build_absolute_uri(settings.MEDIA_URL + path)

        # AI grading — runs synchronously, falls back gracefully
        grade_result = {
            'grade': 'B',
            'condition_summary': data.get('condition_summary', ''),
            'completeness': 1.0,
            'confidence': 0.0,
            'defects': [],
            'from_cache': False,
        }
        if image_bytes:
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

        # If user wrote their own condition notes, prefer them; else use AI summary
        condition_summary = (
            data.get('condition_summary') or
            grade_result.get('condition_summary', '')
        )

        product = Product.objects.create(
            asin=f'P2P-{uuid.uuid4().hex[:8].upper()}',
            title=data['title'],
            category=data['category'],
            mrp=data['price'] * Decimal('2'),
            reference_image_url=image_url,
            description=data.get('description', ''),
        )

        listing = Listing.objects.create(
            product=product,
            source=Listing.Source.P2P,
            grade=grade_result.get('grade', 'B'),
            condition_summary=condition_summary,
            completeness=grade_result.get('completeness', 1.0),
            price=data['price'],
            status=Listing.Status.LISTED,
            seller=request.user,
            image_url=image_url,
        )

        response_data = ListingSerializer(listing).data
        response_data['grade_result'] = {
            'grade': grade_result.get('grade'),
            'confidence': grade_result.get('confidence'),
            'condition_summary': grade_result.get('condition_summary'),
            'defects': grade_result.get('defects', []),
            'completeness': grade_result.get('completeness'),
            'from_cache': grade_result.get('from_cache', False),
        }
        return Response(response_data, status=status.HTTP_201_CREATED)


class ListingDetailView(APIView):
    """GET /api/listings/<pk>/"""
    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            listing = Listing.objects.select_related('product', 'seller').get(pk=pk)
        except Listing.DoesNotExist:
            return Response({'error': 'Listing not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ListingSerializer(listing).data)


class MyListingsView(APIView):
    """GET /api/listings/mine/ — all listings created by the logged-in seller."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Listing.objects
            .filter(seller=request.user)
            .select_related('product')
            .order_by('-created_at')
        )
        return Response({'results': ListingSerializer(qs, many=True).data, 'count': qs.count()})


# ─── Order views ──────────────────────────────────────────────────────────────

class OrderListCreateView(APIView):
    """GET /api/orders/ — user's orders. POST /api/orders/ — place an order."""
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

        order = Order.objects.create(
            user=request.user,
            listing=listing,
            status='confirmed',
            is_p2p=(listing.source == 'p2p'),
            return_window_closes=timezone.now() + timedelta(days=7),
        )
        listing.status = Listing.Status.SOLD
        listing.save()

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
