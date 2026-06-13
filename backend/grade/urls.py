from django.urls import path
from .views import GradeView, GradeAndRouteView, HeatmapView

urlpatterns = [
    path('', GradeView.as_view(), name='grade'),
    path('route/', GradeAndRouteView.as_view(), name='grade-and-route'),
    path('heatmap/', HeatmapView.as_view(), name='grade-heatmap'),
]
