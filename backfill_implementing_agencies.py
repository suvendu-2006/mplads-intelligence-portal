#!/usr/bin/env python3
"""
Root entry point for Idempotent Database Migration Script:
Adds and backfills `implementing_agency` and `implementing_agency_raw` columns
in the works table of mplads_dev.db using authoritative MoSPI data sources.
"""

import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from scripts.backfill_implementing_agencies import migrate_database

if __name__ == "__main__":
    migrate_database()
