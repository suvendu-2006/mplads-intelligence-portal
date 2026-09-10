import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

os.environ["VERCEL"] = "1"

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
