import os

# Maximum AI requests allowed per minute for a user/client
RATE_LIMIT_PER_MINUTE = int(
    os.getenv("RATE_LIMIT_PER_MINUTE", "15")
)
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "InternOps AI Service"
    API_V1_STR: str = "/api/v1"
    AI_PROVIDER_KEY: str = ""
    DEFAULT_MODEL: str = "gpt-4o-mini"

    class Config:
        env_file = ".env"


settings = Settings()
