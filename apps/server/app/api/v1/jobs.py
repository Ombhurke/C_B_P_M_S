import secrets
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from typing import Literal
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from app.core.auth import current_user, digest, optional_user, require_shop
from app.core.audit import record_audit
from app.core.config import settings
from app.core.database import db
from app.models.schemas import CostCalculationResponse, DuplexMode, JobStagedResponse
from app.api.v1.shops import shop_record
from app.services.documents import inspect_document
from app.services.pricing import calculate_cost
from app.services.storage_service import storage_service

router = APIRouter(prefix="/jobs", tags=["Print Jobs"])


def iso(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat()


def get_job(records, job_id):
    job = records.get("jobs", job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


def check_checkout(job, token):
    if not token or not secrets.compare_digest(job["checkout_hash"], digest(token)):
        raise HTTPException(403, "Invalid checkout session")


@router.post("/calculate-cost", response_model=CostCalculationResponse)
def calculate_job_cost(shop_id: str = Form(...), page_count: int = Form(...),
                       copy_count: int = Form(1), is_color: bool = Form(False),
                       duplex_mode: DuplexMode = Form(DuplexMode.SIMPLEX), layout_nup: int = Form(1),
                       paper_type: str = Form("normal")):
    return calculate_cost(shop_record(shop_id), page_count, copy_count, is_color, duplex_mode, layout_nup, paper_type)


@router.post("/stage", response_model=JobStagedResponse)
async def stage_print_job(shop_id: str = Form(...), page_count: int = Form(...),
                          copy_count: int = Form(1), is_color: bool = Form(False),
                          duplex_mode: DuplexMode = Form(DuplexMode.SIMPLEX), layout_nup: int = Form(1),
                          paper_type: str = Form("normal"),
                          page_range: str = Form("all"), access_mode: Literal["anonymous", "account"] = Form("anonymous"),
                          file: UploadFile = File(...), user=Depends(optional_user)):
    if access_mode == "account" and (not user or user["role"] != "customer"):
        raise HTTPException(401, "Sign in with a customer account for account-linked storage")
    shop = shop_record(shop_id)
    if page_range != "all":
        raise HTTPException(422, "Page ranges are not supported yet")
    # Validate before storage; the browser's page estimate is never used for billing.
    calculate_cost(shop, page_count, copy_count, is_color, duplex_mode, layout_nup, paper_type)
    content = await file.read(settings.MAX_FILE_SIZE_BYTES + 1)
    await file.close()
    if not content or len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(413, "Upload must contain between 1 byte and 25 MB")
    page_count, mime = inspect_document(file.filename or "", content)
    calc = calculate_cost(shop, page_count, copy_count, is_color, duplex_mode, layout_nup, paper_type)
    job_id = "job-" + uuid.uuid4().hex
    checkout_token = secrets.token_urlsafe(32)
    created = time.time()
    document_id = "doc-" + uuid.uuid4().hex
    owner_id = user["id"] if access_mode == "account" else None
    job = {"id": job_id, "shop_id": shop_id, "file_name": Path(file.filename).name,
           **calc, "payment_status": "pending", "job_status": "staged",
           "release_token": None, "order": None, "checkout_hash": digest(checkout_token),
           "created_at": iso(created), "expires_at": iso(created + settings.JOB_TTL_SECONDS),
           "expires_at_epoch": created + settings.JOB_TTL_SECONDS, "cleanup_pending": False,
           "access_mode": access_mode, "owner_id": owner_id, "document_id": document_id}
    # Commit metadata and storage as one workflow; compensate if the DB commit fails.
    job.update(storage_service.save(job_id, job["file_name"], content, mime))
    try:
        document = {"id": document_id, "job_id": job_id, "owner_id": owner_id,
                    "access_mode": access_mode, "library": access_mode == "account",
                    "file_name": job["file_name"], "mime_type": mime,
                    "file_size_bytes": job["file_size_bytes"], "file_hash": job["file_hash"],
                    "file_path": job.get("file_path"), "supabase_path": job.get("supabase_path"),
                    "created_at": job["created_at"], "updated_at": job["created_at"],
                    "status": "available", "deleted_at": None}
        with db.transaction() as records:
            records.put("jobs", job_id, job)
            records.put("documents", document_id, document)
            record_audit(records, "job.stage", actor=owner_id, target=job_id,
                         metadata={"shop_id": shop_id, "access_mode": access_mode})
    except Exception:
        purged = storage_service.purge(job)
        if not purged:
            try:
                with db.transaction() as records:
                    records.put("jobs", job_id, {**job, "cleanup_pending": True, "job_status": "failed"})
            except Exception:
                pass
        raise
    return {**job, "job_id": job_id, "checkout_token": checkout_token, "document_id": document_id}


def customer_job_view(job):
    return {"job_id": job["id"], "document_id": job.get("document_id"), "shop_id": job["shop_id"],
            "file_name": job["file_name"], "access_mode": job.get("access_mode", "anonymous"),
            "page_count": job["page_count"], "copy_count": job["copy_count"],
            "total_cost": job["total_cost"], "currency": job["currency"],
            "payment_status": job["payment_status"], "job_status": job["job_status"],
            "created_at": job["created_at"], "expires_at": job["expires_at"],
            "release_token": job.get("release_token") if job.get("payment_status") == "completed" else None}


@router.get("/{job_id}/status")
def get_customer_job_status(job_id: str, x_checkout_token: str | None = Header(None), user=Depends(optional_user)):
    with db.transaction(readonly=True) as records:
        job = get_job(records, job_id)
    owner_allowed = bool(user and user["role"] == "customer" and job.get("owner_id") == user["id"])
    token_allowed = bool(x_checkout_token and secrets.compare_digest(job.get("checkout_hash", ""), digest(x_checkout_token)))
    if not owner_allowed and not token_allowed:
        raise HTTPException(403, "Job status is not available for this account or checkout")
    return customer_job_view(job)


@router.get("/queue/{shop_id}")
def get_shop_queue(shop_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    with db.transaction(readonly=True) as records:
        jobs = [j for j in records.list("jobs") if j["shop_id"] == shop_id and
                j["job_status"] in ("queued", "processing", "failed") and
                (j["expires_at_epoch"] > time.time() or j["job_status"] == "processing")]
    fields = ("id", "shop_id", "file_name", "page_count", "copy_count", "is_color",
              "duplex_mode", "layout_nup", "total_cost", "job_status", "created_at", "expires_at")
    return [{k: j[k] for k in fields} for j in sorted(jobs, key=lambda j: j["created_at"])]


@router.get("/summary/{shop_id}")
def get_summary(shop_id: str, user=Depends(current_user)):
    require_shop(user, shop_id)
    today = datetime.now(timezone.utc).date().isoformat()
    with db.transaction(readonly=True) as records:
        jobs = [j for j in records.list("jobs") if j["shop_id"] == shop_id and j["created_at"].startswith(today)]
    return {"date_utc": today, "total_jobs": len(jobs),
            "completed_jobs": sum(j["job_status"] == "completed" for j in jobs),
            "failed_jobs": sum(j["job_status"] == "failed" for j in jobs),
            "cleanup_pending": sum(bool(j.get("cleanup_pending")) for j in jobs),
            "paid_total": round(sum(j["total_cost"] for j in jobs if j["payment_status"] == "completed"), 2)}
