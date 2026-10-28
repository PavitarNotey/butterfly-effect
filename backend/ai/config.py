from pathlib import Path
from typing import Literal, Self
from urllib.parse import urlparse

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# Backend-only credentials, request bounds and process-local demo safeguards; paid generation defaults off.
class AISettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        extra="ignore",
        hide_input_in_errors=True,
    )
    ai_provider: Literal["auto", "foundry", "mock", "disabled"] = "auto"
    azure_openai_endpoint: str = ""
    azure_openai_deployment: str = "gpt-5-mini"
    azure_openai_api_key: SecretStr = SecretStr("")
    ai_timeout_seconds: float = Field(default=35, ge=1, le=90)
    ai_max_retries: int = Field(default=1, ge=0, le=2)
    ai_max_output_tokens: int = Field(default=3500, ge=600, le=6000)
    ai_moment_output_tokens: int = Field(default=1400, ge=600, le=6000)
    ai_recap_output_tokens: int = Field(default=1600, ge=600, le=6000)
    ai_commentary_output_tokens: int = Field(default=3500, ge=600, le=6000)
    ai_max_input_bytes: int = Field(default=64000, ge=4096, le=128000)
    ai_paid_generation_enabled: bool = False
    ai_concurrency: int = Field(default=2, ge=1, le=4)
    ai_requests_per_minute: int = Field(default=12, ge=1, le=60)
    ai_calls_per_hour: int = Field(default=40, ge=1, le=200)
    ai_calls_per_lifetime: int = Field(default=12, ge=1, le=1000)
    ai_estimated_budget_usd: float = Field(default=0.25, gt=0, le=100)
    ai_cache_entries: int = Field(default=128, ge=1, le=512)
    ai_cache_ttl_seconds: int = Field(default=3600, ge=1, le=86400)
    # Estimates only: configure current deployment prices; never a billing cap.
    ai_input_usd_per_million: float = Field(default=0, ge=0, le=1000)
    ai_output_usd_per_million: float = Field(default=0, ge=0, le=1000)

    @model_validator(mode="after")
    def valid_connection(self) -> Self:
        """Reject partial or unsafe Foundry connection settings without echoing secrets."""
        configured = bool(
            self.azure_openai_endpoint or self.azure_openai_api_key.get_secret_value()
        )
        if self.ai_provider == "foundry" or (self.ai_provider == "auto" and configured):
            url = urlparse(self.azure_openai_endpoint)
            if (
                url.scheme != "https"
                or not url.hostname
                or not url.hostname.endswith(
                    (".openai.azure.com", ".services.ai.azure.com")
                )
                or url.path.rstrip("/") != "/openai/v1"
                or url.query
                or url.fragment
                or url.username
                or url.password
                or url.port not in (None, 443)
                or not self.azure_openai_api_key.get_secret_value()
                or not self.azure_openai_deployment.strip()
            ):
                raise ValueError("Incomplete or invalid Foundry configuration")
        return self

    @property
    def provider(self) -> str:
        """Resolve auto mode from backend configuration without a connectivity probe."""
        if self.ai_provider == "auto":
            return "foundry" if self.azure_openai_endpoint else "disabled"
        return self.ai_provider
