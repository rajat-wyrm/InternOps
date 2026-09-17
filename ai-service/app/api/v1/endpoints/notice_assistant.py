from fastapi import APIRouter, Depends
from app.core.auth import User, get_current_user
from app.core.rate_limiter import ai_rate_limiter
from app.providers.orchestrator import ai_orchestrator
from app.models.notice_assistant import NoticeAssistRequest
import json

router = APIRouter()

SYSTEM_PROMPT = """
You are a Notice Parser. Return ONLY valid JSON with this schema:
{
  "suggested_title": "string, professional",
  "suggested_category": "one of [Internship, Event, Reminder, Important, Announcement, General]",
  "summary": "1-2 line concise summary",
  "extracted_info": {
    "deadline": "date string or null",
    "application_link": "url or null",
    "eligibility": "string or null",
    "date_time": "string or null",
    "other_details": []
  },
  "suggested_action_button": "one of [Apply Now, Register Now, View Details, Learn More, None]",
  "rewritten_content": "professional and clear version"
}
Notice Content:
"""

@router.post(
    "/notice-assist",
    dependencies=[Depends(ai_rate_limiter.check_rate_limit)],
)
async def notice_assist(
    payload: NoticeAssistRequest,
    current_user: User = Depends(get_current_user),
):
    full_prompt = SYSTEM_PROMPT + payload.content
    result = await ai_orchestrator.generate_text_with_fallback(full_prompt)

    try:
        data = json.loads(result.content)
    except:
        cleaned = result.content.replace("```json","").replace("```","").strip()
        data = json.loads(cleaned)

    return data