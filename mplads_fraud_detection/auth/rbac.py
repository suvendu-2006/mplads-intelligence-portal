"""
Role-Based Access Control (RBAC) Server-Side Enforcement.
Guarantees authorization is validated on the backend, preventing unauthorized API/function calls.
"""

from functools import wraps
from datetime import datetime, timezone
import streamlit as st
from mplads_fraud_detection.foundation.db import SessionLocal
from mplads_fraud_detection.foundation.schema import AuditLog


def require_role(*allowed_roles):
    """
    Server-side role enforcement decorator.
    Verifies that the caller possesses one of the allowed roles;
    logs violations to the immutable audit trail and halts execution.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Check Streamlit session state
            user_role = getattr(st, "session_state", {}).get("role")
            user_id = getattr(st, "session_state", {}).get("user_id", "ANONYMOUS")

            if not user_role or user_role not in allowed_roles:
                session = SessionLocal()
                try:
                    log = AuditLog(
                        user_id=user_id if isinstance(user_id, str) else None,
                        action="UNAUTHORIZED_ACCESS_ATTEMPT",
                        entity_type="BACKEND_FUNCTION",
                        entity_id=func.__name__,
                        timestamp=datetime.now(timezone.utc),
                        details_json={
                            "required_roles": list(allowed_roles),
                            "actual_role": user_role
                        }
                    )
                    session.add(log)
                    session.commit()
                except Exception:
                    session.rollback()
                finally:
                    session.close()

                # In Streamlit runtime, call st.error and st.stop()
                if hasattr(st, "error"):
                    st.error(f"❌ Access Denied: Action '{func.__name__}' requires one of: {list(allowed_roles)}")
                if hasattr(st, "stop"):
                    st.stop()
                raise PermissionError(f"Access Denied: Requires one of {list(allowed_roles)}, current role is '{user_role}'")

            return func(*args, **kwargs)
        return wrapper
    return decorator
