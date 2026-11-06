"""
Dual-Mode Security Gate & Work Authorization Engine.
Provides stateless HS256 JWT authentication (RFC 9110 Bearer) using standard library
with backward-compatible demo header fallback and multi-district scoping.
"""

import hmac
import hashlib
import base64
import json
import time
from typing import Optional, Dict, Any, List
from fastapi import Request, Header, HTTPException

from mplads_fraud_detection.settings import settings
from mplads_fraud_detection.foundation.schema import Work


def _b64_encode(data: bytes) -> str:
    """Base64 URL-safe encode without padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data: str) -> bytes:
    """Base64 URL-safe decode with padding restoration."""
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded)


def create_jwt_token(payload: Dict[str, Any], secret_key: str, expires_in: int = 86400) -> str:
    """
    Creates a signed HS256 JSON Web Token using standard library hmac and hashlib.
    """
    header = {"alg": "HS256", "typ": "JWT"}
    claims = dict(payload)
    claims["exp"] = int(time.time()) + expires_in
    claims["iat"] = int(time.time())

    header_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    claims_b64 = _b64_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{claims_b64}".encode("utf-8")

    signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64_encode(signature)
    return f"{header_b64}.{claims_b64}.{sig_b64}"


def decode_jwt_token(token: str, secret_key: str) -> Dict[str, Any]:
    """
    Decodes and verifies a signed HS256 JWT, checking signature integrity and expiration.
    """
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Malformed token: JWT must contain 3 dot-separated parts")

    header_b64, claims_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{claims_b64}".encode("utf-8")
    expected_sig = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

    if not hmac.compare_digest(_b64_encode(expected_sig), sig_b64):
        raise ValueError("Invalid signature: Token verification failed")

    claims = json.loads(_b64_decode(claims_b64).decode("utf-8"))
    if claims.get("exp", 0) < time.time():
        raise ValueError("Token expired")

    return claims


def get_authenticated_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_session_token: Optional[str] = Header(None),
    x_role: Optional[str] = Header(None),
    x_state: Optional[str] = Header(None),
    x_district: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    Dual-mode authentication dependency:
    1. Mode 1 (RFC 9110 Bearer): Decodes HS256 JWT with secret key.
    2. Mode 2 (Legacy Fallback): Falls back to webapi.auth_demo header-based authentication.
    """
    # Mode 1: RFC 9110 Bearer Token
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        try:
            claims = decode_jwt_token(token, settings.SECRET_KEY)
            dist = claims.get("district")
            assigned = claims.get("assigned_districts")
            if assigned is None:
                assigned = [dist] if dist and dist != "ALL" else []

            return {
                "user_id": claims.get("sub", claims.get("user_id", "jwt_user")),
                "role": claims.get("role", "viewer").lower(),
                "assigned_districts": assigned,
                "state": claims.get("state", "ALL"),
                "auth_mode": "jwt_bearer"
            }
        except Exception:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired Bearer token",
                headers={"WWW-Authenticate": "Bearer"}
            )

    # Mode 2: Backward-Compatible auth_demo Fallback
    from webapi.auth_demo import get_current_user
    user = get_current_user(
        x_session_token=x_session_token,
        x_role=x_role,
        x_state=x_state,
        x_district=x_district
    )
    dist = user.get("district")
    user["assigned_districts"] = [dist] if dist and dist != "ALL" else []
    user["auth_mode"] = "demo_header"
    return user


def verify_work_authorization(user: Dict[str, Any], work: Work):
    """
    Enforces role-based and geographical boundaries for work mutations.
    - admin, mospi: Full nationwide write access.
    - state_nodal_officer: Allowed only within assigned state.
    - district_authority: Allowed only within assigned district(s).
    - viewer, analyst, mp, etc.: Denied (HTTP 403 Forbidden).
    """
    role = user.get("role", "viewer").lower()

    # Superusers
    if role in ["admin", "mospi"]:
        return

    # State Nodal Officer
    if role == "state_nodal_officer":
        user_state = str(user.get("state") or "").strip().upper()
        work_state = str(work.state or "").strip().upper()
        if user_state in ["ALL", "ALL STATES", "ALL STATES & UNION TERRITORIES"] or (user_state and work_state and user_state == work_state):
            return
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Work state '{work.state}' does not match assigned state '{user_state}'"
        )

    # District Authority
    if role == "district_authority":
        assigned = [str(d).strip().upper() for d in user.get("assigned_districts", []) if str(d).strip()]
        work_district = str(work.district or "").strip().upper()
        if "ALL" in assigned or (work_district and work_district in assigned):
            return
        raise HTTPException(
            status_code=403,
            detail=f"Access denied: Work district '{work.district}' not in assigned districts {assigned}"
        )

    raise HTTPException(
        status_code=403,
        detail=f"Access denied: Role '{role}' lacks permission to modify works"
    )
