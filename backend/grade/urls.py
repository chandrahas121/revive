from django.urls import path
from .views import GradeView, HeatmapView

urlpatterns = [
    path('', GradeView.as_view(), name='grade'),
    path('heatmap/', HeatmapView.as_view(), name='grade-heatmap'),
]
