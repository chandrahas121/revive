import sys, os, urllib.request, tempfile, time, json
sys.path.insert(0, '.')
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

# Clear cache for a fresh run
Path('ml/artifacts/grade_cache.json').write_text('{}')

# Torn/damaged denim jacket from Unsplash — visible fabric damage, distressing, tears
# Using a heavily distressed denim image
TEST_IMAGES = [
    # Distressed/ripped denim jeans - clear visible tears
    ("torn_denim",    "Clothing", "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=800&q=90"),
    # Worn out old shoe - scuffs and damage
    ("worn_shoe",     "Footwear", "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=90"),
]

from ml.grade import grade_image
from ml.heatmap import save_heatmap

out_dir = Path('demo_output')
out_dir.mkdir(exist_ok=True)

for name, category, url in TEST_IMAGES:
    print("=" * 65)
    print(f"Testing: {name} ({category})")
    print(f"URL: {url[:70]}...")
    print("=" * 65)

    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    try:
        urllib.request.urlretrieve(url, tmp.name)
        print(f"Downloaded: {Path(tmp.name).stat().st_size // 1024} KB")
    except Exception as e:
        print(f"Download failed: {e}")
        continue

    t0 = time.perf_counter()
    result = grade_image(tmp.name, category=category)
    ms = (time.perf_counter() - t0) * 1000

    print(f"\nGRADE       : {result['grade']}")
    print(f"CONFIDENCE  : {result['confidence']:.0%}")
    print(f"COMPLETENESS: {result['completeness']:.3f} (real CLIP)")
    print(f"SUMMARY     : {result.get('condition_summary', '')}")
    print(f"DEFECTS     : {len(result.get('defects', []))}")
    for d in result.get('defects', []):
        bbox = d.get('bbox')
        bbox_str = f"[{bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}]" if bbox else "no bbox"
        print(f"  [{d.get('severity','?'):8s}] {d.get('type','?'):30s} @ {d.get('location','?')}  {bbox_str}")
    print(f"LATENCY     : {ms:.0f}ms")

    # Save heatmap
    image_bytes = open(tmp.name, 'rb').read()
    out_path = str(out_dir / f'graded_{name}.jpg')
    save_heatmap(image_bytes, result, out_path)
    print(f"HEATMAP     : {out_path}")
    print()
