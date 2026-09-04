import uuid
from typing import Optional, Dict, Any, List
from fastapi import Header, HTTPException, Depends

ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "viewer": ["read:national", "read:states", "read:mps", "read:map"],
    "mp": ["read:mp_dashboard", "read:national", "read:states", "read:mps", "read:map", "action:do_letter"],
    "district_authority": ["read:district_dashboard", "read:national", "read:states", "read:mps", "read:map", "action:sanction_work", "action:review_mb"],
    "analyst": ["read:*", "filter:advanced"],
    "auditor": ["read:*", "filter:*", "export:flags"],
    "state_nodal_officer": ["read:my_state", "read:entity_risks", "read:national", "read:states", "read:mps", "read:map"],
    "admin": ["*"]
}

ROLE_DESCRIPTIONS: Dict[str, str] = {
    "viewer": "Public citizen read-only access to national analytics, states, MPs, and maps",
    "mp": "Member of Parliament dashboard with personal allocation ledger, recommended works, and D.O. letters",
    "district_authority": "District Collector & DPA command console for local sanctions, IDA supervision, and MB verification",
    "analyst": "Viewer permissions plus advanced multi-detector filtering and risk inspection",
    "auditor": "Full forensic workbench with deep diagnostic drawer and CSV audit dossier export",
    "state_nodal_officer": "State-scoped administrative command with localized IDA entity risk and project monitoring",
    "admin": "Superuser access with complete cross-state scrutiny, audit controls, and system parameters"
}

# In-memory session cache for demo mode
SESSIONS: Dict[str, Dict[str, Any]] = {}

def get_permissions(role: str) -> List[str]:
    return ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["viewer"])

def switch_role_session(
    role: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
    mp_id: Optional[str] = None,
    mp_name: Optional[str] = None
) -> Dict[str, Any]:
    if role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    if role == "state_nodal_officer":
        if not state or state.upper() in ["ALL", "ALL STATES", "ALL STATES & UNION TERRITORIES"]:
            state = "ALL"
    if role == "district_authority":
        if not district or district.upper() in ["ALL", "ALL DISTRICTS"]:
            district = "ALL"
            state = state or "ALL"
    if role == "mp":
        if not mp_name or mp_name.upper() in ["ALL", "ALL MPS", "ALL MEMBERS OF PARLIAMENT"]:
            mp_name = "All Members of Parliament"
            mp_id = "ALL"
            state = state or "ALL"

    session_token = f"demo_session_{uuid.uuid4().hex[:12]}"
    session_data = {
        "role": role,
        "state": state,
        "district": district,
        "mp_id": mp_id,
        "mp_name": mp_name,
        "session_token": session_token,
        "permissions": get_permissions(role)
    }
    SESSIONS[session_token] = session_data
    return session_data

def get_current_user(x_session_token: Optional[str] = Header(None)) -> Dict[str, Any]:
    if x_session_token and x_session_token in SESSIONS:
        return SESSIONS[x_session_token]
    
    # Auto-heal demo sessions if server restarted
    if x_session_token and ("demo_" in x_session_token or x_session_token.startswith("demo_session_")):
        return {
            "role": "state_nodal_officer",
            "state": "HIMACHAL PRADESH",
            "district": "SHIMLA",
            "mp_id": "6a932b5bcd944524379eddd9",
            "mp_name": "Anurag Singh Thakur",
            "session_token": x_session_token,
            "permissions": ROLE_PERMISSIONS["state_nodal_officer"]
        }

    # Default unauthenticated access is viewer
    return {
        "role": "viewer",
        "state": None,
        "session_token": "default_viewer",
        "permissions": ROLE_PERMISSIONS["viewer"]
    }

def require_roles(*allowed_roles: str):
    def role_checker(user: Dict[str, Any] = Depends(get_current_user)):
        user_role = user.get("role", "viewer")
        if "admin" == user_role:
            return user
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Current role '{user_role}' lacks permission. Required: {allowed_roles}"
            )
        return user
    return role_checker
