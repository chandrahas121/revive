"""
Django settings for revive project.
SQLite for local dev. Switch to PostgreSQL on AWS by setting DATABASE_URL env var.
"""

import os
import sys
from pathlib import Path
from datetime import timedelta
import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Make ml/ importable from anywhere inside backend/
_REPO_ROOT = str(BASE_DIR.parent)
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# Load backend/.env first (most specific), then fall back to repo-root .env
load_dotenv(BASE_DIR / '.env')
load_dotenv(BASE_DIR.parent / '.env', override=False)

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-dev-key-change-in-production-abc123')

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    # Project apps
    'core',
    'grade',
    'trust',
    'prevent',
    'green',
    'route',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # must be first
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # serves static files in production
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'revive.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'revive.wsgi.application'

# ─── Database ───────────────────────────────────────────────────────────────
# Defaults to SQLite locally. Set DATABASE_URL to switch to PostgreSQL on AWS:
#   DATABASE_URL=postgres://user:pass@host:5432/dbname
DATABASES = {
    'default': dj_database_url.config(
        default=f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
    )
}

# ─── Auth ───────────────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'core.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.CookieJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': not DEBUG,     # True in production (HTTPS only)
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'None',
}

# ─── CORS ───────────────────────────────────────────────────────────────────
# 5173 = consumer app (apps/consumer), 5174 = seller app (apps/seller).
_cors_default = (
    'http://localhost:5173,http://127.0.0.1:5173,'
    'http://localhost:5174,http://127.0.0.1:5174'
)
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', _cors_default).split(',')
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', _cors_default).split(',')
CORS_ALLOW_CREDENTIALS = True   # required for cookies to be sent cross-origin

# ─── Static / Media ─────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_ROOT = BASE_DIR / 'media'

# S3 image storage — active when AWS_STORAGE_BUCKET_NAME env var is set.
# Falls back to local filesystem (media/ folder) when not set.
# boto3 picks up AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY automatically from env.
_S3_BUCKET = os.environ.get('AWS_STORAGE_BUCKET_NAME', '')
_S3_REGION = os.environ.get('AWS_S3_REGION_NAME', 'ap-south-1')
_CLOUDFRONT_DOMAIN = os.environ.get('AWS_CLOUDFRONT_DOMAIN', '')

if _S3_BUCKET:
    if _CLOUDFRONT_DOMAIN:
        MEDIA_URL = f'https://{_CLOUDFRONT_DOMAIN}/'
    else:
        MEDIA_URL = f'https://{_S3_BUCKET}.s3.{_S3_REGION}.amazonaws.com/'
        
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
            'OPTIONS': {
                'bucket_name': _S3_BUCKET,
                'region_name': _S3_REGION,
                'custom_domain': _CLOUDFRONT_DOMAIN or None,
                'file_overwrite': False,          # never silently overwrite uploads
                'object_parameters': {
                    'CacheControl': 'max-age=86400',  # browser caches images for 1 day
                },
            },
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }
else:
    MEDIA_URL = '/media/'
    STORAGES = {
        'default': {
            'BACKEND': 'django.core.files.storage.FileSystemStorage',
        },
        'staticfiles': {
            'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
        },
    }

# ─── Caching ─────────────────────────────────────────────────────────────────
# Uses Redis (via REDIS_URL) in production (Railway/Render set this automatically).
# Falls back to in-process memory cache locally — no Redis install needed for dev.
_REDIS_URL = os.environ.get('REDIS_URL', '')
if _REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': _REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'SOCKET_CONNECT_TIMEOUT': 2,
                'SOCKET_TIMEOUT': 2,
                'IGNORE_EXCEPTIONS': True,   # never crash the app if Redis is down
            },
            'KEY_PREFIX': 'revive',
            'TIMEOUT': 300,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'revive-cache',
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── Celery (async ML grading queue) ─────────────────────────────────────────
# Broker and result backend both use the same Upstash Redis as the cache.
# The Celery worker runs as a separate Render Background Worker service.
# Locally falls back to redis://localhost when REDIS_URL is not set.
_celery_broker = _REDIS_URL or 'redis://localhost:6379/0'
CELERY_BROKER_URL = _celery_broker
CELERY_RESULT_BACKEND = _celery_broker
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_SOFT_TIME_LIMIT = 120      # ML grading hard cap: 2 min per job
CELERY_WORKER_PREFETCH_MULTIPLIER = 1  # one job at a time per worker (ML is memory-heavy)

# ─── Production security (auto-enabled when DEBUG=False) ─────────────────────
# Railway/Render/Vercel sit behind a TLS-terminating reverse proxy, so we tell
# Django to trust the X-Forwarded-Proto header they add.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60  # short for first deploy; raise to 31536000 after confirming HTTPS works
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True
