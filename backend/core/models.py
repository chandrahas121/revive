from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Extended user — email is the login credential."""
    email = models.EmailField(unique=True)
    return_rate = models.FloatField(default=0.0)
    geohash5 = models.CharField(max_length=10, blank=True, default='')

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

    def __str__(self):
        return self.title


class Listing(models.Model):
    """A specific item available for sale — the core inventory unit."""

    class Source(models.TextChoices):
        RETURN = 'return', 'Amazon Return'
        P2P = 'p2p', 'P2P (Individual)'
        WAREHOUSE = 'warehouse', 'Amazon Warehouse'
        RENEWED = 'renewed', 'Amazon Renewed'

    class Grade(models.TextChoices):
        A = 'A', 'Grade A – Excellent'
        B = 'B', 'Grade B – Good'
        C = 'C', 'Grade C – Fair'
        D = 'D', 'Grade D – Poor'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending Grading'
        LISTED = 'listed', 'Listed'
        SOLD = 'sold', 'Sold'
        DONATED = 'donated', 'Donated'
        RECYCLED = 'recycled', 'Recycled'
        WAREHOUSE_BOUND = 'warehouse_bound', 'Warehouse Bound'

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='listings')
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.WAREHOUSE)
    grade = models.CharField(max_length=1, choices=Grade.choices, default=Grade.A)
    condition_summary = models.TextField(blank=True)
    completeness = models.FloatField(default=1.0)   # 0.0–1.0 from CLIP
    price = models.DecimalField(max_digits=10, decimal_places=2)
    geohash5 = models.CharField(max_length=10, blank=True, default='')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LISTED)
    seller = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='listings'
    )   # set for P2P listings
    image_url = models.URLField(max_length=500, blank=True)
    # Pillar 2 — routing result (populated by route_item() after grading)
    chosen_path = models.CharField(max_length=30, blank=True, default='')
    tier        = models.IntegerField(default=1)
    ev_data     = models.JSONField(null=True, blank=True)
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
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    is_p2p = models.BooleanField(default=False)
    escrow_released = models.BooleanField(default=False)
    return_window_closes = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.pk} – {self.user.email}"
