"""
Robustness sweep — confirm the pipeline does NOT hallucinate defects on clean
products across categories, and that CLIP completeness correctly flags a
wrong-item upload (laptop photo on a footwear listing).
"""
import sys, os, urllib.request, tempfile, time
sys.path.insert(0, '.')
from pathlib import Path
for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

# Fresh cache so every item runs the full pipeline
Path('ml/artifacts/grade_cache.json').write_text('{}')

from ml.grade import grade_image

# (label, category, url, expectation)
CASES = [
    ("clean_white_sneaker", "Footwear",    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=700&q=80", "A/B, 0-1 minor"),
    ("clean_smartphone",    "Electronics", "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=700&q=80", "A/B, 0-1 minor"),
    ("clean_handbag",       "Clothing",    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=700&q=80", "A/B, 0-1 minor"),
    ("clean_jacket",        "Clothing",    "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=700&q=80", "A/B, 0-1 minor"),
    ("clean_watch",         "Electronics", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&q=80", "A/B, 0-1 minor"),
    # Wrong item: laptop uploaded to a FOOTWEAR listing → CLIP completeness should tank → grade <= C
    ("wrong_item_laptop",   "Footwear",    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=700&q=80", "<= C (wrong item)"),
]

def dl(url):
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    urllib.request.urlretrieve(url, tmp.name)
    return tmp.name

print(f"{'item':22s} {'cat':11s} {'grade':5s} {'conf':>5s} {'compl':>6s} {'defects':>7s}  expectation")
print("-" * 92)
for label, cat, url, expect in CASES:
    try:
        path = dl(url)
        t0 = time.perf_counter()
        r = grade_image(path, category=cat)
        ms = (time.perf_counter() - t0) * 1000
        nd = len(r.get('defects', []))
        print(f"{label:22s} {cat:11s} {r['grade']:5s} {r['confidence']*100:4.0f}% "
              f"{r['completeness']:6.3f} {nd:7d}  {expect}   ({ms:.0f}ms)")
        for d in r.get('defects', []):
            print(f"      - [{d.get('severity','?'):8s}] {d.get('type','?')} @ {d.get('location','?')}")
    except Exception as e:
        print(f"{label:22s} {cat:11s}  ERROR: {e}")
