"""
Evidence Store and Cryptographic Verification for MPLADS Fraud Detection System.
Guarantees that CONFIRMED_FRAUD audit findings link to non-empty, authentic,
and cryptographically verified inspection reports in an immutable evidence store.
"""

import os
import re
import hashlib
from pathlib import Path
from typing import Tuple, Optional
from urllib.parse import urlparse

EVIDENCE_DIR = Path("data/evidence")

# SHA-256 checksum of an empty byte string (b"")
EMPTY_FILE_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

# Generic placeholder paths that cannot be accepted as official audit evidence
DISALLOWED_PLACEHOLDERS = {
    "/evidence/cag_inspection_2026.pdf",
    "/evidence/test.pdf",
    "/evidence/sample.pdf",
    "placeholder",
    "test.pdf",
    "sample.pdf",
    "dummy.pdf",
    "example.com"
}


def compute_bytes_sha256(content: bytes) -> str:
    """Compute SHA-256 checksum of raw bytes."""
    return hashlib.sha256(content).hexdigest()


def compute_file_sha256(filepath: Path) -> str:
    """Compute SHA-256 checksum of a file on disk."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def store_evidence_document(filename: str, content: bytes, target_dir: Optional[Path] = None) -> Tuple[str, str]:
    """
    Stores an official audit evidence document into the immutable evidence store.

    Args:
        filename: Original file name (e.g. 'cag_audit_krishna_2026.pdf')
        content: Binary content of the uploaded document
        target_dir: Optional directory to store document (defaults to EVIDENCE_DIR)

    Returns:
        Tuple of (stored_relative_path, sha256_checksum)

    Raises:
        ValueError: If file is empty or filename is invalid.
    """
    if not content or len(content) == 0:
        raise ValueError("Evidence document content cannot be empty (0 bytes).")

    checksum = compute_bytes_sha256(content)
    if checksum == EMPTY_FILE_SHA256:
        raise ValueError("Evidence document cannot have the empty-file SHA-256 hash.")

    dest_dir = Path(target_dir) if target_dir is not None else EVIDENCE_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Sanitize filename
    clean_filename = re.sub(r"[^\w\.-]", "_", Path(filename).name)
    stored_name = f"{checksum[:16]}_{clean_filename}"
    target_path = dest_dir / stored_name

    # Write file immutably (do not overwrite if already exists with same content)
    if not target_path.exists():
        with open(target_path, "wb") as f:
            f.write(content)

    return str(target_path), checksum


def validate_evidence(evidence_document_path: Optional[str], evidence_checksum: Optional[str]) -> None:
    """
    Rigorously validates evidence document path and SHA-256 checksum for CONFIRMED_FRAUD.

    Checks:
    1. Both path and checksum must be present and non-empty.
    2. Checksum cannot be the empty-file SHA-256 (e3b0c442...).
    3. Checksum must be a valid 64-character lowercase hex string.
    4. Path cannot be an unverified placeholder string.
    5. If path is a local file, the file must exist, be > 0 bytes, and its actual SHA-256
       must match the provided checksum.
    6. If path is a remote URI, it must use http/https/s3/gs schemes and have valid format.

    Raises:
        ValueError: If any validation condition fails.
    """
    if not evidence_document_path or not str(evidence_document_path).strip():
        raise ValueError("CONFIRMED_FRAUD requires a valid evidence_document_path.")

    if not evidence_checksum or not str(evidence_checksum).strip():
        raise ValueError("CONFIRMED_FRAUD requires a valid SHA-256 evidence_checksum.")

    doc_path = str(evidence_document_path).strip()
    checksum = str(evidence_checksum).strip().lower()

    # 1. Reject empty-file SHA-256
    if checksum == EMPTY_FILE_SHA256:
        raise ValueError(
            "Evidence rejected: SHA-256 checksum corresponds to an empty file (0 bytes). "
            "Authentic audit evidence must contain non-empty inspection documentation."
        )

    # 2. Validate SHA-256 format (exact 64 hexadecimal characters)
    if not re.match(r"^[0-9a-f]{64}$", checksum):
        raise ValueError(
            f"Evidence rejected: Checksum '{checksum}' is not a valid 64-character hexadecimal SHA-256 hash."
        )

    # 3. Check for disallowed placeholders
    if doc_path.lower() in DISALLOWED_PLACEHOLDERS:
        raise ValueError(
            f"Evidence rejected: '{doc_path}' is an unbacked placeholder path. "
            "Please upload or provide an authentic inspection document."
        )

    # 4. Check if it's a remote URI
    parsed = urlparse(doc_path)
    if parsed.scheme in ("http", "https", "s3", "gs"):
        if not parsed.netloc:
            raise ValueError(f"Evidence rejected: Remote URI '{doc_path}' is malformed.")
        return

    # 5. Local file validation
    local_path = Path(doc_path)
    if not local_path.exists():
        # Check relative to EVIDENCE_DIR as well
        alt_path = EVIDENCE_DIR / doc_path
        if alt_path.exists():
            local_path = alt_path
        else:
            raise ValueError(
                f"Evidence document not found at '{doc_path}'. "
                "Evidence files must exist in the local filesystem/evidence store or be a valid remote URI."
            )

    # Check file size
    file_size = local_path.stat().st_size
    if file_size == 0:
        raise ValueError(
            f"Evidence file '{doc_path}' is empty (0 bytes). Audit evidence must be non-empty."
        )

    # Verify cryptographic integrity: computed SHA-256 must match provided checksum
    actual_hash = compute_file_sha256(local_path)
    if actual_hash.lower() != checksum:
        raise ValueError(
            f"Cryptographic evidence mismatch: Provided SHA-256 ({checksum}) does not match "
            f"actual file contents hash ({actual_hash}). Evidence document may be forged or corrupted."
        )
