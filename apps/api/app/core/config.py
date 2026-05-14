"""
Application configuration using Pydantic Settings.
Provides type-safe, validated configuration across the application.
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Allow extra env vars not defined here
    )
    
    # Application
    app_name: str = Field(default="AgentPME API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    app_debug: bool = Field(default=True, alias="APP_DEBUG")
    app_port: int = Field(default=8000, alias="APP_PORT")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    log_level: str = Field(default="info", alias="LOG_LEVEL")
    
    # Security
    secret_key: str = Field(alias="SECRET_KEY")
    api_key_header: str = Field(default="X-API-Key", alias="API_KEY_HEADER")
    
    # CORS
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    
    @field_validator("cors_origins")
    @classmethod
    def parse_cors_origins(cls, v: str) -> List[str]:
        """Parse comma-separated CORS origins into list."""
        return [origin.strip() for origin in v.split(",") if origin.strip()]
    
    # AI Providers - OpenRouter (primary - same as Next.js)
    openrouter_api_key: str = Field(alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="openai/gpt-3.5-turbo", alias="OPENROUTER_MODEL")
    openrouter_temperature: float = Field(default=0.3, alias="OPENROUTER_TEMPERATURE")
    openrouter_max_tokens: int = Field(default=1024, alias="OPENROUTER_MAX_TOKENS")
    
    # OpenAI - used via OpenRouter for embeddings
    openai_embedding_model: str = Field(default="openai/text-embedding-3-small", alias="OPENAI_EMBEDDING_MODEL")
    openai_embedding_dimensions: int = Field(default=1536, alias="OPENAI_EMBEDDING_DIMENSIONS")
    
    # Database
    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_key: str = Field(alias="SUPABASE_KEY")
    supabase_service_key: str = Field(alias="SUPABASE_SERVICE_KEY")
    supabase_jwt_secret: str = Field(alias="SUPABASE_JWT_SECRET")
    database_url: Optional[str] = Field(default=None, alias="DATABASE_URL")
    
    # Vector Search
    vector_match_threshold: float = Field(default=0.8, alias="VECTOR_MATCH_THRESHOLD")
    vector_match_count: int = Field(default=5, alias="VECTOR_MATCH_COUNT")
    chunk_size: int = Field(default=1000, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(default=200, alias="CHUNK_OVERLAP")
    
    # WhatsApp
    whatsapp_access_token: str = Field(alias="WHATSAPP_ACCESS_TOKEN")
    whatsapp_phone_number_id: str = Field(alias="WHATSAPP_PHONE_NUMBER_ID")
    whatsapp_verify_token: str = Field(alias="WHATSAPP_VERIFY_TOKEN")
    whatsapp_api_version: str = Field(default="v18.0", alias="WHATSAPP_API_VERSION")
    
    # n8n
    n8n_webhook_url: Optional[str] = Field(default=None, alias="N8N_WEBHOOK_URL")
    n8n_enabled: bool = Field(default=True, alias="N8N_ENABLED")
    n8n_timeout_seconds: int = Field(default=5, alias="N8N_TIMEOUT_SECONDS")
    
    # External Services
    nextjs_api_url: str = Field(default="http://localhost:3000", alias="NEXTJS_API_URL")
    nextjs_api_key: str = Field(alias="NEXTJS_API_KEY")
    
    stripe_webhook_secret: Optional[str] = Field(default=None, alias="STRIPE_WEBHOOK_SECRET")
    
    # Monitoring
    sentry_dsn: Optional[str] = Field(default=None, alias="SENTRY_DSN")
    prometheus_enabled: bool = Field(default=False, alias="PROMETHEUS_ENABLED")
    
    # Testing
    testing: bool = Field(default=False, alias="TESTING")
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"
    
    @property
    def supabase_service_role_headers(self) -> dict:
        """Headers for Supabase service role requests."""
        return {
            "apikey": self.supabase_service_key,
            "Authorization": f"Bearer {self.supabase_service_key}",
        }
    
    @property
    def whatsapp_api_base_url(self) -> str:
        """Meta WhatsApp Cloud API base URL."""
        return f"https://graph.facebook.com/{self.whatsapp_api_version}"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    
    Using lru_cache ensures we only load and validate settings once,
    improving performance across the application.
    """
    return Settings()


# Global settings instance for convenience
settings = get_settings()
