from django.urls import path
from core.seller_views import (
    SellerRelistView, SellerDashboardView, SellerQueueView, SellerGradeView,
)

urlpatterns = [
    path('seller/queue/', SellerQueueView.as_view(), name='seller-queue'),
    path('seller/grade/', SellerGradeView.as_view(), name='seller-grade'),
    path('seller/relist/', SellerRelistView.as_view(), name='seller-relist'),
    path('seller/dashboard/', SellerDashboardView.as_view(), name='seller-dashboard'),
]
