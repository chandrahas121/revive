from django.urls import path
from .views import (
    CreditsMeView, CreditsView, CreditsVestView,
    CreditsRedeemView, CreditsDonateView,
)

urlpatterns = [
    path('me/',      CreditsMeView.as_view(),     name='credits-me'),
    path('vest/',    CreditsVestView.as_view(),   name='credits-vest'),
    path('redeem/',  CreditsRedeemView.as_view(), name='credits-redeem'),
    path('donate/',  CreditsDonateView.as_view(), name='credits-donate'),
    path('<int:user_id>/', CreditsView.as_view(), name='credits'),
]
