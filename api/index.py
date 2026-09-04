import os
import sys
import shutil
from pathlib import Path

# Add project root directory to sys.path so webapi and local modules resolve properly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Signal to backend that it is executing in Vercel Serverless environment
os.environ["VERCEL"] = "1"

# Prime database to /tmp for zero-locking, high-performance SQLite on serverless
tmp_db = Path("/tmp/mplads_dev.db")
if not tmp_db.exists():
    for candidate in [
        Path(__file__).resolve().parent / "mplads_dev.db",
        ROOT_DIR / "mplads_dev.db",
        Path("/var/task/api/mplads_dev.db"),
        Path("/var/task/mplads_dev.db"),
    ]:
        if candidate.exists() and candidate.is_file():
            try:
                shutil.copyfile(candidate, tmp_db)
                break
            except Exception:
                pass

from webapi.main import app
