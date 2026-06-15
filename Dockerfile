FROM python:3.12-slim

WORKDIR /app

# System deps needed by Pillow and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages first (layer cached unless requirements change)
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy source code (ml/ must be alongside backend/ so Django can import it)
COPY backend/ ./backend/
COPY ml/ ./ml/

WORKDIR /app/backend

# Collect static files for WhiteNoise to serve.
# SECRET_KEY is required by Django at import time — we pass a dummy one only for
# this build step; it is NOT baked into the image (env var is not persisted).
RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput || true

EXPOSE 8000

# 2 workers = handles 2 concurrent requests per container.
# Add more containers (horizontal scale) instead of more workers per container.
CMD ["gunicorn", "revive.wsgi:application", "--bind", "0.0.0.0:8000", \
     "--workers", "2", "--timeout", "120", "--access-logfile", "-"]
