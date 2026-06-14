"""
ml/fittwin/build_index.py
--------------------------
Offline step: turn the raw Rent the Runway clothing-fit dataset into a compact
"fit-twin" index the API can match against at request time.

Matching is SIZE-BASED (no body measurements), so each kept row needs only a
size and a real fit verdict. Body columns are parsed when present but are not
used for matching. ModCloth is intentionally NOT merged: it has no weight and a
different size scale, which would corrupt size recommendations.

Input  (real data — download once, see ml/fittwin/README.md):
    data/renttherunway_final_data.json     (newline-delimited JSON)

Output:
    ml/artifacts/fittwin_index.pkl
        {
          "records":  DataFrame[user_id, item_id, category, size, fit,
                                 height_in, weight_lb, bust_in, age, rating],
          "scaler":   StandardScaler over BODY_COLS,
          "body_cols": [...],
          "category_counts": {category: n},
          "built_from": [filenames],
        }

Usage:
    python ml/fittwin/build_index.py
    python ml/fittwin/build_index.py --input data/renttherunway_final_data.json
    python ml/fittwin/build_index.py --sample data/_sample_renttherunway.json   # smoke test

The model here is deliberately non-parametric: no training, no synthetic labels.
The "label" (fit: small/fit/large) is a REAL human judgement from the dataset, so
nothing is circular — we are literally looking up what happened to real shoppers.
"""
from __future__ import annotations
import argparse
import json
import logging
import pickle
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd

try:                                   # works both as `python ml/fittwin/build_index.py`
    from ml.fittwin import parsing     # and as a module import from the backend
except ImportError:                    # pragma: no cover
    import parsing  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
ARTIFACTS_DIR = REPO_ROOT / "ml" / "artifacts"

BODY_COLS = ["height_in", "weight_lb", "bust_in", "age"]

# Real-data filenames the builder will pick up automatically if no --input given.
DEFAULT_INPUTS = [
    "renttherunway_final_data.json",
    # NOTE: ModCloth intentionally excluded — it has no weight and uses a
    # different size scale, so merging would corrupt size recommendations.
]


def _iter_records(path: Path):
    """The dataset is newline-delimited JSON (one object per line). Be tolerant of
    a normal JSON array too."""
    text_first = path.open("r", encoding="utf-8")
    head = text_first.read(1)
    text_first.close()
    if head == "[":
        yield from json.loads(path.read_text(encoding="utf-8"))
        return
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip().rstrip(",")
            if not line or line in ("[", "]"):
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _row_from_record(r: dict) -> dict | None:
    size = parsing.parse_size(r.get("size"))
    fit = parsing.parse_fit(r.get("fit"))

    # Size-based matching needs only a size and a real fit verdict.
    if size is None or fit is None:
        return None

    height = parsing.parse_height(r.get("height"))
    weight = parsing.parse_weight(r.get("weight"))

    return {
        "user_id": str(r.get("user_id", "")),
        "item_id": str(r.get("item_id", "")),
        "category": parsing.norm_category(r.get("category")),
        "body_type": str(r.get("body type") or r.get("body_type") or "").strip().lower(),
        "size": size,
        "fit": fit,
        "height_in": height,
        "weight_lb": weight,
        "bust_in": parsing.parse_bust(r.get("bust size") or r.get("bust_size")),
        "age": parsing.parse_age(r.get("age")),
        "rating": parsing.parse_rating(r.get("rating")),
    }


def build(inputs: List[Path], out_path: Path) -> dict:
    from sklearn.preprocessing import StandardScaler

    rows, used = [], []
    for path in inputs:
        if not path.exists():
            logger.warning("Input not found, skipping: %s", path)
            continue
        n_before = len(rows)
        for rec in _iter_records(path):
            row = _row_from_record(rec)
            if row:
                rows.append(row)
        logger.info("Parsed %d usable rows from %s", len(rows) - n_before, path.name)
        used.append(path.name)

    if not rows:
        raise SystemExit(
            "No usable rows parsed. Did you download the dataset?\n"
            "  See ml/fittwin/README.md  (kaggle datasets download "
            "-d rmisra/clothing-fit-dataset-for-size-recommendation)"
        )

    df = pd.DataFrame(rows)

    # Body columns are optional (kept only for analysis — matching is size-based).
    for col in BODY_COLS + ["rating"]:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())

    scaler = StandardScaler().fit(df[BODY_COLS].values)

    category_counts = df["category"].value_counts().to_dict()
    artifact = {
        "records": df.reset_index(drop=True),
        "scaler": scaler,
        "body_cols": BODY_COLS,
        "category_counts": category_counts,
        "built_from": used,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as fh:
        pickle.dump(artifact, fh)

    logger.info("Built fit-twin index: %d rows, %d categories -> %s",
                len(df), len(category_counts), out_path)
    logger.info("Fit distribution: %s",
                df["fit"].value_counts(normalize=True).round(3).to_dict())
    logger.info("Top categories: %s", dict(list(category_counts.items())[:8]))
    return artifact


def _resolve_inputs(args) -> List[Path]:
    if args.sample:
        return [Path(args.sample)]
    if args.input:
        return [Path(args.input)]
    found = [DATA_DIR / name for name in DEFAULT_INPUTS if (DATA_DIR / name).exists()]
    if not found:
        # fall back to the bundled smoke-test sample so the pipeline is runnable
        sample = DATA_DIR / "_sample_renttherunway.json"
        if sample.exists():
            logger.warning("No real dataset found — building from smoke-test sample. "
                           "Download real data for the demo (ml/fittwin/README.md).")
            return [sample]
    return found


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--input", help="path to a single dataset json")
    p.add_argument("--sample", help="path to a small smoke-test json")
    p.add_argument("--out", default=str(ARTIFACTS_DIR / "fittwin_index.pkl"))
    args = p.parse_args()
    build(_resolve_inputs(args), Path(args.out))
