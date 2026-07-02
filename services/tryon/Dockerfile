FROM python:3.12-slim

WORKDIR /app

# Install deps first so this layer is cached unless requirements change.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Service code (self-contained — no dependency on the Django repo).
COPY app ./app

EXPOSE 8001

# API process. The Celery worker uses the same image with a different command
# (see docker-compose: `celery -A app.celery_app worker`).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
