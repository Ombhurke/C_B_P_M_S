import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class AgentSettings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    SHOP_ID: str = os.environ.get("SHOP_ID", "shop-demo-1")
    # Point to your Render service e.g. https://your-cbpms.onrender.com/api/v1
    CLOUD_API_URL: str = os.environ.get("CLOUD_API_URL", "http://localhost:8000/api/v1")
    # Point to your Render WebSocket e.g. wss://your-cbpms.onrender.com/ws/queue
    CLOUD_WS_URL: str = os.environ.get("CLOUD_WS_URL", "ws://localhost:8000/ws/queue")
    
    # Sandboxed temporary print spool directory on Windows
    LOCAL_SPOOL_DIR: str = os.path.join(
        os.environ.get("TEMP", os.path.expanduser("~")),
        "cbpms_spool"
    )
    
    # Auto-release on barcode scan
    AUTO_RELEASE_ON_SCAN: bool = True
    SELECTED_PRINTER_NAME: str = "HP LaserJet Pro M404dn (B&W High Speed)"


agent_settings = AgentSettings()
os.makedirs(agent_settings.LOCAL_SPOOL_DIR, exist_ok=True)
