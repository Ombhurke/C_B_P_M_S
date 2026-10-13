import secrets
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from app.api.v1.jobs import get_job, iso
from app.core.auth import current_user, digest, require_shop, check_attempts, failed_attempt
from app.core.config import settings
from app.core.database import db
from app.core.audit import record_audit
from app.models.schemas import (
    JobCompleteRequest,
    TokenVerifyRequest,
    TokenVerifyResponse,
    JobOutputConfirmRequest,
    JobIssueReportRequest,
)
from app.services.storage_service import storage_service
from app.services.job_cleanup import finalize_job_cleanup
from app.services.websocket_hub import ws_hub

router = APIRouter(prefix="/jobs", tags=["Counter release"])


@router.post("/verify-token", response_model=TokenVerifyResponse)
async def verify_release_token(payload: TokenVerifyRequest, user=Depends(current_user)):
    require_shop(user, payload.shop_id)
    key = "release:" + user["username"]
    check_attempts(key)
    with db.transaction() as records:
        job = next((j for j in records.list("jobs") if j["shop_id"] == payload.shop_id and
                    j["release_token"] == payload.token and (j["payment_status"] == "completed" or j.get("payment_method") == "counter") and
                    j["job_status"] in ("queued", "failed") and j["expires_at_epoch"] > time.time()), None)
        if job:
            grant = secrets.token_urlsafe(32)
            download_url = storage_service.signed_url(job)
            job.update(job_status="processing", claimed_by=user["username"], download_hash=digest(grant),
                       download_until=time.time() + settings.TOKEN_PRESIGNED_URL_TTL_SECONDS)
            records.put("jobs", job["id"], job)
            record_audit(records, "job.claim", actor=user["username"], target=job["id"],
                         metadata={"shop_id": payload.shop_id})
            records.remove("attempts", key)
    if not job:
        locked = failed_attempt(key)
        raise HTTPException(429 if locked else 400, "Invalid code or job already claimed; locked" if locked else "Invalid code or job already claimed")
    await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_PROCESSING", {"job_id": job["id"]})
    return {**job, "job_id": job["id"],
            "download_url": download_url or f"/api/v1/jobs/{job['id']}/download?grant={grant}",
            "download_url_expires_in_seconds": settings.TOKEN_PRESIGNED_URL_TTL_SECONDS}


@router.get("/{job_id}/download")
def download_print_file(job_id: str, grant: str):
    with db.transaction() as records:
        job = get_job(records, job_id)
    if (job["job_status"] != "processing" or job.get("download_until", 0) <= time.time() or
        not secrets.compare_digest(job.get("download_hash", ""), digest(grant))):
        raise HTTPException(403, "Download grant invalid or expired")
    raw_path = job.get("file_path")
    if not raw_path:
        raise HTTPException(404, "File not available")
    file_path = Path(raw_path).resolve()
    temp_dir = Path(settings.TEMP_STORAGE_DIR).resolve()
    try:
        file_path.relative_to(temp_dir)
    except ValueError:
        raise HTTPException(403, "File path not permitted")
    if not file_path.is_file():
        raise HTTPException(404, "File not available")
    return FileResponse(str(file_path), filename=Path(job["file_name"]).name, media_type="application/octet-stream")


@router.post("/{job_id}/complete")
async def complete_print_job(job_id: str, payload: JobCompleteRequest, user=Depends(current_user)):
    with db.transaction() as records:
        job = get_job(records, job_id)
        require_shop(user, job["shop_id"])
        if payload.job_id != job_id:
            raise HTTPException(422, "Job ID mismatch")
        if job.get("claimed_by") != user["username"]:
            raise HTTPException(403, "Only the claiming operator can report this result")
        if job["job_status"] != payload.status:
            if job["job_status"] != "processing":
                raise HTTPException(409, "Job is not processing")
            job["job_status"] = payload.status
            job["download_until"] = 0
            if payload.status == "completed":
                job["completed_at"] = iso(time.time())
                if job.get("payment_method") == "counter":
                    job["payment_status"] = "completed"
                # Account-linked documents are library records and remain private after printing.
                job["cleanup_pending"] = job.get("access_mode", "anonymous") == "anonymous"
        # Failure retains cloud bytes until retry or expiry.
        if job.get("document_id"):
            document = records.get("documents", job["document_id"])
            if document:
                document["updated_at"] = iso(time.time())
                records.put("documents", document["id"], document)
        records.put("jobs", job_id, job)
        record_audit(records, "job.complete", actor=user["username"], target=job_id,
                     metadata={"shop_id": job["shop_id"], "status": job["job_status"],
                                "error_message": payload.error_message})
    job = finalize_job_cleanup(job)
    await ws_hub.broadcast_to_shop(job["shop_id"], "QUEUE_CHANGED", {"job_id": job_id})
    return {"status": job["job_status"], "job_id": job_id,
            "shredded": job["job_status"] == "completed" and
                        job.get("access_mode", "anonymous") == "anonymous" and
                        not job.get("cleanup_pending")}


@router.post("/{job_id}/confirm-output")
async def confirm_job_output(job_id: str, payload: JobOutputConfirmRequest, user=Depends(current_user)):
    with db.transaction() as records:
        job = get_job(records, job_id)
        require_shop(user, job["shop_id"])
        if job.get("payment_status") != "completed":
            if job.get("payment_method") == "counter":
                job["payment_status"] = "completed"
            else:
                raise HTTPException(402, "Payment has not been completed for this job")
        if job.get("claimed_by") != user["username"]:
            raise HTTPException(403, "Only the claiming operator can confirm output")
        if job.get("job_status") == "completed" and job.get("output_confirmed"):
            return {"status": "completed", "job_id": job_id, "output_confirmed": True}
        if job.get("job_status") not in ("queued", "processing", "failed"):
            raise HTTPException(409, f"Job cannot be confirmed from status '{job.get('job_status')}'")
        job["job_status"] = "completed"
        job["output_confirmed"] = True
        job["completed_at"] = iso(time.time())
        job["download_until"] = 0
        job["cleanup_pending"] = job.get("access_mode", "anonymous") == "anonymous"
        records.put("jobs", job_id, job)
        record_audit(records, "job.output_confirmed", actor=user["username"], target=job_id,
                     metadata={"shop_id": job["shop_id"], "notes": payload.notes})
    job = finalize_job_cleanup(job)
    await ws_hub.broadcast_to_shop(job["shop_id"], "QUEUE_CHANGED", {"job_id": job_id})
    return {"status": "completed", "job_id": job_id, "output_confirmed": True}


@router.post("/{job_id}/abandon-claim")
async def abandon_job_claim(job_id: str, user=Depends(current_user)):
    with db.transaction() as records:
        job = get_job(records, job_id)
        require_shop(user, job["shop_id"])
        if job.get("job_status") != "processing":
            raise HTTPException(409, f"Job is not processing (current status: {job.get('job_status')})")
        if job.get("claimed_by") and job.get("claimed_by") != user["username"]:
            raise HTTPException(403, "Claim belongs to another operator")
        job["job_status"] = "queued"
        job["claimed_by"] = None
        job["download_until"] = 0
        job["download_hash"] = None
        records.put("jobs", job_id, job)
        record_audit(records, "job.abandon_claim", actor=user["username"], target=job_id,
                     metadata={"shop_id": job["shop_id"]})
    await ws_hub.broadcast_to_shop(job["shop_id"], "QUEUE_CHANGED", {"job_id": job_id})
    return {"ok": True, "job_id": job_id, "job_status": "queued"}


@router.post("/{job_id}/report-issue")
async def report_job_issue(job_id: str, payload: JobIssueReportRequest, user=Depends(current_user)):
    with db.transaction() as records:
        job = get_job(records, job_id)
        require_shop(user, job["shop_id"])
        if job.get("claimed_by") != user["username"]:
            raise HTTPException(403, "Only the claiming operator can report a print issue")
        if job.get("job_status") in ("completed", "expired"):
            raise HTTPException(409, f"Cannot report issues on {job.get('job_status')} jobs")
        job["job_status"] = "failed"
        job["last_error"] = f"{payload.issue_type}: {payload.details}"
        records.put("jobs", job_id, job)
        record_audit(records, "job.issue_reported", actor=user["username"], target=job_id,
                     metadata={"shop_id": job["shop_id"], "issue_type": payload.issue_type, "details": payload.details})
    await ws_hub.broadcast_to_shop(job["shop_id"], "QUEUE_CHANGED", {"job_id": job_id})
    return {"status": "failed", "job_id": job_id, "retained_for_retry": True}


