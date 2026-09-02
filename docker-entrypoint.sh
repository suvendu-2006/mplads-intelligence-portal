#!/bin/bash
set -e

echo "🔧 Validating container environment..."
if [ -f /app/check_env.sh ]; then
    /app/check_env.sh || exit 1
fi

echo "🔧 Running database migrations..."
alembic upgrade head

if [ $? -ne 0 ]; then
    echo "❌ Migration failed. Exiting."
    exit 1
fi

echo "✅ Migrations completed successfully"
echo "⏳ Waiting for database to be fully ready..."
sleep 2

echo "🚀 Starting Streamlit application..."
exec streamlit run app.py --server.port=8501 --server.address=0.0.0.0
