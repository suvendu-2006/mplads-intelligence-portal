"""
Administrative Bootstrap Utility for MPLADS Forensic Audit Platform.
Allows secure initial admin provisioning via one-time bootstrap token or CLI.
"""

import os
import sys
import getpass
import bcrypt
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import User, AuditLog
from datetime import datetime, timezone


def bootstrap_admin(username: str = None, password: str = None, token: str = None) -> bool:
    """Create or reset administrator user via secure bootstrap token."""
    expected_token = os.getenv("ADMIN_BOOTSTRAP_TOKEN")
    if not expected_token:
        print("ERROR: ADMIN_BOOTSTRAP_TOKEN environment variable is required to bootstrap admin.")
        return False

    # Check non-interactive vs interactive
    input_token = token or os.getenv("ENTERED_BOOTSTRAP_TOKEN")
    if not input_token:
        try:
            input_token = input("Enter ADMIN_BOOTSTRAP_TOKEN: ").strip()
        except EOFError:
            print("ERROR: No input provided for bootstrap token.")
            return False

    if input_token != expected_token:
        print("ERROR: Invalid bootstrap token provided. Operation rejected.")
        return False

    admin_user = username or os.getenv("ADMIN_BOOTSTRAP_USERNAME")
    if not admin_user:
        try:
            admin_user = input("Enter new Admin username (default 'admin'): ").strip() or "admin"
        except EOFError:
            admin_user = "admin"

    admin_pass = password or os.getenv("ADMIN_BOOTSTRAP_PASSWORD")
    if not admin_pass:
        try:
            admin_pass = getpass.getpass("Enter Admin password (min 12 chars): ")
        except (EOFError, io.UnsupportedOperation):
            print("ERROR: Password required.")
            return False

    if len(admin_pass) < 12:
        print("ERROR: Password must be at least 12 characters.")
        return False

    session = SessionLocal()
    try:
        hashed = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        existing = session.query(User).filter_by(username=admin_user).first()
        if existing:
            existing.password_hash = hashed
            existing.role = "Admin"
            existing.is_active = True
            action_desc = "ADMIN_PASSWORD_RESET_VIA_BOOTSTRAP"
            print(f"✓ Successfully rotated credentials for Admin '{admin_user}'.")
        else:
            admin = User(
                username=admin_user,
                password_hash=hashed,
                role="Admin",
                is_active=True
            )
            session.add(admin)
            action_desc = "ADMIN_BOOTSTRAP_PROVISIONED"
            print(f"✓ Admin user '{admin_user}' provisioned successfully.")

        log = AuditLog(
            action=action_desc,
            entity_type="USER_ACCOUNT",
            entity_id=admin_user,
            timestamp=datetime.now(timezone.utc),
            details_json={"initiated_via": "CLI_BOOTSTRAP"}
        )
        session.add(log)
        session.commit()
        print("⚠️  Bootstrap token has been consumed. Unset ADMIN_BOOTSTRAP_TOKEN now.")
        return True
    except Exception as e:
        session.rollback()
        print(f"ERROR: Database error during admin bootstrap: {e}")
        return False
    finally:
        session.close()


if __name__ == "__main__":
    success = bootstrap_admin()
    sys.exit(0 if success else 1)
