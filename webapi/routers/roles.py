from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from webapi.models import EnvelopeResponse, RoleInfo, RoleSwitchRequest, RoleSwitchResponse, StateDetailData
from webapi.auth_demo import ROLE_PERMISSIONS, ROLE_DESCRIPTIONS, switch_role_session, get_current_user
from webapi.routers.states import get_state_detail
from webapi.data_service import get_db

router = APIRouter()

@router.get("/roles", response_model=EnvelopeResponse[List[RoleInfo]])
def list_roles():
    roles_list = [
        RoleInfo(
            role=role,
            description=ROLE_DESCRIPTIONS.get(role, ""),
            permissions=perms
        )
        for role, perms in ROLE_PERMISSIONS.items()
    ]
    return EnvelopeResponse(data=roles_list, meta=None, warnings=[])

@router.post("/switch-role", response_model=EnvelopeResponse[RoleSwitchResponse])
def switch_role(payload: RoleSwitchRequest):
    session_data = switch_role_session(
        role=payload.role,
        state=payload.state,
        district=payload.district,
        mp_id=payload.mp_id,
        mp_name=payload.mp_name
    )
    resp = RoleSwitchResponse(
        role=session_data["role"],
        state=session_data.get("state"),
        district=session_data.get("district"),
        mp_id=session_data.get("mp_id"),
        mp_name=session_data.get("mp_name"),
        session_token=session_data["session_token"],
        permissions=session_data["permissions"]
    )
    warnings = [
        "⚠️ DEMO MODE — This is a simulated role switch for rapid prototyping. Production requires enterprise JWT."
    ]
    return EnvelopeResponse(data=resp, meta=None, warnings=warnings)

@router.get("/my-state", response_model=EnvelopeResponse[StateDetailData])
def get_my_state(
    state: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = user.get("role")
    if role not in ["state_nodal_officer", "admin"]:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. State Nodal Officer role required (current: '{role}')"
        )
    assigned_state = state or user.get("state") or "ALL"
    if assigned_state.upper() in ["ALL", "ALL STATES", "ALL STATES & UNION TERRITORIES"]:
        assigned_state = "UTTAR PRADESH"  # Canonical representative state for demonstration
    return get_state_detail(state=assigned_state, db=db)
