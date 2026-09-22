# ── Django Auth Backend ───────────────────────────────────────────────────────
FROM python:3.12-slim

# Keeps Python from generating .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
# Prevents Python from buffering stdout/stderr
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend_django/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Django project (manage.py lives one level up from backend_django/)
COPY . .

# Run migrations and start the Django dev server
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
