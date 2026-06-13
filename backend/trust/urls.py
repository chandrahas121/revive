from django.urls import path

from .views import (
    HealthCardGenerateView,
    HealthCardView,
    HealthCardVerifyView,
    HealthCardQRView,
    LedgerAppendView,
)

urlpatterns = [
    path('generate/',                   HealthCardGenerateView.as_view(), name='health-card-generate'),
    path('<int:listing_id>/',           HealthCardView.as_view(),         name='health-card'),
    path('<int:listing_id>/verify/',    HealthCardVerifyView.as_view(),   name='health-card-verify'),
    path('<int:listing_id>/qr/',        HealthCardQRView.as_view(),       name='health-card-qr'),
    path('<int:listing_id>/ledger/',    LedgerAppendView.as_view(),       name='ledger-append'),
]
