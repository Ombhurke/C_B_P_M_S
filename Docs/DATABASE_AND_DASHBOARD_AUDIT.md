# Database and dashboard audit

> Subsequent scope decision: shop provisioning is deferred. The findings below remain the dated audit record, but [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) governs implementation order and acceptance. Build real shop-independent library functionality first; do not provision shops to satisfy the earlier delivery sequence below.

Checked on 9 October 2026 against the current source and configured Supabase project.
This is an implementation assessment, not a production-readiness certification.
The live inventory used a read-only transaction. The live rollback experiment used
session-local temporary tables and the application's actual transaction adapter.
No application rows or deployed schema definitions were changed.

## 1. What exists

| Area | Current implementation | Remaining work |
|---|---|---|
| Customer authentication | Supabase Google and email/password paths, server-side cookie handling, verified customer identity | Current code differs from the earlier Google-only decision; review email confirmation/recovery/rate limiting before retaining both methods |
| Customer workspace | `/account`: library list, job list, counts, deletion, refresh, sign out | Dedicated overview, searchable library, job-detail page, receipt recovery, loading/error separation |
| Shop discovery | `/shops` and `/shop/[shop_id]`; backend shop/rate endpoints | Provision a real shop; remove frontend demo-shop fallback |
| Upload | PDF/PNG/JPEG inspection, byte limit, actual page count, hash, pricing, job/document/audit writes | Configure private Storage; independent library upload; durable upload intent and reconciliation |
| Library | Account ownership checks, list/download/delete API | Reprint saved files without uploading again; pagination and previews; durable deletion |
| Jobs | Staging, capability-protected status, scoped queue, atomic claim, completion/failure reports | Cancellation, resume checkout, claim leases/attempt IDs, explicit uncertain printer outcome |
| Staff workspace | Staff login, scoped queue/summary, activity, admin rates; browser polls every 5 seconds | Real shop/staff provisioning, useful job actions and printer/device management |
| Printing agent | Download/hash check, spool integration, local completion outbox | Real hardware verification, restart reconciliation, expired claim recovery |
| Payments | Provider interface and test-only mock; production disabled | Real adapter, persisted order/events, signed webhooks, idempotency and refunds |
| Cleanup | Expiry worker, `cleanup_pending` retry; local orphan sweep restricted to tests | Production cloud orphan reconciliation and durable deletion tasks |

The account page's **New print** link goes to `/shops`; it does not reuse the
selected document. The download endpoint exists, but the library does not expose
a download button. No separate customer dashboard, document-detail, job-detail,
settings or help route currently exists. Account deletion exists in FastAPI but is
not permitted by the current browser proxy allowlist and has no customer settings UI.

## 2. Live Supabase findings

Machine-readable evidence: `output/audits/database-audit-2026-10-09.json`.

- Seven tables exist in `cbpms_private`: `shops`, `jobs`, `users`, `sessions`,
  `attempts`, `documents`, `audit_events`.
- Every table has only `id varchar(128)` and `data jsonb`. IDs are primary keys;
  `data` is NOT NULL. There are no foreign keys, business-rule CHECK constraints,
  additional unique constraints or query indexes beyond primary-key indexes.
- No custom triggers exist on these application tables. Supabase's internal
  Auth/Storage triggers were outside this audit's scope.
- RLS is enabled on all seven tables. `anon` and `authenticated` have neither
  schema usage nor table access. This protects the direct browser Data API surface.
- The backend uses the `postgres` role, which owns the tables and bypasses RLS.
  Owner/shop authorization is therefore enforced by the API, not by RLS for that connection.
  A separate runtime role with restricted privileges is needed.
- Counts: 1 application user record; 0 shops, jobs, documents, local sessions,
  attempts and audit events. This is not a count of Supabase Auth users.
- The configured `transient-print-jobs` bucket is absent. Its object count is zero.
  The backend's service-role storage key is not configured.
- Production payment mode is `disabled`; local storage and demo seeding are off.
- Full TLS certificate and hostname verification succeeded.
- The legacy public `shops`, `printers` and `print_jobs` tables are absent.
- Seven sampled relationship/state consistency counts were zero. With no jobs or
  documents, that does **not** establish integrity under real use.

## 3. Atomicity, triggers and retry

**Within one `db.transaction()` block, database changes commit together or roll
back together.** The adapter explicitly rolls back exceptions. The live probe
updated one temporary row, inserted another and then forced a NOT NULL violation
on a third table. The earlier update and insert both rolled back, and the connection
successfully handled a subsequent transaction.

Triggers are not necessary for this rollback behaviour. PostgreSQL executes a
trigger within its caller's transaction; a trigger failure also aborts that work.
Independent API requests or independently committed transaction blocks do not
automatically become one transaction.

**Rollback is not retry.** The adapter has no bounded retry mechanism for
serialization failures or deadlocks. `pool_pre_ping` checks pooled connections;
it does not replay a failed business operation. The cleanup loop retries its sweep
every 60 seconds, and the desktop outbox retries result reporting, but neither is
a general database transaction retry facility.

**Storage and printers are outside PostgreSQL transactions.** Rolling back SQL
cannot restore a deleted Storage object, undo a provider charge or pull paper back
through a printer. These steps need durable intent, idempotency and reconciliation.

References: [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html),
[trigger behaviour](https://www.postgresql.org/docs/current/trigger-definition.html),
[serialization retries](https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html),
[Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design).

## 4. Important gaps and their consequences

1. **Deletion happens before database commit.** Customer document deletion,
   account deletion, print completion and cleanup call `storage_service.purge`
   inside a transaction. A later database/audit error can restore metadata while
   leaving its file deleted. Multi-document account deletion can partially delete
   files before failing on a later file.
2. **Upload compensation is incomplete.** Staging uploads bytes before writing
   metadata. If the transaction fails, it attempts deletion once, but ignores a
   failed deletion result. A crash in this window or failed compensation can leave
   a cloud object with no durable cleanup record. The production worker does not
   scan for those cloud orphans.
3. **Relationships live in JSON.** Direct SQL or a new buggy code path can store
   a nonexistent owner/shop, incompatible privacy mode or impossible job state.
   The database does not independently reject those values. Audit records are
   described as append-only but do not have database-enforced immutability.
4. **All adapter transactions share one advisory lock.** Even reads acquire it.
   This serializes cooperating code across every shop; slow Storage calls inside
   that lock can block unrelated requests. Direct SQL can bypass the advisory lock.
5. **No complete request-idempotency layer.** A retry after a lost staging response
   can create another job/file. Production payment events are not persisted or
   deduplicated because a live provider is not implemented.
6. **Processing jobs can remain stuck.** Expiry sweeps exclude `processing` jobs;
   there is no lease expiry/manual-recovery state. Retrying a stale result from the
   same operator after a new print claim is not bound to a unique claim attempt.
7. **Database and UI can disagree after notification failure.** WebSocket events
   are broadcast after commit without a durable event queue. Polling can recover
   display state, but there is no guarantee of event delivery.
8. **Current frontend has misleading fallbacks.** `lib/api.ts` returns hardcoded
   demo shops and calculates a price locally when requests fail. The local duplex
   discount formula also differs from backend pricing. These can mask failures.
9. **Migrations and runtime setup have diverged.** Runtime metadata creates JSON
   columns, while migration 006 creates JSONB; `create_all` will not reconcile
   existing columns. Old migrations define a separate public prototype schema.
   Use an explicit canonical baseline and versioned migrations; do not apply all
   old migrations blindly to the current project.
10. **Customer lists are unbounded.** The API reads entire tables, filters in
    Python and the UI renders every item. Search, sorting and pagination need
    owner/shop indexes and queries in PostgreSQL.

## 5. Backend design to build next

### Relational foundation

Introduce typed columns and foreign keys through an additive migration and a
validated backfill. Preserve the existing user record. Switch the record adapter
only after comparison checks pass; keep legacy data until cutover is verified.

| Entity | Essential rules |
|---|---|
| Customer profiles | Stable Auth UUID, unique identity, disabled/deletion state; no password copy |
| Shops and memberships | Staff-to-shop foreign keys, unique membership, role checks |
| Documents | Nullable owner only for anonymous files; immutable storage key and hash; size/type/status; retention and deletion timestamps |
| Print jobs | Shop FK, privacy mode, owner invariant, valid state, currency and integer minor-unit amount |
| Job documents | Job/document FKs and ownership validation; initially permit one document per job |
| Payment orders and events | Unique provider order/payment/event IDs, amount/currency binding, immutable captured outcome |
| Print attempts and access grants | Job/device binding, hashed grants, expiry, unique current claim and attempt ID |
| Audit events | Restricted append-only access and safe metadata; no file contents or raw tokens |
| Background tasks | Deduplication key, status, attempts, next retry, lease, last error, completion time |
| Idempotency records | Scope/key uniqueness, request fingerprint and original response reference |

Use foreign keys, NOT NULL, CHECK and UNIQUE constraints for structural rules.
Use one transaction and row locks for job/payment/claim transitions. Cross-row
privacy invariants need transactional checks and, where justified, a constraint
trigger; ordinary CHECK constraints are not cross-table validators. Timestamp
triggers are useful but do not substitute for transactions. Restrict audit UPDATE
and DELETE permissions. Avoid external HTTP requests inside SQL triggers.

Use an explicit active release-code allocation with a unique `(shop_id, code)`
while active; release it on completion/expiry. Do not use changing `now()` values
as an index predicate. Keep one small migration role separate from the runtime role.

### Reliable operations

- **Upload:** reserve a document ID, immutable object key and operation key in a
  transaction; upload outside it; inspect/verify content; atomically finalize the
  document and job. Reconcile interrupted reservations and orphan objects.
- **Delete:** atomically mark the document `deleting`, deny new access and enqueue
  one deletion task with the audit event. A worker removes the object, then marks
  `deleted`. Failed attempts remain visible and retry with bounded backoff. Already
  issued signed URLs remain usable until expiry or actual object removal; use a
  short TTL and do not promise instant revocation of existing grants.
- **Payment:** create orders with stable operation keys. Verify signed provider
  events and insert a unique event record, capture payment and queue the job in
  one transaction. Replayed events return the existing outcome. Reconcile uncertain
  external outcomes before retrying a charge/order operation.
- **Claim:** lock the job, validate shop/payment/expiry, create a unique attempt
  and short-lived grant, then commit. Result reports must reference that attempt.
  An uncertain printer result requires reconciliation; never automatically reprint.
- **Retry:** replay complete DB-only transactions for recognised transient SQLSTATEs
  such as `40001` and `40P01`, with limited attempts and jitter. Do not retry invalid
  input or uniqueness conflicts blindly. If commit acknowledgement is lost, look
  up the idempotency key before attempting the operation again.
- **Notify:** commit an outgoing event alongside the state change. A worker delivers
  it with retry; polling remains a recovery path. Duplicate delivery is harmless.

## 6. Delivery order and completion checks

1. Canonical schema, migration/backfill validation, restricted runtime access,
   transaction/idempotency services and failure tests.
2. Private Storage setup, durable upload/delete tasks and orphan reconciliation.
   Provision a real shop and its staff from supplied business details.
3. A working customer slice: sign in, upload, saved library, create/resume job,
   detail/status, owner isolation, deletion and persistence after restart.
   Payment remains honestly unavailable until a real adapter is configured.
4. Dashboard and customer routes from `CUSTOMER_WORKSPACE_PLAN.md`, using real
   paginated queries and real empty/error states. Remove runtime demo fallbacks.
5. Live payment integration, verified queue release and desktop attempt recovery.

For each business transaction, inject an error after each write and check that
all associated DB changes roll back. Add PostgreSQL concurrency tests for duplicate
submissions, duplicate provider events and simultaneous claims. Separately test
Storage outages, process crashes after upload/delete, worker restart, missing
commit acknowledgements and uncertain printer results.

## 7. Reproduce the assessment

From the repository root, with the existing server environment:

```powershell
python tools/database_audit.py
python tools/database_audit.py --rollback-probe
```

The optional probe creates and drops only session-local temporary tables. It
tests the actual adapter against PostgreSQL, but is not a workload/load test.
The script suppresses exception details that could expose connection secrets.

From `apps/server`:

```powershell
python -m pytest tests -q -rx
```

The new `test_transaction_boundaries.py` has explicit strict expected failures
for two unresolved Storage consistency requirements. Expected failures are findings,
not passing correctness checks. The isolated test fixtures never connect to the
production database or Storage service.

### Results from this audit

- Backend: **46 passed, 2 expected failures**, 31.76 seconds. The two expected
  failures reproduced deletion-before-commit and missing durable upload-compensation
  recovery. Four new passing tests cover grouped insert/update/delete rollback,
  successful upload compensation, rates/audit rollback and payment/queue/audit rollback.
- Web security suite: **11 passed**. These do not establish full browser login,
  coverage of every new email-auth path, or a live checkout.
- Live PostgreSQL adapter probe: **passed** using temporary tables only.
- Windows sandbox blocked the test client's internal asyncio loopback socket.
  The isolated suite passed when run with the necessary execution permission;
  all three blocked diagnostic/test processes were stopped.
- No live Storage upload, real payment, physical print or full Google-consent
  journey was performed. No application routes, production migrations or live
  business records were changed during this assessment.

The next deliverable is the backend foundation described in section 5, followed
by the customer screens. The audit tooling and failure tests added here are the
first verification work; the proposed runtime fixes are not implemented yet.
