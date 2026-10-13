import hashlib
import threading
import requests
from agent.core.config import agent_settings


class DesktopApiClient:
    def __init__(self, base_url=None):
        url = (base_url or agent_settings.CLOUD_API_URL).rstrip("/")
        # On Windows, 'localhost' often resolves to IPv6 '::1' first,
        # which throws WinError 10061 if uvicorn is listening on IPv4 (127.0.0.1).
        if url.startswith("http://localhost:"):
            url = url.replace("http://localhost:", "http://127.0.0.1:", 1)
        elif url.startswith("https://localhost:"):
            url = url.replace("https://localhost:", "https://127.0.0.1:", 1)
        self.base_url = url
        self.token = ""
        self.username = ""
        self.password = ""
        self.lock = threading.Lock()

    def set_base_url(self, base_url: str):
        url = (base_url or agent_settings.CLOUD_API_URL).rstrip("/")
        if url.startswith("http://localhost:"):
            url = url.replace("http://localhost:", "http://127.0.0.1:", 1)
        elif url.startswith("https://localhost:"):
            url = url.replace("https://localhost:", "https://127.0.0.1:", 1)
        self.base_url = url

    def login(self, username, password):
        with self.lock:
            last_conn_error = None
            import time
            for attempt in range(3):
                try:
                    response = requests.post(
                        self.base_url + "/auth/login",
                        json={"username": username, "password": password},
                        timeout=10,
                    )
                    if response.status_code == 401:
                        raise ValueError("Invalid operator username or password")
                    response.raise_for_status()
                    result = response.json()
                    user = result.get("user", {})
                    user_shop = user.get("shop_id")
                    if not user_shop:
                        raise ValueError("Account is not assigned to any shop. Please contact the administrator.")
                    agent_settings.SHOP_ID = user_shop
                    self.token = result["access_token"]
                    self.username, self.password = username, password
                    self.role = user.get("role", "operator")
                    self.user_data = user
                    return
                except (requests.ConnectionError, requests.Timeout) as exc:
                    last_conn_error = exc
                    if attempt < 2:
                        time.sleep(1.0)
                except requests.HTTPError as exc:
                    detail = ""
                    try:
                        detail = exc.response.json().get("detail", "")
                    except Exception:
                        pass
                    raise RuntimeError(f"Authentication rejected by server ({detail or exc})") from exc

            raise ConnectionError(
                f"Could not connect to backend server at {self.base_url}. "
                f"Please ensure uvicorn is running on port 8000. (Details: {last_conn_error})"
            )

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

    def abandon_job_claim(self, job_id):
        return self.request("POST", f"/jobs/{job_id}/abandon-claim")

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
        return self.request("POST", f"/jobs/{job_id}/complete",
                            json={"job_id": job_id, "status": status, "error_message": error_message})

    def fetch_shop_queue(self, shop_id=None):
        return self.request("GET", f"/jobs/queue/{shop_id or agent_settings.SHOP_ID}")

    def fetch_shop_summary(self, shop_id=None):
        return self.request("GET", f"/jobs/summary/{shop_id or agent_settings.SHOP_ID}")

    def fetch_shop_profile(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}")

    def fetch_job_detail(self, job_id, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}/jobs/{job_id}")

    def reject_job(self, job_id, reason, shop_id=None):
        return self.request("POST", f"/shops/{shop_id or agent_settings.SHOP_ID}/jobs/{job_id}/reject",
                            json={"reason": reason})

    def confirm_output(self, job_id, notes=None):
        return self.request("POST", f"/jobs/{job_id}/confirm-output",
                            json={"job_id": job_id, "notes": notes})

    def report_issue(self, job_id, issue_type="hardware_error", details=None, notes=None):
        raw_text = (details or notes or "Operator reported printing issue").strip()
        if len(raw_text) < 2:
            raw_text = "Operator reported issue"
        if len(raw_text) > 500:
            raw_text = raw_text[:500]
        return self.request("POST", f"/jobs/{job_id}/report-issue",
                            json={"job_id": job_id, "issue_type": issue_type, "details": raw_text})

    def fetch_shop_activity(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}/activity")

    def fetch_printers(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}/printers")

    def add_printer(self, printer_payload, shop_id=None):
        return self.request("POST", f"/shops/{shop_id or agent_settings.SHOP_ID}/printers",
                            json=printer_payload)

    def fetch_stations(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}/stations")

    def fetch_team(self, shop_id=None):
        return self.request("GET", f"/shops/{shop_id or agent_settings.SHOP_ID}/team")

    def update_rates(self, rates_payload, shop_id=None):
        return self.request("PATCH", f"/shops/{shop_id or agent_settings.SHOP_ID}",
                            json=rates_payload)

    def update_profile(self, profile_payload, shop_id=None):
        return self.request("PATCH", f"/shops/{shop_id or agent_settings.SHOP_ID}/profile",
                            json=profile_payload)


api_client = DesktopApiClient()
