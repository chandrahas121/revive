"""
Management command: python manage.py seed_db
Seeds Products, Listings, a demo buyer with orders, Green-Credit history,
and Health Cards — everything the Pillar 1/2/3/5 demo flows need.
"""
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Product, Listing, Order, User
from trust.models import HealthCard, LedgerEntry
from green.models import CreditTransaction

# Canonical category names (match ml/route.py + frontend utils/tier.js)
CANON = {
    'electronics': 'Electronics', 'footwear': 'Footwear', 'clothing': 'Clothing',
    'kitchen': 'Home & Kitchen', 'bags': 'Other', 'cameras': 'Electronics',
}

# Bengaluru demand cells (from ml/route.py SYNTHETIC_DEMAND_INDEX)
GEOHASHES = ['tbxx1', 'tbxx2', 'tbxx3', 'tbxx4', 'tbxw1', 'tbxv1', 'tbxu1', 'tbxu2']

PRODUCTS = [
    {"asin": "B08N5WRWNW", "title": "boAt Rockerz 450 Bluetooth Headphones", "category": "electronics", "brand": "boAt", "mrp": "2990.00", "reference_image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop", "description": "Wireless Bluetooth headphones with 15 hours playback, 40mm drivers, and foldable design."},
    {"asin": "B07VGRJDFY", "title": "Apple iPhone 12 - 64GB", "category": "electronics", "brand": "Apple", "mrp": "54999.00", "reference_image_url": "https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=400&h=400&fit=crop", "description": "5G capable iPhone with Super Retina XDR display, A14 Bionic chip, and dual camera system."},
    {"asin": "B09LSGVXBM", "title": "Samsung Galaxy Watch 4 Classic", "category": "electronics", "brand": "Samsung", "mrp": "26999.00", "reference_image_url": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop", "description": "Rotating bezel, health monitoring, GPS, and 4G LTE connectivity."},
    {"asin": "B08B7GSTV7", "title": "Sony WH-1000XM4 Wireless Headphones", "category": "electronics", "brand": "Sony", "mrp": "29990.00", "reference_image_url": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=400&fit=crop", "description": "Industry-leading noise cancellation, 30-hour battery life, and multipoint connection."},
    {"asin": "B07S67X9FD", "title": "Logitech MX Master 3 Mouse", "category": "electronics", "brand": "Logitech", "mrp": "9995.00", "reference_image_url": "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop", "description": "Advanced wireless mouse for professionals with ultra-fast MagSpeed scroll wheel."},
    {"asin": "B09G9HD4BC", "title": "Mechanical Gaming Keyboard RGB", "category": "electronics", "brand": "Zebronics", "mrp": "3999.00", "reference_image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop", "description": "Tactile mechanical switches, per-key RGB lighting, anti-ghosting."},
    {"asin": "B08CF3B7N1", "title": "Fjallraven Kanken Backpack", "category": "bags", "brand": "Fjallraven", "mrp": "8999.00", "reference_image_url": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop", "description": "Durable Vinylon F backpack, 16L capacity, padded back and shoulder straps."},
    {"asin": "B07VBGF4RP", "title": "Nike Air Max 270 Running Shoes", "category": "footwear", "brand": "Nike", "mrp": "12995.00", "reference_image_url": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop", "description": "Max Air unit in heel, breathable mesh upper, ideal for casual and light running."},
    {"asin": "B087LGFC7P", "title": "Allen Solly Men's Slim Fit Formal Shirt", "category": "clothing", "brand": "Allen Solly", "mrp": "1599.00", "reference_image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop", "description": "Cotton-rich slim fit formal shirt suitable for office wear."},
    {"asin": "B08NTG2J5P", "title": "Prestige Induction Cooktop 1600W", "category": "kitchen", "brand": "Prestige", "mrp": "3295.00", "reference_image_url": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop", "description": "1600W induction cooktop with feather touch controls and auto-switch off."},
    {"asin": "B07WDTG59D", "title": "Philips 43-inch 4K UHD Smart TV", "category": "electronics", "brand": "Philips", "mrp": "34999.00", "reference_image_url": "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=400&h=400&fit=crop", "description": "4K UHD, Android TV, Dolby Vision, and HDR10+ display technology."},
    {"asin": "B07ZPKBL9V", "title": "Canon EOS M50 Mark II Camera", "category": "cameras", "brand": "Canon", "mrp": "54995.00", "reference_image_url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&fit=crop", "description": "24.1MP APS-C sensor, 4K video, DIGIC 8 processor, Dual Pixel CMOS AF."},
]

LISTINGS = [
    ("B08N5WRWNW", "warehouse", "A", "1799.00", "Like new, original box included, no visible scratches.", ""),
    ("B08N5WRWNW", "p2p",       "B", "1299.00", "Slight scuff on right ear cup, fully functional.", ""),
    ("B07VGRJDFY", "renewed",   "A", "32999.00", "Professionally inspected, new battery, original accessories.", ""),
    ("B07VGRJDFY", "warehouse", "B", "27999.00", "Minimal signs of use, screen protector applied.", ""),
    ("B07VGRJDFY", "p2p",       "C", "19999.00", "Minor dent on corner, screen perfect, battery 87%.", ""),
    ("B09LSGVXBM", "warehouse", "A", "16499.00", "Opened but unused, complete packaging.", ""),
    ("B08B7GSTV7", "renewed",   "A", "17990.00", "Certified refurbished by Sony authorized partner.", ""),
    ("B08B7GSTV7", "p2p",       "B", "13999.00", "Used 6 months, carry case included, works perfectly.", ""),
    ("B07S67X9FD", "warehouse", "A", "7999.00",  "Sealed unit from returned shipment.", ""),
    ("B07S67X9FD", "p2p",       "B", "5999.00",  "Used for 4 months, USB-C cable included.", ""),
    ("B09G9HD4BC", "warehouse", "A", "2499.00",  "Minor dust, cleaned and tested, all keys working.", ""),
    ("B08CF3B7N1", "p2p",       "B", "5499.00",  "Used for 3 months, small stain on bottom, zips work.", ""),
    ("B07VBGF4RP", "warehouse", "A", "8999.00",  "Tried on once, no wear on sole, box included.", ""),
    ("B07VBGF4RP", "p2p",       "B", "6499.00",  "Used 10 times, slight sole wear, clean upper.", ""),
    ("B087LGFC7P", "warehouse", "A",  "899.00",  "Returned after trial, pressed and clean.", ""),
    ("B08NTG2J5P", "warehouse", "B", "1999.00",  "Minor scratch on glass top, heating element perfect.", ""),
    ("B07WDTG59D", "p2p",       "A", "24999.00", "Used 8 months, no dead pixels, remote and stand included.", ""),
    ("B07WDTG59D", "warehouse", "B", "19999.00", "Open box, cosmetic scratches on bezel.", ""),
    ("B07ZPKBL9V", "renewed",   "A", "39999.00", "Shutter count < 500, sensor cleaned, all functions tested.", ""),
    ("B07ZPKBL9V", "p2p",       "B", "29999.00", "Used 1 year, 18-55mm kit lens included, body in good shape.", ""),
]

GRADE_COMPLETENESS = {"A": 1.0, "B": 0.9, "C": 0.75, "D": 0.6}


def _tier(mrp: float) -> int:
    if mrp < 2000: return 1
    if mrp <= 10000: return 2
    return 3


def _chosen_path(grade: str, tier: int) -> str:
    if tier == 3:
        return 'refurbish'
    if grade == 'D':
        return 'donate'
    if grade == 'C':
        return 'refurbish'
    return 'resell_p2p'


def _guarantee(tier: int):
    if tier == 3: return 90, 'Amazon SPN'
    if tier == 2: return 30, 'seller_escrow'
    return 7, 'seller_escrow'


class Command(BaseCommand):
    help = 'Seed products, listings, demo buyer, orders, credits, and health cards.'

    def handle(self, *args, **options):
        self.stdout.write('Seeding products...')
        product_map = {}
        for p in PRODUCTS:
            data = {**p, 'category': CANON.get(p['category'], p['category'])}
            product, _ = Product.objects.update_or_create(asin=p['asin'], defaults=data)
            product_map[p['asin']] = product

        self.stdout.write('Reseeding listings...')
        # Wipe dependent data first to avoid stale FKs
        HealthCard.objects.all().delete()
        Order.objects.all().delete()
        Listing.objects.all().delete()

        listings = []
        for i, (asin, source, grade, price, condition, image_url) in enumerate(LISTINGS):
            product = product_map.get(asin)
            if not product:
                continue
            mrp = float(product.mrp)
            tier = _tier(mrp)
            listing = Listing.objects.create(
                product=product, source=source, grade=grade, price=price,
                condition_summary=condition, image_url=image_url, status='listed',
                completeness=GRADE_COMPLETENESS.get(grade, 0.8),
                geohash5=GEOHASHES[i % len(GEOHASHES)],
                tier=tier, chosen_path=_chosen_path(grade, tier),
            )
            listings.append(listing)

        # Health cards for the first ~10 listings so "View Health Card" works
        self.stdout.write('Generating health cards...')
        for listing in listings[:10]:
            tier = listing.tier
            gdays, gholder = _guarantee(tier)
            inspected = 'ai_spn' if tier == 3 else 'ai_agent' if tier == 2 else 'ai_only'
            card = HealthCard.objects.create(
                listing=listing, tier=tier, grade=listing.grade,
                confidence=0.9 if listing.grade == 'A' else 0.82,
                defects=[], completeness=listing.completeness,
                condition_summary=listing.condition_summary,
                functional=True, box_present=(listing.grade == 'A'),
                inspected_by=inspected, model_version='revive-grade-v1.0',
                battery_pct=(89 if tier >= 2 and 'iphone' in listing.product.title.lower() else None),
                previous_owners=0, guarantee_days=gdays, guarantee_holder=gholder,
            )
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.GRADED, prev_hash='',
                data={'grade': listing.grade, 'tier': tier, 'inspected_by': inspected,
                      'route': listing.chosen_path},
            )
            LedgerEntry.objects.create(
                card=card, event=LedgerEntry.Event.LISTED,
                prev_hash=card.ledger.last().this_hash,
                data={'price': str(listing.price), 'source': listing.source},
            )

        # Demo buyer + delivered orders + credit history
        self.stdout.write('Creating demo buyer, orders & credits...')
        demo, created = User.objects.get_or_create(
            email='demo@revive.in',
            defaults={'username': 'demo@revive.in', 'first_name': 'Demo', 'last_name': 'Buyer', 'geohash5': 'tbxx1'},
        )
        if created:
            demo.set_password('demo12345')
            demo.save()
        else:
            demo.geohash5 = 'tbxx1'
            demo.save()

        CreditTransaction.objects.filter(user=demo).delete()

        # Delivered orders the buyer can return (one per tier)
        order_listings = [
            next((l for l in listings if l.tier == 1), listings[14]),                       # Tier 1 → kirana flow
            next((l for l in listings if l.tier == 2 and l.source in ('p2p', 'renewed')), listings[7]),  # Tier 2 → agent
            next((l for l in listings if l.tier == 3), listings[2]),                         # Tier 3 → SPN
        ]
        now = timezone.now()
        for l in order_listings:
            Order.objects.create(
                user=demo, listing=l, status='delivered',
                is_p2p=(l.source == 'p2p'), escrow_released=True,
                return_window_closes=now + timedelta(days=5),
            )

        # Green-credit history (final_idea §8 examples) — buyer earns by keeping
        earn = [
            (120, 'Kept ₹2,200 monitor + kirana drop', 'Electronics'),
            (80,  'Kept ₹1,800 cookware + kirana drop', 'Home & Kitchen'),
            (60,  'Kept ₹1,200 kurta + kirana drop',    'Clothing'),
            (40,  'Kept ₹800 sneakers + kirana drop',   'Footwear'),
            (20,  'Kept ₹800 phone case + kirana drop', 'Electronics'),
        ]
        for amt, reason, cat in earn:
            CreditTransaction.objects.create(user=demo, kind='earn', status='vested',
                                             amount=amt, reason=reason, category=cat)
        CreditTransaction.objects.create(user=demo, kind='spend', status='vested',
                                         amount=100, reason='Redeemed on REVIVE refurb headphones')
        CreditTransaction.objects.create(user=demo, kind='earn', status='pending',
                                         amount=16, reason='Air Fryer — window closes in 4 days',
                                         category='Home & Kitchen', vests_at=now + timedelta(days=4))

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! {Product.objects.count()} products, {Listing.objects.count()} listings, '
            f'{HealthCard.objects.count()} health cards, {Order.objects.count()} orders. '
            f'Demo buyer: demo@revive.in / demo12345'
        ))
