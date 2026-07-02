from django.urls import path
from .views import (
    GradeView, GradeAndRouteView, InspectAndRouteView, HeatmapView,
    AsyncGradeView, GradeStatusView, AsyncInspectView, InspectStatusView,
    AsyncReturnInspectView,
)

urlpatterns = [
    path('', GradeView.as_view(), name='grade'),
    path('route/', GradeAndRouteView.as_view(), name='grade-and-route'),
    path('inspect/', InspectAndRouteView.as_view(), name='grade-inspect'),
    path('inspect/async/', AsyncInspectView.as_view(), name='grade-inspect-async'),
    path('inspect/return/async/', AsyncReturnInspectView.as_view(), name='grade-inspect-return-async'),
    path('inspect/status/<str:job_id>/', InspectStatusView.as_view(), name='grade-inspect-status'),
    path('heatmap/', HeatmapView.as_view(), name='grade-heatmap'),
    path('async/', AsyncGradeView.as_view(), name='grade-async'),
    path('status/<str:job_id>/', GradeStatusView.as_view(), name='grade-status'),
]
