import hashlib
import threading
import requests
from agent.core.config import agent_settings


class DesktopApiClient:
    def __init__(self, base_url=None):
        self.base_url = (base_url or agent_settings.CLOUD_API_URL).rstrip("/")
        self.token = ""
        self.username = ""
        self.password = ""
        self.lock = threading.Lock()

    def login(self, username, password):
        with self.lock:
            response = requests.post(self.base_url + "/auth/login",
                json={"username": username, "password": password}, timeout=10)
            response.raise_for_status()
            result = response.json()
            if result["user"]["shop_id"] != agent_settings.SHOP_ID:
                raise ValueError("This account belongs to a different shop")
            self.token = result["access_token"]
            self.username, self.password = username, password

    def request(self, method, path, **kwargs):
        response = requests.request(method, self.base_url + path,
            headers={"Authorization": "Bearer " + self.token}, timeout=15, **kwargs)
        if response.status_code == 401 and self.username:
            self.login(self.username, self.password)
            response = requests.request(method, self.base_url + path,
                headers={"Authorization": "Bearer " + self.token}, timeout=15, **kwargs)
        if not response.ok:
            raise RuntimeError(response.json().get("detail", "API request failed"))
        return response.json()

    def verify_release_token(self, token, shop_id=None):
        if shop_id and shop_id != agent_settings.SHOP_ID:
            raise ValueError("Barcode belongs to another shop")
        return self.request("POST", "/jobs/verify-token",
                            json={"shop_id": agent_settings.SHOP_ID, "token": token})

    def download_staged_document(self, download_path, target_file_path, expected_hash=None):
        url = download_path if download_path.startswith(("http://", "https://")) else (
            self.base_url.removesuffix("/api/v1") + download_path)
        hasher = hashlib.sha256()
        with requests.get(url, stream=True, timeout=30) as response:
            response.raise_for_status()
            with open(target_file_path, "wb") as target:
                total = 0
                for chunk in response.iter_content(64 * 1024):
                    total += len(chunk)
                    if total > 25 * 1024 * 1024:
                        raise ValueError("Downloaded document exceeds size limit")
                    hasher.update(chunk)
                    target.write(chunk)
        if expected_hash and hasher.hexdigest() != expected_hash:
            raise ValueError("Downloaded document failed integrity verification")
        return target_file_path

    def notify_spool_completed(self, job_id, status="completed", error_message=None):
        # Failure raises: callers must not report a successful purge.
        return self.request("POST", f"/jobs/{job_id}/complete",
                            json={"job_id": job_id, "status": status, "error_message": error_message})

    def fetch_shop_queue(self, shop_id=None):
        return self.request("GET", f"/jobs/queue/{shop_id or agent_settings.SHOP_ID}")

    def fetch_shop_profile(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}")

    def confirm_output(self, job_id, notes=None):
        return self.request("POST", f"/jobs/{job_id}/confirm-output",
                            json={"job_id": job_id, "notes": notes})

    def report_issue(self, job_id, issue_type="hardware_error", notes=None):
        return self.request("POST", f"/jobs/{job_id}/report-issue",
                            json={"job_id": job_id, "issue_type": issue_type, "notes": notes})


api_client = DesktopApiClient()
