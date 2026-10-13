# CBPMS Secure Upload Deployment Runbook

**Version:** 1.0.0  
**Effective Date:** 13 October 2026  
**Target Environment:** Supabase PostgreSQL, Render FastAPI Backend, Vercel Next.js Frontend

---

## 1. Prerequisites & Required Secrets

The platform owner must configure the following nonsecret and secret variables. **Never check in secret keys to version control.**

### 1.1 Render Backend Environment Variables (`apps/server`)
| Variable | Required Value / Description | Sensitivity |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (`sslmode=verify-full`) | Secret |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Nonsecret |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret key (for private Storage API) | **Secret** |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | Public |
| `SUPABASE_STORAGE_BUCKET` | `transient-print-jobs` | Nonsecret |
| `CAPTCHA_PROVIDER` | `turnstile` (recommended) or `recaptcha` | Nonsecret |
| `CAPTCHA_SECRET_KEY` | Cloudflare Turnstile Secret Key or Google reCAPTCHA Secret Key | **Secret** |
| `SCHEDULER_SECRET` | 32+ character random secret for cron/edge worker authentication | **Secret** |

### 1.2 Vercel Frontend Environment Variables (`apps/web`)
| Variable | Required Value / Description | Sensitivity |
| :--- | :--- | :--- |
| `APP_ORIGIN` | `https://c-b-p-m-s.vercel.app` | Nonsecret |
| `BACKEND_API_URL` | `https://c-b-p-m-s.onrender.com/api/v1` | Nonsecret |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` | Nonsecret |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key | Public |
| `NEXT_PUBLIC_CAPTCHA_SITE_KEY` | Cloudflare Turnstile Site Key or Google reCAPTCHA Site Key | Public |

> [!WARNING]
> Do NOT set `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Browser and frontend environments must never receive privileged service-role credentials.

---

## 2. Step-by-Step Deployment Order

### Step 2.1: Pre-Deployment Database Backup
1. Navigate to the Supabase Dashboard -> **Database** -> **Backups**.
2. Click **Create backup** (or run `pg_dump` via secure SSL connection) to take an authoritative snapshot of `cbpms_private`.

### Step 2.2: Apply Additive Database Migration
Execute migration `008_secure_uploads_quotas_and_tasks.sql` via the Supabase SQL Editor:
```sql
-- File: supabase/migrations/008_secure_uploads_quotas_and_tasks.sql
-- Creates upload_batches, upload_items, guest_upload_sessions,
-- quota_accounts, quota_daily_usage, quota_events,
-- object_artifacts, and background_tasks tables in cbpms_private.
-- Automatically revokes public permissions and enables RLS.
```

### Step 2.3: Verify Private Storage Bucket Policies
Ensure bucket `transient-print-jobs` has:
1. `public = false`.
2. File size ceiling = 25 MiB (`26,214,400 bytes`).
3. Allowed MIME types: `application/pdf`, `image/png`, `image/jpeg`.
4. RLS enabled on `storage.objects` with full access granted ONLY to `service_role`.
5. No public or authenticated INSERT policy exists.

### Step 2.4: Execute Dry-Run Quota Backfill
Run the historical document backfill in dry-run mode from the server environment:
```powershell
python -c "from app.core.database import db; from app.services.quota_service import quota_service; db.initialize(); r = quota_service.backfill_existing_documents(db.transaction().__enter__(), dry_run=True); print(r)"
```
Verify that existing active customer documents are tallied without charging today's daily admission cap. Then apply backfill:
```powershell
python -c "from app.core.database import db; from app.services.quota_service import quota_service; db.initialize(); r = quota_service.backfill_existing_documents(db.transaction().__enter__(), dry_run=False); print(r)"
```

### Step 2.5: Deploy Render Backend API & Worker
1. Deploy updated backend codebase to Render.
2. Verify startup logs indicate successful database connection and storage initialization:
   ```
   INFO: Document storage bucket verified: private
   INFO: Lifespan startup complete
   ```
3. Test health and policy endpoint:
   ```bash
   curl -s https://c-b-p-m-s.onrender.com/api/v1/uploads/policy
   ```

### Step 2.6: Deploy Vercel Frontend
1. Deploy `apps/web` to Vercel.
2. Verify `npx tsc --noEmit` and build pass cleanly.
3. Test that `https://c-b-p-m-s.vercel.app` loads and proxy routes forward correctly.

---

## 3. Post-Deployment Verification & Smoke Tests

1. **Guest Print Flow:**
   - Open walk-in shop print page.
   - Complete CAPTCHA challenge.
   - Upload small PDF directly.
   - Verify job stages with checkout token and counter pricing.
2. **Customer Library Flow:**
   - Log in with Google OAuth.
   - Navigate to Customer Documents workspace.
   - Upload document (verifying upload progress indicator).
   - Verify document is visible in library and storage usage displays 100 MB quota progress bar.
   - Delete document and verify active storage balance drops.
3. **Large File Bounded Concurrency:**
   - Upload a multi-file folder with files up to 25 MiB.
   - Verify all files bypass Vercel Functions and upload directly to Supabase Storage.
   - Verify server merges files into a single deterministic PDF printable by desktop counter desk.

---

## 4. Rollback Procedure

If a critical issue occurs during release:
1. **Disable New Admissions:**
   In backend configuration, set `ENABLE_DIRECT_UPLOADS=false` or temporarily reject `/uploads/batches`.
2. **Preserve Ledgers & Background Tasks:**
   **DO NOT drop or roll back the `cbpms_private` tables.** Doing so would lose customer quotas and orphan pending deletion tasks in cloud storage.
3. **Restore Compatible Frontend Code:**
   Redeploy previous Vercel build commit.
4. **Drain In-Flight Tasks:**
   Allow the background cleanup worker to finish all leased and pending tasks.
