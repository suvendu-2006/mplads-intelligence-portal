#!/bin/bash
set -e

if [ -z "$SECRET_KEY" ]; then
    echo "ERROR: SECRET_KEY not set"
    exit 1
fi
if [ -z "$DB_PASSWORD" ]; then
    echo "ERROR: DB_PASSWORD not set"
    exit 1
fi
if [ ${#SECRET_KEY} -lt 32 ]; then
    echo "ERROR: SECRET_KEY must be at least 32 characters"
    exit 1
fi
echo "✓ Environment variables validated"
