# Platform Operations Manual & Maintenance Guide

## 1. Daily & Automated Database Backups
Automated compressed database backups are generated via `scripts/backup_database.py`:
```bash
python scripts/backup_database.py
```
* **Storage Location**: `backups/mplads_fraud_backup_YYYYMMDD_HHMMSS.db.gz`
* **Integrity Guarantee**: Every archive is verified immediately upon compression.
* **Retention Policy**: Stale archives older than 30 days are automatically rotated and purged.

---

## 2. Running the Forensic Pipeline
To execute a deterministic snapshot run:
```bash
python -m mplads_fraud_detection.pipeline
```
* **Strict Idempotency**: Prior runs with the same snapshot key are automatically purged before insertion.
* **Concurrency Safety**: SQLite operates in WAL mode with 30-second busy timeout and single-writer atomic transactions.

---

## 3. Database Recovery Procedure
If database rollback or disaster recovery is required:
```bash
# Decompress latest backup into active database
gunzip -c backups/latest_backup.db.gz > mplads_fraud.db
```
*(Never delete the database to resolve locks; SQLite WAL mode and busy timeouts prevent locking conflicts).*
