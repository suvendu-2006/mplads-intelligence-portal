"""
Automated Database Backup and Integrity Verification Script.
Generates timestamped, gzip-compressed database backups with 30-day retention.
"""

import os
import shutil
import gzip
import time
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_FILE = BASE_DIR / "mplads_dev.db"
BACKUP_DIR = BASE_DIR / "backups"


def perform_backup(retention_days: int = 30) -> Path:
    """Creates a compressed database backup and cleans up stale archives."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    
    if not DB_FILE.exists():
        raise FileNotFoundError(f"Database file {DB_FILE} not found to backup.")

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"mplads_fraud_backup_{timestamp}.db.gz"
    backup_target = BACKUP_DIR / backup_filename

    # Compress database file
    with open(DB_FILE, "rb") as f_in:
        with gzip.open(backup_target, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)

    # Verify backup integrity
    if not backup_target.exists() or backup_target.stat().st_size == 0:
        raise RuntimeError(f"Backup failed: Output file {backup_target} is missing or empty.")

    print(f"✅ Backup created successfully: {backup_target} ({backup_target.stat().st_size / 1024:.1f} KB)")

    # Rotate old backups
    cutoff_time = time.time() - (retention_days * 86400)
    for old_file in BACKUP_DIR.glob("*.db.gz"):
        if old_file.stat().st_mtime < cutoff_time:
            old_file.unlink()
            print(f"🗑️ Rotated stale backup: {old_file.name}")

    return backup_target


if __name__ == "__main__":
    perform_backup()
