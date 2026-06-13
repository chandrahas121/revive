"""
Comprehensive test: grade_multi_image() and grade_video()

Tests cover:
  1. Clean shoe - 3 angles -> should be Grade A/B, 0 defects
  2. Damaged t-shirt - front + back angles -> should catch the tear from at least one angle
  3. Clean jeans - multiple angles (no damage, no false positives)
  4. Wrong item - laptop photos on Footwear listing -> CLIP tanks completeness -> Grade C
  5. Clean smartphone - 2 angles
  6. Video: smooth 360 rotation of clean sneaker -> Grade A/B
  7. Video: mixed quality (clean + worn frame) -> worst-grade-wins
  8. Video: damaged clothing rotation -> Grade C or D
"""
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
from ml.grade import grade_multi_image, grade_video

Path('ml/artifacts/grade_cache.json').write_text('{}')


def dl(url: str) -> bytes:
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    urllib.request.urlretrieve(url, tmp.name)
    return Path(tmp.name).read_bytes()


def make_video(frame_bytes_list: list, fps: int = 10) -> str:
    """Build an MP4 from a list of JPEG byte strings (each frame repeated 5x for duration)."""
    frames = []
    for b in frame_bytes_list:
        arr = np.frombuffer(b, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        img = cv2.resize(img, (640, 480))
        frames.append(img)

    tmp = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
    tmp.close()
    out = cv2.VideoWriter(tmp.name, cv2.VideoWriter_fourcc(*'mp4v'), fps, (640, 480))
    for f in frames:
        for _ in range(5):
            out.write(f)
    out.release()
    return tmp.name


def print_result(label: str, r: dict, expect: str):
    nd = len(r.get('defects', []))
    source = r.get('source', 'image')
    nf = r.get('frames_sampled', 1)
    pfg = r.get('per_frame_grades', [])
    print()
    print("  " + label)
    print(f"  Source  : {source}  ({nf} frames/images)")
    print(f"  Grade   : {r['grade']}   confidence={r['confidence']:.0%}   completeness={r['completeness']:.3f}")
    print(f"  Defects : {nd}")
    for d in r.get('defects', []):
        print(f"    [{d.get('severity','?'):8s}] {d.get('type','?')} @ {d.get('location','?')}")
    if pfg:
        print(f"  Per-frame grades : {pfg}")
    print(f"  Expect  : {expect}")
    print(f"  Latency : {r.get('latency_ms', 0)} ms")


print("=" * 70)
print("MULTI-IMAGE + VIDEO GRADING - COMPREHENSIVE TEST")
print("=" * 70)


# ---------------------------------------------------------------------------
# SECTION 1: grade_multi_image()
# ---------------------------------------------------------------------------
print("\n\n-- SECTION 1: grade_multi_image() ----------------------------------")

# Test 1: Clean sneaker - 3 different angle images
print("\nDownloading Test 1 images (clean sneaker, 3 angles)...")
sneaker_urls = [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80",
    "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&q=80",
    "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=500&q=80",
]
sneaker_images = [dl(u) for u in sneaker_urls]

t0 = time.perf_counter()
r1 = grade_multi_image(sneaker_images, category="Footwear")
r1["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 1: Clean sneaker (3 angles)", r1, "Grade A or B, <=1 minor defect")

# Test 2: Worn/damaged clothing - front + back (one clearly worn angle)
print("\nDownloading Test 2 images (clothing, one damaged angle)...")
tshirt_urls = [
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80",  # clean shirt
    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&q=80",      # worn/faded shirt
]
tshirt_images = [dl(u) for u in tshirt_urls]

t0 = time.perf_counter()
r2 = grade_multi_image(tshirt_images, category="Clothing")
r2["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 2: T-shirt front+back (one damaged)", r2, "Grade C or D, >=1 defect detected")

# Test 3: Jeans - 3 angles, no damage (avoid distressed/ripped denim URLs)
print("\nDownloading Test 3 images (clean jeans, 3 angles)...")
jeans_urls = [
    "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=500&q=80",
    "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=500&q=80",
    "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&q=80",
]
jeans_images = [dl(u) for u in jeans_urls]

t0 = time.perf_counter()
r3 = grade_multi_image(jeans_images, category="Clothing")
r3["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 3: Clean jeans (3 angles, no damage)", r3, "Grade A or B, 0 false positives")

# Test 4: Wrong item - laptop on Footwear listing
print("\nDownloading Test 4 images (wrong item: laptop on Footwear listing)...")
wrong_urls = [
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&q=80",
    "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=500&q=80",
]
wrong_images = [dl(u) for u in wrong_urls]

t0 = time.perf_counter()
r4 = grade_multi_image(wrong_images, category="Footwear")
r4["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 4: Wrong item - laptop on Footwear listing", r4,
             "Grade C (completeness low ~0.35-0.50)")

# Test 5: Clean smartphone - 2 angles
print("\nDownloading Test 5 images (clean smartphone, 2 angles)...")
phone_urls = [
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80",
    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=500&q=80",
]
phone_images = [dl(u) for u in phone_urls]

t0 = time.perf_counter()
r5 = grade_multi_image(phone_images, category="Electronics")
r5["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 5: Clean smartphone (2 angles)", r5, "Grade A or B, <=1 minor defect")


# ---------------------------------------------------------------------------
# SECTION 2: grade_video()
# ---------------------------------------------------------------------------
print("\n\n-- SECTION 2: grade_video() -----------------------------------------")

# Test 6: Clean sneaker video (360 rotation)
print("\nBuilding Test 6 video (clean sneaker 360 rotation)...")
vid6_path = make_video(sneaker_images, fps=10)
print(f"  Video: {vid6_path} ({Path(vid6_path).stat().st_size // 1024} KB)")

t0 = time.perf_counter()
r6 = grade_video(vid6_path, category="Footwear", n_frames=5)
r6["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 6: Clean sneaker video (360 rotation, 5 frames)", r6,
             "Grade A or B, <=1 minor defect")

# Test 7: Mixed quality video - clean frames + worn shoe frame
print("\nDownloading worn shoe image for Test 7...")
worn_bytes = dl("https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=500&q=80")

print("Building Test 7 video (mostly clean + 1 worn frame)...")
mixed_frames = [sneaker_images[0], sneaker_images[1], worn_bytes, sneaker_images[2]]
vid7_path = make_video(mixed_frames, fps=10)
print(f"  Video: {vid7_path} ({Path(vid7_path).stat().st_size // 1024} KB)")

t0 = time.perf_counter()
r7 = grade_video(vid7_path, category="Footwear", n_frames=5)
r7["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 7: Mixed video - mostly clean + 1 worn frame (worst-grade-wins)", r7,
             "Grade B or C, >=1 defect (worn frame caught)")

# Test 8: Damaged clothing video (use worn angle repeated for emphasis)
print("\nBuilding Test 8 video (damaged clothing rotation)...")
damaged_frames = [tshirt_images[1], tshirt_images[0], tshirt_images[1]]
vid8_path = make_video(damaged_frames, fps=10)
print(f"  Video: {vid8_path} ({Path(vid8_path).stat().st_size // 1024} KB)")

t0 = time.perf_counter()
r8 = grade_video(vid8_path, category="Clothing", n_frames=4)
r8["latency_ms"] = round((time.perf_counter() - t0) * 1000)
print_result("Test 8: Damaged clothing video", r8, "Grade C or D, defect detected")


# ---------------------------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------------------------
print("\n\n" + "=" * 70)
print("SUMMARY")
print("=" * 70)
results = [
    ("Test 1", "Clean sneaker 3-angle",    r1, "A/B"),
    ("Test 2", "Torn t-shirt 2-angle",     r2, "C/D"),
    ("Test 3", "Clean jeans 3-angle",      r3, "A/B"),
    ("Test 4", "Wrong item (laptop)",      r4, "C"),
    ("Test 5", "Clean phone 2-angle",      r5, "A/B"),
    ("Test 6", "Clean sneaker video",      r6, "A/B"),
    ("Test 7", "Mixed quality video",      r7, "B/C"),
    ("Test 8", "Damaged clothing video",   r8, "C/D"),
]

print(f"\n{'#':>2}  {'test':30s} {'grade':5s} {'conf':>5s} {'compl':>6s} {'defects':>7s}  expect")
print("-" * 72)
for num, label, r, expect in results:
    nd = len(r.get('defects', []))
    print(f"{num:>2}  {label:30s} {r['grade']:5s} {r['confidence']*100:4.0f}%  "
          f"{r['completeness']:5.3f}  {nd:7d}  {expect}")

total_ms = sum(r.get('latency_ms', 0) for _, _, r, _ in results)
print(f"\nTotal wall time (8 tests): {total_ms/1000:.1f}s")
print("Done.")
