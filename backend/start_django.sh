#!/usr/bin/env bash
set -e

echo "Starting Django Celery Worker in the background..."
celery -A revive worker -l info --concurrency 2 &

echo "Starting Django API Server in the foreground..."
# Render automatically injects the $PORT environment variable.
# We fallback to 8000 if it is not set (e.g. for local testing).
gunicorn revive.wsgi:application --bind 0.0.0.0:${PORT:-8000}
