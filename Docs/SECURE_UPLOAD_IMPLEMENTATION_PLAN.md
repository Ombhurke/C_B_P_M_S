# Secure uploads, quotas, and temporary-document cleanup

Prepared: 13 October 2026. Status: implementation specification, not implemented.

This document is the authority for this upload milestone. It supplements the existing architecture; it does not authorize rebuilding the application. The owner reports that deployed Google sign-in is now working. Preserve that configuration and flow.

## 1. Outcome and scope

Implement one authorized, private-storage upload workflow for customer-library uploads and walk-in print uploads. Document bytes must not pass through Vercel Functions. Small files use standard direct upload; larger eligible files use resumable direct upload. Both use the same admission, ownership, quota, validation, and cleanup rules.

Deliver durable per-customer storage limits, daily upload admission limits, stricter guest limits, safe batch/folder handling, and scheduled deletion of temporary documents. Keep the existing desktop release, shop isolation, pricing, and payment rules working.

Non-goals: redesigning pages, changing OAuth providers, introducing staff-management features, enabling live payments, replacing the entire database, or committing/pushing/deploying without separate permission. No synthetic production documents, fake success responses, demo shops, or mock storage. Test fixtures are allowed only in isolated automated tests.

The public deployment origins are `https://c-b-p-m-s.vercel.app` and `https://c-b-p-m-s.onrender.com`. Obtain Supabase project identity from current local configuration, not historical chat credentials. Never copy secret values into this document, source code, screenshots, test reports, or browser bundles.

## 2. Current baseline: inspect before editing

These observations come from local source inspection, not a fresh audit of deployed database contents:

| Area | Current implementation | Required change |
|---|---|---|
| Web transport | `apps/web/lib/api.ts` sends multipart files to `/api/backend`; the catch-all Next route buffers request bodies | Metadata-only control requests; browser sends document bytes directly to authorized Storage endpoints |
| Upload surfaces | Shop `UploadBox`, workspace upload modal, single/batch library upload, single/folder job staging | Shared upload coordinator; no old route may bypass new controls |
| Storage | `storage_service.py` uploads bytes using a server credential, verifies the bucket is private, issues signed downloads, and deletes through the Storage API | Add scoped upload admission, quarantine verification, canonical objects, and reconciliation |
| Records | Seven `cbpms_private` tables use `id` plus JSON data: shops, jobs, users, sessions, attempts, documents, audit_events | Add explicit durable upload/quota/work tables; integrate existing records rather than assuming legacy public tables are active |
| Transactions | PostgreSQL transaction advisory lock serializes existing read/modify/write transactions; exceptions roll back SQL | Preserve real SQL atomicity; never call Storage while holding a long database transaction |
| Cleanup | API lifespan starts a 60-second in-process sweep; current job TTL defaults to two hours | Independent scheduled cleanup, explicit three-hour temporary-file expiry, crash-safe retries and orphan detection |
| Release | Completion commits metadata/audit before attempting temporary-byte deletion; account-library files remain | Extend the same durable-intent approach to every deletion and artifact |
| Limits | Backend defaults: 25 MiB per file, 200 MiB folder; frontend repeats limits | Central authoritative policy; new quotas may impose a smaller effective batch limit |
| Authentication | Supabase verifies customers; opaque shop-scoped sessions authenticate staff; guest staging currently exists | Preserve login; add upload-specific admission and durable guest capability sessions |

Read first:

- `Docs/CLAUDE.md`
- `Docs/PRODUCTION_ENVIRONMENT_SETUP.md`
- `Docs/reviews/DEPLOYMENT_SECURITY_REVIEW.md`
- `Docs/WEB_DATA_ARCHITECTURE.md` and `Docs/ARCHITECTURE.md`
- `apps/server/app/core/database.py`, `auth.py`, `google_auth.py`, `config.py`
- `apps/server/app/services/storage_service.py`, `documents.py`, `cleanup_service.py`, `job_cleanup.py`
- `apps/server/app/api/v1/customer.py`, `jobs.py`, `release.py`, `checkout.py`
- `apps/server/app/models/schemas.py` and `app/main.py`
- `apps/web/lib/api.ts`, `types.ts`, `lib/server/policy.ts`, `lib/server/supabase.ts`
- `apps/web/app/api/backend/[...path]/route.ts`
- `apps/web/app/shop/[shop_id]/page.tsx`
- `apps/web/components/customer/UploadBox.tsx` and `workspace/WorkspaceUploadModal.tsx`
- All migrations in `supabase/migrations`, particularly 004 and 006, plus existing tests.

Some older migrations describe public relational tables and permissive staging policies that later migrations close. Do not revive those policies. The current cleanup sweep performs some Storage operations inside SQL transactions; fix that pattern in this milestone. Review all artifact references, not only a document's single `job_id`, before permitting deletion.

## 3. Mandatory research gate

Before choosing SDK methods, authorization mechanisms, migration SQL, or dependencies, browse current official documentation. Read the relevant page content, not just search snippets. Record date, URL, installed version, selected version if changed, and implications in `Docs/reviews/UPLOAD_PROVIDER_RESEARCH.md`.

Verified provider facts as of this specification:

- Vercel Function request/response payloads are limited to 4.5 MB. This is a whole-request limit; a larger application-side buffer does not override it. [Vercel limits](https://vercel.com/docs/functions/limitations).
- Supabase recommends standard uploads for small files and resumable uploads above roughly 6 MB. [Standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).
- Standard signed upload URLs are valid for two hours and require no additional authentication when used. Do not invent a configurable ten-minute expiry, immediate revocation, or a single-use guarantee. [Signed upload reference](https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl).
- Supabase supports TUS uploads using its direct Storage hostname and signed tokens in `x-signature`. Its documentation currently specifies 6 MiB chunks and upload-resource URLs lasting up to 24 hours. Authentication/grant lifetime and resumable-resource lifetime are different. [Resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
- Delete objects through the Storage API. SQL deletion of Storage metadata is not binary deletion. [Object deletion](https://supabase.com/docs/guides/storage/management/delete-objects).

Also consult:

- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [Render free-service limitations](https://render.com/docs/free)
- Official release/documentation sources for any chosen upload library, CAPTCHA provider, PostgreSQL locking, and Supabase Python SDK.

Use lockfiles to identify installed versions. Do not assume a minimum version in requirements or package.json is the installed version. Avoid unrelated upgrades. Where documentation and installed APIs differ, resolve the incompatibility explicitly and test it.

## 4. Product policy and configurable defaults

The owner approved the general approach. Values below beyond the two 100 MB limits and approximately three-hour expiry are proposed implementation defaults, not claims about existing settings. Make them configurable and document them.

| Policy | Initial value / rule |
|---|---|
| Customer active logical storage | 100,000,000 bytes (100 decimal MB) |
| Customer daily upload admission | 100,000,000 bytes per UTC calendar day |
| Verified-customer individual source file | Preserve 25 MiB existing ceiling; also obey remaining quotas |
| Temporary-file lifetime | 10,800 seconds from initial upload admission; do not reset by refreshing/retrying |
| Guest individual file | 2 MiB; no resumable uploads initially |
| Guest batch | At most five files and 10 MiB combined |
| Guest session admission | 20 MiB/day/session plus shared IP/global abuse controls; not a verified-person guarantee |
| Customer batch | At most 20 files, existing 200 MiB envelope, and remaining quota/reservation capacity; the strictest limit wins |
| Parallel browser transfers | Two per batch; enforce server-side active permits as well |
| Cleanup schedule | Every five minutes; retries and alerts for missed runs |
| Standard/resumable selection | Small files standard; larger files resumable around the provider's documented 6 MB guidance; this is not a Vercel threshold |

Configure customer/IP metadata request limits initially around 10 admission attempts per minute and 60 per hour; guest admission around 3 per minute and 15 per hour. Separately bound active permits, file counts, validation tasks, outstanding reserved bytes, and global exposure. Shared-IP limits need an operator-configurable policy for campus/shop NATs. These are starting parameters to test and tune, not a guarantee against DDoS or a universal industry standard.

Policy semantics:

1. Account-linked library storage requires a server-verified, active customer identity. Use the Supabase user UUID, never email, display name, or a browser-supplied owner ID.
2. A signed-in customer may still choose anonymous privacy mode. Temporary files must not appear in their library; apply authenticated admission quotas without converting the job into account-linked storage.
3. A signed-out guest may upload only temporary small documents after server-verified CAPTCHA and guest-session admission. Preserve no-account walk-in printing. Do not use unrestricted public Storage INSERT permissions or silently introduce Supabase anonymous Auth as a replacement identity system.
4. A batch has one privacy mode. Account and anonymous documents cannot be mixed within a job.
5. Deleting a document can free active storage after deletion is confirmed. It never refunds bytes already charged to today's admission budget. Reprinting an existing document does not consume upload allowance again, although a derived artifact requires capacity.
6. Distinguish application admission/object-byte budgets from provider-metered network ingress. Retries, leaked grants, rejected bodies, and protocol overhead may consume provider resources that the application cannot exactly meter. Never advertise the daily counter as a hard cap on all Storage traffic or cloud billing.
7. Explain reserved capacity in the UI. Safe admission may reserve more than declared size where provider enforcement is coarser; do not falsely label conservative reservation as a completed upload.

## 5. Architecture and provider security gate

### 5.1 Control plane and data plane

The browser sends only small JSON control messages through the existing same-origin Next backend proxy. Next verifies its HTTP-only session and forwards the verified credential server-side. The backend authenticates, checks policy, and commits durable admission before providing a narrowly scoped upload permission.

File bytes go browser -> private Supabase quarantine Storage. A bounded backend worker reads and validates the object, then makes a canonical private artifact available. Upload completion in the browser is not document acceptance. Only validated artifacts may enter the library, become print jobs, receive download permissions, or affect billing page counts.

Keep Supabase Auth access/refresh credentials in the existing HTTP-only session design. Do not expose them through a new JSON endpoint or move them to localStorage just to copy a provider tutorial. An upload-specific bearer grant may be returned, but it must have a narrowly defined capability and lifetime. URLs, project identifiers, and publishable keys are not secrets; privileged keys, database credentials, staff credentials, and capability tokens require protection.

Use a quarantine boundary separate from canonical printable/library objects. Browser upload grants must never target a canonical object that customers or printers later consume. Server-generated random paths, no user-provided bucket/URL, no overwrite/upsert, and server-authoritative object lookup are mandatory.

### 5.2 Resolve these issues before enabling direct uploads

Write `Docs/decisions/UPLOAD_ADMISSION_AND_GRANT_LIFECYCLE.md` and test the selected mechanism. Prefer documented provider features; do not invent JWTs signed with guessed Supabase secrets or undocumented Storage APIs.

- A client saying a file is 1 MB is not an enforceable size limit. Establish a real provider-side ceiling for every permit. Bucket size tiers are one possible solution; reserve each permit's enforced maximum, not its untrusted declared size. If exact per-object ceilings are genuinely supported, prove how. Admission must remain safe when a malicious browser never finalizes.
- Private buckets and RLS do not, by themselves, make a privileged signed upload grant revocable or quota-aware. Grant issuance must be path-scoped and admitted before issuance, with no general client INSERT/UPDATE policy bypass.
- No-overwrite prevents replacement while an object exists, but deleting it may allow an unexpired grant to create it again. Define a tested revocation/closed-slot/tombstone mechanism if supported, or retain a conservative reservation and reconcile reappearing objects until the real write horizon has closed. A database status flag alone does not invalidate the provider grant.
- For TUS, verify whether an already-created upload can complete after signing-token expiry, cancellation, or cleanup. Account for upload-resource lifetime and unfinished multipart/resumable resources. A 24-hour resource must not undermine a three-hour privacy promise.
- Never copy `upsert: true`, `x-upsert: true`, broad authenticated INSERT policies, or persistent bearer-token storage from examples into this design.
- A validated canonical object must be immutable to the upload holder. Protect against changing bytes between hash validation, promotion, job creation, and download.

Preferred starting mechanism: documented server-issued signed upload capabilities into bounded private quarantine, followed by server-only canonical promotion. It is acceptable to select a documented revocable, preapproved-slot mechanism instead if it is demonstrably safer and preserves HTTP-only account authentication. Record the reason and security evidence; do not broaden access to force it to work.

This is a release gate, not an optional TODO. If provider capabilities cannot satisfy the agreed retention and admission rules, stop that feature, explain the conflict and the minimum additional choice/infrastructure needed. Do not substitute an insecure public bucket, an unbounded direct endpoint, or a misleading claim of strict quotas. Complete unaffected tests/documentation while awaiting that decision.

## 6. Durable data model and SQL atomicity

Add versioned, additive migrations in `cbpms_private`. Preserve existing JSON records and API compatibility. New high-contention ledger/work state should use typed columns, checks, indexes, and uniqueness, rather than a browser-writable JSON counter.

Recommended logical entities (final names may follow existing conventions):

- `upload_batches`: ID, principal type/key, mode, purpose (library or print), optional shop, manifest digest, state, creation/expiry times, idempotency binding.
- `upload_items`: ID, batch reference, server bucket/path, original display filename, declared bytes, enforced ceiling, observed bytes/hash/MIME/pages, transfer type, state, provider-write horizon, validation/cleanup references. Unique bucket/path.
- `guest_upload_sessions`: hashed capability, expiry, challenge result, limits and principal ID. Guest tokens are never raw persistent records; receipt/checkout capability alone does not grant new uploads.
- `quota_accounts`: principal UUID/key, active canonical bytes, outstanding reservation bytes and concurrent permit count. Separate operational staging/derived-artifact accounting; do not hide real physical storage cost.
- `quota_daily_usage`: principal plus UTC date, charged bytes and outstanding reservations. Keep old-day reservations live until their write horizon closes; midnight must not double available exposure.
- `quota_events`: immutable event type, bytes, item/artifact reference, day, idempotency key. Unique event prevents double charge/release.
- `object_artifacts` and references: bucket/path, verified size/hash, lifecycle state, privacy expiry, document/job references. Shared artifact deletion must not break another active reference.
- `background_tasks`: validation, canonical promotion, delete/reconcile work; state, attempt count, next attempt, lease owner/expiry, sanitized failure code, unique operation key.

Use byte integers with nonnegative checks, bounded states, unique keys, foreign keys where compatible, and indexes on expiry/task availability/principal/day. Identity mapping must not silently reassign existing ownership by matching email. Preserve server-only permissions; do not expose the private schema through Supabase Data API. For SECURITY DEFINER functions, if needed, use a fixed safe search_path, minimal grants, and no browser ability to manipulate quota records.

Admission transaction: lock the principal's quota rows in a stable order; check current plus outstanding storage exposure, daily charged plus outstanding admission, file/count/concurrency limits; insert the batch/items/tasks and quota reservation events together. Roll back all SQL changes on any failure. A preflight UI read is not authorization. Bind idempotency to principal and request digest; reuse with different content returns conflict.

Finalization transaction: compare-and-set item state, verify all required manifest items are accepted, settle reservations exactly once, write documents/job/artifact references plus audit/outbox together. Duplicate finalization returns the original result, not a new job or charge. A batch cannot be partially queued. Library batches should become visible together after all required files validate; successful transfers may be retained in quarantine for a bounded retry, not silently published.

External Storage and SQL cannot share one ACID transaction. Use durable intent/outbox plus idempotent workers and compensation. Never say a SQL rollback undoes a completed upload or deletion. Do not hold row/advisory locks while uploading, downloading, parsing, merging, contacting CAPTCHA/Storage, or waiting on network.

Keep existing transaction locking initially; document any new row-lock scheme and its interaction with legacy JSON writers and cleanup. Two unrelated lock systems must not allow the same object/quota state to race. Test real PostgreSQL isolation; SQLite-only tests do not prove production locking. Retry transient serialization/deadlock failures only around a repeat-safe transaction, with bounded retries; do not retry irreversible work blindly.

## 7. API and frontend workflow

Suggested API capabilities under the existing `/api/v1` backend prefix (exact names can be refined once and documented):

1. `GET /uploads/policy`: nonsecret supported formats/limits and feature availability; no credential or raw private records.
2. `POST /uploads/guest-session`: challenge token and chosen shop -> verified bounded guest session capability. Validate CAPTCHA server-side including intended hostname/action and provider replay/expiry rules.
3. `GET /customer/storage-usage`: authenticated quota summary, reserved bytes, daily reset time; only the current customer's usage.
4. `POST /uploads/batches`: manifest, purpose, shop where needed, privacy mode, idempotency key -> durable admission. Ignore/reject browser owner IDs, arbitrary paths/URLs and claimed validation results.
5. `POST /uploads/items/{id}/permission`: authenticated principal/guest capability -> already-admitted exact-path transfer permission; no new permit or free reservation on retries.
6. `POST /uploads/items/{id}/complete`: request server verification, not acceptance; return pending/accepted/rejected status. The server determines all authoritative file properties.
7. `GET /uploads/batches/{id}`: principal-scoped progress and sanitized errors.
8. `POST /uploads/batches/{id}/finalize`: create accepted library documents or stage the configured print job once; no binary body.
9. `POST /uploads/batches/{id}/cancel`: logical revocation, cleanup intent and safe reservation handling, not a false promise of provider-token revocation.

Use consistent small JSON request bounds, request IDs, structured errors, `Cache-Control: private, no-store`, and rate-limit `Retry-After`. Add only the exact required rules to the Next allowlist. Preserve same-origin CSRF defenses and staff/desktop route boundaries. If an internal scheduled-work route is needed, do not allowlist it in Next; authenticate it independently with a server-only secret or documented scheduler identity. Backend authorization is required even for requests made directly to Render; CORS is not authentication.

Frontend coordinator:

- Keep the desktop-first, warm dark/minimal theme and current layouts. Add readable usage/progress/error UI, not an unrelated redesign.
- Fetch authoritative policy and usage; client size checks are convenience, not enforcement.
- Folder selection makes a manifest and transfers files separately. Normalize safe display paths/order, distinguish duplicate names by item IDs, cap nesting/count, reject ZIP/executable/unsupported formats clearly. Do not silently skip invalid files.
- A folder containing 1 MB, 5 MB, and 12 MB files uses one workflow; the first two can use standard direct transfer, the last resumable. None travels through Vercel as file bytes.
- Show checking permission, uploading, validating, preparing print, accepted, failed, cancelled, and expired as distinct states. Support bounded retry and cancel with real server state.
- Never show success because an HTTP callback merely fired. Refresh library/jobs only after confirmed server acceptance.
- Clear grants from memory after use/cancel; never log them, persist them in analytics, or put credentials in URLs. Review resumable fingerprint persistence so URLs/tokens are not left in localStorage. If persistent resume cannot be made safe, initially support in-memory resume only.
- Abort in-flight transfers on logout/session change; do not resume one customer's upload as another. Handle grant expiry without unrestricted reissuance.

Replace every old byte-upload path. Legacy `/jobs/stage`, `/jobs/stage-folder`, `/customer/documents`, and `/customer/documents/batch` must be migrated to the new accepted-item service, or explicitly reject production binary upload after compatible clients move. Do not leave a callable direct Render route that ignores quotas. Keep listing/download/deletion behavior compatible and add regressions for the deployed desktop.

## 8. Validation, folder processing, and artifact accounting

Workers derive size and hash from actual bytes at the admitted server-selected object. Declared Content-Type, browser page count, checksum, extension, or Storage user metadata is not proof. Use bounded download/stream limits and safe temporary files; reject size mismatch, unsupported/malformed content, encrypted PDFs, excessive pages, decompression bombs, and suspicious filename/control characters.

Validate PDF, PNG, JPEG only, preserving the existing business rules unless explicitly changed in policy. Apply CPU/time/memory/page/pixel limits; parse in a bounded isolated worker/process rather than blocking FastAPI's event loop or holding database locks. Do not download arbitrary client URLs (SSRF). Fail closed on validation timeout/error. Decide and document malware scanning before claiming files are malware-safe; parser validation alone is not antivirus. Missing scan infrastructure is a visible release limitation, not a fake clean result.

Current print-folder staging merges documents into one PDF, and the desktop expects one printable artifact. Preserve that contract: verify all sources, choose deterministic displayed ordering, reserve processing/output capacity, generate one bounded PDF, then stage it. Do not silently switch to multiple physical print jobs or accept an oversized derived PDF because its sources were small. Count image-to-PDF expansion and duplicated quarantine/canonical/merged bytes against separate operational caps; avoid unbounded in-memory folder merging. Persistent output consumes the account's logical-storage cap too. Delete temporary source artifacts when safe, retaining durable cleanup references until all permissions/resources are closed.

Canonical promotion, observed hash/size, document creation, and job creation must be retry-safe across crashes. On quote mismatch, require user confirmation using the verified page count/current shop pricing. Never trust client estimates, or automatically mark a job paid. Preserve pay-at-counter and current disabled-online-payment behavior; this milestone does not enable credentials or implement payments.

## 9. Privacy expiry and independent cleanup

Use persisted `access_mode`/retention policy on every object, not whether the caller currently has a login cookie. Account-linked library documents must never be swept using anonymous TTL. Three-hour expiry starts at initial admission and covers raw sources, validated copies, merged output, cancelled batches and temporary intermediate files. Existing two-hour checkout expiry can remain stricter, but name the two clocks separately; do not silently prolong receipts/payment promises.

Logical expiry denies new access/claims/job creation immediately at the deadline. Existing issued signed downloads are bearer permissions; bound their TTL to the remaining retention interval. Do not promise instant revocation of an already issued provider URL if deletion is pending. Early completed-output cleanup should revoke new permissions and purge temporary sensitive bytes after the durable completion intent commits. Spool acceptance is not proof of physical print success; preserve the current confirmation contract.

Processing jobs need a bounded lease and a watchdog. No job may evade cleanup forever merely by remaining `processing`. Define late heartbeat/completion races, interrupted print handling, and hard privacy deadline behavior without automatically reprinting. If active printing requires a narrowly bounded grace period, document it in the UI/privacy policy and cap it explicitly; do not silently extend three hours indefinitely.

Implement scheduled work outside the web/API lifespan. Preferred infrastructure is Supabase Cron invoking a secured Edge Function/scheduled worker; an always-on dedicated worker plus reliable scheduler is acceptable if deliberately configured. Reuse one authoritative cleanup service/state machine, not two independently destructive sweepers. Supabase Edge Functions do not automatically have access to the private schema: provide a narrowly granted, authenticated mechanism or dedicated DB connection, not public schema exposure.

If Cron only wakes a sleeping free Render API, document the cold-start/availability risk and prove scheduling effectiveness; it is not a hard deletion SLA. A worker dependent on an intermittently sleeping API must not be sold as independent guaranteed deletion. Missing scheduler/CAPTCHA/secrets/plan support must fail production feature readiness and be reported for owner setup.

Delete workflow:

1. SQL transaction denies access, records cleanup intent, and claims a bounded worker lease.
2. After commit, remove every intended binary through the Storage API.
3. Confirm success/not-found using a documented provider response; don't treat arbitrary exceptions as success.
4. SQL transaction marks artifact deleted, releases storage exposure exactly once when safe, reconciles documents/jobs, and preserves daily charged usage.
5. If either external deletion or final metadata commit fails, retry idempotently with exponential backoff/jitter. A lease expiry lets another worker recover.

Keep tombstones/reconciliation references for the necessary provider-write horizon, even after a user sees logical deletion. Detect abandoned permits, uploaded-but-unfinalized files, promotion duplicates, orphaned canonical objects, and writes that reappear after cancellation. Inventory by bounded known prefixes/pages and durable object references, not an unbounded full bucket scan every five minutes. Never delete unknown legacy library files solely because they lack new batch metadata.

Track last successful scheduler run, oldest overdue sensitive object, reserved-byte age, pending validation/deletion tasks, retry counts, and provider-error rates. Alert on overdue cleanup and global storage/bandwidth cost thresholds. Physical deletion may be delayed by provider outages; show honest pending status and never claim an absolute three-hour erasure guarantee or secure physical shredding of cloud disks.

## 10. Implementation stages and gates

### A. Inventory and provider proof

Read instructions and code, record dirty worktree state, read current official sources, enumerate upload entry points and active schema, and write the grant/quota/retention decision record. Run existing tests for a baseline. Do not touch OAuth settings. Gate: a defensible tested admission and write-lifetime design, including TUS and cancellation.

### B. Persistence and quota service

Create additive migrations, guest capabilities, typed ledgers, idempotency, artifact references, task leases and config validation. Integrate existing transactions. Backfill existing owned artifacts with verified sizes and references without charging historical bytes as today's uploads. Produce a dry-run report; do not delete preexisting files. Gate: PostgreSQL concurrency/rollback tests and restricted DB permissions.

### C. Standard direct uploads

Implement metadata APIs, exact-path standard permissions, bounded validation/promotion, account quota display, and shared web coordinator. Complete library and anonymous small-file flows, with genuine CAPTCHA integration. Migrate/reject old upload bypasses. Gate: accepted artifacts only, no binary Vercel request, customer/guest isolation, safe cancellation/replay behavior.

### D. Resumable and folder flows

Implement large verified-customer transfers, validated resumable authorization, bounded concurrency, manifest ordering, all-required-items finalization, derived-artifact reservations and single-PDF desktop compatibility. Guest large/resumable transfers stay disabled initially. Gate: network-interruption, late TUS completion, forged-size, mixed-batch and output-growth tests.

### E. Scheduled cleanup and reconciliation

Implement deployed scheduler/worker configuration, expiry enforcement at every access point, task retries/leases, crash recovery, orphan/reappearance reconciliation and monitoring. Refactor old sweep/purge paths to the same service. Gate: cleanup works while the web/API process is stopped and no active library objects are lost.

### F. Release verification and deployment handoff

Run regressions, isolated PostgreSQL/Storage integration tests, secret/public-bundle checks, and a controlled staging end-to-end test. Produce deployment instructions, exact environment additions, migration order, scheduler installation and rollback. Production changes require explicit owner approval and an appropriate backup; report configuration that is not applied. Do not declare completion if CAPTCHA, scheduler, security gate, or real provider integration remains unverified.

## 11. Required acceptance tests

Use fake providers only in automated unit tests. Real integration tests use a disposable/local Supabase or approved staging project, never arbitrary production customer files. PostgreSQL tests must exercise actual concurrent connections and failure paths.

Required scenarios:

1. Existing Google/email verification and HTTP-only session flow are unaffected. Invalid/expired accounts and staff identities cannot obtain customer-library permissions.
2. Customer A cannot inspect/finalize/cancel/read customer B's batch or artifacts. Guest A cannot use Guest B's capability. Other shops cannot download another shop's job.
3. Publishable-key-only direct upload and arbitrary bucket/path writes fail. No broad legacy policy remains. A scoped permission cannot write a different path or overwrite a canonical document.
4. Actual file bodies larger than 4.5 MB bypass Vercel; JSON control messages stay small. Mixed folders do not use size-based Vercel routing.
5. A forged size, omitted finalize callback, grant replay, deleted-then-recreated quarantine path, and late resumable completion cannot silently exceed admitted exposure or resurrect an accepted/expired document.
6. Concurrent admissions near the cap cannot overbook; two workers/finalizers cannot charge twice. Boundary values are tested using the explicitly documented decimal MB and binary MiB distinction.
7. Deleting frees only safely reclaimed active storage, not daily charged allowance. Aborted zero-byte permits are released only after safe closure. UTC rollover and old-day outstanding permits remain correct.
8. Multi-account/session/IP abuse has layered controls; forged forwarded-IP headers do not bypass shared limits. CAPTCHA invalid/replayed/wrong-host tokens fail.
9. Invalid PDF/image, encrypted PDF, bomb/oversized/page-heavy document, huge manifest, unsupported extension and duplicate filename receive clear bounded failures; nothing printable becomes visible early.
10. One failed folder item prevents whole-batch job finalization; retry preserves order and creates one job. Output-size expansion respects capacity. No double payment/job creation on repeated finalize.
11. Failed DB commit after upload/promotion leaves discoverable cleanup work; failed audit rolls back job creation; failed binary deletion retains durable intent; failed post-delete DB commit is recoverable without double quota release.
12. Restart API/worker, overlap schedulers, lose network, expire task lease, and stop API entirely: durable work and quotas survive. Real configured scheduled cleanup still runs independently.
13. Anonymous mode chosen by a signed-in user remains temporary; account library survives guest sweep. New anonymous access is denied at expiry even before a delayed delete.
14. Processing lease cannot extend forever. Cleanup versus heartbeat/finalize/delete/download races have deterministic safe outcomes; no automatic duplicate print.
15. A signed download issued near expiry cannot outlive the documented retention interval. Already-issued URL limitations are accurately disclosed.
16. Existing shop pricing, pay-at-counter, operator claim ownership, desktop hash verification/download and completion behavior still pass regressions.
17. Browser assets, API errors, logs and committed files contain no privileged credentials, raw account tokens, signed capabilities or private document paths/content. CSP/CORS permits only required providers/origins without weakening CSRF.

Useful existing commands, subject to checking available interpreter/dependencies:

```powershell
# From apps/web
npm run test:security
npx tsc --noEmit
npm run build
node --test tests/customer-flow.test.cjs
node tests/http-smoke.cjs

# From apps/server
python -m pytest tests -q

# From apps/desktop, with the existing Qt offscreen test configuration
python -m pytest tests -q
```

Add focused suites for admission, quotas, upload provider boundaries, PostgreSQL concurrency, artifacts and scheduled cleanup. Inspect scripts before execution. Never claim a lint command passed if the installed Next version does not support that command; report/fix the scoped test configuration appropriately. No automated visual browser testing; give the owner a manual visual checklist. Stop every server/test process you start.

## 12. Configuration, migration, documentation and final report

Preserve existing `.env.local`, private exports, correct production origins, database TLS verification, and working OAuth. Add new settings to `.env.example` with nonsecret policy defaults, not fake working secrets. Document where CAPTCHA public/secret keys and scheduler/worker secrets belong; request missing secrets rather than inventing them. Public CAPTCHA site keys are intentionally visible; backend secrets are not. Do not put a service-role key in Vercel browser configuration. No infrastructure cost changes without disclosure/approval.

Deployment order: backup/inventory -> additive DB migration -> private bucket/policy setup -> backend/worker release -> schedule and secrets -> frontend release -> staging smoke -> monitor. Coordinate legacy-route closure with clients. Rollback disables new admission, preserves pending-task ledgers and cleanup, and restores compatible app code; it must not drop ledgers or abandon sensitive binaries.

Create/update:

- `Docs/reviews/UPLOAD_PROVIDER_RESEARCH.md`
- `Docs/decisions/UPLOAD_ADMISSION_AND_GRANT_LIFECYCLE.md`
- `Docs/UPLOAD_API_CONTRACT.md`
- `Docs/UPLOAD_PRIVACY_AND_QUOTA_POLICY.md`
- `Docs/UPLOAD_DEPLOYMENT_RUNBOOK.md`
- `Docs/reviews/UPLOAD_IMPLEMENTATION_ACCEPTANCE.md`
- Existing architecture, environment examples/setup and privacy-facing upload copy as needed.

Final implementation report must state: files changed; migrations/bucket policies/scheduler definition; implemented versus unapplied infrastructure; commands actually run and exact results; real versus mocked test coverage; limitations; owner actions with exact dashboard locations; safe rollback; and whether each stage gate passed. A successful build is not proof of secure real upload, verified quotas, or deployed deletion. Never conceal an unfinished feature behind a success toast or mark the project production-ready without evidence.
