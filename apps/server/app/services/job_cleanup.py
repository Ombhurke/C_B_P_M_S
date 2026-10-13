"""Delete temporary print bytes only after completion/audit is durably committed."""
import logging

from app.core.database import db
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


def finalize_job_cleanup(job):
    if not job.get("cleanup_pending") or not storage_service.purge(job):
        return job
    try:
        with db.transaction() as records:
            stored = records.get("jobs", job["id"])
            if not stored or not stored.get("cleanup_pending"):
                return stored or job
            cleared = {**stored, "cleanup_pending": False, "file_path": None, "supabase_path": None}
            if stored.get("document_id"):
                records.remove("documents", stored["document_id"])
            records.put("jobs", stored["id"], cleared)
        return cleared
    except Exception:
        # The committed cleanup intent survives; the worker can safely retry deletion.
        logger.warning("Cleanup metadata reconciliation pending for job %s", job["id"])
        return job
