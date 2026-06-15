from django.urls import path

from .views import (
    RouteView, DemandGateView, HeatmapDataView, ApplyRouteView, LocalDemandView,
)

urlpatterns = [
    path('', RouteView.as_view(), name='route'),
    path('gate/', DemandGateView.as_view(), name='route-gate'),
    path('heatmap/', HeatmapDataView.as_view(), name='route-heatmap'),
    path('local-demand/', LocalDemandView.as_view(), name='route-local-demand'),
    path('apply/<int:listing_id>/', ApplyRouteView.as_view(), name='route-apply'),
]
