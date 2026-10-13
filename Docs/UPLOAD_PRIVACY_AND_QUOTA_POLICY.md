# CBPMS Upload Privacy & Quota Policy

**Version:** 1.0.0  
**Effective Date:** 13 October 2026  
**Audience:** Platform Architects, Security Auditors, and Customer Support

---

## 1. Storage & Admission Quotas

CBPMS employs a dual-ledger quota system for customer accounts:

### 1.1 Dual Quota Ceilings
1. **Active Storage Quota:** `100,000,000 bytes` (100 MB decimal).
   - Measures confirmed bytes stored in the customer's permanent library plus current outstanding reservations.
   - Deleting a document frees confirmed active storage immediately upon confirmation.
2. **Daily Admission Quota:** `100,000,000 bytes` (100 MB decimal) per UTC calendar day (`00:00:00 UTC` to `23:59:59 UTC`).
   - Measures total bytes admitted into the system today, regardless of whether documents are kept or deleted.
   - **Crucial Rule:** Deleting a document **never refunds today's consumed admission quota**. This prevents high-velocity upload-and-delete resource exhaustion attacks.

### 1.2 Binary vs. Decimal Distinctions
- System Quotas: Enforced in decimal bytes (`100,000,000 bytes = 100 MB`).
- Provider Ceilings: Enforced in binary mebibytes (`26,214,400 bytes = 25 MiB` for verified customers; `2,097_152 bytes = 2 MiB` for guests).
- Resumable Chunking: 6 MiB (`6,291,456 bytes`) minimum TUS chunk size.

---

## 2. Upfront Quota Reservation Model

Because Supabase Storage standard signed upload tokens are bearer capabilities valid for 2 hours and cannot be revoked mid-flight:
1. **Pre-Grant Reservation:** The backend **reserves the provider-enforced ceiling** (25 MiB customer / 2 MiB guest) *before* returning the upload grant to the client.
2. **Admission Enforcement:** If `current_active + pending_reservations + new_ceiling > 100,000,000` OR `daily_charged + pending_daily_reservations + new_ceiling > 100,000,000`, the admission is **rejected with HTTP 403 Forbidden**.
3. **Settlement:** Upon successful file validation and canonical promotion, the actual observed file size (e.g., 4.5 MB) is settled:
   - The 25 MiB reservation is released.
   - The 4.5 MB observed size is added to `active_storage_bytes` (if persistent) and `daily_charged_admission_bytes`.
4. **Cancellation / Expiry:** If the user cancels the upload or abandons it, the 25 MiB reservation is released immediately, with zero bytes charged to active or daily storage.

---

## 3. Privacy Expiry & Retention SLA

### 3.1 Three-Hour Ephemeral Privacy Deadline
- All transient print jobs, walk-in guest uploads, and customer uploads in anonymous privacy mode have a hard privacy deadline of **3 hours (`10,800 seconds`)** from initial batch creation.
- Logical expiry denies checkout, staging, and downloads immediately at `expires_at`.
- Scheduled background workers purge all raw source binaries, quarantine files, and merged PDFs using the Supabase Storage API (`remove()`).

### 3.2 Customer Library Permanence
- Permanent account-linked documents (`access_mode = 'persistent'`) **never expire** and are completely excluded from the 3-hour ephemeral sweep.
- Customer library documents remain available until explicitly deleted by the owning customer.

### 3.3 Anonymous Privacy Mode for Signed-in Customers
- A verified customer may deliberately select `privacy_mode = 'ephemeral'` during print staging.
- The system honors this choice by assigning `access_mode = 'ephemeral'`, ensuring that print files are purged after 3 hours and never retained in the user's permanent document library.

---

## 4. Deletion & Orphan Reconciliation Guarantees

1. **Storage API Deletion:** SQL `DELETE FROM storage.objects` only removes PostgreSQL metadata, leaving orphaned cloud binaries on disk. All physical binary deletions in CBPMS use the authenticated Supabase Storage API (`storage_service.remove_objects`).
2. **Outbox Pattern:** External Storage API calls and PostgreSQL transactions cannot share an ACID transaction. When a document is deleted:
   - SQL transaction records the deletion intent and marks the artifact `deleting`.
   - The storage binary is purged via the Storage API.
   - Upon confirmation, the SQL record is removed and active storage quota is released.
   - If external deletion fails, an outbox task in `cbpms_private.background_tasks` retries with exponential backoff and worker leasing.
