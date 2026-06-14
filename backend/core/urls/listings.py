from django.urls import path
from core.views import ListingListView, ListingDetailView, MyListingsView, RecommendView

urlpatterns = [
    path('listings/', ListingListView.as_view(), name='listing-list'),
    path('listings/mine/', MyListingsView.as_view(), name='my-listings'),
    path('listings/<int:pk>/', ListingDetailView.as_view(), name='listing-detail'),
    path('recommend/', RecommendView.as_view(), name='recommend'),
]
