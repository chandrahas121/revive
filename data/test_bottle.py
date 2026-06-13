import sys, os, time
sys.path.insert(0, '.')
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

Path('ml/artifacts/grade_cache.json').write_text('{}')

from ml.grade import grade_image
from ml.heatmap import save_heatmap

img_path = 'data/bottle.jpeg'
print('Grading:', img_path)
print()

t0 = time.perf_counter()
result = grade_image(img_path, category='Home & Kitchen')
ms = (time.perf_counter() - t0) * 1000

print('GRADE        :', result['grade'])
print('CONFIDENCE   :', '{:.0%}'.format(result['confidence']))
print('COMPLETENESS :', '{:.3f}'.format(result['completeness']))
print('SUMMARY      :', result.get('condition_summary', ''))
print('DEFECTS      :', len(result.get('defects', [])))
for d in result.get('defects', []):
    bbox = d.get('bbox')
    bbox_str = '[{:.0f},{:.0f},{:.0f},{:.0f}]'.format(*bbox) if bbox else 'no bbox'
    print('  [{:8s}] {:30s} @ {}  bbox={}  [{}]'.format(
        d.get('severity', '?'), d.get('type', '?'),
        d.get('location', '?'), bbox_str, d.get('source', 'llm')))
print('LATENCY      :', '{:.0f}ms'.format(ms))

Path('demo_output').mkdir(exist_ok=True)
image_bytes = open(img_path, 'rb').read()
out = 'demo_output/graded_bottle.jpg'
save_heatmap(image_bytes, result, out)
print()
print('HEATMAP saved:', out)
