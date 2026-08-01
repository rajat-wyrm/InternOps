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