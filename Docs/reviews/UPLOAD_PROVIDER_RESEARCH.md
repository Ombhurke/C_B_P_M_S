# Upload Provider Research & Technical Facts

**Date of Investigation:** 13 October 2026  
**Milestone:** CBPMS Production Secure Upload, Quotas & Expiry  
**Auditor / Architect:** Antigravity Pair Programmer

---

## 1. Verified Provider Technical Constraints

### 1.1 Vercel Serverless Function Payload Limits
- **Official Documentation:** [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- **Hard Restriction:** The request body and response body of any Vercel Serverless or Edge Function (including Next.js Route Handlers and Server Actions) is strictly capped at **4.5 MB** (`4,718,592 bytes`).
- **Enforcement Mechanism:** Enforced at the platform edge layer before user application code executes. When exceeded, Vercel immediately terminates the request with HTTP `413 FUNCTION_PAYLOAD_TOO_LARGE`.
- **Implication for CBPMS:** Application configuration (e.g., `serverActionsBodySizeLimit` or custom body parsers) cannot override or raise this ceiling. Therefore, **no print document bytes may travel through Vercel**. The Next.js frontend can only act as a control-plane proxy for small JSON metadata messages (admission, permissions, status checks, and completion confirmations).

---

### 1.2 Supabase Standard Signed Upload URLs
- **Official Documentation:** 
  - [Supabase Standard Uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
  - [JavaScript Reference: createSignedUploadUrl](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl)
  - [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- **Lifetime & Authentication:**
  - Standard signed upload URLs are valid for **2 hours** (7,200 seconds) from generation.
  - Signed upload tokens are **bearer capabilities**: anyone holding the URL and token can issue an upload without additional user-session headers.
  - Standard signed upload URLs are **not single-use** and cannot be revoked early via any built-in Supabase API.
- **Overwrite & Policy Violations:**
  - The API supports an `upsert: true` option (`x-upsert` header). In our security policy, **`upsert` must always be `false`**.
- **Implication for CBPMS:**
  - Because signed upload tokens are bearer capabilities valid for 2 hours, the backend must never issue a token without first committing an upfront **durable quota reservation** for the maximum allowable exposure (the enforced ceiling).
  - Every upload path must be unique, random, and quarantined (e.g., `quarantine/<batch_id>/<item_id>.bin`), preventing overwriting or collision with canonical objects.

---

### 1.3 Supabase Resumable Uploads (TUS Protocol)
- **Official Documentation:**
  - [Supabase Resumable Uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)
  - [TUS Protocol Specification](https://tus.io/protocols/resumable-upload.html)
- **Endpoint & Chunk Sizing:**
  - Resumable endpoint: `https://<project-id>.supabase.co/storage/v1/upload/resumable`
  - Recommended chunk size: **6 MiB** (`6 * 1024 * 1024` bytes).
- **Authentication via `x-signature`:**
  - When utilizing presigned upload capabilities without client-side master tokens, the client passes the token from `createSignedUploadUrl` in the **`x-signature`** header.
- **Resource Lifetime Discrepancy:**
  - TUS upload resources created on the storage server can persist up to **24 hours**, while our product's temporary document privacy SLA promises a **3-hour maximum lifetime**.
- **Implication for CBPMS:**
  - A client could theoretically resume or finalize a TUS transfer after the 3-hour privacy window has passed.
  - The backend validation and finalization gate must enforce a strict check on `created_at + 10,800 seconds`. Any upload finalized after the 3-hour write horizon is immediately rejected and scheduled for physical binary deletion, regardless of whether the TUS server allowed bytes to land.

---

### 1.4 Supabase Storage Object Deletion vs. SQL Deletion
- **Official Documentation:** [Supabase Object Deletion](https://supabase.com/docs/guides/storage/management/delete-objects)
- **Critical Architectural Difference:**
  - **Storage API (`supabase.storage.from(...).remove([...])`):** Directly issues the S3 `DeleteObject` command to delete the physical binary payload and removes metadata from Postgres.
  - **SQL Metadata (`DELETE FROM storage.objects`):** Deletes ONLY the database row. It **does NOT delete the underlying S3 binary**. The file remains orphaned in object storage, continuing to incur billing while becoming inaccessible through standard routes. Furthermore, Supabase statement triggers block direct SQL deletes on `storage.objects` by default.
- **Implication for CBPMS:**
  - All binary deletions must be performed via the **Supabase Storage API**.
  - Because external Storage API calls cannot be enrolled in PostgreSQL ACID transactions, deletion must be orchestrated via a **durable intent / outbox pattern**: record cleanup intent in PostgreSQL, commit, call the Storage API, and then record confirmed deletion.

---

### 1.5 Background Scheduling (Supabase Cron & Edge Functions)
- **Official Documentation:**
  - [Supabase Cron (pg_cron)](https://supabase.com/docs/guides/cron)
  - [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- **Architecture:**
  - `pg_cron` can trigger every 5 minutes (`*/5 * * * *`).
  - It utilizes `net.http_post` to trigger a secured cleanup worker (or invokes an internal maintenance routine).
  - Storage credentials must be pulled from `vault.decrypted_secrets` or executed via service-role authorization.

---

## 2. Inventory of Installed Dependency Versions

The exact installed versions across the monorepo have been verified against active lockfiles and runtime inspection:

| Package | Environment | Installed Version | Notes / Compatibility |
| :--- | :--- | :--- | :--- |
| `next` | `apps/web` | `15.5.27` | App router; supports Server Actions & Route Handlers |
| `@supabase/supabase-js` | `apps/web` | `2.117.3` | Installed client SDK; provides `uploadToSignedUrl` |
| `@supabase/ssr` | `apps/web` | `0.12.7` | Cookie-based session adapter for Next.js |
| `react` / `react-dom` | `apps/web` | `18.3.1` | Client components |
| `typescript` | `apps/web` | `5.4.5` | Type-checking |
| `python` | System | `3.10.6` | Runtime environment |
| `supabase-py` | `apps/server` | `2.28.3` | Python SDK |
| `storage3` | `apps/server` | `2.28.3` | Python storage client; exposes `create_signed_upload_url` |
| `fastapi` | `apps/server` | `0.110.0` | API routing framework |
| `SQLAlchemy` | `apps/server` | `2.0.51` | Database engine & query builder |
| `psycopg` | `apps/server` | `3.2.1` | Postgres driver with binary support |
| `PySide6` | `apps/desktop` | `6.8.0+` | Native desktop counter desk UI |

---

## 3. Selected Architecture Summary

1. **Pure Direct-to-Quarantine Transfers:**
   - Client requests upload admission from FastAPI backend (`/api/v1/uploads/batches`).
   - Backend reserves daily and total storage quota in `cbpms_private` PostgreSQL tables.
   - Backend generates a scoped signed upload token (`POST /object/upload/sign`) with `upsert: false`.
   - Browser uploads directly to Supabase Storage quarantine (`quarantine/<batch_id>/<item_id>.bin`) using standard `uploadToSignedUrl` for files $\le 6\text{ MB}$ and TUS with `x-signature` for files $> 6\text{ MB}$.
2. **Server-Side Validation & Promotion:**
   - Client notifies backend: `POST /api/v1/uploads/items/{id}/complete`.
   - Backend fetches the quarantined object, inspects magic bytes (PDF, PNG, JPEG), calculates SHA-256 and page count, copies to canonical storage, and marks it accepted.
   - Untrusted client declared sizes are reconciled with actual observed byte counts.
3. **Outbox-Driven Expiry & Cleanup:**
   - 3-hour hard deadline for temporary documents (`10,800` seconds from batch admission).
   - Dedicated cleanup worker processes pending deletions through the Supabase Storage API, retrying with exponential backoff on failure.
