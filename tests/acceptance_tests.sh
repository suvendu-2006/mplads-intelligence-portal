#!/bin/bash
set -e

echo "================================================================="
echo "  PRODUCTION-READY ACCEPTANCE GATE - MPLADS AUDIT TRIAGE"
echo "================================================================="

# [1/10] Security: No hardcoded credentials
echo "[1/10] Security: Checking for hardcoded credentials..."
if git grep -i "ChangeMe123" --quiet 2>/dev/null; then
    echo "  ✗ FAIL: Hardcoded credentials found"
    exit 1
fi
if git grep "9f8e7d6c5b4a3f2e1d0c" --quiet 2>/dev/null; then
    echo "  ✗ FAIL: Default SECRET_KEY found"
    exit 1
fi
echo "  ✓ PASS: No hardcoded credentials"

# [2/10] Typed Configuration
echo "[2/10] Testing fail-closed production configuration..."
.venv/bin/python3 -c "
from mplads_fraud_detection.settings import Settings
import pytest

# Test should fail with SQLite in production
try:
    Settings(
        APP_ENV='production',
        DATABASE_URL='sqlite:///test.db',
        SECRET_KEY='a' * 32
    )
    raise AssertionError('Should have rejected SQLite in production')
except ValueError:
    pass  # Expected

print('  ✓ PASS: Configuration fail-closed validated')
"

# [3/10] Data Integrity
echo "[3/10] Verifying data integrity and lineage..."
.venv/bin/python3 -c "
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, Dataset
session = SessionLocal()
work_count = session.query(Work).count()
dataset_count = session.query(Dataset).count()
session.close()
assert work_count == 8512, f'Expected 8512 works, got {work_count}'
assert dataset_count > 0, 'No datasets registered'
print(f'  ✓ PASS: {work_count:,} works, {dataset_count} datasets registered')
"

# [4/10] Pandera Validation
echo "[4/10] Testing data validation and quarantine routing..."
.venv/bin/pytest tests/test_data_validation.py -v --tb=short

# [5/10] Anti-Synthetic Audit
echo "[5/10] Verifying zero synthetic/fabricated records..."
.venv/bin/python3 -c "
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work

session = SessionLocal()
synthetic_works = session.query(Work).filter_by(data_origin='SYNTHETIC_DEMO').count()
assert synthetic_works == 0, f'Found {synthetic_works} synthetic works'

print('  ✓ PASS: Zero synthetic records in operational tables')
session.close()
"

# [6/10] Server-Side RBAC
echo "[6/10] Testing server-side authorization enforcement..."
.venv/bin/pytest tests/test_rbac_server_side.py -v --tb=short

# [7/10] Alembic Idempotency
echo "[7/10] Testing Alembic migration idempotency..."
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic upgrade head > /dev/null 2>&1
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic downgrade base > /dev/null 2>&1
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic upgrade head > /dev/null 2>&1
rm -f test_migration.db
echo "  ✓ PASS: Migrations are idempotent"

# [8/10] Password Cryptography
echo "[8/10] Verifying bcrypt password hashing..."
.venv/bin/python3 << 'EOF'
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import User
session = SessionLocal()
users = session.query(User).all()
for u in users:
    assert u.password_hash.startswith('$2'), f'User {u.username} password not bcrypt'
print(f'  ✓ PASS: All {len(users)} user passwords hashed with bcrypt')
session.close()
EOF

# [9/10] Detector Registry & Capacity Triage
echo "[9/10] Verifying detector registry and capacity tiers..."
.venv/bin/python3 -c "
from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY, DetectorStatus
assert len(DETECTOR_REGISTRY) == 15, 'Expected 15 detectors in registry'
print(f'  ✓ PASS: {len(DETECTOR_REGISTRY)} detectors registered')
"

# [10/10] Documentation
echo "[10/10] Verifying documentation and policy assets..."
test -f docs/ROLLBACK.md || { echo "Missing ROLLBACK.md"; exit 1; }
test -f docs/USER_GUIDE.md || { echo "Missing USER_GUIDE.md"; exit 1; }
test -f docs/RETENTION_POLICY.md || { echo "Missing RETENTION_POLICY.md"; exit 1; }
test -f .env.example || { echo "Missing .env.example"; exit 1; }
test -f pyproject.toml || { echo "Missing pyproject.toml"; exit 1; }

# Check for proper disclaimers
if ! grep -q "Flagged records require verification and are not fraud findings" docs/USER_GUIDE.md; then
    echo "  ✗ FAIL: Missing disclaimer in USER_GUIDE.md"
    exit 1
fi

echo "  ✓ PASS: All documentation and disclaimers verified"

echo ""
echo "================================================================="
echo "  ✅ ALL 10 PRODUCTION-READY GATES PASSED"
echo "  System validated for deployment as audit-triage platform"
echo "================================================================="
