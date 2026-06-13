import sys, os, urllib.request, tempfile, time
sys.path.insert(0, '.')
from pathlib import Path

for line in Path('.env').read_text().splitlines():
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import cv2
import numpy as np

# Download shoe image and build a short test MP4
url = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'
tmp_img = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
urllib.request.urlretrieve(url, tmp_img.name)
frame = cv2.imread(tmp_img.name)
frame = cv2.resize(frame, (640, 480))

tmp_vid = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
tmp_vid.close()
out = cv2.VideoWriter(tmp_vid.name, cv2.VideoWriter_fourcc(*'mp4v'), 30, (640, 480))
for i in range(15):
    factor = 0.85 + 0.15 * (i / 15)
    varied = np.clip(frame * factor, 0, 255).astype(np.uint8)
    out.write(varied)
out.release()
print(f"Created test video: {tmp_vid.name}")
print(f"Video size: {Path(tmp_vid.name).stat().st_size // 1024} KB, 15 frames @ 30fps")

# Smoke test grade_video
from ml.grade import grade_video
t0 = time.perf_counter()
result = grade_video(tmp_vid.name, category='Footwear', n_frames=3)
ms = (time.perf_counter() - t0) * 1000

print("\ngrade_video() result:")
print(f"  grade            : {result.get('grade')}")
print(f"  confidence       : {result.get('confidence', 0):.0%}")
print(f"  frames_sampled   : {result.get('frames_sampled')}")
print(f"  per_frame_grades : {result.get('per_frame_grades', [])}")
print(f"  completeness     : {result.get('completeness', 0):.3f}")
print(f"  defects          : {len(result.get('defects', []))}")
print(f"  condition_summary: {result.get('condition_summary', '')}")
print(f"  source           : {result.get('source')}")
print(f"  total latency    : {ms:.0f}ms")

spec_fields = ['grade', 'confidence', 'defects', 'completeness',
               'condition_summary', 'source', 'frames_sampled', 'per_frame_grades']
missing = [f for f in spec_fields if f not in result]
print()
if not missing:
    print("PASS — grade_video schema complete")
    print("VIDEO PART IS READY")
else:
    print(f"FAIL — missing fields: {missing}")
