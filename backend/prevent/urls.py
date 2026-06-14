from django.urls import path
from .views import RiskView, FitTwinView

urlpatterns = [
    path('risk/', RiskView.as_view(), name='risk'),
    path('fit-twin/', FitTwinView.as_view(), name='fit-twin'),
]
