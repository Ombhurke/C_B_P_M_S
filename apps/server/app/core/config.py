from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
import os
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore")

    PROJECT_NAME: str = "CBPMS Cloud Backend API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Server & Port (Render sets $PORT dynamically)
    HOST: str = "127.0.0.1"
    PORT: int = int(os.environ.get("PORT", 8000))
    
    # CORS Origins (supports local dev and Vercel domains)
    CORS_ORIGINS: List[str] = []
    CORS_ORIGIN_REGEX: Optional[str] = None
    DATABASE_URL: str = ""
    ENVIRONMENT: str = "production"
    PAYMENT_PROVIDER: str = "disabled"
    ALLOW_MOCK_PAYMENTS: bool = False
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    ALLOW_LOCAL_STORAGE: bool = False
    AUTH_SESSION_SECONDS: int = 8 * 60 * 60
    BOOTSTRAP_ADMIN_USERNAME: str = ""
    BOOTSTRAP_ADMIN_PASSWORD: str = ""
    BOOTSTRAP_SHOP_ID: str = ""
    SEED_DEMO_SHOPS: bool = False
    ENABLE_API_DOCS: bool = False
    SUPABASE_PUBLISHABLE_KEY: str = ""
    
    # Supabase Configuration
    SUPABASE_URL: Optional[str] = os.environ.get("SUPABASE_URL", None)
    SUPABASE_KEY: Optional[str] = os.environ.get("SUPABASE_KEY", None)
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", None)
    SUPABASE_STORAGE_BUCKET: str = os.environ.get("SUPABASE_STORAGE_BUCKET", "transient-print-jobs")
    
    # Ephemeral Storage Config
    MAX_FILE_SIZE_BYTES: int = 25 * 1024 * 1024  # 25MB ceiling
    MAX_FOLDER_SIZE_BYTES: int = 200 * 1024 * 1024  # 200MB ceiling for combined folder uploads
    JOB_TTL_SECONDS: int = 2 * 60 * 60  # 2 hours
    TOKEN_PRESIGNED_URL_TTL_SECONDS: int = 60  # 60 seconds
    
    # Rate Limiting & Anti-Bruteforce
    MAX_TOKEN_ATTEMPTS: int = 3
    LOCKOUT_DURATION_SECONDS: int = 300  # 5 minutes
    
    # Storage Directory for Local/Staged Files (fallback)
    TEMP_STORAGE_DIR: str = ".cbpms/files"


settings = Settings()
