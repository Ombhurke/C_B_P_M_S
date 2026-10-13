import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolve_env_file() -> Path:
    if getattr(sys, "frozen", False):
        exe_env = Path(sys.executable).resolve().parent / ".env"
        if exe_env.exists():
            return exe_env
    cwd_env = Path.cwd() / ".env"
    if cwd_env.exists():
        return cwd_env
    repo_env = Path(__file__).resolve().parents[2] / ".env"
    return repo_env


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=_resolve_env_file(),
        extra="ignore"
    )

    SHOP_ID: str = os.environ.get("SHOP_ID", "shop-demo-1")
    # Point to your Render service e.g. https://your-cbpms.onrender.com/api/v1
    CLOUD_API_URL: str = os.environ.get("CLOUD_API_URL", "http://127.0.0.1:8000/api/v1")
    # Point to your Render WebSocket e.g. wss://your-cbpms.onrender.com/ws/queue
    CLOUD_WS_URL: str = os.environ.get("CLOUD_WS_URL", "ws://127.0.0.1:8000/ws/queue")
    
    # Sandboxed temporary print spool directory on Windows
    LOCAL_SPOOL_DIR: str = os.path.join(
        os.environ.get("TEMP", os.path.expanduser("~")),
        "cbpms_spool"
    )
    LOCAL_STATE_DIR: str = os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
        "CBPMS", "state"
    )
    
    # Auto-release on barcode scan
    AUTO_RELEASE_ON_SCAN: bool = True
    SELECTED_PRINTER_NAME: str = "HP LaserJet Pro M404dn (B&W High Speed)"
    OPERATOR_USERNAME: str = ""
    OPERATOR_PASSWORD: str = ""
    MOCK_PRINTING: bool = False
    RAW_PDF_SUPPORTED: bool = False


agent_settings = AgentSettings()
os.makedirs(agent_settings.LOCAL_SPOOL_DIR, exist_ok=True)
