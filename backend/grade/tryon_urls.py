from django.urls import path
from .views import TryOnView, TryOnStatusView

urlpatterns = [
    path('', TryOnView.as_view(), name='tryon'),
    path('status/<str:job_id>/', TryOnStatusView.as_view(), name='tryon-status'),
]
