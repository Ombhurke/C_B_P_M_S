from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    PROJECT_NAME: str = "CBPMS Cloud Backend API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Server & Port (Render sets $PORT dynamically)
    HOST: str = "0.0.0.0"
    PORT: int = int(os.environ.get("PORT", 8000))
    
    # CORS Origins (supports local dev and Vercel domains)
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]
    CORS_ORIGIN_REGEX: Optional[str] = r"https://.*\.vercel\.app"
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = os.environ.get("SUPABASE_URL", None)
    SUPABASE_KEY: Optional[str] = os.environ.get("SUPABASE_KEY", None)
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", None)
    SUPABASE_STORAGE_BUCKET: str = os.environ.get("SUPABASE_STORAGE_BUCKET", "transient-print-jobs")
    
    # Ephemeral Storage Config
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25MB ceiling
    JOB_TTL_SECONDS: int = 2 * 60 * 60  # 2 hours
    TOKEN_PRESIGNED_URL_TTL_SECONDS: int = 60  # 60 seconds
    
    # Rate Limiting & Anti-Bruteforce
    MAX_TOKEN_ATTEMPTS: int = 3
    LOCKOUT_DURATION_SECONDS: int = 300  # 5 minutes
    
    # Storage Directory for Local/Staged Files (fallback)
    TEMP_STORAGE_DIR: str = os.path.join(os.path.expanduser("~"), ".cbpms_cloud_staging")


settings = Settings()
os.makedirs(settings.TEMP_STORAGE_DIR, exist_ok=True)
