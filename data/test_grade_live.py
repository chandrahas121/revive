"""
Live test of grade_image() using real OpenRouter Claude Haiku call.
Uses a public image of a used Nike shoe for grading.
"""
import sys, os, time
sys.path.insert(0, '.')

# Load .env
from pathlib import Path
env_path = Path('.env')
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

print("LLM_PROVIDER   :", os.environ.get("LLM_PROVIDER", "NOT SET"))
print("OPENROUTER_MODEL:", os.environ.get("OPENROUTER_MODEL", "NOT SET"))
key = os.environ.get("OPENROUTER_API_KEY", "")
print("OPENROUTER_KEY :", key[:12] + "..." if key else "NOT SET")
print()

# Test with a real publicly available product image
TEST_IMAGE_URL = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"

# Download image to temp file
import urllib.request, tempfile
print(f"Downloading test image...")
tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
urllib.request.urlretrieve(TEST_IMAGE_URL, tmp.name)
print(f"Downloaded to: {tmp.name}")
print()

from ml.grade import grade_image
print(f"Grading (Nike shoe)...")
print()

t0 = time.perf_counter()
result = grade_image(tmp.name)
elapsed = (time.perf_counter() - t0) * 1000

print(f"Grade      : {result['grade']}")
print(f"Confidence : {result['confidence']:.0%}")
print(f"Latency    : {elapsed:.0f} ms")
print(f"Defects    : {len(result.get('defects', []))} detected")
print(f"Caption    : {result.get('condition_summary', 'none')}")
print(f"Cached     : {result.get('from_cache', False)}")
print()
if result.get('defects'):
    for d in result['defects']:
        print(f"  - {d.get('type','?')} [{d.get('severity','?')}] bbox={d.get('bbox','?')}")

# Grade it again — should hit cache (0ms)
print("\nRe-grading same image (should be cached ~0ms)...")
t1 = time.perf_counter()
result2 = grade_image(tmp.name)
elapsed2 = (time.perf_counter() - t1) * 1000
print(f"Grade: {result2['grade']} | Latency: {elapsed2:.1f} ms | Cached: {result2.get('from_cache', False)}")
