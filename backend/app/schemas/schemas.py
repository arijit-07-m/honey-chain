from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Hives ──────────────────────────────────────────────────────────────────

class HiveResponse(BaseModel):
    id: int
    hive_code: str
    cluster_id: Optional[int] = None
    farmer_id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class HiveDetailResponse(HiveResponse):
    latest_temperature: Optional[float] = None
    latest_humidity: Optional[float] = None
    latest_weight: Optional[float] = None
    latest_sound_level: Optional[float] = None
    anomaly_status: Optional[str] = None
    last_updated: Optional[datetime] = None


# ── Sensor Readings ────────────────────────────────────────────────────────

class SensorReadingResponse(BaseModel):
    id: int
    hive_id: int
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    weight: Optional[float] = None
    sound_level: Optional[float] = None
    timestamp: datetime
    anomaly: bool = False
    anomaly_score: Optional[float] = None

    class Config:
        from_attributes = True

class SensorReadingCreate(BaseModel):
    hive_id: int
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    weight: Optional[float] = None
    sound_level: Optional[float] = None
    timestamp: Optional[datetime] = None


# ── Batches ────────────────────────────────────────────────────────────────

class HarvestCreate(BaseModel):
    hive_id: int
    honey_type: str = Field(default="Mustard Honey")
    harvest_date: datetime = Field(default_factory=datetime.utcnow)
    quantity: float
    location: Optional[str] = None
    notes: Optional[str] = None

class BatchResponse(BaseModel):
    id: int
    batch_code: str
    hive_id: int
    farmer_id: int
    honey_type: Optional[str] = None
    quantity: float
    harvest_date: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class BatchDetailResponse(BatchResponse):
    events: List["TraceabilityEventResponse"] = []


# ── Traceability Events ────────────────────────────────────────────────────

class TraceabilityEventResponse(BaseModel):
    id: int
    batch_id: int
    stage: str
    actor_id: int
    event_data: Optional[str] = None
    timestamp: datetime
    previous_hash: str
    current_hash: str

    class Config:
        from_attributes = True

class EventCreate(BaseModel):
    stage: str
    event_data: Optional[str] = None


# ── Blockchain ─────────────────────────────────────────────────────────────

class VerifyResponse(BaseModel):
    valid: bool
    batch_id: str
    message: str


# ── Alerts ─────────────────────────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: int
    hive_id: int
    type: str
    message: str
    severity: str
    created_at: datetime
    resolved: bool

    class Config:
        from_attributes = True


# ── Admin ──────────────────────────────────────────────────────────────────

class AdminDashboardResponse(BaseModel):
    total_clusters: int = 0
    total_beekeepers: int = 0
    active_hives: int = 0
    honey_produced_kg: float = 0
    recent_alerts: List[AlertResponse] = []

class ClusterStatsResponse(BaseModel):
    id: int
    name: str
    location: str
    hive_count: int = 0
    beekeeper_count: int = 0
    honey_produced_kg: float = 0