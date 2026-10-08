import hashlib
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.core.auth import current_user
from app.core.audit import record_audit
from app.core.config import settings
from app.core.database import db
from app.models.schemas import CustomerDocumentResponse, CustomerJobResponse
from app.services.documents import inspect_document
from app.services.storage_service import storage_service
from app.api.v1.jobs import customer_job_view

router = APIRouter(prefix="/customer", tags=["Customer workspace"])


def require_customer(user):
    if user["role"] != "customer":
        raise HTTPException(403, "Customer account required")


@router.post("/documents", response_model=CustomerDocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    user=Depends(current_user),
):
    require_customer(user)
    if not file.filename:
        raise HTTPException(400, "Filename is required")
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        raise HTTPException(413, f"File exceeds maximum allowed size ({settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB)")
    if len(content) == 0:
        raise HTTPException(422, "File is empty")

    page_count, mime = inspect_document(file.filename, content)
    doc_id = f"doc-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    saved = storage_service.save(doc_id, file.filename, content, mime)

    doc = {
        "id": doc_id,
        "owner_id": user["id"],
        "library": True,
        "job_id": None,
        "file_name": file.filename,
        "mime_type": mime,
        "file_size_bytes": len(content),
        "file_hash": hashlib.sha256(content).hexdigest(),
        "page_count": page_count,
        "file_path": saved.get("file_path"),
        "supabase_path": saved.get("supabase_path"),
        "created_at": now_iso,
        "updated_at": now_iso,
        "status": "available",
        "deleted_at": None,
    }

    try:
        with db.transaction() as records:
            records.put("documents", doc_id, doc)
            record_audit(
                records,
                "document.upload",
                actor=user["username"],
                target=doc_id,
                metadata={"size": len(content), "pages": page_count},
            )
    except Exception:
        purged = storage_service.purge(saved)
        if not purged:
            try:
                with db.transaction() as records:
                    records.put("documents", doc_id, {**doc, "status": "failed", "cleanup_pending": True})
            except Exception:
                pass
        raise

    return doc


@router.get("/documents", response_model=list[CustomerDocumentResponse])
def list_documents(
    q: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(current_user),
):
    require_customer(user)
    with db.transaction(readonly=True) as records:
        jobs = {j["id"]: j for j in records.list("jobs")}
        documents = [
            d for d in records.list("documents")
            if d.get("owner_id") == user["id"] and d.get("library") and d.get("status") != "deleted"
        ]

    # Filter by search query
    if q:
        query_str = q.strip().lower()
        documents = [d for d in documents if query_str in d.get("file_name", "").lower()]

    # Filter by type (pdf, image)
    if type:
        type_clean = type.strip().lower()
        if type_clean == "pdf":
            documents = [d for d in documents if d.get("mime_type") == "application/pdf"]
        elif type_clean in ("image", "images"):
            documents = [d for d in documents if d.get("mime_type") in ("image/png", "image/jpeg")]

    # Sort
    if sort == "oldest":
        documents.sort(key=lambda d: d.get("created_at", ""))
    elif sort == "name_asc":
        documents.sort(key=lambda d: d.get("file_name", "").lower())
    elif sort == "name_desc":
        documents.sort(key=lambda d: d.get("file_name", "").lower(), reverse=True)
    elif sort == "size_desc":
        documents.sort(key=lambda d: d.get("file_size_bytes", 0), reverse=True)
    else:  # "recent" default
        documents.sort(key=lambda d: d.get("updated_at", d.get("created_at", "")), reverse=True)

    # Slice pagination
    paginated = documents[offset: offset + limit]

    result = []
    for document in paginated:
        job = jobs.get(document.get("job_id"))
        result.append({
            **document,
            "latest_job_status": job.get("job_status") if job else None,
        })
    return result


@router.get("/documents/{document_id}", response_model=CustomerDocumentResponse)
def get_document(document_id: str, user=Depends(current_user)):
    require_customer(user)
    with db.transaction(readonly=True) as records:
        document = records.get("documents", document_id)
        if not document or document.get("owner_id") != user["id"] or not document.get("library") or document.get("status") == "deleted":
            raise HTTPException(404, "Document not found")
        job = records.get("jobs", document.get("job_id")) if document.get("job_id") else None

    return {
        **document,
        "latest_job_status": job.get("job_status") if job else None,
    }


@router.get("/documents/{document_id}/download")
def download_document(document_id: str, user=Depends(current_user)):
    require_customer(user)
    with db.transaction(readonly=True) as records:
        document = records.get("documents", document_id)
    if not document or document.get("owner_id") != user["id"] or not document.get("library"):
        raise HTTPException(404, "Document not found")
    if document.get("file_path") and Path(document["file_path"]).is_file():
        return FileResponse(document["file_path"], filename=document["file_name"], media_type=document["mime_type"])
    signed_url = storage_service.signed_url(document)
    if signed_url:
        return RedirectResponse(signed_url)
    raise HTTPException(404, "Document content is no longer available")


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, user=Depends(current_user)):
    require_customer(user)
    with db.transaction() as records:
        document = records.get("documents", document_id)
        if not document or document.get("owner_id") != user["id"] or not document.get("library"):
            raise HTTPException(404, "Document not found")
        job = records.get("jobs", document.get("job_id"))
        if job and job.get("job_status") in ("staged", "queued", "processing"):
            raise HTTPException(409, "This document is attached to an active print job")

        # Mark as deleting inside the transaction
        document["status"] = "deleting"
        document["updated_at"] = datetime.now(timezone.utc).isoformat()
        records.put("documents", document_id, document)
        record_audit(records, "document.delete", actor=user["username"], target=document_id)

    # Purge storage after metadata transaction commits
    purged = storage_service.purge(document)
    if purged:
        with db.transaction() as records:
            records.remove("documents", document_id)

    return {"deleted": True, "document_id": document_id, "status": "deleted" if purged else "deleting"}


@router.get("/jobs", response_model=list[CustomerJobResponse])
def list_customer_jobs(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(current_user),
):
    require_customer(user)
    with db.transaction(readonly=True) as records:
        jobs = [j for j in records.list("jobs") if j.get("owner_id") == user["id"]]

    if status:
        status_clean = status.strip().lower()
        if status_clean == "active":
            jobs = [j for j in jobs if j.get("job_status") in ("staged", "queued", "processing")]
        elif status_clean == "completed":
            jobs = [j for j in jobs if j.get("job_status") == "completed"]
        elif status_clean == "attention":
            jobs = [j for j in jobs if j.get("job_status") in ("failed", "expired") or j.get("payment_status") == "pending"]

    jobs.sort(key=lambda j: j.get("created_at", ""), reverse=True)
    paginated = jobs[offset: offset + limit]
    return [customer_job_view(j) for j in paginated]


@router.get("/jobs/{job_id}", response_model=CustomerJobResponse)
def get_customer_job(job_id: str, user=Depends(current_user)):
    require_customer(user)
    with db.transaction(readonly=True) as records:
        job = records.get("jobs", job_id)
    if not job or job.get("owner_id") != user["id"]:
        raise HTTPException(404, "Job not found")
    return customer_job_view(job)


class UpdateAliasRequest(BaseModel):
    alias: str = Field(..., min_length=1, max_length=32)


@router.patch("/alias")
def update_alias(payload: UpdateAliasRequest, user=Depends(current_user)):
    require_customer(user)
    clean = payload.alias.strip()
    if not clean or len(clean) > 32:
        raise HTTPException(422, "Alias must be between 1 and 32 characters")
    key = user.get("identity_key") or ("supabase:" + user["id"])
    with db.transaction() as records:
        stored = records.get("users", key) or {**user}
        stored["alias"] = clean
        stored["alias_chosen"] = True
        records.put("users", key, stored)
    from app.core.google_auth import update_cached_user_alias
    update_cached_user_alias(user["id"], clean)
    return {"ok": True, "alias": clean, "alias_chosen": True}

