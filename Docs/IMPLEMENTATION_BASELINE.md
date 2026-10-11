# CBPMS implementation baseline — 30 September 2026

> **Historical record only.** Follow [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) for new work. Mock payments, demo seeding, older account/session behaviour and completion claims below do not describe the current production target. Shop provisioning is now deferred.

> Historical prototype baseline. Current Google authentication, server-managed cookies, same-origin proxy, production defaults, TLS database setup, and verification results are documented in [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md).

## Scope and status

This increment addresses persistence, operator and customer authentication/access control, the customer document library, and the live admin dashboard. Payments remain simulated. Existing source and tests were used to identify unsafe success fallbacks and recovery gaps. This document supersedes implementation claims in the original PRD and architecture proposal; those documents remain useful as product targets.

The local automated checks cover SQLite and local storage, not a hosted Supabase deployment, real financial settlement, a physical scanner, or physical printer output. No credentials, cloud configuration, or live payment transactions were created during implementation.

## Components and ownership

| Component | Responsibility | Trust boundary |
|---|---|---|
| Customer web | Upload, estimate, choose privacy mode, review verified checkout, display release code, view account library | Anonymous capability jobs or authenticated customer-owned library jobs |
| Admin web | Login, queue, stored printer configuration, persisted rates, UTC daily counts | Bearer session; admin/operator roles scoped to one shop |
| FastAPI | Document inspection, pricing, auth, job transitions, payment verification boundary, cleanup | Authoritative business logic; secrets remain server-side |
| SQL persistence | Shops, jobs, users, sessions, failed-attempt counters, documents, audit events | SQLite locally; private PostgreSQL schema in Supabase |
| Storage | Temporary document bytes | Private Supabase bucket or local server directory |
| Desktop | Authenticate, release, download, hash verification, spool, report result | Same shop authorization as the API; printer access stays local |

Web and desktop can start and be tested separately. Operational queue access requires the backend; offline mode reports an error instead of inventing jobs, payments or successful prints.

## Persistence design and tradeoff

`core/database.py` provides one transaction interface over SQLAlchemy for SQLite and PostgreSQL. Seven tables (`shops`, `jobs`, `users`, `sessions`, `attempts`, `documents`, `audit_events`) contain a string primary key and a JSON document. This preserves the prototype payloads while making them durable. PostgreSQL records live in `cbpms_private`, outside the browser-facing schema. The original normalized `public.shops`, `public.printers` and `public.print_jobs` tables are legacy design artifacts and are not the current runtime store. Existing public data is neither deleted nor automatically imported.

This is a deliberately small-project record store, not the final normalized relational design. All read/modify/write transactions are serialized: SQLite uses `BEGIN IMMEDIATE`; PostgreSQL uses one transaction advisory lock. It prevents concurrent token collisions, duplicate claims and lost updates at the cost of throughput. Queue selection currently scans records. Before larger deployment, migrate JSON fields into indexed relational columns, add schema-versioned migrations, and replace the global lock with row-level concurrency controls. Keep the transaction and state-transition tests unchanged during that migration.

Jobs persist storage locations, verified document metadata, the saved cost, payment order/receipt, checkout hash, release code, claimant, download grant expiry, and cleanup status. Sessions and release/login attempt counters survive restarts. Seed data is inserted only when absent; startup does not reset saved rates.

Deployment requires a persistent local volume or PostgreSQL plus private object storage. SQLAlchemy `create_all` provisions fresh tables, not future schema upgrades. `DATABASE_URL` must use `postgresql+psycopg` for the bundled PostgreSQL driver; use an appropriate Supabase connection endpoint and TLS. Database credentials and the Storage service-role key are separate and must never use a `NEXT_PUBLIC_` variable.

## Authentication and authorization

- Bootstrap creates an administrator only when its configured username does not exist. There is no default password. Existing passwords are not reset at startup.
- Passwords use salted PBKDF2-HMAC-SHA256 with 600,000 iterations; only the hash is stored.
- Login returns a random, eight-hour bearer session. The database stores its SHA-256 digest. Logout revokes it.
- Browser sessions stay in React memory; reload requires sign-in. They are not saved in localStorage.
- An admin can create operator/admin accounts only in its own shop through `/auth/users`. Operators may view queues and operate printing, but cannot change rates or create users.
- Cross-shop queue access, rate edits, token verification, completion and WebSocket subscriptions are rejected.
- WebSockets authenticate in their first frame, not in URL parameters. Session validity is checked again during the connection and before broadcasts.
- Desktop completion callbacks are persisted in a local outbox when the server is unavailable. Reconnect retries only the idempotent completion transition and never reprints the document.
- Login is throttled by source IP; failed release attempts are throttled by authenticated username. Limits are persisted. Configure trusted proxy handling at deployment; never blindly trust arbitrary forwarded IP headers.
- Public shop responses contain public shop contact/configuration information, not customer/job secrets. Queue messages omit release codes and checkout tokens.

### Customer accounts and document library

Customer accounts are separate from shop operator accounts. Registration is email-shaped username plus a password of at least 12 characters; the server stores only the PBKDF2 password hash and hashed bearer session. Customer sessions have no shop scope. A signed-in customer may still choose anonymous mode for a sensitive print job.

`POST /jobs/stage` accepts `access_mode=anonymous|account`. Account mode requires a customer session and creates a private `documents` record linked to the customer. Anonymous mode stores no customer owner and uses the checkout capability as the only customer status credential. `GET /customer/documents` and `GET /customer/jobs` enforce owner equality. The shop queue remains scoped to the selected shop and is not a customer document library.

Account-linked content is retained until the customer deletes it. Anonymous content is removed after successful completion or expiry. An account cannot be deleted while an active print job exists; deletion purges owned content and removes the customer identity while preserving de-identified shop operational history.

Only use HTTPS/WSS outside local development. The local development origins are allowed explicitly. CORS is not an authorization substitute.

## Payment architecture (mock active)

`PaymentProvider` in `services/payments.py` defines creation of an order and verification of a captured receipt. `Receipt` contains the provider order ID, payment ID, integer amount in currency subunits, currency, and capture status. The selected provider is obtained only on the server.

Current flow:

1. Upload a valid file. The server parses PDF pages (or validates a single-page image), calculates the price, stores the job, and returns a random checkout token. Only its digest is persisted.
2. Create an order using the checkout token. Repeated creation returns the same stored order, amount and currency.
3. The UI displays an explicit mock checkout, without a UPI transfer URI or live gateway QR.
4. The mock provider returns a server-created receipt. The route validates capture status, order binding, saved amount and currency before transitioning the job.
5. Confirmation atomically allocates a PIN that is unique among that shop's unexpired active jobs. Repeated confirmation returns the same receipt and PIN without resetting a processing/completed job.
6. After commit, notify the shop. Periodic dashboard snapshots recover from missed notifications.

The old endpoint that accepted arbitrary browser-supplied payment IDs is removed. Unsupported provider settings or disabled mock payment settings stop application startup; they never silently fall back to successful mock payments.

### Activating a real gateway later

Credentials alone do not turn the mock into a real gateway. A provider adapter, the matching checkout UI, and verified webhook processing are required. Razorpay is a suitable candidate already named in the original architecture, but no live provider is implemented or enabled in this increment.

The integration contract is:

1. Create provider orders on the server from the saved amount/currency and a stable job reference; persist external IDs. Reconcile ambiguous order-creation timeouts before creating another external order.
2. Keep key secrets in server environment variables; expose only the gateway's public checkout key.
3. Verify the checkout signature using the server's stored order ID. Fetch the payment from the gateway and require captured/settled status, exact amount/currency and matching order ownership. A browser success callback is not evidence of settlement.
4. Add a separate webhook endpoint. Verify the signature over the unmodified raw body with the webhook secret; durably deduplicate event IDs and payment IDs. Handle repeated and out-of-order events.
5. Share one atomic settlement service between checkout verification and webhooks. Preserve existing idempotency and state-transition tests. Do not reuse the mock-confirm endpoint for a live provider.
6. Record pending/failed/captured/refunded states and a reconciliation queue. Late capture after document expiry requires a refund/review path, never release of an expired file. Refund policies and capture configuration must be approved before live use.
7. Run the adapter in the gateway's test environment, verify webhook retries and restart recovery, then explicitly select live configuration. Keep mock confirmation inaccessible in live mode.

References: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), and [payment lookup](https://razorpay.com/docs/api/payments/fetch-with-id/). These are design references, not claims of a tested gateway integration.

## Job transitions and recovery

| Current state | Trigger | Next state | File behavior |
|---|---|---|---|
| staged | Matching provider receipt | queued | Retained |
| queued / failed | Authenticated release before expiry | processing | Short-lived download grant |
| processing | Claiming operator reports spool success | completed | Delete; keep cleanup pending if deletion fails |
| processing | Claiming operator reports failure | failed | Retain cloud copy for controlled retry |
| staged / queued / failed | Two-hour expiry | expired | Delete and retry failed cleanup |
| completed | Duplicate completion/payment request | completed | No reprint and no new PIN |

Local download links carry random, hashed, 60-second grants; the four-digit release PIN is not a download credential. The agent verifies downloaded bytes against the stored SHA-256 hash. Completion is limited to the account that claimed the job. Local temporary files are removed on download/printing failure, while the cloud document remains for retry.

If a completion callback is lost after spooling, the agent reports an uncertain result and does not automatically reprint. The durable desktop outbox retries only the completion transition after reconnect; it never downloads or prints the same job again. The job remains `processing` until the server receives the result. Automatic retry of an uncertain physical print could produce duplicates, so the operator must reconcile any genuinely ambiguous spool result.

Cleanup runs on startup and every minute, using stored metadata. Local orphan files older than the TTL are swept. A process crash between remote blob upload and database commit can leave a cloud orphan; a bucket inventory reconciliation task is still needed before production. No guarantee is made about backups, SSD erasure, Windows spool storage, or printer memory.

Supabase binary deletion uses Storage API `remove()`. SQL deletion of `storage.objects` removes metadata without deleting the underlying binary, so migration 004 disables the old unsafe helper. See [Supabase's storage schema guidance](https://supabase.com/docs/guides/storage/schema/design).

## Dashboard behavior

The dashboard signs in, loads only the account's shop, fetches the real queue and UTC-day counts, and persists rate edits. The saved-success message appears only after the API succeeds. WebSocket events trigger snapshots; a five-second poll reconciles missed events and events from another API worker. Network failure displays an error and marks the displayed data as potentially stale.

Printer cards display saved registration/configuration, not live hardware telemetry. Browser-side release and hardcoded job/revenue/security statistics were removed. Physical release remains in the desktop agent. Demo seeded printers must be replaced with real shop configuration before hardware use.

## API contract

| Endpoint | Access | Purpose |
|---|---|---|
| POST `/auth/login` | Credentials + throttle | Issue session |
| POST `/auth/register` | Public, throttled | Create a customer account and issue a session |
| GET `/auth/me`, POST `/auth/logout` | Session | Read/revoke session |
| DELETE `/auth/me` | Customer session | Delete the customer identity and owned content |
| POST `/auth/users` | Shop admin | Create account in own shop |
| GET `/shops`, `/shops/{id}`, `/shops/{id}/printers` | Public | Public shop configuration |
| PATCH `/shops/{id}` | Same-shop admin | Persist validated rates |
| POST `/jobs/calculate-cost` | Public | Estimate using stored rates |
| POST `/jobs/stage` | Public upload | Validate file, freeze price, issue checkout capability |
| GET `/jobs/{id}/status` | Checkout capability or owning customer session | Read safe customer job status |
| GET `/customer/documents`, `/customer/jobs` | Owning customer session | Read private library and job history |
| DELETE `/customer/documents/{id}` | Owning customer session | Delete a non-active library document |
| POST `/payments/{job}/order` | `X-Checkout-Token` | Idempotent order creation |
| POST `/payments/{job}/mock-confirm` | `X-Checkout-Token` | Simulated settlement only |
| GET `/jobs/queue/{shop}`, `/jobs/summary/{shop}` | Same-shop session | Queue and persisted counts |
| GET `/shops/{shop}/activity` | Same-shop session | Redacted operator/shop activity history |
| POST `/jobs/verify-token` | Same-shop session | Atomically claim job |
| GET `/jobs/{id}/download?grant=…` | Expiring capability | Retrieve local staged bytes |
| POST `/jobs/{id}/complete` | Claiming account | Report completed or failed |
| WS `/ws/queue/{shop}` | Session in first JSON frame | Queue notifications |

## Test traceability and submission evidence

Verification on this baseline: 20 backend tests passed; 7 desktop tests passed; standalone TypeScript checking passed; the Next.js production build passed (compilation, type checking, page generation and build tracing). The first sandboxed build stalled and was stopped; the successful build ran outside the sandbox. No automated visual browser test or physical print was performed.

Verification on this baseline: 20 backend tests passed; 7 desktop tests passed; standalone TypeScript checking passed; the Next.js production build passed (compilation, type checking, page generation and build tracing). The first sandboxed build stalled and was stopped; the successful build ran outside the sandbox. No automated visual browser test or physical print was performed.

| Requirement | Automated evidence |
|---|---|
| Persist jobs, rates, credentials and files | `test_restart_preserves_jobs_files_sessions_and_rates`, `test_rates_are_durable_and_staged_price_is_locked` |
| Protect shop operations | `test_auth_scope_and_revocation`, `test_operator_cannot_change_rates` |
| Authenticate event subscriptions | `test_websocket_auth_and_events` |
| Realistic, repeatable mock checkout | `test_payment_is_idempotent_and_cannot_reset_completed_job`, `test_atomic_payment_confirmation` |
| Reject forged payment/ownership data | `test_payment_ownership_and_client_supplied_id_rejected`, `test_provider_amount_mismatch_cannot_release_job` |
| Prevent duplicate printing claims | `test_atomic_claim_prevents_duplicate_release` |
| Retry failure and expiry safely | `test_failed_print_retains_file_for_retry`, `test_expiry_cleanup_after_restart`, `test_pending_cleanup_retried` |
| Restrict downloads and PIN guessing | `test_expired_checkout_and_download_rejected`, `test_rate_limiter_survives_restart` |
| Server-authoritative price | `test_lifecycle_and_authoritative_price`, `test_odd_duplex_does_not_charge_blank_side` |
| Never falsely complete failed printing | Desktop `test_print_failure_never_reports_completed`, `test_download_failure_retains_cloud_job`, `test_ack_failure_does_not_claim_purge` |

Manual assessment evidence to capture: admin login; forbidden access to another shop; rate save surviving restart; PDF checkout with corrected page count; visible mock notice; queue arrival; failure/retry; completed job disappearing; file deletion verification. User validation of the web/desktop visual interface and physical hardware remains outstanding.

## Known limits before a production claim

The private JSON record schema, global transaction lock, polling, and process-local WebSocket fan-out suit an assignment baseline. Production work still includes normalized/indexed data, managed migrations, durable event delivery, cloud orphan reconciliation, upload abuse controls, parser isolation, password reset/account revocation UI, metadata retention policy, and a real rendering/printing pipeline. No uptime, latency, RAM, physical erasure, or payment-settlement guarantees are asserted.

RAW `WritePrinter` expects printer-ready data and does not implement general document rendering or apply arbitrary UI print settings. Native mode therefore requires explicit PDF-direct capability and restricts the supported configuration; all other cases fail instead of pretending to succeed. DOCX is explicitly rejected pending a reliable conversion service. See [Microsoft RAW printing documentation](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type).
