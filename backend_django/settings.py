"""
Django settings for backend_django project.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/topics/settings/
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file at the project root
load_dotenv(Path(__file__).resolve().parent.parent / '.env')

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY',
    'django-insecure-fallback-key-change-in-production'
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')

# ── Application definition ────────────────────────────────────────────────────
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'users',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend_django.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend_django.wsgi.application'

import urllib.parse

# ── Database ──────────────────────────────────────────────────────────────────
# 1. First priority: DATABASE_URL (Supabase / Neon / Render Postgres)
# 2. Second priority: DB_HOST individual variables
# 3. Fallback: SQLite
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Normalize scheme
    if database_url.startswith('postgres://'):
        database_url = 'postgresql://' + database_url[len('postgres://'):]

    # Robust parsing that handles passwords with unescaped '@' characters
    clean_url = database_url
    sslmode = 'require'
    if '?' in clean_url:
        clean_url, query_str = clean_url.split('?', 1)
        params = urllib.parse.parse_qs(query_str)
        if 'sslmode' in params:
            sslmode = params['sslmode'][0]

    # Strip scheme
    _, rest = clean_url.split('://', 1)

    # Split credentials and host at the LAST '@'
    if '@' in rest:
        user_info, host_info = rest.rsplit('@', 1)
        if ':' in user_info:
            db_user, db_password = user_info.split(':', 1)
        else:
            db_user, db_password = user_info, ''
    else:
        db_user, db_password = '', ''
        host_info = rest

    # Split host and database path
    if '/' in host_info:
        host_port, db_name = host_info.split('/', 1)
    else:
        host_port, db_name = host_info, 'postgres'

    # Split host and port
    if ':' in host_port:
        db_host, db_port = host_port.split(':', 1)
    else:
        db_host, db_port = host_port, '5432'

    print(f"[DB] Configured PostgreSQL: user='{db_user}', host='{db_host}', port={db_port}, db='{db_name}', sslmode='{sslmode}'")

    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': db_name,
            'USER': urllib.parse.unquote(db_user),
            'PASSWORD': urllib.parse.unquote(db_password),
            'HOST': db_host,
            'PORT': db_port,
            'OPTIONS': {
                'sslmode': sslmode,
            },
        }
    }
elif os.environ.get('DB_HOST'):
    DATABASES = {
        'default': {
            'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.postgresql'),
            'NAME': os.environ.get('DB_NAME', 'documind'),
            'USER': os.environ.get('DB_USER', 'documind_user'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'db'),
            'PORT': os.environ.get('DB_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# ── Password validation ───────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Internationalization ──────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ── Static files ──────────────────────────────────────────────────────────────
STATIC_URL = 'static/'

# ── Custom User Model ─────────────────────────────────────────────────────────
AUTH_USER_MODEL = 'users.CustomUser'

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'users.authentication.CustomJWTAuthentication',
    ),
}

# ── SimpleJWT ─────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': not DEBUG,   # True in production (HTTPS)
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_PATH': '/',
    'AUTH_COOKIE_SAMESITE': 'None' if not DEBUG else 'Lax',  # 'None' is required for cross-site cookies (Vercel -> Render)
}

