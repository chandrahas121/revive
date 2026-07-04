from django.urls import path
from .views import RufusView

urlpatterns = [
    path('', RufusView.as_view(), name='rufus'),
]
