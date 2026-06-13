import sys, os, shutil, time
sys.path.insert(0, '.')
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

# Clear cache
Path('ml/artifacts/grade_cache.json').write_text('{}')

# Use the generated torn t-shirt image
src = r"C:\Users\chand\.gemini\antigravity-ide\brain\7db68ba9-04fb-4e3b-b8f1-c537b47ee451\torn_tshirt_test_1781332490362.png"
dest = "demo_output/test_torn_tshirt.png"
Path('demo_output').mkdir(exist_ok=True)
shutil.copy(src, dest)

print("=" * 65)
print("Testing: Torn T-shirt (Clothing) — significant damage")
print("=" * 65)
print(f"Image: {dest}")
print(f"Size : {Path(dest).stat().st_size // 1024} KB")

from ml.grade import grade_image
from ml.heatmap import save_heatmap

t0 = time.perf_counter()
result = grade_image(dest, category='Clothing')
ms = (time.perf_counter() - t0) * 1000

print(f"\nGRADE        : {result['grade']}")
print(f"CONFIDENCE   : {result['confidence']:.0%}")
print(f"COMPLETENESS : {result['completeness']:.3f}")
print(f"SUMMARY      : {result.get('condition_summary', '')}")
print(f"DEFECTS      : {len(result.get('defects', []))}")
for d in result.get('defects', []):
    bbox = d.get('bbox')
    bbox_str = f"[{bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}]" if bbox else "no bbox"
    src_tag = d.get('source', 'llm')
    print(f"  [{d.get('severity','?'):8s}] {d.get('type','?'):30s} @ {d.get('location','?')}  bbox={bbox_str}  [{src_tag}]")
print(f"LATENCY      : {ms:.0f}ms")

# Save heatmap
image_bytes = open(dest, 'rb').read()
out_path = 'demo_output/graded_torn_tshirt.jpg'
save_heatmap(image_bytes, result, out_path)
print(f"\nHEATMAP saved: {out_path}")
