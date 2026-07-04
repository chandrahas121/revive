from django.urls import path
from core.seller_views import (
    SellerRelistView, SellerDashboardView, SellerQueueView, SellerGradeView,
)
from core.views import (
    SellerRegisterView, SellerLoginView, SellerMeView, LogoutView,
)

urlpatterns = [
    # Seller Central auth (separate from consumer /api/auth/)
    path('seller/auth/register/', SellerRegisterView.as_view(), name='seller-register'),
    path('seller/auth/login/', SellerLoginView.as_view(), name='seller-login'),
    path('seller/auth/logout/', LogoutView.as_view(), name='seller-logout'),
    path('seller/auth/me/', SellerMeView.as_view(), name='seller-me'),

    path('seller/queue/', SellerQueueView.as_view(), name='seller-queue'),
    path('seller/grade/', SellerGradeView.as_view(), name='seller-grade'),
    path('seller/relist/', SellerRelistView.as_view(), name='seller-relist'),
    path('seller/dashboard/', SellerDashboardView.as_view(), name='seller-dashboard'),
]
