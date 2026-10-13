# CBPMS Upload API Contract & Specification

**Version:** 1.0.0  
**Effective Date:** 13 October 2026  
**Security Boundary:** Direct-to-Private-Storage with Strict Backend Admission

---

## 1. Overview & Transport Guarantees

All document file bodies in CBPMS bypass application proxies and serverless functions (including Vercel's 4.5 MB Function payload cap). File bodies are transferred directly from client user agents to Supabase Storage using scoped, short-lived signed upload grants issued by the authoritative FastAPI backend.

### Authentication & Principal Capabilities
- **Verified Customer Accounts:** Authenticated via `Authorization: Bearer <supabase_access_token>`. Permits persistent customer library storage up to 100,000,000 bytes active storage and 100,000,000 bytes UTC-day admission.
- **Walk-in Guest Customers:** Authenticated via header `X-Guest-Session: <guest_token>`. Issued only after server-verified CAPTCHA validation. Strictly restricted to ephemeral print staging (max 5 files, 2 MiB per file).

---

## 2. API Endpoints

### 2.1 Get Upload Policy
- **Method / Path:** `GET /api/v1/uploads/policy`
- **Authentication:** Public (nonsecret)
- **Description:** Returns authoritative system limits, supported formats, and feature capabilities.

#### Response `200 OK`
```json
{
  "supported_mime_types": ["application/pdf", "image/png", "image/jpeg"],
  "supported_extensions": [".pdf", ".png", ".jpg", ".jpeg"],
  "customer_max_file_bytes": 26214400,
  "customer_max_storage_bytes": 100000000,
  "customer_max_daily_admission_bytes": 100000000,
  "customer_max_batch_files": 20,
  "guest_max_file_bytes": 2097152,
  "guest_max_batch_files": 5,
  "grant_ttl_seconds": 7200,
  "privacy_expiry_seconds": 10800,
  "resumable_threshold_bytes": 6291456,
  "captcha_required_for_guests": true
}
```

---

### 2.2 Create Walk-in Guest Session
- **Method / Path:** `POST /api/v1/uploads/guest-session`
- **Authentication:** Public with server-verified CAPTCHA
- **Request Body:**
```json
{
  "shop_id": "shop-demo-1",
  "captcha_token": "<turnstile_or_recaptcha_response_token>"
}
```
#### Response `200 OK`
```json
{
  "guest_token": "gsess_token_urlsafe_string",
  "session_id": "gsess-abc123456789",
  "shop_id": "shop-demo-1",
  "expires_at": "2026-10-13T21:00:00Z"
}
```
#### Error Responses
- `403 Forbidden`: CAPTCHA challenge failed or replayed.
- `404 Not Found`: Selected shop does not exist.

---

### 2.3 Get Customer Storage & Daily Admission Usage
- **Method / Path:** `GET /api/v1/customer/storage-usage`
- **Authentication:** Customer Bearer Token
- **Description:** Returns current authenticated customer's storage exposure, active bytes, and UTC-day consumption.

#### Response `200 OK`
```json
{
  "account_id": "user-uuid",
  "active_storage_bytes": 14999000,
  "outstanding_reservation_bytes": 0,
  "total_storage_exposure_bytes": 14999000,
  "max_storage_bytes": 100000000,
  "storage_remaining_bytes": 85001000,
  "daily_charged_admission_bytes": 14999000,
  "daily_outstanding_reservation_bytes": 0,
  "total_daily_exposure_bytes": 14999000,
  "max_daily_admission_bytes": 100000000,
  "daily_remaining_bytes": 85001000,
  "today_utc": "2026-10-13",
  "resets_at_utc": "2026-10-14T00:00:00Z"
}
```

---

### 2.4 Create Upload Batch (Admission & Upfront Quota Reservation)
- **Method / Path:** `POST /api/v1/uploads/batches`
- **Authentication:** Customer Bearer Token OR `X-Guest-Session`
- **Request Body:**
```json
{
  "purpose": "customer_library",
  "access_mode": "persistent",
  "shop_id": null,
  "idempotency_key": "optional-client-uuid",
  "items": [
    {
      "name": "annual_report.pdf",
      "size_bytes": 4500000,
      "mime_type": "application/pdf"
    }
  ]
}
```
#### Response `200 OK`
```json
{
  "batch_id": "batch-a1b2c3d4e5f6",
  "principal_type": "customer",
  "principal_id": "user-uuid",
  "purpose": "customer_library",
  "access_mode": "persistent",
  "shop_id": null,
  "status": "pending",
  "total_items": 1,
  "expires_at": "2026-10-13T21:00:00Z",
  "created_at": "2026-10-13T18:00:00Z",
  "items": [
    {
      "id": "item-9876543210ab",
      "batch_id": "batch-a1b2c3d4e5f6",
      "item_index": 0,
      "declared_name": "annual_report.pdf",
      "declared_size_bytes": 4500000,
      "declared_mime": "application/pdf",
      "enforced_ceiling_bytes": 26214400,
      "status": "reserved",
      "quarantine_path": "quarantine/batch-a1b2c3d4e5f6/item-9876543210ab.bin"
    }
  ]
}
```
#### Error Responses
- `400 Bad Request`: Manifest is empty or exceeds maximum item limits (20 customer / 5 guest).
- `403 Forbidden`: Upload would exceed account active storage cap or daily admission cap (`QUOTA_EXCEEDED`).
- `409 Conflict`: Idempotency key reused with mismatched manifest.
- `413 Payload Too Large`: Declared item size exceeds per-file ceiling (25 MiB customer / 2 MiB guest).
- `422 Unprocessable Entity`: Unsupported file format or invalid filename.

---

### 2.5 Request Scoped Upload Permission Grant
- **Method / Path:** `POST /api/v1/uploads/items/{item_id}/permission`
- **Authentication:** Principal owner of the item's batch
- **Description:** Generates a Supabase Storage signed upload URL strictly scoped to the server-assigned quarantine path (`upsert: false`).

#### Response `200 OK`
```json
{
  "item_id": "item-9876543210ab",
  "batch_id": "batch-a1b2c3d4e5f6",
  "quarantine_path": "quarantine/batch-a1b2c3d4e5f6/item-9876543210ab.bin",
  "upload_url": "https://<project-ref>.supabase.co/storage/v1/object/upload/sign/transient-print-jobs/quarantine/batch-a1b2c3d4e5f6/item-9876543210ab.bin?token=<signed_token>",
  "token": "<signed_token>",
  "expires_in": 7200
}
```

---

### 2.6 Complete & Validate Upload Item
- **Method / Path:** `POST /api/v1/uploads/items/{item_id}/complete`
- **Authentication:** Principal owner of the item's batch
- **Description:** Promotes quarantined binary to canonical storage, validates magic bytes, verifies SHA-256 and page count, and settles quota reservations.

#### Response `200 OK`
```json
{
  "item_id": "item-9876543210ab",
  "batch_id": "batch-a1b2c3d4e5f6",
  "status": "accepted",
  "observed_size_bytes": 4501230,
  "observed_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "page_count": 12,
  "mime_type": "application/pdf"
}
```
#### Error Responses
- `400 Bad Request`: File has not been uploaded to quarantine path.
- `413 Payload Too Large`: Uploaded binary exceeds provider-enforced ceiling.
- `422 Unprocessable Entity`: Corrupt file, encrypted PDF, decompression bomb, or invalid magic bytes.

---

### 2.7 Finalize Upload Batch
- **Method / Path:** `POST /api/v1/uploads/batches/{batch_id}/finalize`
- **Authentication:** Principal owner of the batch
- **Description:** Atomic check-and-publish: ensures all batch items are accepted. Creates customer library document records or stages transient print job (merging multi-file folders into a single printable PDF).

#### Response `200 OK` (Customer Library)
```json
{
  "batch_id": "batch-a1b2c3d4e5f6",
  "status": "finalized",
  "purpose": "customer_library",
  "documents": [
    {
      "id": "doc-abc123456789",
      "owner_id": "user-uuid",
      "file_name": "annual_report.pdf",
      "file_size_bytes": 4501230,
      "page_count": 12,
      "status": "available"
    }
  ]
}
```

#### Response `200 OK` (Transient Print Job)
```json
{
  "batch_id": "batch-a1b2c3d4e5f6",
  "status": "finalized",
  "purpose": "transient_print_job",
  "job": {
    "job_id": "job-def123456789",
    "shop_id": "shop-demo-1",
    "file_name": "folder-merge-2-files.pdf",
    "page_count": 14,
    "total_cost": 28.00,
    "job_status": "staged",
    "payment_status": "pending",
    "checkout_token": "checkout_token_string"
  }
}
```

---

### 2.8 Cancel Upload Batch
- **Method / Path:** `POST /api/v1/uploads/batches/{batch_id}/cancel`
- **Authentication:** Principal owner of the batch
- **Description:** Marks batch cancelled, releases outstanding quota reservations immediately, and triggers outbox cleanup of quarantine objects.

#### Response `200 OK`
```json
{
  "cancelled": true,
  "batch_id": "batch-a1b2c3d4e5f6",
  "status": "cancelled"
}
```
