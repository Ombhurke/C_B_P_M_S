"""Authoritative Direct-to-Storage Upload APIs.

All document file bytes are transferred directly from the browser to Supabase Storage,
completely bypassing Vercel Functions.
"""
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.audit import record_audit
from app.core.auth import current_user, digest, resolve_session
from app.core.config import settings
from app.core.database import db
from app.models.schemas import CustomerDocumentResponse
from app.services.documents import inspect_document, merge_documents_into_pdf
from app.services.pricing import calculate_cost
from app.services.quota_service import (
    quota_service,
    CUSTOMER_MAX_STORAGE_BYTES,
    CUSTOMER_MAX_DAILY_ADMISSION_BYTES,
    CUSTOMER_MAX_FILE_BYTES,
    GUEST_MAX_FILE_BYTES,
    CUSTOMER_MAX_BATCH_FILES,
    GUEST_MAX_BATCH_FILES,
    PRIVACY_EXPIRY_SECONDS,
    GRANT_EXPIRY_SECONDS,
)
from app.services.storage_service import storage_service

router = APIRouter(prefix="/uploads", tags=["Secure Direct Uploads"])


# --- Schemas ---

class PolicyResponse(BaseModel):
    supported_mime_types: List[str]
    supported_extensions: List[str]
    customer_max_file_bytes: int
    customer_max_storage_bytes: int
    customer_max_daily_admission_bytes: int
    customer_max_batch_files: int
    guest_max_file_bytes: int
    guest_max_batch_files: int
    grant_ttl_seconds: int
    privacy_expiry_seconds: int
    resumable_threshold_bytes: int
    captcha_required_for_guests: bool


class GuestSessionRequest(BaseModel):
    shop_id: str = Field(..., min_length=1)
    captcha_token: str = Field(..., min_length=1)


class GuestSessionResponse(BaseModel):
    guest_token: str
    session_id: str
    shop_id: str
    expires_at: str


class ManifestItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    size_bytes: int = Field(..., gt=0)
    mime_type: str = Field(default="application/pdf")


class CreateBatchRequest(BaseModel):
    purpose: str = Field(..., pattern="^(customer_library|transient_print_job)$")
    access_mode: Optional[str] = Field(default="ephemeral", pattern="^(ephemeral|persistent)$")
    shop_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    items: List[ManifestItem] = Field(..., min_length=1)
    # Optional print configuration for transient print jobs
    print_config: Optional[Dict[str, Any]] = None


class BatchResponse(BaseModel):
    batch_id: str
    principal_type: str
    principal_id: str
    purpose: str
    access_mode: str
    shop_id: Optional[str]
    status: str
    total_items: int
    expires_at: str
    created_at: str
    items: List[Dict[str, Any]]


class CompleteItemRequest(BaseModel):
    pass


class FinalizeBatchResponse(BaseModel):
    batch_id: str
    status: str
    purpose: str
    documents: Optional[List[Dict[str, Any]]] = None
    job: Optional[Dict[str, Any]] = None


# --- Helpers & Authentication ---

def verify_captcha_token(token: str, ip: Optional[str] = None) -> bool:
    if not token or token.strip() == "invalid-token":
        return False
    if settings.ENVIRONMENT == "test" or getattr(settings, "CAPTCHA_PROVIDER", "mock") == "mock":
        return True
    provider = getattr(settings, "CAPTCHA_PROVIDER", "mock")
    secret = getattr(settings, "CAPTCHA_SECRET_KEY", "")
    if not secret:
        # Fail closed if production CAPTCHA is not configured
        return False
    import urllib.request
    import urllib.parse
    if provider == "turnstile":
        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    elif provider == "recaptcha":
        url = "https://www.google.com/recaptcha/api/siteverify"
    else:
        return False
    data = urllib.parse.urlencode({"secret": secret, "response": token}).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = json.loads(resp.read().decode())
            return bool(body.get("success"))
    except Exception:
        return False


def get_principal(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_guest_session: Optional[str] = Header(None, alias="X-Guest-Session"),
) -> Dict[str, Any]:
    """Authenticates either a verified customer or a verified guest session."""
    # 1. Customer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            # Check user session or Supabase identity
            user = resolve_session(token)
            return {"type": "customer", "id": user["id"], "user": user}
        except Exception:
            pass

    # 2. Guest token
    if x_guest_session:
        hashed = hashlib.sha256(x_guest_session.strip().encode()).hexdigest()
        with db.transaction(readonly=True) as records:
            guest_sess = records.get("guest_upload_sessions", hashed)
        if not guest_sess:
            raise HTTPException(401, "Invalid guest upload session")
        exp = datetime.fromisoformat(guest_sess["expires_at"])
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(401, "Guest upload session has expired")
        return {"type": "guest", "id": guest_sess["id"], "shop_id": guest_sess["shop_id"]}

    raise HTTPException(401, "Authentication required (Customer Bearer token or X-Guest-Session)")


# --- Endpoints ---

@router.get("/policy", response_model=PolicyResponse)
def get_upload_policy():
    """Returns authoritative, nonsecret upload limits and capabilities."""
    return PolicyResponse(
        supported_mime_types=["application/pdf", "image/png", "image/jpeg"],
        supported_extensions=[".pdf", ".png", ".jpg", ".jpeg"],
        customer_max_file_bytes=CUSTOMER_MAX_FILE_BYTES,
        customer_max_storage_bytes=CUSTOMER_MAX_STORAGE_BYTES,
        customer_max_daily_admission_bytes=CUSTOMER_MAX_DAILY_ADMISSION_BYTES,
        customer_max_batch_files=CUSTOMER_MAX_BATCH_FILES,
        guest_max_file_bytes=GUEST_MAX_FILE_BYTES,
        guest_max_batch_files=GUEST_MAX_BATCH_FILES,
        grant_ttl_seconds=GRANT_EXPIRY_SECONDS,
        privacy_expiry_seconds=PRIVACY_EXPIRY_SECONDS,
        resumable_threshold_bytes=6 * 1024 * 1024,  # 6 MiB threshold
        captcha_required_for_guests=True,
    )


@router.post("/guest-session", response_model=GuestSessionResponse)
def create_guest_session(payload: GuestSessionRequest, request: Request):
    """Verifies CAPTCHA and issues a short-lived, rate-bounded guest capability."""
    with db.transaction(readonly=True) as records:
        shop = records.get("shops", payload.shop_id)
    if not shop:
        raise HTTPException(404, "Selected shop does not exist")

    client_ip = request.client.host if request.client else None
    if not verify_captcha_token(payload.captcha_token, client_ip):
        raise HTTPException(403, "CAPTCHA verification failed. Please complete challenge again.")

    raw_token = secrets.token_urlsafe(32)
    session_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    session_id = f"gsess-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=PRIVACY_EXPIRY_SECONDS)).isoformat()

    session_record = {
        "id": session_id,
        "session_hash": session_hash,
        "shop_id": payload.shop_id,
        "ip_fingerprint": hashlib.sha256((client_ip or "").encode()).hexdigest() if client_ip else None,
        "captcha_verified": True,
        "expires_at": expires_at,
        "created_at": now.isoformat(),
    }

    with db.transaction() as records:
        records.put("guest_upload_sessions", session_hash, session_record)

    return GuestSessionResponse(
        guest_token=raw_token,
        session_id=session_id,
        shop_id=payload.shop_id,
        expires_at=expires_at,
    )


@router.post("/batches", response_model=BatchResponse)
def create_upload_batch(payload: CreateBatchRequest, request: Request, principal=Depends(get_principal)):
    """Transactionally reserves provider-enforced quotas and creates an upload batch."""
    p_type = principal["type"]
    p_id = principal["id"]

    # Validate purpose & access_mode
    if p_type == "guest":
        if payload.purpose != "transient_print_job":
            raise HTTPException(403, "Guests may only stage print jobs")
        if payload.access_mode != "ephemeral":
            raise HTTPException(403, "Guests cannot use persistent library storage")
        if not payload.shop_id:
            payload.shop_id = principal.get("shop_id")
        elif payload.shop_id != principal.get("shop_id"):
            raise HTTPException(403, "Guest session bound to a different shop")

    if payload.purpose == "transient_print_job" and not payload.shop_id:
        raise HTTPException(400, "shop_id is required for print jobs")

    # Access mode: customer can explicitly choose ephemeral mode (anonymous privacy mode)
    access_mode = payload.access_mode or ("persistent" if payload.purpose == "customer_library" else "ephemeral")
    if p_type == "guest":
        access_mode = "ephemeral"

    # Validate filenames and extensions
    manifest_dicts = []
    for item in payload.items:
        clean_name = Path(item.name).name.strip()
        if not clean_name or any(c in clean_name for c in ("\r", "\n", "\0")):
            raise HTTPException(422, f"Invalid filename: {item.name}")
        ext = Path(clean_name).suffix.lower()
        if ext not in (".pdf", ".png", ".jpg", ".jpeg"):
            raise HTTPException(422, f"Unsupported file extension '{ext}'. Only PDF, PNG, and JPG allowed.")
        manifest_dicts.append({
            "name": clean_name,
            "size_bytes": item.size_bytes,
            "mime_type": item.mime_type,
        })

    # Idempotency check
    batch_id = f"batch-{uuid.uuid4().hex[:12]}"
    digest = hashlib.sha256(json.dumps([m for m in manifest_dicts], sort_keys=True).encode()).hexdigest()

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=PRIVACY_EXPIRY_SECONDS)).isoformat()

    with db.transaction() as records:
        if payload.idempotency_key:
            existing_batches = [
                b for b in records.list("upload_batches")
                if b.get("principal_id") == p_id and b.get("idempotency_key") == payload.idempotency_key
            ]
            if existing_batches:
                existing = existing_batches[0]
                if existing.get("request_digest") != digest:
                    raise HTTPException(409, "Idempotency key reused with different upload manifest")
                existing_items = [
                    it for it in records.list("upload_items")
                    if it.get("batch_id") == existing["id"]
                ]
                existing_items.sort(key=lambda x: x.get("item_index", 0))
                return BatchResponse(
                    batch_id=existing["id"],
                    principal_type=existing["principal_type"],
                    principal_id=existing["principal_id"],
                    purpose=existing["purpose"],
                    access_mode=existing["access_mode"],
                    shop_id=existing.get("shop_id"),
                    status=existing["status"],
                    total_items=existing["total_items"],
                    expires_at=existing["expires_at"],
                    created_at=existing["created_at"],
                    items=existing_items,
                )

        # Transactionally check and reserve quota
        prepared_items = quota_service.reserve_batch(
            records=records,
            principal_type=p_type,
            principal_id=p_id,
            items=manifest_dicts,
            purpose=payload.purpose,
            access_mode=access_mode,
            batch_id=batch_id,
        )

        batch_record = {
            "id": batch_id,
            "principal_type": p_type,
            "principal_id": p_id,
            "shop_id": payload.shop_id,
            "purpose": payload.purpose,
            "access_mode": access_mode,
            "status": "pending",
            "idempotency_key": payload.idempotency_key,
            "request_digest": digest,
            "total_items": len(prepared_items),
            "expires_at": expires_at,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "print_config": payload.print_config,
        }
        records.put("upload_batches", batch_id, batch_record)

        items_created = []
        for it in prepared_items:
            item_id = f"item-{uuid.uuid4().hex[:12]}"
            quarantine_path = f"quarantine/{batch_id}/{item_id}.bin"
            item_rec = {
                "id": item_id,
                "batch_id": batch_id,
                "item_index": it["item_index"],
                "declared_name": it["declared_name"],
                "declared_size_bytes": it["declared_size_bytes"],
                "declared_mime": it["declared_mime"],
                "enforced_ceiling_bytes": it["enforced_ceiling_bytes"],
                "status": "reserved",
                "quarantine_path": quarantine_path,
                "canonical_path": None,
                "observed_size_bytes": None,
                "observed_sha256": None,
                "page_count": None,
                "error_message": None,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            }
            records.put("upload_items", item_id, item_rec)
            items_created.append(item_rec)

    return BatchResponse(
        batch_id=batch_id,
        principal_type=p_type,
        principal_id=p_id,
        purpose=payload.purpose,
        access_mode=access_mode,
        shop_id=payload.shop_id,
        status="pending",
        total_items=len(items_created),
        expires_at=expires_at,
        created_at=now.isoformat(),
        items=items_created,
    )


@router.post("/items/{item_id}/permission")
def get_item_upload_permission(item_id: str, principal=Depends(get_principal)):
    """Issues a direct, scoped signed upload grant to the quarantine path."""
    with db.transaction() as records:
        item = records.get("upload_items", item_id)
        if not item:
            raise HTTPException(404, "Upload item not found")
        batch = records.get("upload_batches", item["batch_id"])
        if not batch or batch.get("principal_id") != principal["id"]:
            raise HTTPException(403, "Access denied")
        if batch.get("status") in ("cancelled", "expired", "failed", "finalized"):
            raise HTTPException(400, f"Cannot upload to batch in '{batch.get('status')}' state")
        if item.get("status") in ("accepted", "rejected", "cancelled"):
            raise HTTPException(400, f"Item already in '{item.get('status')}' state")

        grant = storage_service.create_signed_upload_grant(item["quarantine_path"])
        item["status"] = "granted"
        item["updated_at"] = datetime.now(timezone.utc).isoformat()
        records.put("upload_items", item_id, item)

    return {
        "item_id": item_id,
        "batch_id": item["batch_id"],
        "quarantine_path": item["quarantine_path"],
        "upload_url": grant["upload_url"],
        "token": grant["token"],
        "expires_in": GRANT_EXPIRY_SECONDS,
    }


@router.post("/items/{item_id}/complete")
def complete_item_upload(item_id: str, principal=Depends(get_principal)):
    """Verifies binary from quarantine, derives size/hash/pages, promotes to canonical, and settles quota."""
    with db.transaction(readonly=True) as records:
        item = records.get("upload_items", item_id)
        if not item:
            raise HTTPException(404, "Upload item not found")
        batch = records.get("upload_batches", item["batch_id"])
        if not batch or batch.get("principal_id") != principal["id"]:
            raise HTTPException(403, "Access denied")
        if batch.get("status") != "pending":
            raise HTTPException(400, f"Batch is {batch.get('status')}")
        if item.get("status") == "accepted":
            return {"item_id": item_id, "status": "accepted", "already_completed": True}

    # Fetch quarantined binary and validate without holding database transaction
    try:
        content = storage_service.download_bytes(item["quarantine_path"])
    except Exception as exc:
        raise HTTPException(400, "Uploaded object could not be found in storage quarantine. Upload body before calling complete.") from exc

    observed_size = len(content)
    ceiling = item["enforced_ceiling_bytes"]
    if observed_size > ceiling:
        # File exceeded ceiling
        with db.transaction() as records:
            item["status"] = "rejected"
            item["error_message"] = f"Observed size ({observed_size}) exceeded enforced ceiling ({ceiling})"
            records.put("upload_items", item_id, item)
            quota_service.release_reservation(
                records, batch["principal_type"], batch["principal_id"],
                batch["id"], item_id, ceiling
            )
        storage_service.remove_objects([item["quarantine_path"]])
        raise HTTPException(413, item["error_message"])

    observed_sha256 = hashlib.sha256(content).hexdigest()

    # Validate file format and inspect pages
    try:
        page_count, validated_mime = inspect_document(item["declared_name"], content)
    except Exception as exc:
        with db.transaction() as records:
            item["status"] = "rejected"
            item["error_message"] = str(exc)
            records.put("upload_items", item_id, item)
            quota_service.release_reservation(
                records, batch["principal_type"], batch["principal_id"],
                batch["id"], item_id, ceiling
            )
        storage_service.remove_objects([item["quarantine_path"]])
        raise HTTPException(422, f"Document validation failed: {exc}") from exc

    # Promote to canonical storage
    canonical_path = f"canonical/{batch['purpose']}/{item_id}.bin"
    storage_service.copy_object(item["quarantine_path"], canonical_path)

    # Commit metadata and settle quota
    now_iso = datetime.now(timezone.utc).isoformat()
    artifact_id = f"art-{uuid.uuid4().hex[:12]}"

    with db.transaction() as records:
        # Settle quota reservation
        quota_service.settle_item(
            records=records,
            principal_type=batch["principal_type"],
            principal_id=batch["principal_id"],
            batch_id=batch["id"],
            item_id=item_id,
            enforced_ceiling_bytes=ceiling,
            observed_size_bytes=observed_size,
            purpose=batch["purpose"],
            access_mode=batch["access_mode"],
        )

        # Update item
        item["status"] = "accepted"
        item["canonical_path"] = canonical_path
        item["observed_size_bytes"] = observed_size
        item["observed_sha256"] = observed_sha256
        item["page_count"] = page_count
        item["declared_mime"] = validated_mime
        item["updated_at"] = now_iso
        records.put("upload_items", item_id, item)

        # Insert object_artifacts
        records.put("object_artifacts", artifact_id, {
            "id": artifact_id,
            "storage_bucket": settings.SUPABASE_STORAGE_BUCKET,
            "storage_path": canonical_path,
            "artifact_type": "source",
            "purpose": batch["purpose"],
            "access_mode": batch["access_mode"],
            "owner_id": batch["principal_id"] if batch["principal_type"] == "customer" else None,
            "size_bytes": observed_size,
            "sha256": observed_sha256,
            "expires_at": batch["expires_at"] if batch["access_mode"] == "ephemeral" else None,
            "deleted_at": None,
            "created_at": now_iso,
        })

    # Remove temporary quarantine file
    storage_service.remove_objects([item["quarantine_path"]])

    return {
        "item_id": item_id,
        "batch_id": batch["id"],
        "status": "accepted",
        "observed_size_bytes": observed_size,
        "observed_sha256": observed_sha256,
        "page_count": page_count,
        "mime_type": validated_mime,
    }


@router.get("/batches/{batch_id}", response_model=BatchResponse)
def get_batch_status(batch_id: str, principal=Depends(get_principal)):
    """Returns principal-scoped progress and item statuses for an upload batch."""
    with db.transaction(readonly=True) as records:
        batch = records.get("upload_batches", batch_id)
        if not batch or batch.get("principal_id") != principal["id"]:
            raise HTTPException(404, "Batch not found")
        items = [it for it in records.list("upload_items") if it.get("batch_id") == batch_id]
        items.sort(key=lambda x: x.get("item_index", 0))

    return BatchResponse(
        batch_id=batch["id"],
        principal_type=batch["principal_type"],
        principal_id=batch["principal_id"],
        purpose=batch["purpose"],
        access_mode=batch["access_mode"],
        shop_id=batch.get("shop_id"),
        status=batch["status"],
        total_items=batch["total_items"],
        expires_at=batch["expires_at"],
        created_at=batch["created_at"],
        items=items,
    )


@router.post("/batches/{batch_id}/finalize", response_model=FinalizeBatchResponse)
def finalize_upload_batch(batch_id: str, principal=Depends(get_principal)):
    """Verifies all required items are accepted, then publishes library documents or stages print job."""
    with db.transaction() as records:
        batch = records.get("upload_batches", batch_id)
        if not batch or batch.get("principal_id") != principal["id"]:
            raise HTTPException(404, "Batch not found")

        # Idempotency: if already finalized, return cached result
        if batch.get("status") == "finalized":
            cached_docs = None
            if batch["purpose"] == "customer_library":
                cached_docs = [
                    d for d in records.list("documents")
                    if d.get("batch_id") == batch_id
                ]
            cached_job = None
            if batch["purpose"] == "transient_print_job":
                jobs = [j for j in records.list("jobs") if j.get("batch_id") == batch_id]
                cached_job = jobs[0] if jobs else None

            return FinalizeBatchResponse(
                batch_id=batch_id,
                status="finalized",
                purpose=batch["purpose"],
                documents=cached_docs,
                job=cached_job,
            )

        if batch.get("status") != "pending":
            raise HTTPException(400, f"Cannot finalize batch in status '{batch.get('status')}'")

        items = [it for it in records.list("upload_items") if it.get("batch_id") == batch_id]
        items.sort(key=lambda x: x.get("item_index", 0))

        if len(items) != batch["total_items"]:
            raise HTTPException(400, "Item count mismatch in batch")

        unaccepted = [it for it in items if it.get("status") != "accepted"]
        if unaccepted:
            raise HTTPException(400, f"{len(unaccepted)} items have not completed verification")

        now_iso = datetime.now(timezone.utc).isoformat()

        # Handle Customer Library Finalization
        if batch["purpose"] == "customer_library":
            created_docs = []
            for it in items:
                doc_id = f"doc-{uuid.uuid4().hex[:12]}"
                doc = {
                    "id": doc_id,
                    "owner_id": batch["principal_id"],
                    "batch_id": batch_id,
                    "library": True,
                    "job_id": None,
                    "file_name": it["declared_name"],
                    "mime_type": it["declared_mime"],
                    "file_size_bytes": it["observed_size_bytes"],
                    "file_hash": it["observed_sha256"],
                    "page_count": it["page_count"],
                    "file_path": None,
                    "supabase_path": it["canonical_path"],
                    "created_at": now_iso,
                    "updated_at": now_iso,
                    "status": "available",
                    "deleted_at": None,
                }
                records.put("documents", doc_id, doc)
                created_docs.append(doc)

            batch["status"] = "finalized"
            batch["updated_at"] = now_iso
            records.put("upload_batches", batch_id, batch)
            return FinalizeBatchResponse(
                batch_id=batch_id,
                status="finalized",
                purpose="customer_library",
                documents=created_docs,
            )

        # Handle Print Job Staging Finalization
        if batch["purpose"] == "transient_print_job":
            shop = records.get("shops", batch["shop_id"])
            if not shop:
                raise HTTPException(404, "Shop not found")

            # Download canonical binaries and prepare single printable artifact for desktop
            if len(items) == 1:
                single_item = items[0]
                job_pages = single_item["page_count"]
                job_canonical_path = single_item["canonical_path"]
                job_sha256 = single_item["observed_sha256"]
                job_size = single_item["observed_size_bytes"]
                job_filename = single_item["declared_name"]
            else:
                # Merge folder items into single PDF
                folder_payloads = []
                for it in items:
                    content = storage_service.download_bytes(it["canonical_path"])
                    folder_payloads.append((it["declared_name"], content))
                merged_pdf_bytes, job_pages = merge_documents_into_pdf(folder_payloads)
                merged_sha256 = hashlib.sha256(merged_pdf_bytes).hexdigest()
                merged_size = len(merged_pdf_bytes)

                merged_path = f"canonical/transient_print_job/merged-{batch_id}.pdf"
                if storage_service.client:
                    storage_service.client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
                        merged_path, merged_pdf_bytes, {"content-type": "application/pdf"}
                    )
                else:
                    local_dst = Path(settings.TEMP_STORAGE_DIR).resolve() / merged_path
                    local_dst.parent.mkdir(parents=True, exist_ok=True)
                    local_dst.write_bytes(merged_pdf_bytes)

                job_canonical_path = merged_path
                job_sha256 = merged_sha256
                job_size = merged_size
                job_filename = f"folder-merge-{len(items)}-files.pdf"

            cfg = batch.get("print_config") or {}
            color = bool(cfg.get("color", False))
            copies = int(cfg.get("copies", 1))
            duplex = bool(cfg.get("duplex", False))

            duplex_mode = "duplex_long" if duplex else "simplex"
            calc = calculate_cost(shop, job_pages, copies, color, duplex_mode, 1, "normal")
            job_id = f"job-{uuid.uuid4().hex[:12]}"
            checkout_token = secrets.token_urlsafe(32)

            doc_id = f"doc-{uuid.uuid4().hex[:12]}"
            doc_record = {
                "id": doc_id,
                "owner_id": batch["principal_id"] if batch["principal_type"] == "customer" else None,
                "batch_id": batch_id,
                "library": False,
                "job_id": job_id,
                "file_name": job_filename,
                "mime_type": "application/pdf" if len(items) > 1 else items[0]["declared_mime"],
                "file_size_bytes": job_size,
                "file_hash": job_sha256,
                "page_count": job_pages,
                "file_path": None,
                "supabase_path": job_canonical_path,
                "created_at": now_iso,
                "updated_at": now_iso,
                "status": "staged",
                "deleted_at": None,
            }
            records.put("documents", doc_id, doc_record)

            job_record = {
                "id": job_id,
                "job_id": job_id,
                "shop_id": batch["shop_id"],
                "owner_id": batch["principal_id"] if batch["principal_type"] == "customer" else None,
                "batch_id": batch_id,
                "document_id": doc_id,
                "file_name": job_filename,
                **calc,
                "job_status": "staged",
                "payment_status": "pending",
                "checkout_token": checkout_token,
                "checkout_hash": digest(checkout_token),
                "release_token": None,
                "supabase_path": job_canonical_path,
                "file_path": None,
                "file_hash": job_sha256,
                "file_size_bytes": job_size,
                "created_at": now_iso,
                "updated_at": now_iso,
                "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=settings.JOB_TTL_SECONDS)).isoformat(),
            }
            records.put("jobs", job_id, job_record)

            batch["status"] = "finalized"
            batch["updated_at"] = now_iso
            records.put("upload_batches", batch_id, batch)

            return FinalizeBatchResponse(
                batch_id=batch_id,
                status="finalized",
                purpose="transient_print_job",
                job=job_record,
            )


@router.post("/batches/{batch_id}/cancel")
def cancel_upload_batch(batch_id: str, principal=Depends(get_principal)):
    """Cancels batch, releases outstanding quota reservations, and cleans up storage."""
    with db.transaction() as records:
        batch = records.get("upload_batches", batch_id)
        if not batch or batch.get("principal_id") != principal["id"]:
            raise HTTPException(404, "Batch not found")

        if batch.get("status") in ("finalized", "cancelled"):
            return {"cancelled": True, "batch_id": batch_id, "status": batch.get("status")}

        items = [it for it in records.list("upload_items") if it.get("batch_id") == batch_id]
        released_bytes = 0
        quarantine_paths_to_delete = []

        now_iso = datetime.now(timezone.utc).isoformat()
        for it in items:
            if it.get("status") in ("reserved", "granted"):
                released_bytes += it.get("enforced_ceiling_bytes", 0)
                it["status"] = "cancelled"
                it["updated_at"] = now_iso
                records.put("upload_items", it["id"], it)
                quarantine_paths_to_delete.append(it["quarantine_path"])
            elif it.get("status") == "accepted":
                # For accepted items in a cancelled batch, release active storage if persistent or daily
                quota_service.free_active_storage(
                    records, batch["principal_id"], it.get("observed_size_bytes", 0), target_id=it["id"]
                )
                it["status"] = "cancelled"
                records.put("upload_items", it["id"], it)
                if it.get("canonical_path"):
                    quarantine_paths_to_delete.append(it["canonical_path"])

        if released_bytes > 0:
            quota_service.release_reservation(
                records=records,
                principal_type=batch["principal_type"],
                principal_id=batch["principal_id"],
                batch_id=batch_id,
                item_id=None,
                released_bytes=released_bytes,
            )

        batch["status"] = "cancelled"
        batch["updated_at"] = now_iso
        records.put("upload_batches", batch_id, batch)

    # Clean up storage objects outside transaction
    if quarantine_paths_to_delete:
        storage_service.remove_objects(quarantine_paths_to_delete)

    return {"cancelled": True, "batch_id": batch_id, "status": "cancelled"}
