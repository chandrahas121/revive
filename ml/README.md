# ML Package — README

## Structure

```
ml/
├── __init__.py
├── grade.py              # grade_image() + grade_video()  ← MAIN FUNCTION
├── route.py              # route_item() EV optimizer      ← MAIN FUNCTION
├── prevent.py            # score_risk()                   ← MAIN FUNCTION
├── recommend.py          # recommend()                    ← MAIN FUNCTION
├── captioner.py          # LLM provider abstraction (OpenRouter/Anthropic/Bedrock/local)
├── video_sampler.py      # OpenCV frame extractor
├── pregrade_demo.py      # Pre-grade all demo items into cache (run before demo!)
├── test_ml_functions.py  # Smoke test — validates all 4 functions
├── setup_and_train.py    # One-shot setup + training orchestrator
├── requirements.txt      # All ML dependencies
├── artifacts/
│   ├── grade_cache.json        # SHA-256 keyed grade results cache
│   ├── price_model.pkl         # LightGBM price model (train with Mercari)
│   ├── risk_model.pkl          # GBDT return-risk model (trained on synthetic)
│   ├── als_user_factors.pkl    # ALS user vectors (train with Amazon Reviews)
│   ├── als_item_factors.pkl    # ALS item vectors
│   ├── als_user_id_map.pkl     # User ID → index mapping
│   ├── als_item_id_map.pkl     # Item ID → index mapping
│   ├── als_metrics.json        # Recall@20, NDCG@20
│   ├── risk_metrics.json       # F1, AUC
│   ├── price_metrics.json      # RMSLE
│   └── pregrade_results.json   # Pre-graded demo items
├── inference/
│   ├── dino.py           # Grounding DINO zero-shot defect detection
│   └── clip_model.py     # CLIP completeness + embeddings
└── notebooks/
    ├── train_price_model.py   # LightGBM training on Mercari
    ├── train_als.py           # Implicit ALS on Amazon Reviews 2023
    └── train_prevention.py    # GBDT on synthetic return data
```

## Public API (what backend imports)

```python
from ml.grade import grade_image, grade_video
from ml.route import route_item
from ml.prevent import score_risk
from ml.recommend import recommend
```

### grade_image()
```python
result = grade_image(
    image_bytes=b"...",      # JPEG/PNG bytes
    product_id="B08SHOE001", # ASIN
    operator="self",          # "self" | "agent" | "seller"
    reference_bytes=None,     # Optional catalog reference for CLIP completeness
)
# Returns:
# {grade, confidence, defects[], completeness, condition_summary,
#  functional, box_present, latency_ms, model_version, image_hash}
```

### grade_video()
```python
result = grade_video(
    video_path="/path/to/shoe.mp4",
    product_id="B08SHOE001",
    n_frames=5,
)
# Returns same schema + {source: "video", frames_sampled, per_frame_grades}
```

### route_item()
```python
result = route_item(
    listing_id="lst_001",
    grade="B",
    category="Footwear",
    defects=[{"type": "scratch on surface", "severity": "minor"}],
    geohash5="tbxx1",    # Seller's geohash5
    mrp=2999.0,
)
# Returns:
# {chosen_path, ev_breakdown, price, km_saved, co2_saved_kg,
#  demand_note, sell_probability, green_credits_earned}
```

### score_risk()
```python
result = score_risk(
    user_id="user_001",
    cart_items=[{"product_id": "...", "category": "Footwear", "brand": "Nike",
                 "size": 8.0, "is_gift": False}],
    user_history={"return_rate": 0.25, "size_history": {"Footwear": 7.5}},
)
# Returns: {risk, flagged_item_id, nudge_text, credit_promise, breakdown}
```

### recommend()
```python
result = recommend(
    user_id="user_001",
    n=5,
    geohash5="tbxx1",
    available_listings=[...],  # From backend DB query
    user_history_embeddings=[...],  # Optional CLIP embeddings
)
# Returns: [{listing_id, score, reason, grade, price}] sorted by score
```

## Environment Variables

Copy `.env.example` to `.env`:
```
LLM_PROVIDER=openrouter     # or anthropic | bedrock | local
OPENROUTER_API_KEY=sk-or-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r ml/requirements.txt
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# 2. Train models (synthetic data — no downloads needed)
python ml/notebooks/train_prevention.py --rows 50000
# With real Mercari data:
python ml/notebooks/train_price_model.py --data data/mercari_train.tsv --sample 300000

# 3. Download Amazon Reviews for ALS (optional but recommended)
python data/download_datasets.py --amazon-reviews --category Electronics
python ml/notebooks/train_als.py --data data/amazon_reviews_electronics.jsonl

# 4. Set your API key (copy .env.example → .env)
copy .env.example .env
# Edit .env: add ANTHROPIC_API_KEY or OPENROUTER_API_KEY

# 5. Pre-grade demo items (critical — run before demo!)
python ml/pregrade_demo.py --images demo_items/

# 6. Smoke test
python ml/test_ml_functions.py
```

## For Kaggle/Mercari Data
See `data/KAGGLE_SETUP.md` for step-by-step instructions.

## Architecture Notes

### Grade Pipeline Flow
```
grade_image(bytes)
  → SHA-256 cache check (Redis prod / JSON file dev)  → HIT: return cached
  → Grounding DINO: detect_defects(bytes)             → bounding boxes
  → CLIP: compute_completeness(uploaded, reference)   → 0.0–1.0 score
  → captioner.caption(bytes, detections)              → LLM grade/defects/summary
  → _compute_grading_head(llm, dino, clip)            → final fused grade
  → cache write → return
```

### Provider Abstraction
One `LLM_PROVIDER` env var switches between:
- `openrouter` → OpenAI SDK → `https://openrouter.ai/api/v1` (demo default)
- `anthropic` → Direct Anthropic SDK (Claude Haiku)
- `bedrock` → boto3 bedrock-runtime (production)
- `local` → Qwen2.5-VL-3B (offline GPU fallback)

Switching providers = 1 env var. Zero code changes.

### Demo Safety
All demo items are pre-graded into `artifacts/grade_cache.json`.
Every live demo hit is a cache read → **~0ms latency, zero API dependency on stage**.
