from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CertificateRequest(BaseModel):
    task: str = Field(..., min_length=1, max_length=2000)

    @field_validator("task")
    @classmethod
    def strip_task(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task cannot be empty.")
        return value


def _require_non_empty(value: Optional[str], field_name: str) -> str:
    if value is None or not str(value).strip():
        raise ValueError(f"{field_name} is required.")
    return str(value).strip()


class ValidateCertificateRequest(BaseModel):
    name: str = Field(..., max_length=200)
    company: str = Field(..., max_length=200)
    achievement: str = Field(..., max_length=500)
    date: Optional[str] = Field(default=None, max_length=50)
    use_ai: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _require_non_empty(value, "name")

    @field_validator("company")
    @classmethod
    def validate_company(cls, value: str) -> str:
        return _require_non_empty(value, "company")

    @field_validator("achievement")
    @classmethod
    def validate_achievement(cls, value: str) -> str:
        return _require_non_empty(value, "achievement")


class GenerateAchievementRequest(BaseModel):
    recipient_name: str = Field(..., max_length=200)
    recognition_type: str = Field(..., max_length=200)
    core_achievement: str = Field(..., max_length=500)
    desired_tone: str = Field(default="Professional", max_length=50)

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_name(cls, value: str) -> str:
        return _require_non_empty(value, "recipient_name")


class GenerateContentRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)
    tone: str = Field(default="formal", max_length=50)
    content_type: str = Field(default="blog post", max_length=100)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        return _require_non_empty(value, "prompt")


class MatchTemplateRequest(BaseModel):
    certificate_type: str = Field(..., max_length=100)
    tone: Optional[str] = Field(default=None, max_length=50)
    industry: Optional[str] = Field(default=None, max_length=100)
    style: Optional[str] = Field(default=None, max_length=100)
    audience: Optional[str] = Field(default=None, max_length=100)
    language: Optional[str] = Field(default=None, max_length=50)
    user_text: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("certificate_type")
    @classmethod
    def validate_certificate_type(cls, value: str) -> str:
        return _require_non_empty(value, "certificate_type")


class ToneCustomizeRequest(BaseModel):
    recipient_name: str = Field(..., max_length=200)
    company_name: str = Field(..., max_length=200)
    certificate_type: str = Field(default="Internship", max_length=100)
    achievement: Optional[str] = Field(default=None, max_length=500)
    tone: str = Field(..., max_length=50)

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_name(cls, value: str) -> str:
        return _require_non_empty(value, "recipient_name")


class MultiLanguageRequest(BaseModel):
    recipient_name: str = Field(..., max_length=200)
    company_name: str = Field(..., max_length=200)
    certificate_type: str = Field(default="Internship", max_length=100)
    achievement: Optional[str] = Field(default=None, max_length=500)
    language: str = Field(..., max_length=50)

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_name(cls, value: str) -> str:
        return _require_non_empty(value, "recipient_name")


class DesignSuggestRequest(BaseModel):
    certificate_type: str = Field(..., max_length=100)
    industry: Optional[str] = Field(default=None, max_length=100)
    style: Optional[str] = Field(default=None, max_length=100)
    tone: Optional[str] = Field(default=None, max_length=50)
    audience: Optional[str] = Field(default=None, max_length=100)

    @field_validator("certificate_type")
    @classmethod
    def validate_certificate_type(cls, value: str) -> str:
        return _require_non_empty(value, "certificate_type")


class CertificatePreviewRequest(BaseModel):
    recipient_name: str = Field(..., max_length=200)
    title: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = Field(default=None, max_length=1000)
    closing: Optional[str] = Field(default=None, max_length=100)
    template_name: Optional[str] = Field(default=None, max_length=100)
    logo_url: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_name(cls, value: str) -> str:
        return _require_non_empty(value, "recipient_name")
