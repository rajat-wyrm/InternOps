from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class AnomalyBase(BaseModel):
    intern_id: str = Field(..., description="UUID of the intern")
    flag_type: str = Field(..., description="Type of detected anomaly")
    severity: str = Field(..., description="Severity level: low, medium, or high")
    reason: str = Field(..., description="Human-readable explanation of the anomaly")
    details: Optional[Dict[str, Any]] = Field(default=None, description="Additional context or statistics")

class AnomalyCreate(AnomalyBase):
    pass

class AnomalyResponse(AnomalyBase):
    id: str
    intern_name: Optional[str] = None
    intern_email: Optional[str] = None
    viewed_by: Optional[str] = None
    viewed_by_name: Optional[str] = None
    viewed_at: Optional[datetime] = None
    notification_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnomalyListResponse(BaseModel):
    anomalies: List[AnomalyResponse]
    total: int

class TriggerAnalysisResponse(BaseModel):
    status: str
    message: str
