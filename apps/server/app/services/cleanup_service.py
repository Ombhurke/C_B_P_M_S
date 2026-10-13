import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.core.database import db
from app.services.quota_service import quota_service
from app.services.storage_service import storage_service
from app.services.websocket_hub import ws_hub

logger = logging.getLogger(__name__)


class CleanupService:
    def __init__(self):
        self.task = None

    async def sweep(self):
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        now_epoch = time.time()
        changed_shops = set()

        with db.transaction() as records:
            # 1. Sweep expired print jobs
            for job in records.list("jobs"):
                if (job.get("expires_at_epoch", 0) <= now_epoch and
                    job.get("job_status") in ("staged", "queued", "failed")):
                    job["job_status"] = "expired"
                    # Expire checkout for all jobs, but retain an account's private library file.
                    job["cleanup_pending"] = job.get("access_mode", "anonymous") == "anonymous"
                    changed_shops.add(job.get("shop_id"))
                if job.get("cleanup_pending") and storage_service.purge(job):
                    job.update(cleanup_pending=False, file_path=None, supabase_path=None)
                    if job.get("document_id"):
                        records.remove("documents", job["document_id"])
                records.put("jobs", job["id"], job)

            # 2. Sweep soft-deleted customer documents
            for doc in records.list("documents"):
                if doc.get("status") == "deleting":
                    if storage_service.purge(doc):
                        records.remove("documents", doc["id"])

            # 3. Sweep expired user sessions
            for session in records.list("sessions"):
                if session.get("expires_at", 0) <= now_epoch and session.get("id"):
                    records.remove("sessions", session["id"])

            # 4. Sweep expired guest upload sessions
            for g_sess in records.list("guest_upload_sessions"):
                exp = g_sess.get("expires_at")
                if exp and datetime.fromisoformat(exp) <= now_dt:
                    records.remove("guest_upload_sessions", g_sess["session_hash"])

            # 5. Sweep expired upload batches (3-hour privacy deadline)
            for batch in records.list("upload_batches"):
                if batch.get("status") in ("pending", "completed"):
                    exp_str = batch.get("expires_at")
                    if exp_str and datetime.fromisoformat(exp_str) <= now_dt:
                        batch["status"] = "expired"
                        batch["updated_at"] = now_iso
                        records.put("upload_batches", batch["id"], batch)

                        # Find items and release outstanding reservations
                        items = [it for it in records.list("upload_items") if it.get("batch_id") == batch["id"]]
                        released_bytes = 0
                        quarantine_paths = []
                        for it in items:
                            if it.get("status") in ("reserved", "granted"):
                                released_bytes += it.get("enforced_ceiling_bytes", 0)
                                it["status"] = "expired"
                                it["updated_at"] = now_iso
                                records.put("upload_items", it["id"], it)
                                quarantine_paths.append(it.get("quarantine_path"))
                            elif it.get("status") == "accepted" and batch.get("access_mode") == "ephemeral":
                                it["status"] = "expired"
                                records.put("upload_items", it["id"], it)
                                if it.get("canonical_path"):
                                    quarantine_paths.append(it.get("canonical_path"))

                        if released_bytes > 0:
                            quota_service.release_reservation(
                                records, batch["principal_type"], batch["principal_id"],
                                batch["id"], None, released_bytes
                            )

                        for q_path in quarantine_paths:
                            if q_path:
                                task_id = f"task-{uuid.uuid4().hex[:12]}"
                                records.put("background_tasks", task_id, {
                                    "id": task_id,
                                    "task_type": "quarantine_cleanup",
                                    "target_id": q_path,
                                    "payload": {"path": q_path},
                                    "status": "pending",
                                    "run_after": now_iso,
                                    "attempts": 0,
                                    "max_attempts": 5,
                                    "created_at": now_iso,
                                })

            # 6. Sweep expired ephemeral artifacts (never touch persistent customer library artifacts)
            for art in records.list("object_artifacts"):
                if art.get("access_mode") == "ephemeral" and not art.get("deleted_at"):
                    exp_str = art.get("expires_at")
                    if exp_str and datetime.fromisoformat(exp_str) <= now_dt:
                        art["deleted_at"] = now_iso
                        records.put("object_artifacts", art["id"], art)
                        task_id = f"task-{uuid.uuid4().hex[:12]}"
                        records.put("background_tasks", task_id, {
                            "id": task_id,
                            "task_type": "storage_delete",
                            "target_id": art["storage_path"],
                            "payload": {"path": art["storage_path"]},
                            "status": "pending",
                            "run_after": now_iso,
                            "attempts": 0,
                            "max_attempts": 5,
                            "created_at": now_iso,
                        })

        # Process outbox background tasks outside the main transaction
        self.process_background_tasks()

        for shop_id in changed_shops:
            if shop_id:
                await ws_hub.broadcast_to_shop(shop_id, "QUEUE_CHANGED", {})

        if settings.ENVIRONMENT != "test" or not settings.ALLOW_LOCAL_STORAGE:
            return

        # Expire orphan local test files
        with db.transaction() as records:
            referenced = {j.get("file_path") for j in records.list("jobs")}
        for path in Path(settings.TEMP_STORAGE_DIR).glob("job-*"):
            if str(path.resolve()) not in referenced and path.stat().st_mtime < time.time() - settings.JOB_TTL_SECONDS:
                path.unlink(missing_ok=True)

    def process_background_tasks(self):
        """Leases and executes pending outbox tasks for Storage API deletion."""
        worker_id = f"worker-{uuid.uuid4().hex[:8]}"
        now_dt = datetime.now(timezone.utc)
        now_iso = now_dt.isoformat()
        lease_until = (now_dt + timedelta(seconds=60)).isoformat()

        tasks_to_run = []
        with db.transaction() as records:
            for task in records.list("background_tasks"):
                if task.get("status") == "pending":
                    run_after = task.get("run_after")
                    if not run_after or datetime.fromisoformat(run_after) <= now_dt:
                        task["status"] = "leased"
                        task["leased_until"] = lease_until
                        task["leased_by"] = worker_id
                        records.put("background_tasks", task["id"], task)
                        tasks_to_run.append(task)

        for task in tasks_to_run:
            success = False
            error_msg = None
            try:
                task_type = task.get("task_type")
                target_path = task.get("target_id") or task.get("payload", {}).get("path")
                if target_path and task_type in ("quarantine_cleanup", "storage_delete", "artifact_purge"):
                    success = storage_service.remove_objects([target_path])
                else:
                    success = True
            except Exception as exc:
                error_msg = str(exc)
                success = False

            with db.transaction() as records:
                current = records.get("background_tasks", task["id"])
                if current:
                    if success:
                        current["status"] = "completed"
                        current["updated_at"] = datetime.now(timezone.utc).isoformat()
                    else:
                        attempts = current.get("attempts", 0) + 1
                        current["attempts"] = attempts
                        current["last_error"] = error_msg
                        if attempts >= current.get("max_attempts", 5):
                            current["status"] = "failed"
                        else:
                            current["status"] = "pending"
                            # Exponential backoff
                            backoff_sec = 2 ** attempts * 5
                            current["run_after"] = (datetime.now(timezone.utc) + timedelta(seconds=backoff_sec)).isoformat()
                        current["updated_at"] = datetime.now(timezone.utc).isoformat()
                    records.put("background_tasks", task["id"], current)

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
