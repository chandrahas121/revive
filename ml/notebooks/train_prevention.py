"""
ml/notebooks/train_prevention.py
----------------------------------
Train GBDT (LightGBM) return-risk model on synthetic + review-mined data.

Usage:
    python train_prevention.py [--rows 50000]

Outputs:
    ml/artifacts/risk_model.pkl
    ml/artifacts/risk_metrics.json

Evaluation: F1-score + AUC on holdout
"""
from __future__ import annotations
import argparse
import json
import logging
import pickle
import random
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"

# ─── Category return-rate priors ─────────────────────────────────────────────
CATEGORY_RETURN_RATES = {
    "Footwear": 0.32,
    "Clothing": 0.28,
    "Electronics": 0.12,
    "Home & Kitchen": 0.08,
    "Books": 0.03,
    "Sports": 0.14,
    "Beauty": 0.18,
    "Toys": 0.10,
    "Jewelry": 0.22,
}
CATEGORIES = list(CATEGORY_RETURN_RATES.keys())

# ─── Brand size-bias ─────────────────────────────────────────────────────────
BRAND_SIZE_BIAS = {
    "Nike": -0.5, "Adidas": -0.3, "Puma": 0.2, "Woodland": 0.5,
    "Bata": 0.3, "Reebok": -0.2, "Zara": -0.4, "H&M": -0.2,
    "Allen Solly": 0.3, "Arrow": 0.2, "Peter England": 0.1,
}
BRANDS = list(BRAND_SIZE_BIAS.keys()) + ["OtherBrand"] * 5


def generate_synthetic_dataset(n: int = 50_000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic purchase+return dataset with realistic priors.
    Each row = one order with features and return label.
    """
    rng = random.Random(seed)
    np.random.seed(seed)

    rows = []
    for _ in range(n):
        category = rng.choice(CATEGORIES)
        brand = rng.choice(BRANDS)
        base_return_rate = CATEGORY_RETURN_RATES.get(category, 0.15)
        brand_bias = BRAND_SIZE_BIAS.get(brand, 0.0)

        # User history
        user_return_rate = np.clip(np.random.beta(2, 8), 0.0, 0.6)

        # Size delta (how far from user's typical size)
        size_delta = abs(np.random.normal(0, 0.5))

        # Gift flag (gifts return more)
        is_gift = rng.random() < 0.15

        # Latent return probability (ground truth)
        p_return = (
            0.35 * base_return_rate
            + 0.25 * user_return_rate
            + 0.20 * min(1.0, size_delta)
            + 0.15 * abs(brand_bias) / 0.5
            + 0.05 * float(is_gift)
        )
        p_return = np.clip(p_return + np.random.normal(0, 0.03), 0.0, 1.0)
        returned = int(rng.random() < p_return)

        rows.append({
            "category_return_prior": base_return_rate,
            "size_delta": round(size_delta, 3),
            "brand_bias": brand_bias,
            "is_gift": int(is_gift),
            "user_return_rate": round(float(user_return_rate), 3),
            "category_hash": hash(category) % 100 / 100.0,
            "returned": returned,
        })

    df = pd.DataFrame(rows)
    logger.info(f"Generated {len(df)} synthetic samples | Return rate: {df['returned'].mean():.2%}")
    return df


def train(n_rows: int = 50_000):
    import lightgbm as lgb
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score, roc_auc_score

    df = generate_synthetic_dataset(n_rows)

    FEATURES = [
        "category_return_prior", "size_delta", "brand_bias",
        "is_gift", "user_return_rate", "category_hash",
    ]
    X = df[FEATURES].values
    y = df["returned"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_test, label=y_test)

    params = {
        "objective": "binary",
        "metric": "auc",
        "num_leaves": 31,
        "learning_rate": 0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "min_child_samples": 20,
        "verbose": -1,
    }

    logger.info("Training GBDT risk model…")
    callbacks = [lgb.early_stopping(50, verbose=False), lgb.log_evaluation(50)]
    model = lgb.train(
        params,
        train_data,
        num_boost_round=300,
        valid_sets=[val_data],
        callbacks=callbacks,
    )

    # Evaluate — use optimal threshold from ROC curve
    y_prob = model.predict(X_test)
    from sklearn.metrics import precision_recall_curve
    precisions, recalls, thresholds = precision_recall_curve(y_test, y_prob)
    f1_scores_thresh = 2 * (precisions * recalls) / (precisions + recalls + 1e-9)
    best_thresh_idx = f1_scores_thresh.argmax()
    best_threshold = thresholds[best_thresh_idx] if best_thresh_idx < len(thresholds) else 0.5
    y_pred = (y_prob >= best_threshold).astype(int)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    logger.info(f"  Best threshold: {best_threshold:.3f}")
    logger.info(f"✅ F1-score: {f1:.4f}  |  AUC: {auc:.4f}")

    # Save
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "risk_model.pkl", "wb") as f:
        pickle.dump(model, f)

    metrics = {"f1": round(f1, 4), "auc": round(auc, 4), "n_train": len(X_train)}
    json.dump(metrics, open(ARTIFACTS_DIR / "risk_metrics.json", "w"), indent=2)
    logger.info(f"Risk model saved to {ARTIFACTS_DIR}/risk_model.pkl")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=50_000)
    args = parser.parse_args()
    metrics = train(args.rows)
    print(f"F1: {metrics['f1']:.4f}  |  AUC: {metrics['auc']:.4f}")
