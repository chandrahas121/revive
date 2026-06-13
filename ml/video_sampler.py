"""
ml/video_sampler.py
--------------------
OpenCV-based video frame sampler.
Extracts N evenly-spaced frames from a video clip as JPEG bytes.

Usage:
    from ml.video_sampler import sample_frames
    frames = sample_frames("shoe_video.mp4", n=5)
    # frames: list[bytes]  — JPEG bytes, ready for grade_image()
"""
from __future__ import annotations
import io
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


def sample_frames(video_path: str, n: int = 5) -> List[bytes]:
    """
    Sample N evenly-distributed frames from a video file.

    Args:
        video_path: Path to video file (MP4, MOV, AVI, etc.)
        n:          Number of frames to extract (default 5).

    Returns:
        List of JPEG-encoded frame bytes. Empty list on error.
    """
    try:
        import cv2
    except ImportError:
        logger.error("[video_sampler] opencv-python not installed. pip install opencv-python")
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"[video_sampler] Cannot open video: {video_path}")
        return []

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    duration_s = total_frames / fps

    logger.info(
        f"[video_sampler] {video_path}: {total_frames} frames, "
        f"{fps:.1f} fps, {duration_s:.1f}s — extracting {n} frames"
    )

    if total_frames == 0:
        cap.release()
        return []

    n_actual = min(n, total_frames)
    # Evenly space frame indices, avoiding exact first/last
    step = max(1, total_frames // (n_actual + 1))
    frame_indices = [step * (i + 1) for i in range(n_actual)]
    frame_indices = [min(idx, total_frames - 1) for idx in frame_indices]

    frames: List[bytes] = []
    for idx in frame_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret:
            logger.warning(f"[video_sampler] Could not read frame {idx}")
            continue

        # Encode to JPEG bytes
        success, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        if success:
            frames.append(bytes(buf))
        else:
            logger.warning(f"[video_sampler] Failed to encode frame {idx}")

    cap.release()
    logger.info(f"[video_sampler] Extracted {len(frames)} frames.")
    return frames


def sample_frames_at_timestamps(
    video_path: str,
    timestamps_s: Optional[List[float]] = None,
) -> List[bytes]:
    """
    Extract frames at specific timestamps (seconds).
    Useful for controlled demo extraction.
    """
    try:
        import cv2
    except ImportError:
        return []

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames: List[bytes] = []

    for ts in (timestamps_s or []):
        frame_idx = int(ts * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if ret:
            success, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if success:
                frames.append(bytes(buf))

    cap.release()
    return frames
