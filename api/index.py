import os
import sys
import gzip
import shutil
from pathlib import Path

# Add project root directory to sys.path so webapi and local modules resolve properly
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Signal to backend that it is executing in Vercel Serverless environment
os.environ["VERCEL"] = "1"

# Decompress ultra-compact 8.6MB gzipped database to /tmp if needed (takes ~70ms on cold start)
tmp_db = Path("/tmp/mplads_dev.db")
if not tmp_db.exists() or tmp_db.stat().st_size == 0:
    for gz_candidate in [
        Path(__file__).resolve().parent / "mplads_dev.db.gz",
        Path("/var/task/api/mplads_dev.db.gz"),
        ROOT_DIR / "api" / "mplads_dev.db.gz",
    ]:
        if gz_candidate.exists() and gz_candidate.is_file():
            tmp_write = Path(f"/tmp/mplads_dev.db.tmp.{os.getpid()}")
            with gzip.open(gz_candidate, "rb") as f_in, open(tmp_write, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
            os.replace(str(tmp_write), str(tmp_db))
            break

if tmp_db.exists() and tmp_db.stat().st_size > 0:
    os.environ["DATABASE_PATH"] = str(tmp_db.resolve())
else:
    for candidate in [
        Path(__file__).resolve().parent / "mplads_dev.db",
        Path("/var/task/api/mplads_dev.db"),
        ROOT_DIR / "mplads_dev.db",
        Path("/var/task/mplads_dev.db"),
    ]:
        if candidate.exists() and candidate.is_file():
            os.environ["DATABASE_PATH"] = str(candidate.resolve())
            break

from webapi.main import app

# Expose both app and handler for universal Vercel Python runtime compatibility
handler = app
