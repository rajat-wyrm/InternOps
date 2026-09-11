from typing import List, Optional
from pydantic import BaseModel, Field

class NoticeAssistRequest(BaseModel):
    content: str

class ExtractedInfo(BaseModel):
    deadline: Optional[str] = None
    application_link: Optional[str] = None
    eligibility: Optional[str] = None
    date_time: Optional[str] = None
    other_details: List[str] = Field(default_factory=list)

class NoticeAssistResponse(BaseModel):
    suggested_title: str
    suggested_category: str
    summary: str
    extracted_info: ExtractedInfo
    suggested_action_button: str
    rewritten_content: str