from pydantic import BaseModel


class NoticeAssistRequest(BaseModel):
    content: str
