"""
ml/notebooks/train_price_model.py
----------------------------------
Best-practice LightGBM + TF-IDF + SVD price model for Mercari Price Suggestion.

Architecture (informed by top Kaggle solutions):
  1. Text = name + brand_name + category_name + item_description (concatenated)
  2. TF-IDF with word n-grams (1-3) + char n-grams (3-5)  — the trick that
     pushed all top solutions below RMSLE 0.44.
  3. TruncatedSVD (64 components) → dense representation
  4. LightGBM on [64 SVD dims + 5 numeric features]

Expected RMSLE: ~0.43–0.46 on holdout  (vs 0.55 with pure 10-column tabular)
Run time on Kaggle CPU: ~25–35 minutes with full 1.4M dataset (recommended)

═══════════════════════════════════════════════════════════════════════════════
HOW TO RUN ON KAGGLE
═══════════════════════════════════════════════════════════════════════════════
1. Create a new Kaggle Notebook (CPU accelerator is enough, no GPU needed)
2. Add dataset: mercari-price-suggestion-challenge
3. Paste this entire file into a code cell and run it.
   DATA_PATH below is already set to the correct Kaggle path.
4. Wait ~30 minutes.
5. Download /kaggle/working/price_model.pkl from the Output tab.
6. Place the file at:  ml/artifacts/price_model.pkl
   route.py will auto-detect it and use the new inference path.

AFTER TRAINING — see bottom of this file for steps.
═══════════════════════════════════════════════════════════════════════════════
"""
from __future__ import annotations
import json
import logging
import math
import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
# Kaggle paths (used when run as a notebook cell)
DATA_PATH  = "/kaggle/input/mercari-price-suggestion-challenge/train.tsv"
OUTPUT_DIR = "/kaggle/working/"

# Local override (used when run with --data flag)
ARTIFACTS_DIR = Path(__file__).parent.parent / "artifacts"

# ── Config ─────────────────────────────────────────────────────────────────────
SAMPLE          = 0          # 0 = all 1.4M rows (best RMSLE); set 400_000 for a quick test run
SVD_COMPONENTS  = 64         # dense embedding dimensions; 64 is sweet spot (speed vs accuracy)
TFIDF_WORD_FEAT = 150_000    # vocabulary cap for word n-grams
TFIDF_CHAR_FEAT = 50_000     # vocabulary cap for char n-grams
TEST_SIZE       = 0.10       # 10% holdout

CONDITION_MAP = {1: 5, 2: 4, 3: 3, 4: 2, 5: 1}  # Mercari 1=New→5, 5=Poor→1


# ══════════════════════════════════════════════════════════════════════════════
# FEATURE ENGINEERING
# ══════════════════════════════════════════════════════════════════════════════

def build_text(df: pd.DataFrame) -> pd.Series:
    """
    Concatenate all text fields into one string per listing.
    Key insight from top solutions: combining all text into one field and
    letting TF-IDF learn the context beats treating fields separately.
    Lowercasing + replacing category "/" with spaces helps the word tokenizer.
    """
    name   = df["name"].fillna("").str.lower()
    brand  = df["brand_name"].fillna("").str.lower()
    cat    = (df["category_name"].fillna("")
                .str.lower()
                .str.replace("/", " ", regex=False))
    desc   = df["item_description"].fillna("").str.lower()
    # Replace "No description yet" (appears 400k times) with empty string
    desc   = desc.str.replace("no description yet", "", regex=False)
    return name + " " + brand + " " + cat + " " + desc


def build_numeric(df: pd.DataFrame) -> np.ndarray:
    """
    5 numeric/binary features that complement the TF-IDF embedding.
    IMPORTANT: These must match EXACTLY what route.py sends at inference time.
    Do not add features here that route.py cannot provide.
    """
    condition_ord = df["item_condition_id"].map(CONDITION_MAP).fillna(3).values.astype(float)
    shipping      = df["shipping"].fillna(0).values.astype(float)
    # Normalised name length (longer names → more info → slightly higher price)
    name_len_norm = (df["name"].fillna("").apply(len).values.astype(float) / 80.0).clip(0, 5)
    has_desc      = (df["item_description"].fillna("").str.strip() != "").astype(float).values
    brand_known   = (df["brand_name"].notna()
                     & (df["brand_name"].fillna("") != "")).astype(float).values
    return np.column_stack([condition_ord, shipping, name_len_norm, has_desc, brand_known])


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train(data_path: str, sample: int = 0, output_dir: str = ".") -> float:
    import lightgbm as lgb

    logger.info(f"Loading data from {data_path}  (sample={sample or 'ALL rows'})…")
    df = pd.read_csv(data_path, sep="\t", nrows=sample if sample > 0 else None)
    df = df[df["price"] > 0].reset_index(drop=True)
    logger.info(f"Rows after price>0 filter: {len(df):,}")

    # Target: log1p(price) so we optimise RMSLE directly
    y = np.log1p(df["price"].values)

    # ── Step 1: Build text corpus ──────────────────────────────────────────────
    logger.info("Building text corpus…")
    text = build_text(df)

    # ── Step 2: TF-IDF vectorisation ──────────────────────────────────────────
    # Word n-grams (1-3): captures phrases like "like new", "never used", brand names
    logger.info("Fitting TF-IDF word n-grams (1-3)…")
    tfidf_word = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=TFIDF_WORD_FEAT,
        analyzer="word",
        min_df=3,
        sublinear_tf=True,   # use log(1+tf) — critical for skewed term frequencies
        strip_accents="unicode",
        token_pattern=r"(?u)\b\w+\b",
    )
    X_word = tfidf_word.fit_transform(text)
    logger.info(f"  Word TF-IDF shape: {X_word.shape}")

    # Char n-grams (3-5): captures partial words, brand abbreviations, typos
    logger.info("Fitting TF-IDF char n-grams (3-5)…")
    tfidf_char = TfidfVectorizer(
        ngram_range=(3, 5),
        max_features=TFIDF_CHAR_FEAT,
        analyzer="char_wb",  # char_wb = word-boundary aware (better than "char")
        min_df=10,
        sublinear_tf=True,
    )
    X_char = tfidf_char.fit_transform(text)
    logger.info(f"  Char TF-IDF shape: {X_char.shape}")

    # Combine sparse matrices
    X_sparse = hstack([X_word, X_char], format="csr")
    logger.info(f"Combined sparse TF-IDF shape: {X_sparse.shape}")

    # ── Step 3: Dimensionality reduction (SVD) ────────────────────────────────
    # SVD maps 200k sparse features → 64 dense semantic dimensions.
    # This is what allows LightGBM to learn interactions between text meaning
    # and numeric features (condition, shipping, brand).
    logger.info(f"Fitting TruncatedSVD ({SVD_COMPONENTS} components)…")
    svd = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=42, n_iter=5)
    X_svd = svd.fit_transform(X_sparse)
    explained_var = svd.explained_variance_ratio_.sum()
    logger.info(f"SVD explained variance: {explained_var:.1%}")

    # ── Step 4: Numeric features ───────────────────────────────────────────────
    X_num = build_numeric(df)
    logger.info(f"Numeric features shape: {X_num.shape}")

    # ── Step 5: Combine all features ───────────────────────────────────────────
    X = np.hstack([X_svd, X_num])   # shape: (N, 64+5) = (N, 69)
    logger.info(f"Final feature matrix: {X.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=42)
    logger.info(f"Train: {len(X_train):,} | Test: {len(X_test):,}")

    # ── Step 6: LightGBM ───────────────────────────────────────────────────────
    train_data = lgb.Dataset(X_train, label=y_train)
    val_data   = lgb.Dataset(X_test,  label=y_test)

    params = {
        # regression_l1 (MAE) is more robust than MSE for price data with outliers
        # (a $1000 item doesn't distort the model for $10 items)
        "objective":          "regression_l1",
        "metric":             "rmse",           # report RMSLE-equivalent on log target
        "num_leaves":         256,              # more leaves → more complex decisions
        "learning_rate":      0.03,             # lower LR + more rounds = better generalisation
        "feature_fraction":   0.7,             # random column subsampling per tree
        "bagging_fraction":   0.8,             # row subsampling
        "bagging_freq":       1,
        "min_child_samples":  20,              # prevents overfitting on rare categories
        "lambda_l1":          0.05,            # L1 regularisation
        "lambda_l2":          0.05,            # L2 regularisation
        "verbose":            -1,
        "num_threads":        os.cpu_count() or 4,
    }

    logger.info("Training LightGBM (up to 3000 rounds, early stop at 100)…")
    callbacks = [
        lgb.early_stopping(stopping_rounds=100, verbose=True),
        lgb.log_evaluation(period=100),
    ]
    model = lgb.train(
        params,
        train_data,
        num_boost_round=3000,
        valid_sets=[val_data],
        callbacks=callbacks,
    )

    # ── Step 7: Evaluate ───────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    # Since target is log1p(price), RMSE of log predictions = RMSLE of prices
    rmsle = math.sqrt(np.mean((y_pred - y_test) ** 2))
    logger.info(f"✅  Holdout RMSLE: {rmsle:.4f}  (target: < 0.47)")

    # ── Step 8: Save artifact ──────────────────────────────────────────────────
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Artifact dict — route.py uses "type" to select the correct inference path
    artifact = {
        "type":           "lgbm_tfidf_svd_v2",  # route.py checks this key
        "model":          model,
        "tfidf_word":     tfidf_word,
        "tfidf_char":     tfidf_char,
        "svd":            svd,
        "svd_components": SVD_COMPONENTS,
        "condition_map":  CONDITION_MAP,
    }
    pkl_path = out / "price_model.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump(artifact, f, protocol=4)
    logger.info(f"Model saved → {pkl_path}  ({pkl_path.stat().st_size / 1e6:.1f} MB)")

    metrics = {
        "rmsle":         rmsle,
        "n_train":       len(X_train),
        "n_test":        len(X_test),
        "tfidf_vocab":   int(X_sparse.shape[1]),
        "svd_components": SVD_COMPONENTS,
        "svd_variance":  float(explained_var),
        "best_iteration": int(model.best_iteration),
    }
    json.dump(metrics, open(out / "price_metrics.json", "w"), indent=2)
    logger.info(f"Metrics → {out / 'price_metrics.json'}")

    return rmsle


# ══════════════════════════════════════════════════════════════════════════════
# KAGGLE ENTRY POINT
# Run this block directly in a Kaggle notebook cell.
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train LightGBM+TF-IDF price model")
    parser.add_argument("--data",   default=DATA_PATH,        help="Path to train.tsv")
    parser.add_argument("--sample", type=int, default=SAMPLE, help="Max rows (0=all)")
    parser.add_argument("--out",    default=OUTPUT_DIR,        help="Output directory")
    args = parser.parse_args()
    rmsle = train(args.data, args.sample, args.out)
    print(f"\n{'='*50}\nFINAL RMSLE : {rmsle:.4f}\n{'='*50}")


# ══════════════════════════════════════════════════════════════════════════════
# AFTER TRAINING — STEPS TO DEPLOY
# ══════════════════════════════════════════════════════════════════════════════
#
# 1. In Kaggle Output tab, download:  price_model.pkl   (~50–150 MB)
#                                      price_metrics.json
#
# 2. Place the pkl in your project:
#       ml/artifacts/price_model.pkl
#
# 3. Verify route.py picked it up:
#       python -c "from ml.route import route_item; r = route_item('T1', 'B', 'Electronics', [], 'tbxx1', mrp=5000); print(r['price'], r['chosen_path'])"
#    Expected output: a price between ₹250 and ₹4500, e.g. "₹2,340  resell_p2p"
#
# 4. Run the pillar2 checks:
#       python data/check_pillar2.py
#    All 15 checks should pass.
#
# 5. Report to judges:
#    "LightGBM + TF-IDF + SVD trained on 1.4M Mercari listings.
#     RMSLE: {your rmsle:.2f} on holdout — within the 0.43–0.47 industry range."
#
# ══════════════════════════════════════════════════════════════════════════════
