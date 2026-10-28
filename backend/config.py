"""Server deployment configuration; independent of model credentials/settings."""

from pathlib import Path
from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LOCAL_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")


# Server CORS configuration is independent of AI credentials and paid-generation settings.
class ServerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        extra="ignore",
        hide_input_in_errors=True,
    )
    # Comma-separated exact origins, appended to the development origins.
    cors_allowed_origins: str = ""

    @field_validator("cors_allowed_origins")
    @classmethod
    def exact_origins(cls, value: str) -> str:
        """Normalize configured comma-separated HTTP(S) origins; reject wildcards and paths."""
        origins = []
        for entry in value.split(","):
            origin = entry.strip().removesuffix("/")
            if not origin:
                continue
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
                or "*" in origin
                or any(char.isspace() for char in origin)
            ):
                raise ValueError(
                    "CORS_ALLOWED_ORIGINS must contain exact HTTP(S) origins"
                )
            # Accessing port also validates malformed/non-numeric port values.
            _ = parsed.port
            origins.append(origin)
        return ",".join(dict.fromkeys(origins))

    @property
    def allowed_origins(self) -> list[str]:
        """Return deduplicated localhost plus configured exact origins for CORS."""
        return list(
            dict.fromkeys(
                [*LOCAL_ORIGINS, *filter(None, self.cors_allowed_origins.split(","))]
            )
        )
