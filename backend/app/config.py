from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LifeOS API"
    environment: str = "development"
    database_url: str = "sqlite:///./lifeos.db"
    secret_key: str = "development-only-change-me"
    app_encryption_key: str = "development-encryption-key"
    access_token_minutes: int = 60 * 24 * 7
    allowed_origins: str = "http://localhost:5173"

    llm_api_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_model: str = "llama-3.3-70b-versatile"

    youtube_api_key: str = ""
    youtube_region: str = "IN"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    whatsapp_verify_token: str = ""
    whatsapp_app_secret: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_postgres_url(cls, value: str):
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
