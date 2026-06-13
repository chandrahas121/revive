"""
Calibration: measure RAW CLIP cosine similarity for known-good, damaged, and
wrong-category items vs their category reference. Used to set the rescale
constants in compute_completeness so completeness has a real 0-1 spread and
only drops low for genuine mismatch (wrong item / missing parts), not for
ordinary good products.
"""
import sys, os, urllib.request, tempfile
sys.path.insert(0, '.')
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import numpy as np
from ml.inference.clip_model import get_image_embedding
from ml.catalog import get_reference_bytes

def dl(url):
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    urllib.request.urlretrieve(url, tmp.name)
    return open(tmp.name, 'rb').read()

# (label, category, url, expectation)
CASES = [
    # Good footwear (same category as ref) — should score HIGH
    ("clean_nike_red",   "Footwear", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80", "good"),
    ("clean_sneaker_2",  "Footwear", "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&q=80", "good"),
    ("worn_shoe",        "Footwear", "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600&q=80", "good-worn"),
    # Good clothing
    ("clean_tshirt",     "Clothing", "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80", "good"),
    ("clean_jeans",      "Clothing", "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=600&q=80", "good"),
    # Wrong category — shoe image graded against CLOTHING ref → should score LOW
    ("shoe_vs_clothing", "Clothing", "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80", "wrong-item"),
    # Wrong category — laptop graded against FOOTWEAR ref → should score LOW
    ("laptop_vs_footwear", "Footwear", "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80", "wrong-item"),
]

print(f"{'case':22s} {'category':10s} {'expect':12s} {'raw_cosine':>10s}")
print("-" * 60)
refs = {}
for label, cat, url, expect in CASES:
    try:
        img = dl(url)
        if cat not in refs:
            refs[cat] = get_reference_bytes(cat)
        ref = refs[cat]
        emb_u = get_image_embedding(img)
        emb_r = get_image_embedding(ref)
        cos = float(np.dot(emb_u, emb_r))
        print(f"{label:22s} {cat:10s} {expect:12s} {cos:>10.4f}")
    except Exception as e:
        print(f"{label:22s} {cat:10s} {expect:12s}  ERROR: {e}")
