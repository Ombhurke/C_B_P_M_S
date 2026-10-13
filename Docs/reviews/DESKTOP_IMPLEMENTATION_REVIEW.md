# Desktop implementation and database contract review

Reviewed: 12 October 2026. Scope: the new native desktop counter desk, its API contracts, and the live database structure. This is not a complete production security certification.

## Change completed

Removed desktop Add Staff creation, including its button, dialogs, view/shell signals, controller handler, and desktop API helper. Existing staff listing and owner-only shop profile editing remain. Web staff management, backend team routes, accounts, permissions, and database records have not been removed or changed.

All other findings below are review findings, not implemented repairs.

## Verified database structure

A read-only connection inspected table definitions, constraints, triggers, RLS flags, and aggregate field presence. No database writes, startup initialization, migrations, or schema changes were performed. No credentials or customer documents were printed.

The application tables found in `cbpms_private` are:

- `shops`
- `jobs`
- `users`
- `sessions`
- `attempts`
- `documents`
- `audit_events`

Each has an `id` primary key and a non-null `data` JSONB value. All seven have RLS enabled. The catalog query found primary-key constraints but no foreign-key or business CHECK constraints on these tables. RLS being enabled is not, by itself, proof that every API route is secure.

The live shop aggregate was: one shop; one record with `phone`; zero with `contact_number`; one with `printers`; zero with `stations`. An empty stations list in an API response can come from its response-model default, not a paired station in storage.

The only application trigger found was `trg_ensure_user_alias` on user INSERT/UPDATE. It does not coordinate jobs, payments, printing, or shop profile changes.

These are JSON records, not a normalized relational schema. Embedded printer/station arrays and payment fields on a job can be stored without separate tables. A missing dedicated table does not automatically mean the feature cannot persist; missing contracts and constraints must be distinguished from missing storage.

## Priority findings

### P1 — Rate editing uses the wrong contract and can break checkout

Locations: `apps/desktop/agent/ui/views/rates_view.py:update_rates/_on_save_clicked`; `apps/server/app/models/schemas.py:ShopUpdateRequest`; `apps/server/app/services/pricing.py:calculate_cost`.

The view reads and sends `base_rates.bw_normal/color_normal`. The API and quote engine use top-level `base_bw_rate` and `base_color_rate`. Pydantic currently ignores the unexpected `base_rates`, so a successful PATCH does not update those prices.

The same form replaces `paper_rates` with numeric values for normal/bond/glossy. Checkout expects each applicable paper entry to be a structured object with fields such as `bw_single`, `bw_duplex`, `color_single`, and `color_duplex`. Direct diagnostics reproduced `AttributeError` for bond and glossy quotes after parsing the desktop's payload. Normal's zero value falls back to the unchanged base rate.

Repair: align both loading and saving to the canonical pricing contract; validate nested paper entries on the server; preserve unrelated paper settings; read back accepted values; test quotes after edits. Do not rewrite already accepted job quotes.

### P1 — Displayed review job can differ from the document actually dispatched

Locations: `apps/desktop/agent/ui/shell.py:open_review_for_job`; `apps/desktop/main.py:handle_submit_print`; `apps/desktop/agent/core/lifecycle.py:submit_print`.

Opening a queue row only calls the view's `set_job`. It does not authorize/claim the job or set the controller's lifecycle job. Dispatch uses `lifecycle.active_job`, not the job visible in the view. Opening B after scanning A can leave B displayed while dispatch still targets A. Opening a queue job without an active lifecycle job instead fails to print.

Repair: use a single authorized review context across the view/controller/lifecycle, tied to job ID, claim, downloaded file/hash, and selected printer. Metadata-only review must not enable Print. Block overlapping scans and changes during dispatch/confirmation. Add an A-to-B mismatch regression test without physical printing.

### P1 — Station lock accepts any password

Location: `apps/desktop/agent/ui/shell.py:_lock_station`.

Unlock and Enter call `dialog.accept` directly. The password is never checked; after the dialog closes, `is_locked` is reset unconditionally. This is a visual modal, not an authenticated lock.

Repair: implement genuine reauthentication or remove the security claim; require success before unlocking; handle cancellation safely and prevent scanner/background actions bypassing the lock.

### P2 — Shop contact edit is silently discarded; refresh is not awaited

Locations: `apps/desktop/agent/ui/views/staff_view.py:update_data/_on_edit_profile`; `apps/desktop/main.py:handle_update_profile/refresh_all_data`; `apps/server/app/api/v1/shops.py:update_shop_profile`.

The UI reads/sends `contact_number`; both the API and live shop use `phone`. Direct request-model validation retained name/address and dropped contact_number. The UI therefore also fails to display the stored phone.

Name/address use valid field names and the backend persists them in a transaction. This review does not establish that those fields fail to save. However, the controller ignores the PATCH response, launches a separate refresh thread, then immediately announces success. The refresh emits its UI update only after all subsequent profile/summary/queue/team requests succeed; a later failure leaves old values onscreen despite the earlier save.

Repair: use `phone`, apply the saved response on the Qt UI thread, distinguish save failure from refresh failure, and reject unexpected request fields rather than accepting a silent no-op. Preserve backend admin/shop authorization. Add tests for phone/name/address persistence and failed refresh.

### P2 — Report problem sends an invalid request and retries it indefinitely

Locations: `apps/desktop/agent/core/api_client.py:report_issue`; `apps/server/app/models/schemas.py:JobIssueReportRequest`; `apps/desktop/agent/core/lifecycle.py:report_issue/flush_outbox`.

The desktop sends `notes`; the server requires `details` (2–500 characters). Direct validation reproduced the missing-details failure. The lifecycle treats any exception as retryable, queues the same malformed request, cleans the local file, and reports a locally successful outcome. Retrying cannot repair a 422 payload.

Repair: map/validate `details`; distinguish network retry from permanent validation/authorization errors; visibly separate recorded-local from synchronized-server state; honor false return values and lifecycle stages in controller confirmation/report actions.

### P2 — Printer refresh is not connected; station mapping is not persistent

Locations: `apps/desktop/agent/ui/views/printers_view.py`; `apps/desktop/agent/ui/shell.py:_wire_signals`; `apps/desktop/main.py:handle_printer_change/_apply_data_to_views`.

Refresh local devices emits `refresh_printers_requested`, but the shell does not connect it. Mapping a printer only changes an in-memory controller field. No station PATCH or durable local setting is written. The header uses hardcoded `Station Alpha` even though the live shop has no stored stations array.

Repair: connect refresh; define and persist the real station mapping through an authorized contract; read it back at startup. Until pairing is implemented, label the selection honestly as session-local rather than a saved station mapping.

### P2 — Monitor/recovery and readiness displays are not fully backed by evidence

Locations: `apps/desktop/agent/core/lifecycle.py:submit_print`; `apps/desktop/agent/spooler/win32_spooler.py:spool_job`; `apps/desktop/main.py:_apply_data_to_views/_apply_print_completed`; overview/printers/recovery/staff views.

- The lifecycle manufactures `Spool-<time>` instead of preserving the ID returned by Windows `StartDocPrinter`.
- Recovery is passed an empty audit-events list, so server history never loads.
- Cloud online is always passed as true after refresh. A detected printer is labelled ready/online without observing its hardware state.
- Staff with no last-active timestamp are shown as `Active recently`, without a timestamp writer in backend code.
- The printer displayed in Monitor comes from the controller's default, not necessarily the selection used for dispatch.
- Review displays a document placeholder rather than rendering the downloaded PDF. A supplied hash alone is labelled verified even on metadata-only review.

Repair: distinguish unknown/detected/verified states; preserve native IDs and actual dispatch printer; fetch authorized history; show unknown activity honestly; implement a real authorized preview or explicitly label metadata-only review. Never convert spool acceptance into proof of physical output.

### P2 — Paper choice disappears in the authorized release response

Location: `apps/server/app/models/schemas.py:TokenVerifyResponse`; `apps/desktop/agent/ui/views/review_view.py:set_job`.

Queue records include `paper_type`, but the response model for a verified release omits it. FastAPI response filtering removes that field, and the review falls back to `A4`, which mixes paper stock with paper size. Carry the supported paper contract consistently from quote to job to release to review.

## Atomicity and retries

`apps/server/app/core/database.py:transaction` commits on success and rolls back on exceptions. PostgreSQL read/modify/write paths use advisory locks; shop updates and their audit events share the same database transaction. Triggers are not necessary for that rollback behavior. This code does not automatically retry every failed transaction.

Database rollback cannot undo a physical print or object-storage deletion. In particular, `release.py:confirm_job_output` calls storage purge before committing the job/audit transaction. A later failure can roll back metadata after the file has already been deleted. Durable cleanup intent and an idempotent worker are needed for that boundary. Similarly, no database trigger can prevent an uncertain physical dispatch from being printed twice; durable dispatch/reconciliation state is needed.

## Implementation handoff

Fix the P1 issues before real printing or live pricing changes. Then repair profile/report contracts, refresh/mapping/history wiring, and remaining evidence-backed display states. Preserve the existing desktop theme and desktop-sized layout. Do not introduce demo records, fabricated hardware states, fake successful requests, unrestricted storage URLs, or weaker authorization. Do not recreate Add Staff in desktop.

For each mutation, trace UI field -> request schema -> authorized route -> transaction -> persisted record -> response -> displayed readback. Keep public customer-facing metadata separate from operator-only station/job details. Use isolated tests for multi-shop access, admin-only changes, rollback, malformed payloads, stale review contexts, duplicate dispatch prevention, offline sync, and restart reconciliation. Do not run visual browser automation or send test documents to physical printers.

## Verification

- Desktop unit suite: 18 tests passed with third-party pytest plugin autoload disabled; process exited successfully. One warning concerns `asyncio_mode`, whose plugin was deliberately disabled.
- The focused Add Staff removal regression also passed independently with a successful process exit.
- Direct model/quote diagnostics reproduced the profile, rates, and issue-report contract mismatches without API/database writes.
- Live schema inspection used a read-only transaction and retained full configured TLS verification.
- Focused server suite: 6 tests passed covering rate persistence/locked quotes, operator permissions, station/printer management, issue/confirmation endpoints, transaction rollback, and rate/audit rollback. These used isolated temporary databases, not Supabase.
- Initial sandbox runs encountered temporary-file atomic-rename restrictions. A broader server test attempt stalled and was interrupted; it is not a passing test result.
- Visual layout, actual printer hardware, and real physical print/restart behavior were not tested.
