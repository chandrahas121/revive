from django.urls import path
from core.views import (
    ListingListView, ListingDetailView, MyListingsView, RecommendView,
    ManageListingView, CatalogSuggestView,
)

urlpatterns = [
    path('listings/', ListingListView.as_view(), name='listing-list'),
    path('listings/mine/', MyListingsView.as_view(), name='my-listings'),
    path('listings/<int:pk>/manage/', ManageListingView.as_view(), name='listing-manage'),
    path('listings/<int:pk>/', ListingDetailView.as_view(), name='listing-detail'),
    path('catalog/suggest/', CatalogSuggestView.as_view(), name='catalog-suggest'),
    path('recommend/', RecommendView.as_view(), name='recommend'),
]
