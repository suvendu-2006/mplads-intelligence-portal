# Multi-stage production Dockerfile for MPLADS Forensic Platform
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies with deterministic lockfile
COPY pyproject.toml requirements.lock ./
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.lock && \
    pip install --no-deps .

# Copy application source
COPY . .
RUN chmod +x /app/docker-entrypoint.sh /app/check_env.sh

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8501/_stcore/health || exit 1

EXPOSE 8501

ENTRYPOINT ["/app/docker-entrypoint.sh"]
