# Real-Amazon catalog — drop files here

The storefront's real product catalog comes from the **Amazon Reviews 2023**
dataset (McAuley Lab, UCSD). `seed_demo` reads sliced `.jsonl` files from THIS
`data/` folder. Until the `catalog_*.jsonl` files exist, `seed_demo` falls back
to the curated branded catalog (~173 products).

## Files needed in this folder (`data/`)

| File | Present? |
|------|----------|
| `catalog_phone.jsonl`   | ⬅ needed (get from friend / download) |
| `catalog_laptop.jsonl`  | ⬅ needed |
| `catalog_monitor.jsonl` | ⬅ needed |
| `catalog_footwear.jsonl`| ⬅ needed |
| `catalog_apparel.jsonl` | ⬅ needed |
| `reviews_*.jsonl` (×5)  | ✅ already here |

## To generate them (the friend runs this once, from repo root)

```bash
python data/download_reviews.py
```
Then they send you the 5 `catalog_*.jsonl` files. Streams several GB of source
data, so it's slow — that's why we hand the output files around instead.

## After the files are in `data/`, reseed (from repo root)

```bash
cd backend
python manage.py seed_demo
```

The seeder auto-detects the `catalog_*.jsonl` files: when present it uses the
REAL Amazon products; when absent it uses the curated fallback. No code change
needed either way.

## Then restart the backend (it holds a sqlite lock during seeding)

```bash
# from backend/ , with the venv python
python manage.py runserver 8000
```

Backend DB note: this repo's root `.env` points `DATABASE_URL` at Postgres, but
`backend/.env` overrides it to `sqlite:///db.sqlite3` (the seeded file). Run all
`manage.py` commands from the `backend/` folder so they hit the right DB.
