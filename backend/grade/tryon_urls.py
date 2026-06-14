from django.urls import path
from .views import TryOnView

urlpatterns = [
    path('', TryOnView.as_view(), name='tryon'),
]
