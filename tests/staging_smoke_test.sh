#!/bin/bash
set -e

echo "================================================================="
echo "  STAGING SMOKE TEST: POSTGRESQL & REAL TLS CONNECTIVITY        "
echo "================================================================="

STAGING_PORT=5433
STAGING_DB="mplads_staging"
STAGING_USER="mplads_staging_user"
STAGING_PASS="StagingSecurePassword123!"
CERT_DIR="$(pwd)/tests/staging_certs"

# Check if docker is available and running
DOCKER_ACTIVE=false
if command -v docker > /dev/null 2>&1; then
    if docker info > /dev/null 2>&1; then
        DOCKER_ACTIVE=true
    fi
fi

if [ "$DOCKER_ACTIVE" = true ]; then
    echo "🐳 Docker daemon detected. Setting up fresh PostgreSQL container with TLS/SSL..."

    mkdir -p "$CERT_DIR"
    chmod 700 "$CERT_DIR"

    # Generate temporary self-signed SSL certificates for staging
    openssl req -new -x509 -days 1 -nodes -text \
        -out "$CERT_DIR/server.crt" \
        -keyout "$CERT_DIR/server.key" \
        -subj "/CN=localhost" > /dev/null 2>&1
    chmod 600 "$CERT_DIR/server.key"

    CONTAINER_NAME="mplads_staging_pg_$(date +%s)"

    echo "  • Starting isolated PostgreSQL with SSL enabled on port $STAGING_PORT..."
    docker run -d --name "$CONTAINER_NAME" \
        -e POSTGRES_DB="$STAGING_DB" \
        -e POSTGRES_USER="$STAGING_USER" \
        -e POSTGRES_PASSWORD="$STAGING_PASS" \
        -v "$CERT_DIR/server.crt:/var/lib/postgresql/server.crt:ro" \
        -v "$CERT_DIR/server.key:/var/lib/postgresql/server.key:ro" \
        -p "$STAGING_PORT:5432" \
        postgres:15-alpine \
        -c ssl=on \
        -c ssl_cert_file=/var/lib/postgresql/server.crt \
        -c ssl_key_file=/var/lib/postgresql/server.key > /dev/null

    trap "echo '🧹 Cleaning up staging container and certs...'; docker rm -f $CONTAINER_NAME > /dev/null 2>&1 || true; rm -rf $CERT_DIR" EXIT

    echo "  • Waiting for PostgreSQL to be healthy..."
    for i in {1..30}; do
        if docker exec "$CONTAINER_NAME" pg_isready -U "$STAGING_USER" -d "$STAGING_DB" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    STAGING_DATABASE_URL="postgresql+psycopg2://${STAGING_USER}:${STAGING_PASS}@localhost:${STAGING_PORT}/${STAGING_DB}?sslmode=require"

    echo "  • Running Alembic migrations against fresh TLS-enabled PostgreSQL..."
    DATABASE_URL="$STAGING_DATABASE_URL" .venv/bin/alembic upgrade head

    echo "  • Verifying encrypted TLS connection and database schema..."
    DATABASE_URL="$STAGING_DATABASE_URL" .venv/bin/python3 -c "
import os
from sqlalchemy import create_engine, text
db_url = os.environ['DATABASE_URL']
engine = create_engine(db_url, connect_args={'sslmode': 'require'})
with engine.connect() as conn:
    res = conn.execute(text('SELECT version(), ssl_is_used()')).fetchone()
    print(f'    ✓ Connected to: {res[0][:30]}...')
    print(f'    ✓ TLS Active (ssl_is_used): {res[1]}')
    assert res[1] is True, 'TLS connection was not active!'
    tables = conn.execute(text(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\")).fetchall()
    table_names = [t[0] for t in tables]
    assert 'works' in table_names
    assert 'fraud_labels' in table_names
    assert 'label_history' in table_names
    print(f'    ✓ Schema initialized: {len(table_names)} tables verified in PostgreSQL public schema.')
"
    echo "  ✓ PASS: Fresh PostgreSQL container created, TLS verified, and Alembic migrations executed successfully!"

else
    echo "ℹ️  Docker daemon not active on local host (macOS development environment)."
    echo "   Executing automated PostgreSQL TLS enforcement & offline DDL compiler test..."
    .venv/bin/pytest -v tests/test_postgres_tls_staging.py --tb=short
    echo "  ✓ PASS: PostgreSQL TLS parameter enforcement and complete DDL compilation verified!"
fi

echo "================================================================="
echo "  ✅ STAGING SMOKE TEST PASSED"
echo "================================================================="
