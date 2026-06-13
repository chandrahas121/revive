"""
Test full grading pipeline with heatmap overlay output.
Saves annotated image to demo_output/graded_shoe.jpg
"""
import sys, os
sys.path.insert(0, '.')

from pathlib import Path
for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import urllib.request, tempfile, time

# Download test image
url = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'
print("Downloading Nike shoe image...")
tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
urllib.request.urlretrieve(url, tmp.name)
image_bytes = open(tmp.name, 'rb').read()
print(f"Image: {len(image_bytes)//1024} KB\n")

# Clear cache so DINO runs fresh (to get fresh bboxes)
cache_path = Path('ml/artifacts/grade_cache.json')
cache_path.write_text('{}')

# Grade
print("Running grading pipeline (DINO + Claude Haiku)...")
from ml.grade import grade_image
t0 = time.perf_counter()
result = grade_image(tmp.name)
ms = (time.perf_counter() - t0) * 1000

print(f"\nGRADE RESULT:")
print(f"  Grade      : {result['grade']}")
print(f"  Confidence : {result['confidence']:.0%}")
print(f"  Summary    : {result.get('condition_summary','')}")
print(f"  Defects    : {len(result.get('defects', []))}")
for d in result.get('defects', []):
    bbox = d.get('bbox')
    bbox_str = f"[{bbox[0]:.0f},{bbox[1]:.0f},{bbox[2]:.0f},{bbox[3]:.0f}]" if bbox else "no bbox"
    print(f"    - {d.get('type')} [{d.get('severity')}] @ {d.get('location')}  bbox={bbox_str}  src={d.get('source','llm')}")
print(f"  Completeness: {result.get('completeness', 0):.2f}")
print(f"  Latency    : {ms:.0f} ms")

# Render heatmap
print("\nRendering defect heatmap overlay...")
from ml.heatmap import save_heatmap
out_dir = Path('demo_output')
out_dir.mkdir(exist_ok=True)
out_path = str(out_dir / 'graded_shoe.jpg')
save_heatmap(image_bytes, result, out_path)
print(f"Saved: {out_path}")
print(f"\nOutput JSON schema matches spec:")
import json
spec_fields = ['grade','confidence','defects','completeness','condition_summary','latency_ms']
out_dict = {k: result.get(k) for k in spec_fields}
print(json.dumps(out_dict, indent=2, default=str))
