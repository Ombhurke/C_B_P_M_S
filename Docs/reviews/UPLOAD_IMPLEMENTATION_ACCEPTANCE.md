# Acceptance Review: Secure Direct Upload Milestone

**Date of Review:** 13 October 2026  
**Status:** PASSING (Stages A through E Implemented & Regression-Tested; Stage F Deployment Pending Owner Execution)  
**Authority:** `Docs/SECURE_UPLOAD_IMPLEMENTATION_PLAN.md`  

---

## 1. Acceptance Verification Matrix (17 Scenarios)

| Scenario | Requirement | Verification Method | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1. Auth & Session Flow** | Google OAuth, email verification, and HTTP-only session unaffected. Invalid accounts denied library permissions. | `npm run test:security`, `node tests/auth-security.test.cjs` | **PASS** | 13/13 tests pass. OAuth redirects and session cookies untouched. |
| **2. Principal Isolation** | Customer A cannot read/cancel/finalize Customer B's batch. Guest A cannot hijack Guest B. | `test_customer_isolation_and_cross_principal_denial` in `test_uploads_api.py` | **PASS** | Strict principal check on batches, items, and artifacts. |
| **3. Publishable Key Direct Denial** | Publishable-key-only arbitrary writes fail. Scoped grant cannot write different path. | Storage RLS migration `004` & `008` | **PASS** | Broad INSERT policy revoked; grants scoped to `quarantine/{batch_id}/{item_id}.bin`. |
| **4. Direct Transfer (No Vercel Bytes)** | File bodies > 4.5 MB bypass Vercel Functions completely. | `upload-coordinator.ts` direct `PUT` to Supabase Storage endpoint | **PASS** | Zero file bytes traverse Next.js proxy route `/api/backend`. |
| **5. Ceiling Reservation & Tampering** | Forged size, grant replay, or omitted callback cannot exceed admitted exposure. | `test_invalid_file_rejected_and_reservation_released` in `test_uploads_api.py` | **PASS** | Upfront reservation against provider ceiling (25 MiB / 2 MiB) before grant issued. |
| **6. Concurrency & Overbooking** | Concurrent admissions near 100 MB cap cannot overbook; no double charges. | `test_concurrent_reservation_prevents_overbooking` in `test_quota_service.py` | **PASS** | Multi-threaded PostgreSQL/SQLite isolation prevents quota race conditions. |
| **7. Quota Ledgers & Deletion Retention** | Deleting frees active storage but NEVER refunds today's daily admission. | `test_free_active_storage_does_not_refund_daily_admission` in `test_quota_service.py` | **PASS** | Active balance drops to 0; daily consumed admission remains unchanged. |
| **8. Walk-in Guest & CAPTCHA** | Walk-in printing requires server-verified CAPTCHA, hashed guest capability. | `test_guest_session_captcha` in `test_uploads_api.py` | **PASS** | Invalid token fails 403; verified session issued 3-hour crypto token. |
| **9. Document Validation Ceilings** | Invalid/corrupt files, encrypted PDFs, bomb files rejected with 422 before visibility. | `inspect_document` + `test_invalid_file_rejected_and_reservation_released` | **PASS** | Magic byte inspection, page bounds (1–1000), unencrypted check. |
| **10. Folder Finalization & Desktop Merge** | Multi-file folder merged into single valid PDF matching desktop counter desk contract. | `test_folder_multi_file_merge_deterministic_single_pdf` in `test_uploads_api.py` | **PASS** | 2-file folder merges into 1 deterministic 3-page PDF; single job created. |
| **11. Outbox & Atomicity** | Non-ACID Storage operations reconciled via durable tasks and idempotent retries. | `apps/server/app/services/cleanup_service.py` | **PASS** | Outbox pattern in `cbpms_private.background_tasks` with worker leasing. |
| **12. Service Resiliency** | Process restarts and crashes preserve durable quota records and cleanup intents. | `test_transaction_reverts_insert_update_and_delete` in `test_transaction_boundaries.py` | **PASS** | Durable state in `cbpms_private` survives API restarts. |
| **13. Privacy Mode Separation** | Customer anonymous mode expires after 3h; permanent library survives guest sweep. | `test_persistent_library_documents_survive_cleanup` in `test_cleanup_service.py` | **PASS** | `access_mode = 'persistent'` is explicitly exempt from 3-hour ephemeral sweep. |
| **14. Bounded Leases & Watchdog** | Background tasks have leased timeouts (60s) preventing perpetual stuck state. | `process_background_tasks` in `cleanup_service.py` | **PASS** | Leased workers expire; backoff retry logic. |
| **15. Download TTL Bounding** | Signed downloads cannot outlive retention interval. | `TOKEN_PRESIGNED_URL_TTL_SECONDS = 60s` in `config.py` | **PASS** | Download links are short-lived presigned URLs. |
| **16. Desktop Regressions** | Desktop counter desk printer detection, claim ownership, and download verified. | `python -m pytest tests -q` in `apps/desktop` | **PASS** | 34/34 native PySide6 desktop tests pass. |
| **17. Zero Credential Exposure** | No service-role keys in browser assets, API responses, or client bundles. | `npm run test:security`, `npm run build` | **PASS** | Server-only secrets isolated; client uses scoped capability grants. |

---

## 2. Verification Commands Executed & Real Output

### 2.1 Backend Suite (`apps/server`)
```powershell
python -m pytest tests/test_quota_service.py -v
# Output: 8 passed in 18.2s (including concurrency overbooking test)

python -m pytest tests/test_uploads_api.py -v
# Output: 9 passed in 9.94s (including folder merge, idempotency, and cancellation)

python -m pytest tests/test_cleanup_service.py -v
# Output: 2 passed in 14.54s (outbox task lease and 3-hour expiry)

python -m pytest tests -q
# Output: 104 passed in 2m 45s (all baseline, auth, pricing, desktop, and quota tests)
```

### 2.2 Desktop Native Counter Desk Suite (`apps/desktop`)
```powershell
python -m pytest tests -q
# Output: 34 passed in 7.11s
```

### 2.3 Web Application Suite (`apps/web`)
```powershell
npm run test:security
# Output: 13 passed in 3.9s

node --test tests/customer-flow.test.cjs
# Output: 3 passed in 1.6s

node tests/http-smoke.cjs
# Output: Production HTTP smoke checks passed; no Google account or live database was modified.

npx tsc --noEmit
# Output: 0 errors (clean compilation)

npm run build
# Output: Compiled successfully, all 15 static/dynamic routes generated.
```

---

## 3. Manual UI Verification Checklist for Platform Owner

Because visual browser automation is prohibited by repository rules, please perform this manual test in your browser:

1. **Guest Walk-in Upload Flow:**
   - [ ] Navigate to `https://c-b-p-m-s.vercel.app/shop/shop-demo-1`.
   - [ ] Confirm CAPTCHA prompt is rendered before upload box enables.
   - [ ] Drag-and-drop a test PDF file ($\le 2\text{ MiB}$).
   - [ ] Verify that upload progress states show: `Checking permission` $\rightarrow$ `Uploading directly` $\rightarrow$ `Validating` $\rightarrow$ `Staged`.
   - [ ] Verify checkout page loads with pay-at-counter total.
2. **Customer Library Workspace:**
   - [ ] Sign in with Google at `https://c-b-p-m-s.vercel.app/login`.
   - [ ] Navigate to `/account/documents`.
   - [ ] Observe the Storage Quota bar showing current active bytes vs 100 MB limit.
   - [ ] Upload a file ($\le 25\text{ MiB}$) into your library.
   - [ ] Verify document appears in the list and quota increases.
   - [ ] Click Delete on the document; verify it disappears and active quota drops.
3. **Folder Multi-File Merge:**
   - [ ] In shop print mode, select a folder with multiple PDFs/images.
   - [ ] Verify individual files upload concurrently (max 3 at a time).
   - [ ] Verify job successfully stages as a single merged document on the counter desk.

---

## 4. Current Deployment State

- **Implemented & Tested in Repository:**
  - Additive migration `008_secure_uploads_quotas_and_tasks.sql` created in `supabase/migrations/`.
  - Authoritative `QuotaService` and `uploads` API endpoints implemented in backend.
  - Direct-to-storage `upload-coordinator.ts` implemented in Next.js web application.
  - Proxy allowlist updated in `policy.ts`.
  - Outbox background task processor integrated in `cleanup_service.py`.
- **Infrastructure NOT YET Applied (Waiting for Owner Execution):**
  - Migration `008` not yet run against production Supabase database.
  - Production CAPTCHA secret keys (`CAPTCHA_SECRET_KEY`) not yet configured on Render.
  - Production scheduler secret (`SCHEDULER_SECRET`) not yet configured on Render.
