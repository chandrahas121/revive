"""
ml/image_dedup.py
-----------------
v2 duplicate / angle integrity (final_idea_v2.md §4.2, fixes Q6).

Sellers/agents must not fill every angle slot with the same photo. This module
computes a perceptual hash (dHash, 64-bit) per image and flags near-duplicate
uploads via Hamming distance. Pure-Pillow, no extra dependency.

Usage:
    from ml.image_dedup import find_duplicates, dhash
    dups = find_duplicates([bytes1, bytes2, ...])  # -> [(i, j, distance), ...]
"""
from __future__ import annotations
import io
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger(__name__)

# Two images whose dHash differ by <= this many bits are "the same shot".
DUP_HAMMING_THRESHOLD = 6


def dhash(image_bytes: bytes, hash_size: int = 8) -> Optional[int]:
    """64-bit difference hash of an image. Returns None on failure (0 is a VALID
    hash for a perfectly uniform image, so it must not signal failure)."""
    try:
        from PIL import Image
        img = (Image.open(io.BytesIO(image_bytes))
               .convert("L")
               .resize((hash_size + 1, hash_size), Image.LANCZOS))
        px = list(img.getdata())
        w = hash_size + 1
        bits = 0
        idx = 0
        for row in range(hash_size):
            for col in range(hash_size):
                left = px[row * w + col]
                right = px[row * w + col + 1]
                bits |= (1 << idx) if left > right else 0
                idx += 1
        return bits
    except Exception as e:
        logger.warning(f"[image_dedup] dhash failed: {e}")
        return None


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def find_duplicates(image_bytes_list: List[bytes],
                    threshold: int = DUP_HAMMING_THRESHOLD) -> List[Tuple[int, int, int]]:
    """
    Return [(i, j, distance), ...] for every pair of near-identical images.
    Images that failed to hash (0) are skipped.
    """
    hashes = [dhash(b) for b in image_bytes_list]
    dups: List[Tuple[int, int, int]] = []
    for i in range(len(hashes)):
        if hashes[i] is None:
            continue
        for j in range(i + 1, len(hashes)):
            if hashes[j] is None:
                continue
            d = hamming(hashes[i], hashes[j])
            if d <= threshold:
                dups.append((i, j, d))
    return dups


def has_duplicates(image_bytes_list: List[bytes],
                   threshold: int = DUP_HAMMING_THRESHOLD) -> bool:
    return len(find_duplicates(image_bytes_list, threshold)) > 0
