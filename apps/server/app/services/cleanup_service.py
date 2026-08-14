import asyncio
from datetime import datetime
from typing import Dict
from app.services.storage_service import storage_service


class CleanupService:
    """Periodic task worker that removes expired staged print files."""
    def __init__(self, check_interval_seconds: int = 60):
        self.interval = check_interval_seconds
        self._running = False
        self._task = None

    async def start(self, jobs_db_ref: Dict[str, dict]):
        self._running = True
        self._task = asyncio.create_task(self._run_sweep(jobs_db_ref))

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()

    async def _run_sweep(self, jobs_db_ref: Dict[str, dict]):
        while self._running:
            try:
                await asyncio.sleep(self.interval)
                now = datetime.utcnow()
                expired_job_ids = []
                for job_id, job in list(jobs_db_ref.items()):
                    if job.get("expires_at") and job["expires_at"] < now:
                        if job.get("job_status") in ("staged", "queued"):
                            job["job_status"] = "expired"
                            expired_job_ids.append(job_id)
                            storage_service.purge_file(job_id)

                if expired_job_ids:
                    print(f"[CleanupService] Expired and purged {len(expired_job_ids)} jobs.")
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[CleanupService] Sweep error: {e}")


cleanup_service = CleanupService()
