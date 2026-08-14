import uuid
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.security import generate_release_token, rate_limiter
from app.models.schemas import (
    DuplexMode, PaymentStatus, JobStatus,
    CostCalculationResponse, JobStagedResponse,
    PaymentVerifyRequest, PaymentVerifyResponse,
    TokenVerifyRequest, TokenVerifyResponse,
    JobCompleteRequest
)
from app.api.v1.shops import SHOPS_DB
from app.services.storage_service import storage_service
from app.services.websocket_hub import ws_hub

router = APIRouter(prefix="/jobs", tags=["Print Jobs"])

# Ephemeral In-Memory Database for active print jobs: job_id -> job_dict
JOBS_DB: Dict[str, dict] = {}


def calculate_cost(
    shop: dict,
    page_count: int,
    copy_count: int,
    is_color: bool,
    duplex_mode: DuplexMode,
    layout_nup: int
) -> dict:
    base_rate = shop["base_color_rate"] if is_color else shop["base_bw_rate"]
    effective_pages_per_copy = math.ceil(page_count / layout_nup)
    
    if duplex_mode in (DuplexMode.DUPLEX_LONG, DuplexMode.DUPLEX_SHORT):
        sheets_per_copy = math.ceil(effective_pages_per_copy / 2)
        total_sheets = sheets_per_copy * copy_count
        raw_cost = total_sheets * 2 * base_rate
        discount = sheets_per_copy * copy_count * shop.get("duplex_discount", 0.0)
        total_cost = max(0.0, raw_cost - discount)
    else:
        sheets_per_copy = effective_pages_per_copy
        total_sheets = sheets_per_copy * copy_count
        total_cost = total_sheets * base_rate
        discount = 0.0

    return {
        "page_count": page_count,
        "copy_count": copy_count,
        "is_color": is_color,
        "duplex_mode": duplex_mode,
        "layout_nup": layout_nup,
        "sheets_per_copy": sheets_per_copy,
        "total_sheets": total_sheets,
        "rate_per_page": base_rate,
        "discount": round(discount, 2),
        "total_cost": round(total_cost, 2),
        "currency": shop.get("currency", "INR")
    }


@router.post("/calculate-cost", response_model=CostCalculationResponse)
async def calculate_job_cost(
    shop_id: str = Form(...),
    page_count: int = Form(...),
    copy_count: int = Form(1),
    is_color: bool = Form(False),
    duplex_mode: DuplexMode = Form(DuplexMode.SIMPLEX),
    layout_nup: int = Form(1)
):
    shop = SHOPS_DB.get(shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    
    calc = calculate_cost(shop, page_count, copy_count, is_color, duplex_mode, layout_nup)
    return CostCalculationResponse(**calc)


@router.post("/stage", response_model=JobStagedResponse)
async def stage_print_job(
    shop_id: str = Form(...),
    page_count: int = Form(...),
    copy_count: int = Form(1),
    is_color: bool = Form(False),
    duplex_mode: DuplexMode = Form(DuplexMode.SIMPLEX),
    layout_nup: int = Form(1),
    page_range: str = Form("all"),
    file: UploadFile = File(...)
):
    shop = SHOPS_DB.get(shop_id)
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")

    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_FILE_SIZE_BYTES // (1024*1024)}MB size limit")

    job_id = f"job-{uuid.uuid4().hex[:12]}"
    file_meta = storage_service.save_staged_file(job_id, file.filename, content)
    calc = calculate_cost(shop, page_count, copy_count, is_color, duplex_mode, layout_nup)

    job_record = {
        "id": job_id,
        "shop_id": shop_id,
        "file_name": file.filename,
        "file_path": file_meta["file_path"],
        "file_size_bytes": file_meta["file_size"],
        "file_hash": file_meta["file_hash"],
        "page_count": page_count,
        "copy_count": copy_count,
        "is_color": is_color,
        "duplex_mode": duplex_mode,
        "layout_nup": layout_nup,
        "page_range": page_range,
        "total_cost": calc["total_cost"],
        "currency": calc["currency"],
        "payment_status": PaymentStatus.PENDING,
        "payment_id": None,
        "release_token": None,
        "job_status": JobStatus.STAGED,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(seconds=settings.JOB_TTL_SECONDS),
        "token_attempt_count": 0
    }
    JOBS_DB[job_id] = job_record

    return JobStagedResponse(
        job_id=job_id,
        shop_id=shop_id,
        file_name=file.filename,
        file_size_bytes=file_meta["file_size"],
        page_count=page_count,
        copy_count=copy_count,
        is_color=is_color,
        duplex_mode=duplex_mode,
        layout_nup=layout_nup,
        total_cost=calc["total_cost"],
        currency=calc["currency"],
        payment_status=PaymentStatus.PENDING,
        job_status=JobStatus.STAGED
    )


@router.post("/verify-payment", response_model=PaymentVerifyResponse)
async def verify_payment(payload: PaymentVerifyRequest):
    job = JOBS_DB.get(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["job_status"] == JobStatus.EXPIRED:
        raise HTTPException(status_code=400, detail="Job has expired. Please re-upload.")

    release_token = generate_release_token()
    job["payment_status"] = PaymentStatus.COMPLETED
    job["payment_id"] = payload.payment_id
    job["payment_method"] = payload.payment_method
    job["release_token"] = release_token
    job["job_status"] = JobStatus.QUEUED
    
    # 2D Barcode payload containing standard JSON with shop, job and token
    barcode_payload = f"CBPMS:{job['shop_id']}:{release_token}:{job['id']}"

    # Broadcast real-time event to shop operator desktop agent over WebSockets
    await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_QUEUED", {
        "job_id": job["id"],
        "shop_id": job["shop_id"],
        "file_name": job["file_name"],
        "page_count": job["page_count"],
        "copy_count": job["copy_count"],
        "is_color": job["is_color"],
        "duplex_mode": job["duplex_mode"],
        "layout_nup": job["layout_nup"],
        "total_cost": job["total_cost"],
        "release_token": release_token,
        "created_at": job["created_at"].isoformat()
    })

    return PaymentVerifyResponse(
        job_id=job["id"],
        shop_id=job["shop_id"],
        release_token=release_token,
        barcode_payload=barcode_payload,
        total_cost=job["total_cost"],
        payment_status=job["payment_status"],
        job_status=job["job_status"],
        expires_at=job["expires_at"]
    )


@router.post("/verify-token", response_model=TokenVerifyResponse)
async def verify_release_token(payload: TokenVerifyRequest, request: Request):
    client_ip = request.client.host if request.client else "local"
    rate_key = f"{payload.shop_id}:{client_ip}"
    
    is_locked, remaining = rate_limiter.is_locked(rate_key)
    if is_locked:
        raise HTTPException(
            status_code=429,
            detail=f"Too many invalid attempts. Terminal locked for {remaining} seconds."
        )

    # Search for queued job with matching shop_id and release_token
    target_job = None
    for job in JOBS_DB.values():
        if job["shop_id"] == payload.shop_id and job.get("release_token") == payload.token:
            if job["job_status"] in (JobStatus.QUEUED, JobStatus.STAGED):
                target_job = job
                break

    if not target_job:
        count, locked, lock_secs = rate_limiter.record_failed_attempt(rate_key)
        if locked:
            raise HTTPException(
                status_code=429,
                detail=f"3 invalid release attempts reached. Terminal locked for {lock_secs}s."
            )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 4-digit code. Attempt {count} of {settings.MAX_TOKEN_ATTEMPTS}."
        )

    # Success: reset rate-limiting
    rate_limiter.reset(rate_key)
    target_job["job_status"] = JobStatus.PROCESSING

    # Broadcast status update
    await ws_hub.broadcast_to_shop(payload.shop_id, "JOB_PROCESSING", {
        "job_id": target_job["id"],
        "release_token": target_job["release_token"]
    })

    download_url = storage_service.get_presigned_download_url(target_job["id"], target_job["release_token"])

    return TokenVerifyResponse(
        job_id=target_job["id"],
        shop_id=target_job["shop_id"],
        file_name=target_job["file_name"],
        file_hash=target_job["file_hash"],
        page_count=target_job["page_count"],
        copy_count=target_job["copy_count"],
        is_color=target_job["is_color"],
        duplex_mode=target_job["duplex_mode"],
        layout_nup=target_job["layout_nup"],
        total_cost=target_job["total_cost"],
        download_url=download_url,
        download_url_expires_in_seconds=settings.TOKEN_PRESIGNED_URL_TTL_SECONDS
    )


@router.get("/{job_id}/download")
async def download_print_file(job_id: str, token: str):
    job = JOBS_DB.get(job_id)
    if not job or job.get("release_token") != token:
        raise HTTPException(status_code=403, detail="Invalid token or download expired")
    
    file_path = storage_service.get_file_path(job_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Ephemeral file has already been shredded or expired")

    return FileResponse(
        path=file_path,
        filename=job["file_name"],
        media_type="application/octet-stream"
    )


@router.post("/{job_id}/complete")
async def complete_print_job(job_id: str, payload: JobCompleteRequest):
    job = JOBS_DB.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job["job_status"] = JobStatus.COMPLETED if payload.status == "completed" else JobStatus.FAILED
    job["completed_at"] = datetime.utcnow()
    
    # Trigger cloud file shredding immediately
    storage_service.purge_file(job_id)

    # Broadcast completion to WebSocket clients
    await ws_hub.broadcast_to_shop(job["shop_id"], "JOB_COMPLETED", {
        "job_id": job["id"],
        "status": job["job_status"]
    })

    return {"status": "success", "job_id": job_id, "shredded": True}


@router.get("/queue/{shop_id}")
async def get_shop_queue(shop_id: str):
    jobs = [
        {
            "id": j["id"],
            "shop_id": j["shop_id"],
            "file_name": j["file_name"],
            "page_count": j["page_count"],
            "copy_count": j["copy_count"],
            "is_color": j["is_color"],
            "duplex_mode": j["duplex_mode"],
            "layout_nup": j["layout_nup"],
            "total_cost": j["total_cost"],
            "release_token": j["release_token"],
            "job_status": j["job_status"],
            "created_at": j["created_at"].isoformat(),
            "expires_at": j["expires_at"].isoformat()
        }
        for j in JOBS_DB.values()
        if j["shop_id"] == shop_id and j["job_status"] in (JobStatus.QUEUED, JobStatus.PROCESSING)
    ]
    return jobs
