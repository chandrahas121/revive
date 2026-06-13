"""
ml/notebooks/train_als.py
--------------------------
Train Implicit ALS recommender on Amazon Reviews 2023 dataset.

Usage:
    python train_als.py --data data/amazon_reviews_electronics.jsonl --factors 64

Outputs:
    ml/artifacts/als_user_factors.pkl
    ml/artifacts/als_item_factors.pkl
    ml/artifacts/als_user_id_map.pkl
    ml/artifacts/als_item_id_map.pkl
    ml/artifacts/als_metrics.json

Evaluation: leave-last-out → Recall@20 / NDCG@20
"""
from __future__ import annotations
import argparse
import json
import logging
import math
import pickle
import random
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"


# ─── Data loading ─────────────────────────────────────────────────────────────
def load_reviews_jsonl(path: str, max_rows: int = 500_000) -> pd.DataFrame:
    """Load Amazon Reviews 2023 JSONL format."""
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f):
            if max_rows > 0 and i >= max_rows:
                break
            try:
                r = json.loads(line)
                rows.append({
                    "user_id": r.get("user_id", r.get("reviewerID", "")),
                    "item_id": r.get("asin", r.get("parent_asin", "")),
                    "rating": float(r.get("rating", r.get("overall", 3.0))),
                    "timestamp": r.get("timestamp", r.get("unixReviewTime", 0)),
                })
            except Exception:
                continue
    df = pd.DataFrame(rows)
    logger.info(f"Loaded {len(df)} reviews from {path}")
    return df


def load_reviews_csv(path: str, max_rows: int = 500_000) -> pd.DataFrame:
    """Load Amazon Reviews in CSV format."""
    df = pd.read_csv(path, nrows=max_rows if max_rows > 0 else None)
    # Normalize column names
    rename = {}
    for col in df.columns:
        lc = col.lower()
        if lc == "user_id":
            rename[col] = "user_id"
        elif lc in ("asin", "parent_asin", "item_id", "product_id"):
            rename[col] = "item_id"
        elif lc in ("rating", "overall", "stars"):
            rename[col] = "rating"
        elif "time" in lc or "stamp" in lc:
            rename[col] = "timestamp"
    df = df.rename(columns=rename)
    for col in ["user_id", "item_id", "rating"]:
        if col not in df.columns:
            df[col] = "unknown" if col != "rating" else 3.0
    if "timestamp" not in df.columns:
        df["timestamp"] = range(len(df))
    logger.info(f"Loaded {len(df)} reviews from {path}")
    return df[["user_id", "item_id", "rating", "timestamp"]].head(max_rows)


# ─── 5-core filtering (users+items with ≥5 interactions) ────────────────────
def five_core_filter(df: pd.DataFrame, min_count: int = 5) -> pd.DataFrame:
    for _ in range(10):  # iterate until stable
        n_before = len(df)
        user_counts = df["user_id"].value_counts()
        item_counts = df["item_id"].value_counts()
        df = df[
            df["user_id"].isin(user_counts[user_counts >= min_count].index) &
            df["item_id"].isin(item_counts[item_counts >= min_count].index)
        ]
        if len(df) == n_before:
            break
    logger.info(f"After 5-core: {len(df)} interactions, "
                f"{df['user_id'].nunique()} users, {df['item_id'].nunique()} items")
    return df.reset_index(drop=True)


# ─── Leave-last-out split ────────────────────────────────────────────────────
def leave_last_out_split(df: pd.DataFrame):
    """For each user, hold out their last interaction as test."""
    df = df.sort_values(["user_id", "timestamp"], ascending=True)
    test_mask = df.groupby("user_id").cumcount(ascending=False) == 0
    train_df = df[~test_mask]
    test_df = df[test_mask]
    logger.info(f"Train: {len(train_df)} | Test: {len(test_df)}")
    return train_df, test_df


# ─── Build sparse matrix ──────────────────────────────────────────────────────
def build_sparse(df: pd.DataFrame, user_map: dict, item_map: dict) -> sp.csr_matrix:
    users = df["user_id"].map(user_map).values
    items = df["item_id"].map(item_map).values
    ratings = df["rating"].values.astype(np.float32)
    return sp.csr_matrix(
        (ratings, (users, items)),
        shape=(len(user_map), len(item_map)),
    )


# ─── Evaluation ──────────────────────────────────────────────────────────────
def evaluate(model, train_df: pd.DataFrame, test_df: pd.DataFrame,
             user_map: dict, item_map: dict, k: int = 20) -> dict:
    """Compute Recall@k and NDCG@k on test set (leave-last-out)."""
    # implicit model: user_factors shape = (n_users, factors), item_factors = (n_items, factors)
    # But we trained on item_user_matrix (items × users), so implicit swaps them internally
    # user_factors[u] gives user u embedding; item_factors[i] gives item i embedding
    user_factors = model.user_factors  # shape: (n_items in item_user_matrix, factors)
    item_factors = model.item_factors  # shape: (n_users in item_user_matrix, factors)
    # Since we passed item_user_matrix (items × users), implicit's internal naming is:
    # model.user_factors = item embeddings (rows of item_user_matrix)
    # model.item_factors = user embeddings (columns of item_user_matrix)
    # Let's re-name clearly:
    item_emb = user_factors  # (n_items, factors)
    user_emb = item_factors  # (n_users, factors)

    n_items = item_emb.shape[0]
    n_users = user_emb.shape[0]

    recalls, ndcgs = [], []
    test_users = test_df["user_id"].unique()
    sample_users = test_users[:min(500, len(test_users))]  # sample for speed

    inv_item_map = {v: k for k, v in item_map.items()}

    for uid in sample_users:
        u_idx = user_map.get(uid)
        if u_idx is None or u_idx >= n_users:
            continue

        # Items user interacted with in train
        train_items = set(train_df[train_df["user_id"] == uid]["item_id"].values)
        # Ground truth
        gt_items = set(test_df[test_df["user_id"] == uid]["item_id"].values)

        if not gt_items:
            continue

        # Score all items: items × user_vec
        scores = item_emb @ user_emb[u_idx]  # (n_items,)

        # Mask train items
        for iid in train_items:
            i_idx = item_map.get(iid)
            if i_idx is not None and i_idx < n_items:
                scores[i_idx] = -np.inf

        top_k = np.argsort(scores)[::-1][:k]
        rec_items = {inv_item_map.get(i) for i in top_k}

        # Recall@k
        hits = len(rec_items & gt_items)
        recall = hits / len(gt_items)
        recalls.append(recall)

        # NDCG@k
        dcg = 0.0
        idcg = sum(1.0 / math.log2(i + 2) for i in range(min(len(gt_items), k)))
        for rank, i_idx in enumerate(top_k):
            if inv_item_map.get(i_idx) in gt_items:
                dcg += 1.0 / math.log2(rank + 2)
        ndcgs.append(dcg / idcg if idcg > 0 else 0.0)

    return {
        f"Recall@{k}": round(float(np.mean(recalls)), 4) if recalls else 0.0,
        f"NDCG@{k}": round(float(np.mean(ndcgs)), 4) if ndcgs else 0.0,
    }


# ─── Main training ────────────────────────────────────────────────────────────
def train(data_path: str, factors: int = 64, iterations: int = 20,
          regularization: float = 0.01, max_rows: int = 500_000):
    import implicit
    from implicit.als import AlternatingLeastSquares

    # Detect file format by peeking at content (ignore misleading extension)
    path = Path(data_path)

    def _is_csv(p: Path) -> bool:
        with open(p, "r", encoding="utf-8", errors="replace") as fh:
            first_line = fh.readline().strip()
        return "," in first_line and not first_line.startswith("{")

    if _is_csv(path):
        df = load_reviews_csv(data_path, max_rows)
    else:
        df = load_reviews_jsonl(data_path, max_rows)

    # 5-core filter
    df = five_core_filter(df)

    # Leave-last-out split (need timestamp; create synthetic if missing)
    if "timestamp" not in df.columns:
        df["timestamp"] = range(len(df))
    train_df, test_df = leave_last_out_split(df)

    # Build ID maps
    user_ids = df["user_id"].unique().tolist()
    item_ids = df["item_id"].unique().tolist()
    user_map = {uid: i for i, uid in enumerate(user_ids)}
    item_map = {iid: i for i, iid in enumerate(item_ids)}

    # Sparse matrix (users × items)
    train_matrix = build_sparse(train_df, user_map, item_map)
    # implicit expects items × users
    item_user_matrix = train_matrix.T.tocsr()

    logger.info(f"Training ALS: {len(user_ids)} users × {len(item_ids)} items, "
                f"factors={factors}, iterations={iterations}")

    model = AlternatingLeastSquares(
        factors=factors,
        regularization=regularization,
        iterations=iterations,
        use_gpu=False,
    )
    model.fit(item_user_matrix)

    # Evaluate
    metrics = evaluate(model, train_df, test_df, user_map, item_map, k=20)
    logger.info(f"✅ Evaluation: {metrics}")

    # Save artifacts
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARTIFACTS_DIR / "als_user_factors.pkl", "wb") as f:
        pickle.dump(model.user_factors, f)
    with open(ARTIFACTS_DIR / "als_item_factors.pkl", "wb") as f:
        pickle.dump(model.item_factors, f)
    with open(ARTIFACTS_DIR / "als_user_id_map.pkl", "wb") as f:
        pickle.dump(user_map, f)
    with open(ARTIFACTS_DIR / "als_item_id_map.pkl", "wb") as f:
        pickle.dump(item_map, f)

    import json
    metrics["n_users"] = len(user_ids)
    metrics["n_items"] = len(item_ids)
    metrics["factors"] = factors
    json.dump(metrics, open(ARTIFACTS_DIR / "als_metrics.json", "w"), indent=2)

    logger.info(f"All ALS artifacts saved to {ARTIFACTS_DIR}/")
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train Implicit ALS recommender")
    parser.add_argument("--data", required=True, help="Path to Amazon Reviews data file")
    parser.add_argument("--factors", type=int, default=64, help="ALS latent factors")
    parser.add_argument("--iterations", type=int, default=20, help="ALS iterations")
    parser.add_argument("--max-rows", type=int, default=500_000, help="Max interactions to load")
    args = parser.parse_args()

    metrics = train(
        args.data,
        factors=args.factors,
        iterations=args.iterations,
        max_rows=args.max_rows,
    )
    print(f"Recall@20: {metrics['Recall@20']:.4f}  |  NDCG@20: {metrics['NDCG@20']:.4f}")
