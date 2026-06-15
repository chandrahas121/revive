"""
Guaranteed branded demo catalog. These products are ALWAYS seeded (in addition to
the real Amazon data) so the demo reliably shows — and the Sell-It catalog search
reliably finds — Nike / Adidas / Samsung / Vivo / Apple / OnePlus / Dell / HP /
Lenovo, plus t-shirts, shirts and pants. They carry a very high rating_count so
the storefront's popularity sort + the second-life curation surface them first.

Not a management command (leading underscore) — imported by seed_real.
"""
from decimal import Decimal
from core.models import Product, Listing

# Category-representative images (Unsplash; the tile has an onError placeholder).
IMG = {
    "phone_a": "https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=600&q=80&fit=crop",
    "phone_b": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&q=80&fit=crop",
    "phone_c": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&q=80&fit=crop",
    "laptop_a": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80&fit=crop",
    "laptop_b": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80&fit=crop",
    "shoe_a": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&fit=crop",
    "shoe_b": "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600&q=80&fit=crop",
    "tee_a": "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=600&q=80&fit=crop",
    "tee_b": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80&fit=crop",
    "shirt_a": "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&q=80&fit=crop",
    "shirt_b": "https://images.unsplash.com/photo-1564584217132-2271feaeb3c5?w=600&q=80&fit=crop",
    "pant_a": "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600&q=80&fit=crop",
    "pant_b": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&q=80&fit=crop",
    "monitor_a": "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&q=80&fit=crop",
    "monitor_b": "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&q=80&fit=crop",
    "kitchen_a": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&q=80&fit=crop",
    "book_a": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&q=80&fit=crop",
    "toy_a": "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600&q=80&fit=crop",
}

# (title, category, brand, mrp, image)
_DEMO = [
    # ── Phones (different brands) ───────────────────────────────────────────────
    ("Samsung Galaxy S23 5G (256GB, Phantom Black)", "Phone", "Samsung", 74999, "phone_c"),
    ("Samsung Galaxy A54 5G (128GB, Awesome Violet)", "Phone", "Samsung", 38999, "phone_c"),
    ("Vivo V29 5G (256GB, Peak Blue)", "Phone", "Vivo", 32999, "phone_b"),
    ("Vivo Y28 5G (128GB, Crystal Flake)", "Phone", "Vivo", 16499, "phone_b"),
    ("Apple iPhone 14 (128GB, Midnight)", "Phone", "Apple", 69900, "phone_a"),
    ("Apple iPhone 13 (128GB, Starlight)", "Phone", "Apple", 52999, "phone_a"),
    ("OnePlus 11R 5G (256GB, Galactic Silver)", "Phone", "OnePlus", 39999, "phone_b"),
    ("OnePlus Nord CE3 5G (128GB, Aqua Surge)", "Phone", "OnePlus", 24999, "phone_b"),
    ("Xiaomi Redmi Note 13 Pro 5G (256GB)", "Phone", "Xiaomi", 23999, "phone_c"),
    ("Realme 12 Pro 5G (128GB, Submarine Blue)", "Phone", "Realme", 25999, "phone_c"),
    ("Redmi A3 (64GB, Lake Blue)", "Phone", "Xiaomi", 8499, "phone_c"),
    ("Samsung Galaxy M14 5G (128GB)", "Phone", "Samsung", 10999, "phone_c"),
    # ── Laptops (different brands) ──────────────────────────────────────────────
    ("Dell XPS 13 Laptop (i7, 16GB, 512GB SSD)", "Laptop", "Dell", 109990, "laptop_a"),
    ("Dell Inspiron 15 Laptop (i5, 8GB, 512GB SSD)", "Laptop", "Dell", 54990, "laptop_a"),
    ("HP Pavilion 14 Laptop (i5, 16GB, 512GB SSD)", "Laptop", "HP", 62990, "laptop_b"),
    ("HP Victus Gaming Laptop (i5, RTX 3050)", "Laptop", "HP", 74990, "laptop_b"),
    ("Lenovo ThinkPad X1 Carbon (i7, 16GB)", "Laptop", "Lenovo", 135000, "laptop_a"),
    ("Lenovo IdeaPad Slim 5 (i5, 16GB, 512GB)", "Laptop", "Lenovo", 52990, "laptop_b"),
    ("Apple MacBook Air M2 (8GB, 256GB SSD)", "Laptop", "Apple", 114900, "laptop_b"),
    ("ASUS VivoBook 15 (i3, 8GB, 512GB SSD)", "Laptop", "ASUS", 45990, "laptop_a"),
    # ── Shoes ──────────────────────────────────────────────────────────────────
    ("Nike Air Max 270 Men's Running Shoes", "Footwear", "Nike", 12995, "shoe_a"),
    ("Nike Revolution 6 Men's Running Shoes", "Footwear", "Nike", 4495, "shoe_a"),
    ("Adidas Ultraboost 22 Running Shoes", "Footwear", "Adidas", 16999, "shoe_b"),
    ("Adidas Runfalcon 3.0 Training Shoes", "Footwear", "Adidas", 3999, "shoe_b"),
    ("Puma Smash V2 Sneakers", "Footwear", "Puma", 3499, "shoe_b"),
    ("Reebok Classic Leather Sneakers", "Footwear", "Reebok", 5999, "shoe_a"),
    ("Skechers Go Walk 6 Slip-On Shoes", "Footwear", "Skechers", 5499, "shoe_b"),
    ("Bata Formal Derby Leather Shoes", "Footwear", "Bata", 2499, "shoe_a"),
    # ── T-shirts ───────────────────────────────────────────────────────────────
    ("Allen Solly Men's Cotton Crew Neck T-Shirt", "Apparel", "Allen Solly", 1299, "tee_a"),
    ("U.S. Polo Assn. Men's Polo T-Shirt", "Apparel", "U.S. Polo Assn.", 1799, "tee_a"),
    ("Levi's Men's Crew Neck Cotton T-Shirt", "Apparel", "Levi's", 1499, "tee_b"),
    ("Puma Men's Active Dry-Cell T-Shirt", "Apparel", "Puma", 999, "tee_a"),
    ("Roadster Men's Henley T-Shirt", "Apparel", "Roadster", 799, "tee_b"),
    # ── Shirts ─────────────────────────────────────────────────────────────────
    ("Van Heusen Men's Slim Fit Formal Shirt", "Apparel", "Van Heusen", 2199, "shirt_a"),
    ("Allen Solly Men's Cotton Formal Shirt", "Apparel", "Allen Solly", 1899, "shirt_b"),
    ("Peter England Men's Casual Shirt", "Apparel", "Peter England", 1599, "shirt_a"),
    ("Arrow Men's Slim Fit Formal Shirt", "Apparel", "Arrow", 2499, "shirt_b"),
    ("Louis Philippe Men's Linen Shirt", "Apparel", "Louis Philippe", 2999, "shirt_a"),
    # ── Pants / jeans ──────────────────────────────────────────────────────────
    ("Levi's Men's 511 Slim Fit Jeans", "Apparel", "Levi's", 3499, "pant_a"),
    ("Wrangler Men's Slim Fit Chinos", "Apparel", "Wrangler", 2799, "pant_b"),
    ("U.S. Polo Assn. Men's Trousers", "Apparel", "U.S. Polo Assn.", 2499, "pant_a"),
    ("Jack & Jones Men's Slim Fit Jeans", "Apparel", "Jack & Jones", 2999, "pant_b"),
    ("Allen Solly Men's Formal Trousers", "Apparel", "Allen Solly", 2199, "pant_a"),
    # ── Monitors ─────────────────────────────────────────────────────────────────
    ("Dell UltraSharp U2723QE 27\" 4K Monitor", "Monitor", "Dell", 44999, "monitor_a"),
    ("LG 27UP850 27\" 4K UHD Monitor", "Monitor", "LG", 38999, "monitor_b"),
    ("Samsung Odyssey G5 27\" QHD Gaming Monitor", "Monitor", "Samsung", 24999, "monitor_a"),
    ("BenQ GW2785TC 27\" FHD Eye-Care Monitor", "Monitor", "BenQ", 14999, "monitor_b"),
    ("Acer Nitro VG271 27\" FHD Gaming Monitor", "Monitor", "Acer", 13499, "monitor_a"),
    ("ASUS ProArt PA248QV 24\" Monitor", "Monitor", "ASUS", 18999, "monitor_b"),
    # ── A few extras for catalog variety (lower rating_count) ────────────────────
    ("Prestige Iris 750W Mixer Grinder", "Home & Kitchen", "Prestige", 3499, "kitchen_a"),
    ("Philips HD9252 Digital Air Fryer", "Home & Kitchen", "Philips", 8999, "kitchen_a"),
    ("Pigeon Stovekraft Non-Stick Cookware Set", "Home & Kitchen", "Pigeon", 1999, "kitchen_a"),
    ("Atomic Habits by James Clear", "Books", "Random House", 599, "book_a"),
    ("The Psychology of Money by Morgan Housel", "Books", "Jaico", 399, "book_a"),
    ("Ikigai by Hector Garcia", "Books", "Penguin", 499, "book_a"),
    ("LEGO Classic Bricks Box 484 Pieces", "Toys", "LEGO", 2999, "toy_a"),
    ("Funskool Hot Wheels 5-Car Pack", "Toys", "Funskool", 899, "toy_a"),
]


def upsert_demo_catalog():
    """Create/refresh the guaranteed branded products + their NEW listings.
    Returns the list of Product objects (with very high rating_count so the
    curation + popularity sort surface them first)."""
    rc = 250000
    products = []
    for i, (title, category, brand, mrp, img_key) in enumerate(_DEMO):
        rc -= 1500  # descending, all far above real-data rating counts
        prod, _ = Product.objects.update_or_create(
            asin=f"DEMO-{i:03d}",
            defaults=dict(
                title=title, category=category, brand=brand,
                mrp=Decimal(str(mrp)), reference_image_url=IMG[img_key],
                description=f"{brand} {title}. Brand-new, full manufacturer warranty.",
                rating=4.5, rating_count=rc),
        )
        Listing.objects.update_or_create(
            product=prod, source=Listing.Source.NEW,
            defaults=dict(grade="", price=prod.mrp, completeness=1.0,
                          condition_summary="", status=Listing.Status.LISTED,
                          image_url=prod.reference_image_url, condition_label="New",
                          seller=None, tier=0, disposition="", risk_tier=""),
        )
        products.append(prod)
    return products
