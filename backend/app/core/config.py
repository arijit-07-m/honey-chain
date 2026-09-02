from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database — use sqlite+aiosqlite when PostgreSQL is unavailable
    DATABASE_URL: str = "sqlite+aiosqlite:///./honeychain.db"
    DATABASE_SYNC_URL: str = "sqlite:///./honeychain.db"

    # MQTT (public broker: broker.emqx.io)
    MQTT_BROKER_URL: str = "broker.emqx.io"
    MQTT_BROKER_PORT: int = 1883
    MQTT_USERNAME: str = ""
    MQTT_PASSWORD: str = ""
    MQTT_TOPIC_PREFIX: str = "hive"
    MQTT_ENABLED: bool = True

    # Auth
    SECRET_KEY: str = "honey-chain-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Server
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000  # Render uses $PORT env var
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000,https://honey-chain.vercel.app,https://honey-chain-ten.vercel.app"

    # Demo
    DEMO_MODE: bool = True

    # QR output directory (backend generates QR PNGs)
    QR_STORAGE_PATH: str = "./qr_codes"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()


def get_cors_origins() -> List[str]:
    """Parse comma-separated CORS origins into a list.

    Production Vercel frontend origins are ALWAYS included, even if the
    CORS_ORIGINS environment variable contains stale values that would
    otherwise break the deployed frontend's authentication.
    """
    origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

    # Production frontend origins - always allow regardless of env var
    # This prevents deployed production logins from breaking when the
    # Render dashboard CORS_ORIGINS value is stale or incomplete.
    for stable_origin in (
        "https://honey-chain.vercel.app",
        "https://honey-chain-ten.vercel.app",
    ):
        if stable_origin not in origins:
            origins.append(stable_origin)

    return origins
