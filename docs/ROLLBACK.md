# Emergency Rollback Procedures

This document defines standardized operational procedures for rolling back migrations, application containers, model releases, and feature flags in the MPLADS Fraud Detection Platform.

---

## 1. Database Rollback

### Option A: Downgrade Migration (Schema Level)
When a newly applied Alembic migration causes issues or schema conflicts:
```bash
# Check current active revision
alembic current

# Downgrade one migration step
alembic downgrade -1

# Or downgrade to a specific known-good revision
alembic downgrade <revision_id>
```

### Option B: Full Database Restore (Data Corruption Recovery)

#### Production (PostgreSQL):
```bash
# Terminate existing connections and restore from daily dump
pg_restore -h $DB_HOST -U $DB_USER -d mplads_prod -c backups/daily_backup_YYYYMMDD.dump
```

#### Development / Staging (SQLite):
```bash
# Restore from forensic archive
gunzip -c backups/forensic_archive_pre_hardening.db.gz > mplads_dev.db
```

---

## 2. Application & Container Rollback

### Option A: Docker Deployment Rollback
```bash
# Revert to previous stable container tag
docker pull mplads-fraud-detection:v1.0.0
docker-compose down
docker-compose up -d
```

### Option B: Git Tag Release Rollback
```bash
# Fetch verified release tags
git fetch --tags

# Checkout prior stable production tag
git checkout prototype-before-production-hardening

# Reinstall pinned environment and restart service
pip install -e .
sudo systemctl restart mplads-api
```

---

## 3. Feature Flag Emergency Kill Switches

In case of runtime anomalies, feature flags in `.env` allow immediate deactivation without redeployment:

```bash
# 1. Kill switch for Supervised Machine Learning Predictions
ML_PREDICTIONS_ENABLED=false

# 2. Emergency Read-Only Maintenance Mode
MAINTENANCE_MODE=true

# 3. Disable specific detector (e.g. if a schedule rate changes)
DISABLED_DETECTORS="detector_15_copy_paste_pricing"
```

---

## 4. Post-Rollback Verification Checklist

Following any rollback execution, run the following verification steps:
1. `alembic current` confirms expected target revision.
2. `python -c "from mplads_fraud_detection.foundation.db import SessionLocal; from mplads_fraud_detection.foundation.schema import Work; print('Work count:', SessionLocal().query(Work).count())"` returns canonical 8,512.
3. Streamlit dashboard loads cleanly at `http://localhost:8501`.
4. Audit log entry is recorded with action `EMERGENCY_ROLLBACK` and reason.
