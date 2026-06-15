from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Extended user — email is the login credential."""
    email = models.EmailField(unique=True)
    return_rate = models.FloatField(default=0.0)
    geohash5 = models.CharField(max_length=10, blank=True, default='')
    # v2: live location capture (browser geolocation) → feeds local demand / "Near me"
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    # Pillar 4 — Fit-Twin body measurements + learned size profile
    height_in = models.FloatField(blank=True, null=True)
    weight_lb = models.FloatField(blank=True, null=True)
    bust_in = models.FloatField(blank=True, null=True)
    body_type = models.CharField(max_length=40, blank=True, default='')
    age = models.IntegerField(blank=True, null=True)
    fit_size_profile = models.JSONField(blank=True, default=dict)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class Product(models.Model):
    """Reference catalogue item (like Amazon's ASIN catalogue)."""
    asin = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    brand = models.CharField(max_length=100, blank=True)
    mrp = models.DecimalField(max_digits=10, decimal_places=2)
    reference_image_url = models.URLField(max_length=500)
    description = models.TextField(blank=True)
    # v2: real catalog signals (from Amazon Reviews 2023 import)
    rating = models.FloatField(default=0.0)
    rating_count = models.IntegerField(default=0)
    # Pillar 4 — link to the clothing-fit dataset item this product represents
    fit_item_id = models.CharField(max_length=40, blank=True, default='')

    def __str__(self):
        return self.title


class Review(models.Model):
    """A customer review on a catalogue product — real text imported from the
    Amazon Reviews 2023 (UCSD/McAuley) dataset, displayed Amazon-style on the
    product page."""
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='reviews')
    author = models.CharField(max_length=80)
    rating = models.IntegerField(default=5)            # 1–5 stars
    title = models.CharField(max_length=160, blank=True)
    body = models.TextField(blank=True)
    verified_purchase = models.BooleanField(default=True)
    helpful_votes = models.IntegerField(default=0)
    review_date = models.DateField(null=True, blank=True)
    source_asin = models.CharField(max_length=20, blank=True, default='')  # dataset provenance

    class Meta:
        ordering = ['-helpful_votes', '-review_date']

    def __str__(self):
        return f"{self.rating}★ {self.title[:40]} — {self.product.title[:30]}"


class Listing(models.Model):
    """A specific item available for sale — the core inventory unit."""

    class Source(models.TextChoices):
        NEW = 'new', 'New'                          # v2: normal Amazon New catalog
        RETURN = 'return', 'Amazon Return'
        P2P = 'p2p', 'P2P (Individual)'
        WAREHOUSE = 'warehouse', 'Amazon Warehouse'
        RENEWED = 'renewed', 'Amazon Renewed'

    class Grade(models.TextChoices):
        A = 'A', 'Grade A – Like New'
        B = 'B', 'Grade B – Very Good'
        C = 'C', 'Grade C – Good'
        D = 'D', 'Grade D – Heavy cosmetic damage (functional)'
        E = 'E', 'Grade E – Functional defect / for parts'   # v2 (Q8)
        F = 'F', 'Grade F – Not resellable (recycle)'        # v2 (Q8)

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Grading'
        LISTED = 'listed', 'Listed'
        PAUSED = 'paused', 'Paused'           # v2 (Q3) — temporarily hidden
        DELISTED = 'delisted', 'Delisted'     # v2 (Q3) — removed by seller
        SOLD = 'sold', 'Sold'
        DONATED = 'donated', 'Donated'
        RECYCLED = 'recycled', 'Recycled'
        WAREHOUSE_BOUND = 'warehouse_bound', 'Warehouse Bound'
        # v2 lifecycle stages — a returned/listed item is NOT instantly live; it
        # progresses through a disposition-driven track (see core/lifecycle.py):
        REFURB_SCHEDULED = 'refurb_scheduled', 'Refurb pickup scheduled'  # Renewed track
        REFURBISHING     = 'refurbishing', 'Refurbishing at SPN center'   # Renewed track
        AWAITING_DEMAND  = 'awaiting_demand', 'Held local · awaiting demand'  # Revive track

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='listings')
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.WAREHOUSE)
    grade = models.CharField(max_length=1, choices=Grade.choices, default=Grade.A, blank=True)
    condition_summary = models.TextField(blank=True)
    completeness = models.FloatField(default=1.0)   # 0.0–1.0 from CLIP
    price = models.DecimalField(max_digits=10, decimal_places=2)
    geohash5 = models.CharField(max_length=10, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LISTED)
    seller = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='listings'
    )   # set for P2P listings
    image_url = models.URLField(max_length=500, blank=True)
    images = models.JSONField(default=list, blank=True)   # v2: seller-uploaded angle shots [{url,label}]
    # Pillar 2 — routing result (populated by route_item() after grading)
    chosen_path = models.CharField(max_length=30, blank=True, default='')
    tier        = models.IntegerField(default=1)   # legacy int tier (1/2/3)
    ev_data     = models.JSONField(null=True, blank=True)
    # v2 — backend-only risk tier + disposition gate result + buyer-facing label
    risk_tier        = models.CharField(max_length=10, blank=True, default='')   # LOW/MEDIUM/HIGH
    disposition      = models.CharField(max_length=20, blank=True, default='')   # RESTOCK_NEW/OPEN_BOX/...
    condition_label  = models.CharField(max_length=40, blank=True, default='')   # "Used – Very Good" etc.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.title} [{self.grade}] @ ₹{self.price}"


class Order(models.Model):
    """Purchase record — supports both standard and P2P transactions."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        SHIPPED = 'shipped', 'Shipped'
        DELIVERED = 'delivered', 'Delivered'
        RETURNED = 'returned', 'Returned'
        CANCELLED = 'cancelled', 'Cancelled'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    listing = models.ForeignKey(Listing, null=True, on_delete=models.SET_NULL, related_name='orders')
    size = models.FloatField(null=True, blank=True)   # chosen size — feeds fit_size_profile
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    is_p2p = models.BooleanField(default=False)
    escrow_released = models.BooleanField(default=False)
    return_window_closes = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.pk} – {self.user.email}"
