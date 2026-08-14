import os
import requests
from typing import Optional, Dict
from agent.core.config import agent_settings


class DesktopApiClient:
    """HTTP Client communicating with the CBPMS Cloud Backend."""
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or agent_settings.CLOUD_API_URL

    def verify_release_token(self, token: str, shop_id: Optional[str] = None) -> dict:
        """Submits 4-digit token or scanned code for cloud authorization."""
        target_shop = shop_id or agent_settings.SHOP_ID
        url = f"{self.base_url}/jobs/verify-token"
        resp = requests.post(url, json={"shop_id": target_shop, "token": token}, timeout=5)
        
        if resp.status_code == 429:
            raise RuntimeError(resp.json().get("detail", "Rate limit lockout triggered."))
        elif resp.status_code != 200:
            raise ValueError(resp.json().get("detail", "Invalid token."))
            
        return resp.json()

    def download_staged_document(self, download_path: str, target_file_path: str) -> str:
        """Fetches binary document using pre-signed short-lived URL."""
        if download_path.startswith("http"):
            url = download_path
        else:
            host_root = self.base_url.replace("/api/v1", "")
            url = f"{host_root}{download_path}"

        resp = requests.get(url, stream=True, timeout=15)
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to download print file (HTTP {resp.status_code})")

        with open(target_file_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=64 * 1024):
                if chunk:
                    f.write(chunk)

        return target_file_path

    def notify_spool_completed(self, job_id: str, status: str = "completed") -> bool:
        """Signals backend to permanently shred the cloud blob."""
        url = f"{self.base_url}/jobs/{job_id}/complete"
        try:
            resp = requests.post(url, json={"job_id": job_id, "status": status}, timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    def fetch_shop_queue(self, shop_id: Optional[str] = None) -> list:
        target_shop = shop_id or agent_settings.SHOP_ID
        url = f"{self.base_url}/jobs/queue/{target_shop}"
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                return resp.json()
        except Exception:
            pass
        return []


api_client = DesktopApiClient()
