#!/usr/bin/env python3
"""
ml/setup_and_train.py
----------------------
One-shot setup script:
  1. Installs all ML dependencies
  2. Trains the GBDT prevention model (synthetic data, no download needed)
  3. Trains the LightGBM price model (synthetic Mercari-format data, no download needed)
  4. Pre-grades demo items into cache
  5. Prints a readiness report

Usage:
    python ml/setup_and_train.py
    python ml/setup_and_train.py --skip-install   # if deps already installed
"""
from __future__ import annotations
import subprocess
import sys
import logging
import json
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ROOT = Path(__file__).parent.parent
ML_DIR = Path(__file__).parent
ARTIFACTS_DIR = ML_DIR / "artifacts"


def pip_install(packages: list[str]):
    cmd = [sys.executable, "-m", "pip", "install", "--quiet"] + packages
    logger.info(f"Installing: {' '.join(packages)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.warning(f"pip install warning:\n{result.stderr[-500:]}")
    else:
        logger.info("  ✓ Installed")


def install_core_deps():
    """Install the essential ML dependencies that don't require GPU."""
    packages = [
        "numpy",
        "scipy",
        "pandas",
        "scikit-learn",
        "lightgbm",
        "implicit",
        "Pillow",
        "openai",
        "anthropic",
        "boto3",
        "redis",
        "qrcode[pil]",
        "python-dotenv",
        "tqdm",
        "requests",
    ]
    pip_install(packages)

    # PyTorch (CPU — smaller download for dev)
    logger.info("Installing PyTorch (CPU)…")
    subprocess.run([
        sys.executable, "-m", "pip", "install", "--quiet",
        "torch", "torchvision", "--index-url",
        "https://download.pytorch.org/whl/cpu"
    ], capture_output=True)

    # Transformers for DINO
    pip_install(["transformers>=4.38.0", "accelerate"])

    # OpenCV
    pip_install(["opencv-python"])

    # CLIP
    logger.info("Installing CLIP…")
    result = subprocess.run([
        sys.executable, "-m", "pip", "install", "--quiet",
        "git+https://github.com/openai/CLIP.git"
    ], capture_output=True, text=True)
    if result.returncode != 0:
        logger.info("  openai-clip failed, trying open_clip…")
        pip_install(["open_clip_torch"])


def train_prevention_model():
    logger.info("\n--- Training GBDT prevention model ---")
    script = ML_DIR / "notebooks" / "train_prevention.py"
    result = subprocess.run(
        [sys.executable, str(script), "--rows", "50000"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    if result.returncode == 0:
        logger.info("  ✓ Prevention model trained")
        if result.stdout:
            print(result.stdout.strip())
    else:
        logger.warning(f"  Prevention training error:\n{result.stderr[-500:]}")


def train_price_model_synthetic():
    """Train price model on synthetic data (no Kaggle needed for local dev)."""
    logger.info("\n--- Training price model (synthetic data) ---")
    # Generate synthetic data first
    data_path = ROOT / "data" / "mercari_train.tsv"
    if not data_path.exists():
        logger.info("  Generating synthetic Mercari data…")
        sys.path.insert(0, str(ROOT))
        from data.download_datasets import _create_synthetic_mercari
        _create_synthetic_mercari(data_path, n=10_000)

    script = ML_DIR / "notebooks" / "train_price_model.py"
    result = subprocess.run(
        [sys.executable, str(script), "--data", str(data_path), "--sample", "10000"],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    if result.returncode == 0:
        logger.info("  ✓ Price model trained (synthetic — run with real Mercari data for better RMSLE)")
        if result.stdout:
            print(result.stdout.strip())
    else:
        logger.warning(f"  Price training error:\n{result.stderr[-500:]}")


def pregrade_demo_items():
    logger.info("\n--- Pre-grading demo items ---")
    script = ML_DIR / "pregrade_demo.py"
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True, text=True, cwd=str(ROOT)
    )
    if result.returncode == 0:
        logger.info("  ✓ Demo items pre-graded")
    else:
        logger.warning(f"  Pre-grade error:\n{result.stderr[-300:]}")
        logger.info("  (This is OK if LLM API key not set — set ANTHROPIC_API_KEY and re-run)")


def print_readiness_report():
    logger.info("\n" + "="*60)
    logger.info("REVIVE ML Readiness Report")
    logger.info("="*60)

    checks = {
        "price_model.pkl": ARTIFACTS_DIR / "price_model.pkl",
        "risk_model.pkl":  ARTIFACTS_DIR / "risk_model.pkl",
        "grade_cache.json": ARTIFACTS_DIR / "grade_cache.json",
        "als_user_factors.pkl (optional)": ARTIFACTS_DIR / "als_user_factors.pkl",
    }

    for name, path in checks.items():
        status = "✅" if path.exists() else "⚠️ "
        logger.info(f"  {status} {name}: {path.exists()}")

    logger.info("\nImportable functions:")
    try:
        sys.path.insert(0, str(ROOT))
        from ml.grade import grade_image
        logger.info("  ✅ grade_image() — ready")
    except Exception as e:
        logger.info(f"  ⚠️  grade_image() — {e}")

    try:
        from ml.route import route_item
        logger.info("  ✅ route_item() — ready")
    except Exception as e:
        logger.info(f"  ⚠️  route_item() — {e}")

    try:
        from ml.prevent import score_risk
        logger.info("  ✅ score_risk() — ready")
    except Exception as e:
        logger.info(f"  ⚠️  score_risk() — {e}")

    try:
        from ml.recommend import recommend
        logger.info("  ✅ recommend() — ready")
    except Exception as e:
        logger.info(f"  ⚠️  recommend() — {e}")

    logger.info("\nNext steps:")
    logger.info("  1. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY in .env")
    logger.info("  2. Run: python ml/pregrade_demo.py --images demo_items/")
    logger.info("  3. For real data: python data/download_datasets.py --mercari --amazon-reviews")
    logger.info("  4. Retrain: python ml/notebooks/train_price_model.py --data data/mercari_train.tsv")
    logger.info("  5. Retrain: python ml/notebooks/train_als.py --data data/amazon_reviews_electronics.jsonl")
    logger.info("="*60)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-install", action="store_true")
    parser.add_argument("--skip-train", action="store_true")
    parser.add_argument("--skip-pregrade", action="store_true")
    args = parser.parse_args()

    logger.info("🚀 REVIVE ML Setup")
    logger.info(f"   Root: {ROOT}")
    logger.info(f"   Artifacts: {ARTIFACTS_DIR}")

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    if not args.skip_install:
        logger.info("\n--- Installing dependencies ---")
        install_core_deps()

    if not args.skip_train:
        train_prevention_model()
        train_price_model_synthetic()

    if not args.skip_pregrade:
        pregrade_demo_items()

    print_readiness_report()


if __name__ == "__main__":
    main()
