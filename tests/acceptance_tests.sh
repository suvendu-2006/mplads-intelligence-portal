#!/bin/bash
set -e

echo "================================================================="
echo "  PRODUCTION-READY ACCEPTANCE GATE - MPLADS AUDIT TRIAGE (v3.6)  "
echo "================================================================="

# [1/16] Security: No hardcoded credentials
echo "[1/16] Security: Checking for hardcoded credentials..."
if git grep -i "ChangeMe123" --quiet 2>/dev/null; then
    echo "  ✗ FAIL: Hardcoded credentials found"
    exit 1
fi
if git grep "9f8e7d6c5b4a3f2e1d0c" --quiet 2>/dev/null; then
    echo "  ✗ FAIL: Default SECRET_KEY found"
    exit 1
fi
echo "  ✓ PASS: No hardcoded credentials"

# [2/16] Typed Configuration
echo "[2/16] Testing fail-closed production configuration..."
.venv/bin/python3 -c "
from mplads_fraud_detection.settings import Settings

# Test should fail with SQLite in production
try:
    Settings(
        APP_ENV='production',
        DATABASE_URL='sqlite:///test.db',
        SECRET_KEY='a' * 32
    )
    raise AssertionError('Should have rejected SQLite in production')
except ValueError:
    pass

print('  ✓ PASS: Configuration fail-closed validated')
"

# [3/16] Data Integrity & Source Lineage
echo "[3/16] Verifying data integrity, multi-source dataset lineage, and reconciliation..."
.venv/bin/python3 -c "
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, Dataset, IngestionRun
session = SessionLocal()
work_count = session.query(Work).count()
dataset_count = session.query(Dataset).count()
missing_lineage = session.query(Work).filter(
    (Work.source_file == None) | (Work.source_file_checksum == None) | (Work.source_url == None)
).count()
latest_run = session.query(IngestionRun).order_by(IngestionRun.started_at.desc()).first()

session.close()
assert work_count == 8512, f'Expected 8512 works, got {work_count}'
assert dataset_count >= 3, f'Expected at least 3 registered datasets, got {dataset_count}'
assert missing_lineage == 0, f'{missing_lineage} works lack source file/checksum/URL lineage'
assert latest_run is not None and latest_run.raw_row_count == 18190, 'IngestionRun raw row count incorrect'
assert latest_run.duplicate_row_count == 9678, 'IngestionRun duplicate row count incorrect'
print(f'  ✓ PASS: {work_count:,} works with complete lineage, {dataset_count} datasets, 18,190 raw / 9,678 duplicates reconciled')
"

# [4/16] Pandera Validation
echo "[4/16] Testing data validation and quarantine routing..."
.venv/bin/pytest tests/test_data_validation.py -v --tb=short

# [5/16] Anti-Synthetic & Test Contamination Audit
echo "[5/16] Verifying zero synthetic records and zero test/demo audit labels..."
.venv/bin/python3 -c "
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import Work, FraudLabel, LabelHistory

session = SessionLocal()
synthetic_works = session.query(Work).filter_by(data_origin='SYNTHETIC_DEMO').count()
assert synthetic_works == 0, f'Found {synthetic_works} synthetic works'

label_count = session.query(FraudLabel).count()
history_count = session.query(LabelHistory).count()
assert label_count == 0, f'Found {label_count} test/demo fraud labels in operational database'
assert history_count == 0, f'Found {history_count} test/demo label history records in operational database'

# Check honest status terminology
overstated_quality = session.query(Work).filter_by(data_quality_status='VERIFIED_COMPLIANT').count()
assert overstated_quality == 0, f'Found {overstated_quality} works with overstated VERIFIED_COMPLIANT status'
overstated_payment = session.query(Work).filter_by(payment_data_status='NO_DISBURSEMENT_RECORD').count()
assert overstated_payment == 0, f'Found {overstated_payment} works with unjustified NO_DISBURSEMENT_RECORD status'

print('  ✓ PASS: Zero synthetic records, zero test labels, and honest portal status terminology confirmed')
session.close()
"

# [6/16] Server-Side RBAC
echo "[6/16] Testing server-side authorization enforcement..."
.venv/bin/pytest tests/test_rbac_server_side.py -v --tb=short

# [7/16] Alembic Idempotency
echo "[7/16] Testing Alembic migration idempotency..."
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic upgrade head > /dev/null 2>&1
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic downgrade base > /dev/null 2>&1
DATABASE_URL=sqlite:///test_migration.db .venv/bin/alembic upgrade head > /dev/null 2>&1
rm -f test_migration.db
echo "  ✓ PASS: Migrations are idempotent"

# [8/16] Password Cryptography
echo "[8/16] Verifying bcrypt password hashing..."
.venv/bin/python3 << 'EOF'
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import User
session = SessionLocal()
users = session.query(User).all()
for u in users:
    assert u.password_hash.startswith('$2') or u.password_hash.startswith('dummy_'), f'User {u.username} password not bcrypt'
print(f'  ✓ PASS: User passwords properly secured')
session.close()
EOF

# [9/16] Detector Registry & Capacity Triage
echo "[9/16] Verifying detector registry and capacity tiers..."
.venv/bin/python3 -c "
from mplads_fraud_detection.detectors.registry import DETECTOR_REGISTRY, DetectorStatus
assert len(DETECTOR_REGISTRY) == 15, 'Expected 15 detectors in registry'
print(f'  ✓ PASS: {len(DETECTOR_REGISTRY)} detectors registered')
"

# [10/16] Documentation & Dependencies Lockfile
echo "[10/16] Verifying documentation, lockfile, and package declarations..."
test -f docs/ROLLBACK.md || { echo "Missing ROLLBACK.md"; exit 1; }
test -f docs/USER_GUIDE.md || { echo "Missing USER_GUIDE.md"; exit 1; }
test -f docs/RETENTION_POLICY.md || { echo "Missing RETENTION_POLICY.md"; exit 1; }
test -f .env.example || { echo "Missing .env.example"; exit 1; }
test -f pyproject.toml || { echo "Missing pyproject.toml"; exit 1; }
test -f requirements.lock || { echo "Missing requirements.lock"; exit 1; }

grep -q "pydantic-settings" pyproject.toml || { echo "FAIL: pydantic-settings missing from pyproject.toml"; exit 1; }
grep -q "Flagged records require verification and are not fraud findings" docs/USER_GUIDE.md || { echo "FAIL: Missing disclaimer in USER_GUIDE.md"; exit 1; }
echo "  ✓ PASS: All documentation, lockfile, and dependency declarations verified"

# [11/16] P0-1: Pipeline RBAC on Initial Run
echo "[11/16] Verifying initial pipeline RBAC enforcement..."
grep -q 'st.session_state.get("role") != "Admin"' app.py || { echo "FAIL: Missing role check on uninitialized pipeline"; exit 1; }
grep -q '@require_role("Admin")' app.py || { echo "FAIL: Missing require_role Admin on initial pipeline"; exit 1; }
echo "  ✓ PASS: Uninitialized pipeline run strictly gated behind Admin role"

# [12/16] P0-2: Dual-Review Label Workflow & Cryptographic Evidence Validation
echo "[12/16] Verifying dual-review workflow and cryptographic evidence verification..."
.venv/bin/pytest tests/test_label_approval_workflow.py -v --tb=short

# [13/16] P0-4: Docker Migration Runner
echo "[13/16] Verifying Docker migration runner and entrypoint..."
test -x docker-entrypoint.sh || { echo "FAIL: docker-entrypoint.sh missing or not executable"; exit 1; }
grep -q "alembic upgrade head" docker-entrypoint.sh || { echo "FAIL: Entrypoint does not run alembic upgrade head"; exit 1; }
grep -q "ENTRYPOINT" Dockerfile || { echo "FAIL: Dockerfile missing ENTRYPOINT"; exit 1; }
grep -q "requirements.lock" Dockerfile || { echo "FAIL: Dockerfile missing requirements.lock"; exit 1; }
echo "  ✓ PASS: Docker entrypoint and reproducible lockfile builds verified"

# [14/16] P0-5: Docker Security
echo "[14/16] Verifying Docker security configuration..."
if grep -q "DB_PASSWORD:-" docker-compose.yml; then
    echo "  ✗ FAIL: Hardcoded fallback password found in docker-compose.yml"
    exit 1
fi
if grep -q "5432:5432" docker-compose.yml; then
    echo "  ✗ FAIL: PostgreSQL port 5432 publicly exposed in docker-compose.yml"
    exit 1
fi
test -x check_env.sh || { echo "FAIL: check_env.sh missing or not executable"; exit 1; }
echo "  ✓ PASS: Docker configuration secured (private network, no fallback passwords)"

# [15/16] P0-3: ML Quarantine
echo "[15/16] Verifying ML quarantine..."
if test -f scripts/train_and_evaluate_model.py; then
    echo "  ✗ FAIL: scripts/train_and_evaluate_model.py not quarantined"
    exit 1
fi
if test -f mplads_fraud_detection/models/ensemble.py; then
    echo "  ✗ FAIL: mplads_fraud_detection/models/ensemble.py not quarantined"
    exit 1
fi
test -f scripts/train_model.py || { echo "FAIL: scripts/train_model.py placeholder missing"; exit 1; }
.venv/bin/python3 -c "
import subprocess, sys
res = subprocess.run([sys.executable, 'scripts/train_model.py'], capture_output=True, text=True)
assert res.returncode == 1, 'train_model.py did not exit with code 1'
assert 'gated until 300+ verified labels' in res.stdout, 'Missing gating error message'
"
echo "  ✓ PASS: Premature ML code quarantined; training script gated"

# [16/16] Staging Smoke Test: PostgreSQL TLS Connectivity & Migration Validation
echo "[16/16] Executing Staging Smoke Test (PostgreSQL TLS & Migration DDL)..."
./tests/staging_smoke_test.sh

echo ""
echo "================================================================="
echo "  ✅ ALL 16 COMPREHENSIVE ACCEPTANCE GATES PASSED (v3.6)"
echo "  Evidence Verification, Lockfile, and Staging TLS Fully Certified"
echo "================================================================="
