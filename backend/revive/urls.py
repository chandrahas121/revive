from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('core.urls.auth')),
    path('api/', include('core.urls.listings')),
    path('api/', include('core.urls.orders')),
    path('api/grade/', include('grade.urls')),
    path('api/tryon/', include('grade.tryon_urls')),
    path('api/card/', include('trust.urls')),
    path('api/prevent/', include('prevent.urls')),
    path('api/credits/', include('green.urls')),
    path('api/route/', include('route.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
