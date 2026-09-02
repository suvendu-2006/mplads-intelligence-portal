"""
Centralized structured logging configuration for MPLADS Fraud Detection Platform.
Supports console output and optional rotating file logging for observability.
"""

import sys
import logging
from pathlib import Path
from typing import Optional


def setup_logging(log_level: str = "INFO", log_file: Optional[str] = None):
    """
    Configure structured logging for production observability.

    Args:
        log_level: DEBUG, INFO, WARNING, ERROR, CRITICAL
        log_file: Optional path to write logs (defaults to stdout)
    """
    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_path, encoding="utf-8"))

    logging.basicConfig(
        level=getattr(logging, log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
        force=True
    )

    # Set third-party noisy loggers to WARNING
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    logging.getLogger("streamlit").setLevel(logging.WARNING)
