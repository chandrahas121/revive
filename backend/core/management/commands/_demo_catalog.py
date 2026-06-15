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
# Balanced across the four hero categories the demo leads with — Phones, Laptops,
# Footwear (shoes) and Apparel (men's) — ~40 each, plus a small Monitor set and a
# handful of Home/Books/Toys extras for catalog variety. ~150 products total.
_DEMO = [
    # ── Phones (40) ──────────────────────────────────────────────────────────────
    ("Samsung Galaxy S23 Ultra 5G (256GB, Phantom Black)", "Phone", "Samsung", 109999, "phone_c"),
    ("Samsung Galaxy S23 5G (256GB, Cream)", "Phone", "Samsung", 74999, "phone_c"),
    ("Samsung Galaxy S22 5G (128GB, Pink Gold)", "Phone", "Samsung", 57999, "phone_c"),
    ("Samsung Galaxy A54 5G (128GB, Awesome Violet)", "Phone", "Samsung", 38999, "phone_c"),
    ("Samsung Galaxy A34 5G (128GB, Awesome Silver)", "Phone", "Samsung", 30999, "phone_c"),
    ("Samsung Galaxy M14 5G (128GB, Smoky Teal)", "Phone", "Samsung", 10999, "phone_c"),
    ("Samsung Galaxy F15 5G (128GB, Jazzy Green)", "Phone", "Samsung", 12499, "phone_c"),
    ("Apple iPhone 15 (128GB, Blue)", "Phone", "Apple", 79900, "phone_a"),
    ("Apple iPhone 15 Pro (256GB, Natural Titanium)", "Phone", "Apple", 134900, "phone_a"),
    ("Apple iPhone 14 (128GB, Midnight)", "Phone", "Apple", 69900, "phone_a"),
    ("Apple iPhone 13 (128GB, Starlight)", "Phone", "Apple", 52999, "phone_a"),
    ("Apple iPhone SE 3rd Gen (128GB, Midnight)", "Phone", "Apple", 43900, "phone_a"),
    ("Vivo X90 Pro 5G (256GB, Legendary Black)", "Phone", "Vivo", 84999, "phone_b"),
    ("Vivo V29 5G (256GB, Peak Blue)", "Phone", "Vivo", 32999, "phone_b"),
    ("Vivo V27 5G (128GB, Magic Blue)", "Phone", "Vivo", 28999, "phone_b"),
    ("Vivo Y28 5G (128GB, Crystal Flake)", "Phone", "Vivo", 16499, "phone_b"),
    ("Vivo T2 5G (128GB, Nitro Blaze)", "Phone", "Vivo", 17499, "phone_b"),
    ("OnePlus 12 5G (256GB, Flowy Emerald)", "Phone", "OnePlus", 64999, "phone_b"),
    ("OnePlus 11R 5G (256GB, Galactic Silver)", "Phone", "OnePlus", 39999, "phone_b"),
    ("OnePlus Nord 3 5G (128GB, Misty Green)", "Phone", "OnePlus", 28999, "phone_b"),
    ("OnePlus Nord CE3 5G (128GB, Aqua Surge)", "Phone", "OnePlus", 24999, "phone_b"),
    ("Xiaomi 14 5G (256GB, Jade Green)", "Phone", "Xiaomi", 69999, "phone_c"),
    ("Xiaomi Redmi Note 13 Pro+ 5G (256GB)", "Phone", "Xiaomi", 31999, "phone_c"),
    ("Xiaomi Redmi Note 13 Pro 5G (256GB)", "Phone", "Xiaomi", 23999, "phone_c"),
    ("Xiaomi Redmi Note 13 5G (128GB)", "Phone", "Xiaomi", 17999, "phone_c"),
    ("Redmi A3 (64GB, Lake Blue)", "Phone", "Xiaomi", 8499, "phone_c"),
    ("Realme 12 Pro+ 5G (256GB, Navigator Beige)", "Phone", "Realme", 29999, "phone_c"),
    ("Realme 12 Pro 5G (128GB, Submarine Blue)", "Phone", "Realme", 25999, "phone_c"),
    ("Realme Narzo 70 Pro 5G (128GB)", "Phone", "Realme", 19999, "phone_c"),
    ("Realme C67 5G (128GB, Dark Purple)", "Phone", "Realme", 14999, "phone_c"),
    ("Oppo Reno 11 Pro 5G (256GB, Pearl White)", "Phone", "Oppo", 39999, "phone_b"),
    ("Oppo Reno 11 5G (128GB, Wave Green)", "Phone", "Oppo", 29999, "phone_b"),
    ("Oppo A79 5G (128GB, Glowing Green)", "Phone", "Oppo", 19999, "phone_b"),
    ("Motorola Edge 50 Pro 5G (256GB, Luxe Lavender)", "Phone", "Motorola", 31999, "phone_a"),
    ("Motorola G84 5G (128GB, Marshmallow Blue)", "Phone", "Motorola", 19999, "phone_a"),
    ("Motorola G54 5G (128GB, Pearl Blue)", "Phone", "Motorola", 13999, "phone_a"),
    ("Nothing Phone (2a) 5G (128GB, Black)", "Phone", "Nothing", 23999, "phone_a"),
    ("Nothing Phone (2) 5G (256GB, White)", "Phone", "Nothing", 44999, "phone_a"),
    ("iQOO Neo 9 Pro 5G (256GB, Conquer Black)", "Phone", "iQOO", 36999, "phone_b"),
    ("iQOO Z9 5G (128GB, Graphene Blue)", "Phone", "iQOO", 19999, "phone_b"),
    # ── Laptops (38) ─────────────────────────────────────────────────────────────
    ("Dell XPS 13 Laptop (i7, 16GB, 512GB SSD)", "Laptop", "Dell", 109990, "laptop_a"),
    ("Dell XPS 15 Laptop (i9, 32GB, 1TB SSD)", "Laptop", "Dell", 189990, "laptop_a"),
    ("Dell Inspiron 15 Laptop (i5, 8GB, 512GB SSD)", "Laptop", "Dell", 54990, "laptop_a"),
    ("Dell Inspiron 14 Laptop (i3, 8GB, 256GB SSD)", "Laptop", "Dell", 42990, "laptop_a"),
    ("Dell G15 Gaming Laptop (i5, RTX 4050)", "Laptop", "Dell", 84990, "laptop_a"),
    ("Dell Latitude 5440 (i5, 16GB, 512GB SSD)", "Laptop", "Dell", 78990, "laptop_a"),
    ("HP Pavilion 14 Laptop (i5, 16GB, 512GB SSD)", "Laptop", "HP", 62990, "laptop_b"),
    ("HP Pavilion 15 Laptop (i7, 16GB, 1TB SSD)", "Laptop", "HP", 74990, "laptop_b"),
    ("HP Victus 15 Gaming Laptop (i5, RTX 3050)", "Laptop", "HP", 74990, "laptop_b"),
    ("HP Spectre x360 14 (i7, 16GB, 1TB SSD)", "Laptop", "HP", 144990, "laptop_b"),
    ("HP 15s Laptop (i3, 8GB, 512GB SSD)", "Laptop", "HP", 38990, "laptop_b"),
    ("HP Omen 16 Gaming Laptop (i7, RTX 4060)", "Laptop", "HP", 134990, "laptop_b"),
    ("Lenovo ThinkPad X1 Carbon Gen 11 (i7, 16GB)", "Laptop", "Lenovo", 135000, "laptop_a"),
    ("Lenovo IdeaPad Slim 5 (i5, 16GB, 512GB)", "Laptop", "Lenovo", 52990, "laptop_b"),
    ("Lenovo IdeaPad Slim 3 (i3, 8GB, 512GB)", "Laptop", "Lenovo", 36990, "laptop_b"),
    ("Lenovo Legion 5 Pro Gaming (i7, RTX 4060)", "Laptop", "Lenovo", 129990, "laptop_a"),
    ("Lenovo Yoga Slim 7 (Ryzen 7, 16GB, 1TB)", "Laptop", "Lenovo", 79990, "laptop_b"),
    ("Lenovo LOQ 15 Gaming Laptop (i5, RTX 3050)", "Laptop", "Lenovo", 69990, "laptop_a"),
    ("Apple MacBook Air M2 (8GB, 256GB SSD)", "Laptop", "Apple", 114900, "laptop_b"),
    ("Apple MacBook Air M3 (16GB, 512GB SSD)", "Laptop", "Apple", 149900, "laptop_b"),
    ("Apple MacBook Pro 14 M3 Pro (18GB, 512GB)", "Laptop", "Apple", 199900, "laptop_b"),
    ("ASUS VivoBook 15 (i3, 8GB, 512GB SSD)", "Laptop", "ASUS", 45990, "laptop_a"),
    ("ASUS Zenbook 14 OLED (i5, 16GB, 512GB)", "Laptop", "ASUS", 84990, "laptop_a"),
    ("ASUS ROG Strix G16 Gaming (i7, RTX 4070)", "Laptop", "ASUS", 159990, "laptop_a"),
    ("ASUS TUF Gaming A15 (Ryzen 7, RTX 4050)", "Laptop", "ASUS", 79990, "laptop_a"),
    ("Acer Aspire 7 Gaming (i5, RTX 3050)", "Laptop", "Acer", 59990, "laptop_b"),
    ("Acer Swift Go 14 (i5, 16GB, 512GB SSD)", "Laptop", "Acer", 64990, "laptop_b"),
    ("Acer Nitro 5 Gaming (i7, RTX 4050)", "Laptop", "Acer", 89990, "laptop_b"),
    ("MSI Modern 14 (i5, 16GB, 512GB SSD)", "Laptop", "MSI", 54990, "laptop_a"),
    ("MSI Katana 15 Gaming (i7, RTX 4060)", "Laptop", "MSI", 109990, "laptop_a"),
    ("Lenovo ThinkBook 15 (i5, 16GB, 512GB)", "Laptop", "Lenovo", 58990, "laptop_b"),
    ("HP EliteBook 840 G10 (i7, 16GB, 512GB)", "Laptop", "HP", 119990, "laptop_b"),
    ("Dell Vostro 3520 (i5, 8GB, 512GB SSD)", "Laptop", "Dell", 49990, "laptop_a"),
    ("ASUS ExpertBook B1 (i5, 16GB, 512GB)", "Laptop", "ASUS", 56990, "laptop_a"),
    ("Acer Predator Helios Neo 16 (i7, RTX 4060)", "Laptop", "Acer", 124990, "laptop_b"),
    ("Apple MacBook Pro 16 M3 Max (36GB, 1TB)", "Laptop", "Apple", 349900, "laptop_b"),
    ("Microsoft Surface Laptop 5 (i5, 8GB, 512GB)", "Laptop", "Microsoft", 106999, "laptop_a"),
    ("Honor MagicBook X14 (i5, 16GB, 512GB)", "Laptop", "Honor", 49990, "laptop_b"),
    # ── Shoes / Footwear (38) ──────────────────────────────────────────────────────
    ("Nike Air Max 270 Men's Running Shoes", "Footwear", "Nike", 12995, "shoe_a"),
    ("Nike Air Force 1 '07 Men's Sneakers", "Footwear", "Nike", 7995, "shoe_a"),
    ("Nike Revolution 6 Men's Running Shoes", "Footwear", "Nike", 4495, "shoe_a"),
    ("Nike Pegasus 40 Men's Road Running Shoes", "Footwear", "Nike", 11295, "shoe_a"),
    ("Nike Court Vision Low Men's Sneakers", "Footwear", "Nike", 5495, "shoe_a"),
    ("Adidas Ultraboost 22 Men's Running Shoes", "Footwear", "Adidas", 16999, "shoe_b"),
    ("Adidas Runfalcon 3.0 Men's Training Shoes", "Footwear", "Adidas", 3999, "shoe_b"),
    ("Adidas Galaxy 6 Men's Running Shoes", "Footwear", "Adidas", 4499, "shoe_b"),
    ("Adidas Grand Court Base Men's Sneakers", "Footwear", "Adidas", 5999, "shoe_b"),
    ("Adidas Lite Racer Adapt 5.0 Slip-On", "Footwear", "Adidas", 4999, "shoe_b"),
    ("Puma Smash V2 Men's Sneakers", "Footwear", "Puma", 3499, "shoe_b"),
    ("Puma Softride Enzo Men's Running Shoes", "Footwear", "Puma", 5999, "shoe_b"),
    ("Puma Caven 2.0 Men's Sneakers", "Footwear", "Puma", 3999, "shoe_b"),
    ("Reebok Classic Leather Men's Sneakers", "Footwear", "Reebok", 5999, "shoe_a"),
    ("Reebok Energen Plus Men's Running Shoes", "Footwear", "Reebok", 3499, "shoe_a"),
    ("Skechers Go Walk 6 Men's Slip-On Shoes", "Footwear", "Skechers", 5499, "shoe_b"),
    ("Skechers Summits Men's Walking Shoes", "Footwear", "Skechers", 4999, "shoe_b"),
    ("New Balance 550 Men's Sneakers", "Footwear", "New Balance", 11999, "shoe_a"),
    ("New Balance Fresh Foam Men's Running Shoes", "Footwear", "New Balance", 8999, "shoe_a"),
    ("Campus North Plus Men's Running Shoes", "Footwear", "Campus", 1799, "shoe_b"),
    ("Campus Oxyfit Men's Sports Shoes", "Footwear", "Campus", 1499, "shoe_b"),
    ("Bata Formal Derby Men's Leather Shoes", "Footwear", "Bata", 2499, "shoe_a"),
    ("Bata Comfit Men's Slip-On Loafers", "Footwear", "Bata", 1999, "shoe_a"),
    ("Woodland Men's Leather Outdoor Boots", "Footwear", "Woodland", 4995, "shoe_a"),
    ("Woodland Men's Casual Sneakers", "Footwear", "Woodland", 3495, "shoe_a"),
    ("Red Tape Men's Sports Walking Shoes", "Footwear", "Red Tape", 2799, "shoe_b"),
    ("Red Tape Men's Formal Brogue Shoes", "Footwear", "Red Tape", 3299, "shoe_a"),
    ("Sparx Men's Running Shoes", "Footwear", "Sparx", 1299, "shoe_b"),
    ("Asics Gel-Contend 8 Men's Running Shoes", "Footwear", "Asics", 5999, "shoe_b"),
    ("Asics Gel-Nimbus 25 Men's Running Shoes", "Footwear", "Asics", 16999, "shoe_b"),
    ("Crocs Men's Classic Clogs", "Footwear", "Crocs", 3995, "shoe_b"),
    ("Vans Old Skool Men's Sneakers", "Footwear", "Vans", 6499, "shoe_a"),
    ("Converse Chuck Taylor All Star Sneakers", "Footwear", "Converse", 4999, "shoe_a"),
    ("Fila Disruptor II Men's Sneakers", "Footwear", "Fila", 7999, "shoe_b"),
    ("Hush Puppies Men's Leather Loafers", "Footwear", "Hush Puppies", 4499, "shoe_a"),
    ("Clarks Men's Formal Leather Shoes", "Footwear", "Clarks", 5999, "shoe_a"),
    ("Liberty Men's Casual Sandals", "Footwear", "Liberty", 999, "shoe_b"),
    ("Bata Power Men's Training Shoes", "Footwear", "Power", 1999, "shoe_b"),
    # ── Apparel — men's (40): T-shirts, shirts, pants, jackets ──────────────────────
    ("Allen Solly Men's Cotton Crew Neck T-Shirt", "Apparel", "Allen Solly", 1299, "tee_a"),
    ("U.S. Polo Assn. Men's Polo T-Shirt", "Apparel", "U.S. Polo Assn.", 1799, "tee_a"),
    ("Levi's Men's Crew Neck Cotton T-Shirt", "Apparel", "Levi's", 1499, "tee_b"),
    ("Puma Men's Active Dry-Cell T-Shirt", "Apparel", "Puma", 999, "tee_a"),
    ("Roadster Men's Henley T-Shirt", "Apparel", "Roadster", 799, "tee_b"),
    ("Nike Men's Dri-FIT Training T-Shirt", "Apparel", "Nike", 1495, "tee_a"),
    ("Adidas Men's Essentials Logo T-Shirt", "Apparel", "Adidas", 1299, "tee_b"),
    ("H&M Men's Regular Fit Cotton T-Shirt", "Apparel", "H&M", 699, "tee_a"),
    ("Jockey Men's Round Neck T-Shirt", "Apparel", "Jockey", 899, "tee_b"),
    ("Wrogn Men's Slim Fit Printed T-Shirt", "Apparel", "Wrogn", 1099, "tee_a"),
    ("Van Heusen Men's Slim Fit Formal Shirt", "Apparel", "Van Heusen", 2199, "shirt_a"),
    ("Allen Solly Men's Cotton Formal Shirt", "Apparel", "Allen Solly", 1899, "shirt_b"),
    ("Peter England Men's Casual Shirt", "Apparel", "Peter England", 1599, "shirt_a"),
    ("Arrow Men's Slim Fit Formal Shirt", "Apparel", "Arrow", 2499, "shirt_b"),
    ("Louis Philippe Men's Linen Shirt", "Apparel", "Louis Philippe", 2999, "shirt_a"),
    ("U.S. Polo Assn. Men's Checked Casual Shirt", "Apparel", "U.S. Polo Assn.", 2299, "shirt_b"),
    ("Levi's Men's Slim Fit Denim Shirt", "Apparel", "Levi's", 2799, "shirt_a"),
    ("Raymond Men's Cotton Formal Shirt", "Apparel", "Raymond", 1999, "shirt_b"),
    ("Park Avenue Men's Slim Fit Shirt", "Apparel", "Park Avenue", 1799, "shirt_a"),
    ("Highlander Men's Oxford Casual Shirt", "Apparel", "Highlander", 1099, "shirt_b"),
    ("Levi's Men's 511 Slim Fit Jeans", "Apparel", "Levi's", 3499, "pant_a"),
    ("Levi's Men's 512 Slim Tapered Jeans", "Apparel", "Levi's", 3799, "pant_a"),
    ("Wrangler Men's Slim Fit Chinos", "Apparel", "Wrangler", 2799, "pant_b"),
    ("U.S. Polo Assn. Men's Trousers", "Apparel", "U.S. Polo Assn.", 2499, "pant_a"),
    ("Jack & Jones Men's Slim Fit Jeans", "Apparel", "Jack & Jones", 2999, "pant_b"),
    ("Allen Solly Men's Formal Trousers", "Apparel", "Allen Solly", 2199, "pant_a"),
    ("Spykar Men's Skinny Fit Jeans", "Apparel", "Spykar", 2499, "pant_b"),
    ("Pepe Jeans Men's Regular Fit Jeans", "Apparel", "Pepe Jeans", 3299, "pant_a"),
    ("Peter England Men's Casual Chinos", "Apparel", "Peter England", 1999, "pant_b"),
    ("Flying Machine Men's Slim Fit Jeans", "Apparel", "Flying Machine", 2299, "pant_a"),
    ("Roadster Men's Cargo Joggers", "Apparel", "Roadster", 1499, "pant_b"),
    ("Levi's Men's Denim Trucker Jacket", "Apparel", "Levi's", 4999, "shirt_a"),
    ("U.S. Polo Assn. Men's Bomber Jacket", "Apparel", "U.S. Polo Assn.", 4499, "shirt_b"),
    ("Wrogn Men's Hooded Sweatshirt", "Apparel", "Wrogn", 1799, "tee_b"),
    ("Puma Men's Zip-Up Track Jacket", "Apparel", "Puma", 2999, "tee_a"),
    ("Adidas Men's Essentials Hoodie", "Apparel", "Adidas", 3499, "tee_b"),
    ("Jack & Jones Men's Casual Blazer", "Apparel", "Jack & Jones", 5999, "shirt_a"),
    ("Allen Solly Men's Half-Sleeve Polo", "Apparel", "Allen Solly", 1599, "tee_a"),
    ("Tommy Hilfiger Men's Cotton Polo T-Shirt", "Apparel", "Tommy Hilfiger", 2999, "tee_a"),
    ("Nike Men's Sportswear Club Fleece Joggers", "Apparel", "Nike", 3495, "pant_b"),
    # ── Monitors (8) ─────────────────────────────────────────────────────────────
    ("Dell UltraSharp U2723QE 27\" 4K Monitor", "Monitor", "Dell", 44999, "monitor_a"),
    ("LG 27UP850 27\" 4K UHD Monitor", "Monitor", "LG", 38999, "monitor_b"),
    ("Samsung Odyssey G5 27\" QHD Gaming Monitor", "Monitor", "Samsung", 24999, "monitor_a"),
    ("BenQ GW2785TC 27\" FHD Eye-Care Monitor", "Monitor", "BenQ", 14999, "monitor_b"),
    ("Acer Nitro VG271 27\" FHD Gaming Monitor", "Monitor", "Acer", 13499, "monitor_a"),
    ("ASUS ProArt PA248QV 24\" Monitor", "Monitor", "ASUS", 18999, "monitor_b"),
    ("LG 24MR400 24\" FHD IPS Monitor", "Monitor", "LG", 8999, "monitor_b"),
    ("Samsung 32\" M70C 4K Smart Monitor", "Monitor", "Samsung", 39999, "monitor_a"),
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


def upsert_demo_catalog(skip_categories=None):
    """Create/refresh the guaranteed branded products + their NEW listings.
    Returns the list of Product objects (with very high rating_count so the
    curation + popularity sort surface them first).

    `skip_categories` lets the seeder leave whole categories to the REAL Amazon
    catalog instead. The electronics demo uses this: curated phones/laptops/
    monitors carried reused stock photos + borrowed (category-matched) reviews,
    which read as inaccurate next to the real ASINs that ship their own image and
    their own 1:1 reviews — so we skip them and let the real data stand alone."""
    skip = set(skip_categories or ())
    rc = 250000
    products = []
    for i, (title, category, brand, mrp, img_key) in enumerate(_DEMO):
        rc -= 1500  # descending, all far above real-data rating counts
        if category in skip:
            continue
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
