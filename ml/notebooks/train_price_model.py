"""
ml/notebooks/train_price_model.py
----------------------------------
Train LightGBM price model on Mercari Price Suggestion dataset.

Usage:
    python train_price_model.py --data data/mercari_train.tsv --sample 300000

Output:
    ml/artifacts/price_model.pkl
    Report: RMSLE on holdout set
"""
from __future__ import annotations
import argparse
import logging
import math
import os
import pickle
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


# ─── Feature engineering ──────────────────────────────────────────────────────
CATEGORY_LEVELS = 3

def parse_category(cat_str: str, level: int) -> str:
    """Extract level-th segment from Mercari's / delimited category string."""
    if not isinstance(cat_str, str):
        return "unknown"
    parts = cat_str.split("/")
    return parts[level].strip() if len(parts) > level else "unknown"


CONDITION_MAP = {
    1: 5,  # New
    2: 4,  # Like New
    3: 3,  # Good
    4: 2,  # Fair
    5: 1,  # Poor
}

# Simple text feature: presence of brand mention
def has_brand(name_str: str, brand_str: str) -> int:
    if not isinstance(name_str, str) or not isinstance(brand_str, str):
        return 0
    return int(brand_str.lower() in name_str.lower())


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["name"] = df["name"].fillna("")
    df["brand_name"] = df["brand_name"].fillna("unknown")
    df["category_name"] = df["category_name"].fillna("unknown/unknown/unknown")
    df["item_description"] = df["item_description"].fillna("")
    df["item_condition_id"] = df["item_condition_id"].fillna(3).astype(int)
    df["shipping"] = df["shipping"].fillna(0).astype(int)

    # Category levels
    for i in range(CATEGORY_LEVELS):
        df[f"cat_{i}"] = df["category_name"].apply(lambda c: parse_category(c, i))

    # Condition ordinal
    df["condition_ord"] = df["item_condition_id"].map(CONDITION_MAP).fillna(3)

    # Name length features
    df["name_len"] = df["name"].apply(len)
    df["desc_len"] = df["item_description"].apply(len)

    # Brand mentioned in name?
    df["brand_in_name"] = df.apply(
        lambda r: has_brand(r["name"], r["brand_name"]), axis=1
    )

    # Has description?
    df["has_desc"] = (df["item_description"] != "No description yet").astype(int)

    return df


def label_encode_categoricals(df: pd.DataFrame, cat_cols: list, fit: bool, encoders: dict = None):
    """Simple label encoding using pandas Categorical."""
    if encoders is None:
        encoders = {}
    for col in cat_cols:
        if fit:
            df[col] = df[col].astype("category")
            encoders[col] = df[col].cat.categories.tolist()
        else:
            mapping = {v: i for i, v in enumerate(encoders.get(col, []))}
            df[col] = df[col].map(mapping).fillna(-1).astype(int)
            continue
        df[col] = df[col].cat.codes
    return df, encoders


FEATURE_COLS = [
    "cat_0", "cat_1", "cat_2",
    "brand_name",
    "condition_ord", "shipping",
    "name_len", "desc_len",
    "brand_in_name", "has_desc",
]
CAT_COLS = ["cat_0", "cat_1", "cat_2", "brand_name"]


# ─── Training ─────────────────────────────────────────────────────────────────
def train(data_path: str, sample: int = 300_000, test_size: float = 0.1):
    import lightgbm as lgb
    from sklearn.model_selection import train_test_split

    logger.info(f"Loading data from {data_path}…")
    df = pd.read_csv(data_path, sep="\t", nrows=sample if sample > 0 else None)

    # Remove zero-price items (can't log)
    df = df[df["price"] > 0].reset_index(drop=True)
    logger.info(f"After filtering: {len(df)} rows")

    df = build_features(df)
    df, encoders = label_encode_categoricals(df, CAT_COLS, fit=True)

    y = np.log1p(df["price"].values)  # RMSLE target
    X = df[FEATURE_COLS].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    train_data = lgb.Dataset(X_train, label=y_train)
    val_data = lgb.Dataset(X_test, label=y_test)

    params = {
        "objective": "regression",
        "metric": "rmse",
        "num_leaves": 63,
        "learning_rate": 0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "n_estimators": 500,
        "verbose": -1,
        "num_threads": os.cpu_count() or 4,
    }

    logger.info("Training LightGBM…")
    callbacks = [lgb.early_stopping(50), lgb.log_evaluation(50)]
    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[val_data],
        callbacks=callbacks,
    )

    # Evaluate
    y_pred = model.predict(X_test)
    rmsle = math.sqrt(np.mean((y_pred - y_test) ** 2))
    logger.info(f"✅ RMSLE on holdout: {rmsle:.4f}")

    # Save model + encoders
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    artifact = {"model": model, "encoders": encoders, "feature_cols": FEATURE_COLS}
    artifact_path = ARTIFACTS_DIR / "price_model.pkl"
    with open(artifact_path, "wb") as f:
        pickle.dump(artifact, f)
    logger.info(f"Model saved to {artifact_path}")

    # Save metrics
    metrics_path = ARTIFACTS_DIR / "price_metrics.json"
    import json
    json.dump({"rmsle": rmsle, "n_train": len(X_train), "n_test": len(X_test)},
              open(metrics_path, "w"), indent=2)
    logger.info(f"Metrics saved to {metrics_path}")
    return rmsle


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train LightGBM price model on Mercari data")
    parser.add_argument("--data", required=True, help="Path to mercari_train.tsv")
    parser.add_argument("--sample", type=int, default=300_000, help="Max rows to load (0=all)")
    args = parser.parse_args()
    rmsle = train(args.data, sample=args.sample)
    print(f"Final RMSLE: {rmsle:.4f}")
