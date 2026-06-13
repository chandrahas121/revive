"""
Run all 5 demo items and save heatmaps to demo_output/.
  1. phone.jpeg      (Electronics)
  2. bottle.jpeg     (Home & Kitchen)
  3. Nike shoe       (Footwear - pristine)
  4. worn denim      (Clothing - distressed)
  5. torn t-shirt    (Clothing - damaged)
"""
import sys, os, urllib.request, tempfile, time, shutil
sys.path.insert(0, '.')
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

Path('ml/artifacts/grade_cache.json').write_text('{}')
Path('demo_output').mkdir(exist_ok=True)

from ml.grade import grade_image
from ml.heatmap import save_heatmap

TSHIRT_LOCAL = r"C:\Users\chand\.gemini\antigravity-ide\brain\7db68ba9-04fb-4e3b-b8f1-c537b47ee451\torn_tshirt_test_1781332490362.png"

ITEMS = [
    ("phone",      "Electronics",    "local:data/phone.jpeg"),
    ("bottle",     "Home & Kitchen", "local:data/bottle.jpeg"),
    ("shoe",       "Footwear",       "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=90"),
    ("torn_denim", "Clothing",       "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&q=90"),
    ("torn_tshirt","Clothing",       "local:" + TSHIRT_LOCAL),
]


def get_image_path(src):
    if src.startswith("local:"):
        return src[6:]
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    urllib.request.urlretrieve(src, tmp.name)
    return tmp.name


print("=" * 65)
print("REVIVE — All Demo Items Grading Run")
print("=" * 65)

for name, category, src in ITEMS:
    print()
    print("-" * 65)
    print("Item    :", name)
    print("Category:", category)

    try:
        img_path = get_image_path(src)
        size_kb = Path(img_path).stat().st_size // 1024
        print("Size    : {} KB".format(size_kb))
    except Exception as e:
        print("ERROR loading image:", e)
        continue

    t0 = time.perf_counter()
    result = grade_image(img_path, category=category)
    ms = (time.perf_counter() - t0) * 1000

    print("GRADE   :", result['grade'])
    print("CONF    :", '{:.0%}'.format(result['confidence']))
    print("COMPLET :", '{:.3f}'.format(result['completeness']))
    print("SUMMARY :", result.get('condition_summary', ''))
    print("DEFECTS :", len(result.get('defects', [])))
    for d in result.get('defects', []):
        bbox = d.get('bbox')
        bbox_str = '[{:.0f},{:.0f},{:.0f},{:.0f}]'.format(*bbox) if bbox else 'no bbox'
        print("  [{:8s}] {:30s} @ {}  {}  [{}]".format(
            d.get('severity', '?'), d.get('type', '?'),
            d.get('location', '?'), bbox_str, d.get('source', 'llm')))
    print("LATENCY :", '{:.0f}ms'.format(ms))

    image_bytes = open(img_path, 'rb').read()
    out = 'demo_output/graded_{}.jpg'.format(name)
    save_heatmap(image_bytes, result, out)
    print("HEATMAP :", out)

print()
print("=" * 65)
print("Done. All heatmaps saved to demo_output/")
print("=" * 65)
