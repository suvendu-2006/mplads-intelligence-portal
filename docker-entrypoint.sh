#!/bin/bash
set -e

echo "🔧 Validating container environment..."
if [ -f /app/check_env.sh ]; then
    /app/check_env.sh || exit 1
fi

if [ ! -f /app/mplads_dev.db ] && [ -f /app/api/mplads_dev.db.gz ]; then
    echo "📦 Seeding database from compressed archive..."
    gzip -dc /app/api/mplads_dev.db.gz > /app/mplads_dev.db
    echo "✅ Database seeded successfully"
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
