#!/usr/bin/env bash
set -e

echo "Starting Try-On Celery Worker in the background..."
celery -A app.celery_app worker -l info -Q tryon --concurrency 2 &

echo "Starting Try-On FastAPI Server in the foreground..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8001}
