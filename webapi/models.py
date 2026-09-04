from typing import Generic, TypeVar, Optional, List, Any, Dict
from pydantic import BaseModel, Field, model_validator

T = TypeVar("T")

class MetaPagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
    has_next: bool
    has_prev: bool

class EnvelopeResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[MetaPagination] = None
    warnings: List[str] = Field(default_factory=list)

class NationalOverview(BaseModel):
    totalAllocated: float
    totalExpenditure: float
    utilizationPercentage: float
    totalMPs: int
    totalWorksCompleted: int
    totalWorksRecommended: int
    completionRate: float
    totalTransactions: int
    avgAllocation: float
    pendingWorks: int
    paymentGap: float
    completedWorksValue: float
    inProgressPayments: float

class StateSummaryItem(BaseModel):
    state: str
    totalAllocated: float
    totalExpenditure: float
    utilizationPercentage: float
    utilizationRate: Optional[float] = None
    mpCount: int
    totalMPs: int
    activeMpCount: Optional[int] = None
    districtCount: Optional[int] = None
    totalWorksCompleted: int
    completedWorksCount: int
    recommendedWorksCount: int
    pendingWorksCount: Optional[int] = None
    redFlagPct: float
    redFlagCount: int
    totalWorksCount: int

class DistrictTierCounts(BaseModel):
    red: int
    orange: int
    yellow: int
    green: int

class DistrictSummaryItem(BaseModel):
    district_nodal: str
    district: Optional[str] = None
    districtNodal: Optional[str] = None
    total_works: int
    totalWorks: Optional[int] = None
    completed_works_count: int
    completedWorks: Optional[int] = None
    recommended_works_count: int
    recommendedWorks: Optional[int] = None
    completion_rate_pct: float
    completionRatePct: Optional[float] = None
    portfolio_value: float
    portfolioValue: Optional[float] = None
    expenditure: float
    balance: float
    in_progress_payments_inr: float
    mp_count: int
    mps_active: str
    activeMps: Optional[str] = None
    constituencies_covered: str
    primary_sector: str
    tier_counts: DistrictTierCounts
    tierCounts: Optional[DistrictTierCounts] = None
    red_work_count: int
    is_estimated: Optional[bool] = False
    isEstimated: Optional[bool] = False

class StateDetailSummary(BaseModel):
    totalAllocated: float
    totalExpenditure: float
    utilizationPercentage: float
    utilizationRate: Optional[float] = None
    mpCount: int
    activeMpCount: Optional[int] = None
    districtCount: Optional[int] = None
    totalWorksCompleted: int
    redFlagPct: float

class StateDetailData(BaseModel):
    state: str
    summary: StateDetailSummary
    districts: List[DistrictSummaryItem]

class FlagItem(BaseModel):
    work_id: int
    work_description: str
    cost: float
    category: Optional[str] = None
    district: str
    state: str
    mp_name: str
    constituency: str
    detector_type: str
    detector_name: str
    severity: float
    tier: str
    explanation: str
    evidence: Dict[str, Any]
    detected_at: str
    cpwd_comparison: Optional[Dict[str, Any]] = None

    # camelCase convenience aliases for React components
    workDescription: Optional[str] = None
    detectorName: Optional[str] = None
    sanctionedCost: Optional[float] = None
    workId: Optional[int] = None
    mpName: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "work_description" in data and not data.get("workDescription"):
                data["workDescription"] = data["work_description"]
            if "detector_name" in data and not data.get("detectorName"):
                data["detectorName"] = data["detector_name"]
            if "cost" in data and not data.get("sanctionedCost"):
                data["sanctionedCost"] = data["cost"]
            if "work_id" in data and not data.get("workId"):
                data["workId"] = data["work_id"]
            if "mp_name" in data and not data.get("mpName"):
                data["mpName"] = data["mp_name"]
        return data

class MPListItem(BaseModel):
    id: str
    mpName: str
    house: str
    state: str
    constituency: str
    allocatedAmount: float
    totalAllocated: Optional[float] = None
    totalExpenditure: float
    utilizationPercentage: float
    utilizationRate: Optional[float] = None
    completedWorksCount: int
    recommendedWorksCount: int
    completionRate: float
    pendingWorks: int
    unspentAmount: float
    completedWorksValue: float
    totalCompletedAmount: float
    inProgressPayments: float
    paymentGapPercentage: float
    redFlagPct: float
    redFlagCount: int

class MPWorkItem(BaseModel):
    work_id: int
    workId: Optional[int] = None
    work_description: str
    workDescription: Optional[str] = None
    cost: float
    category: Optional[str] = None
    district: Optional[str] = None
    status: str
    completion_date: Optional[str] = None
    has_flags: bool
    flag_count: int
    delay_days: Optional[int] = None
    delayDays: Optional[int] = None
    progress_pct: Optional[int] = None
    progressPct: Optional[int] = None

class EntityRiskItem(BaseModel):
    entity_type: str
    entity_key: str
    composite_risk: float
    composite_risk_score: Optional[float] = None
    risk_tier: str
    risk_rank: int
    breakdown: Dict[str, Any]
    entity_name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    concentration_score: Optional[float] = None
    velocity_score: Optional[float] = None
    pattern_score: Optional[float] = None

    @model_validator(mode="after")
    def sync_risk_score(self):
        if self.composite_risk_score is None:
            self.composite_risk_score = self.composite_risk
        return self

class MPDetailData(BaseModel):
    summary: Dict[str, Any]
    dossier: Optional[Dict[str, Any]] = None
    works: List[MPWorkItem]
    flags: List[FlagItem]
    entity_risk: Optional[EntityRiskItem] = None

class RoleInfo(BaseModel):
    role: str
    description: str
    permissions: List[str]

class RoleSwitchRequest(BaseModel):
    role: str
    state: Optional[str] = None
    district: Optional[str] = None
    mp_id: Optional[str] = None
    mp_name: Optional[str] = None

class RoleSwitchResponse(BaseModel):
    role: str
    state: Optional[str] = None
    district: Optional[str] = None
    mp_id: Optional[str] = None
    mp_name: Optional[str] = None
    session_token: str
    permissions: List[str]

class DetectorMetaItem(BaseModel):
    detector_id: str
    name: str
    status: str
    regulatory_source: str
    assumptions: str
    limitations: str
