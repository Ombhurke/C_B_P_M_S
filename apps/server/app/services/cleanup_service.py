import asyncio
import logging
import time
from pathlib import Path

from app.core.config import settings
from app.core.database import db
from app.services.storage_service import storage_service
from app.services.websocket_hub import ws_hub

logger = logging.getLogger(__name__)


class CleanupService:
    def __init__(self):
        self.task = None

    async def sweep(self):
        changed = set()
        with db.transaction() as records:
            for job in records.list("jobs"):
                if (job["expires_at_epoch"] <= time.time() and
                    job["job_status"] in ("staged", "queued", "failed")):
                    job["job_status"] = "expired"
                    # Expire checkout for all jobs, but retain an account's private library file.
                    job["cleanup_pending"] = job.get("access_mode", "anonymous") == "anonymous"
                    changed.add(job["shop_id"])
                if job.get("cleanup_pending") and storage_service.purge(job):
                    job.update(cleanup_pending=False, file_path=None, supabase_path=None)
                    if job.get("document_id"):
                        records.remove("documents", job["document_id"])
                records.put("jobs", job["id"], job)
            for doc in records.list("documents"):
                if doc.get("status") == "deleting":
                    if storage_service.purge(doc):
                        records.remove("documents", doc["id"])
            for session in records.list("sessions"):
                # Sessions are keyed by a hash stored on the record.
                if session["expires_at"] <= time.time() and session.get("id"):
                    records.remove("sessions", session["id"])
        for shop_id in changed:
            await ws_hub.broadcast_to_shop(shop_id, "QUEUE_CHANGED", {})
        if settings.ENVIRONMENT != "test" or not settings.ALLOW_LOCAL_STORAGE:
            return
        # Crash between writing a local file and committing its job: expire orphan files.
        with db.transaction() as records:
            referenced = {j.get("file_path") for j in records.list("jobs")}
        for path in Path(settings.TEMP_STORAGE_DIR).glob("job-*"):
            if str(path.resolve()) not in referenced and path.stat().st_mtime < time.time() - settings.JOB_TTL_SECONDS:
                path.unlink(missing_ok=True)

    async def run(self):
        while True:
            try:
                await self.sweep()
            except Exception:
                logger.exception("Cleanup sweep failed; will retry")
            await asyncio.sleep(60)

    async def start(self):
        self.task = asyncio.create_task(self.run())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass


cleanup_service = CleanupService()
