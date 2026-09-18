import os
import sys
import gzip
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ["VERCEL"] = "1"

tmp_db = Path("/tmp/mplads_dev.db")
if not tmp_db.exists() or tmp_db.stat().st_size == 0:
    for gz_candidate in [
        Path(__file__).resolve().parent / "mplads_dev.db.gz",
        Path("/var/task/api/mplads_dev.db.gz"),
        ROOT_DIR / "api" / "mplads_dev.db.gz",
    ]:
        if gz_candidate.exists() and gz_candidate.is_file():
            with gzip.open(gz_candidate, "rb") as f_in, open(tmp_db, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)
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

handler = app
