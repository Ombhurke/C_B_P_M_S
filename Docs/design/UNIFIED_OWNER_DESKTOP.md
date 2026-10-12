# Unified owner desktop: workflow and design specification

Date: 12 October 2026. Deliverable: design and implementation handoff only. No application code, database, environment, payment configuration or hardware was changed.

## Decision

Unify Counter Desk management and Print Station execution inside the existing desktop application. The owner should not need a browser to understand a job, rates, printers or staff. Keep the existing web portal as a second client of the same authoritative backend, not a second source of records.

Use one desktop shell with Overview, Print queue, Active prints, Printers & stations, Services & rates, Staff & shop, History & recovery and Station settings. Review is a selected-job view inside Print queue, not an empty standalone navigation destination. Monitor is Active prints. Connection setup belongs to Station settings/onboarding. Scan/release is part of Print queue.

This replaces the old six sparse station screens as the next desktop design direction. It does not replace the customer Paper Desk horizontal navigation or redesign the approved owner web portal.

## Current implementation evidence

Inspected files:
- apps/desktop/main.py: scan callback verifies and claims the job, downloads, then invokes spool_job in the same operation. There is no intervening explicit review approval. Successful submission is reported as status completed, despite logging that physical output is unconfirmed.
- apps/desktop/agent/ui/dashboard.py: 1024x680 initial window; small controls; separate Connect/Release/Review/Monitor/History/Settings tabs. Confirm/report handlers change labels even after API errors. Worker code in main.py directly changes some widgets instead of consistently using the existing queued bridge.
- apps/desktop/agent/ui/panels.py: Review dispatch button is disabled; history is a text log; connection/online text is hardcoded; no owner management views.
- apps/desktop/agent/core/api_client.py: authentication, shop queue, release verification, hash-checked download, completion, output confirmation and issue reporting methods exist.
- apps/desktop/agent/core/completion_outbox.py: pending completion callbacks survive restart and are retried without reprinting. Preserve this safety property.
- apps/desktop/agent/spooler/win32_spooler.py: real printing currently requires configured PDF-direct RAW support and default single-copy, single-sided, one-page-per-sheet, B&W settings. Device presence alone does not support every requested print setting. Page-range behavior also needs verification; never assume a partial range is honored by raw file submission.
- apps/web/components/admin/counter-desk/: owner overview, queue/details, printers/stations, rates and staff/profile views exist. Shell still includes a hardcoded initial team member and catches some refresh errors without an explicit stale/error state. Reuse information architecture and contracts, not these defects.
- apps/server/app/api/v1/release.py: verify-token mutates queued/failed to processing and claims immediately; complete can mark completed and trigger deletion; confirm-output currently rejects a job already marked completed; report-issue also rejects completed. Thus current desktop completion and later output confirmation are inconsistent.
- apps/server/app/api/v1/jobs.py: queue response omits several fields needed for decisions, including explicit payment method/status, privacy mode, paper/range and claim identity. Detail retrieval must be checked, not filled with defaults.
- apps/server/app/api/v1/shops.py: profile, printers, stations, team, job detail, reject and activity endpoints exist. Current reject sets job status failed, not a distinct non-retryable rejected state.
- apps/server/app/api/v1/checkout.py and services/payments.py: pay-at-counter and Razorpay code now exist. Code presence is not proof credentials, capture verification, production behavior or merchant readiness are verified.

These are source observations, not a full security or hardware audit. Existing working-tree changes belong to the user and must remain intact.

## Text workflow: what the owner does

1. Sign in with a supported staff authentication flow. Select only a shop authorized by the server. Link this station and map an actual detected Windows printer. Until linked, show No shop selected / Not connected; never fake Online.
2. Overview shows actual shop workload, stale-data time, active local dispatches, printer observations and issues. Open queue or a specific job. Overview never prints.
3. Queue allows searching ordinary job references and selecting metadata without claiming. Scanning a customer receipt uses Find & review, never immediate dispatch. Reference numbers are not release credentials.
4. Review shows requested settings, payment obligation, selected shop and release/claim checks. Before a grant exists show metadata and a Preview requires release authorization notice; do not show document content. On explicit authorization, claim the job with a bounded lease and short-lived access. Existing verify-token already claims: split the agent flow so it stops before printing, and define abandon/expiry behavior server-side.
5. Prepare/download an authorized file and verify integrity. Render a real private preview with the effective selected range/layout, or show Preview unavailable and the reason. If the job is a folder/multiple documents, show the complete ordered manifest, per-document settings, totals and missing-file blockers; never print only the first member.
6. Choose a compatible printer. Compare the requested options against BOTH hardware capabilities and the actual app/driver print path. Show Print blocked: duplex is not supported by this print path, rather than silently printing simplex. Any changed paid settings require a separate re-quote/customer-consent workflow, not an owner override.
7. Review payment: show Verified online only from an authoritative verified provider record; Counter payment due is not Paid. Counter collection requires an explicit authorized collection record under an agreed policy. Until that policy/API exists, do not manufacture Collected or let output confirmation collect money implicitly.
8. The owner presses the clearly labelled Print button. Revalidate job revision, lease, expiry, station, shop, payment policy and printer compatibility at dispatch. Serialize/guard duplicate submission. A stale/revoked claim blocks print. Printer name, document count, effective pages, copies and requested settings stay visible at this irreversible action.
9. Active prints shows observed stages: grant authorized, file verified, submitting, spool accepted, output awaiting confirmation, result sync and cleanup. Spool accepted is not Printed. Display real spool ID if available. No invented percentage/pages-printed estimate.
10. Owner verifies complete paper output and confirms it, or reports a specific issue. Partial/missing output and uncertain outcome go to Recovery. API failure shows Confirmation pending/failed, not a success label.
11. Record results safely, retry only idempotent result reporting when the network returns, and reconcile uncertain spool outcomes after restart. Never auto-download or auto-reprint from an outbox retry.
12. Remove temporary preview/spool files on success, abandonment, expiry and failure through bounded lifecycle cleanup. Account library originals remain private unless the user deletes them; anonymous cleanup follows the job lifecycle. An uncertain outcome preserves minimal reconciliation metadata, not unnecessary indefinite document copies.

## Pages and actions

| Concept | Primary use | Actions and effects |
| --- | --- | --- |
| 01-overview | At-a-glance shop management | Open queue/job, inspect issue; stats require real records and explicit freshness |
| 02-queue | Queue + scanner release desk | Search/filter, select metadata, Find & review, authorize release; no auto-print |
| 03-review | Owner's print decision | Authorized preview, compatibility checks, explicit Print, hold/reject reason, back/abandon claim |
| 04-monitor | Active physical jobs | Observe spool stages, Confirm full output, Report problem; no guessed completion |
| 05-recovery | History and uncertainty | Retry result sync, inspect printer/outcome, review reprint eligibility; no blind reprint |
| 06-printers | Local and shop devices | Refresh local devices, map station device, inspect effective print path; never infer readiness from enumeration |
| 07-rates | Owner shop services | Edit supported offerings, review/save persisted rates; existing accepted quotes stay unchanged |
| 08-team | Memberships and shop profile | View staff/profile; authorized add/edit only when supported; no assumed invite emails |
| 09-settings | Connect, lock, local preferences | Authenticate/link, reconnect, map printer, redacted diagnostics, managed cleanup, safe disconnect |

A form/drawer must cover first-time sign-in/shop selection, no eligible shop, unknown printer, hold reason, reject reason, collection confirmation if later agreed, partial output, grant expiry, lock, staff edit, rate change review and disconnect while a spool is active. These supporting states do not require separate sidebar pages.

## Minimum information for the print decision

| Information | Authority / behavior if absent |
| --- | --- |
| Job reference, shop, created time, expiry, revision | Backend; absent scope/revision/expiry needed for release blocks dispatch |
| Anonymous/account-linked privacy | Backend; never browse customer library from the station |
| Filename(s), MIME, size, inspected page count, manifest/hash | Authorized job/detail; actual missing document/integrity mismatch blocks print |
| Requested page range, copies, colour, duplex, N-up, paper and order | Backend immutable job configuration; do not default unknown options to 1/B&W/all |
| Effective pages/sheets and price units | Explicit server/render plan calculation; distinguish source pages, impressions and sheets |
| Accepted quote/currency, payment method/state, outstanding amount | Backend/provider/collection ledger, never a local paid checkbox |
| Release authorized, expiry, current claim owner/station | Server; authorization is independent of queue visibility |
| Printer/device mapping and effective supported driver settings | Local observations + server shop configuration; Unknown/Stale is not Ready |
| Previous attempts, native spool ID, physical outcome, pending sync | Persisted execution records; uncertain attempt blocks automatic retry |
| Hold/rejection reason and allowed next action | Validated lifecycle; failure does not mean permission to reprint |

Do not expose release tokens in queue tables or logs. Display a friendly public reference separately from secrets. Optional customer name is not required for anonymous processing.

## Permissions and shared data

Owner capabilities: shop settings/rates/staff within assigned shop; operator capabilities: allowed queue review/release/print/outcome reporting; station identity: bounded shop association and granted local execution. The current backend uses admin/operator labels: map actual permissions explicitly, not an invented owner role migration.

Every backend mutation rechecks permission and tenant scope. UI hiding is not security. No unrestricted service-role/database credentials, customer-library access or permanent document URL on the station.

Use the same authoritative shop/jobs/rates/membership APIs as web, with a desktop-specific API adapter using authenticated requests. Do not load an arbitrary website/WebView solely to fake native integration. Keep the current Python/PySide6 app and spooler separation unless a migration is explicitly authorized. Local device observation, native print and cleanup remain desktop responsibilities; browser clicks must not directly cause a remote physical print.

Changes in either client must refresh/reconcile the other; WebSocket events trigger authoritative fetching rather than being treated as complete truth. Cloud/disconnected status must reflect real observations and timestamps. Default recommendation: no new release/dispatch while offline; reconcile existing spool attempts/outbox safely. Any offline-print policy requires explicit approval.

## Backend and lifecycle work required before safe implementation

This is an implementation requirement, not a claim these contracts already exist.

- Separate job business state, release lease, local execution attempt, physical outcome, payment/collection, result sync and cleanup. Keep an explicit mapping to legacy staged/queued/processing/completed/failed/expired fields; migrate only with reviewed compatibility.
- Metadata inspection is read-only. Authorization creates/renews a bounded claim and scoped grant. Closing the review safely abandons a pre-dispatch claim; after submission it must never unclaim as if no print occurred.
- Atomically validate eligible state, tenant, permissions, expiry and revision when taking the claim. Use compare-and-set/versioning and unique attempt/idempotency keys to prevent two stations printing one job.
- Persist an attempt intent before native dispatch and record the actual spool result after. A database transaction cannot roll back already printed paper. Crash between intent and spool acknowledgement is Unknown, requiring reconciliation, not an automatic retry.
- Track spool-accepted separately from physical confirmed; keep confirm-output/report-issue usable in valid awaiting-output states. Do not call legacy complete(completed) at spool acceptance and purge cloud bytes before issue recovery is possible.
- Persist output outcome and audit together; result replay is idempotent. Broadcast only after commit. Retry transport/report failures with bounded backoff, but do not retry native dispatch blindly.
- Counter-payment selection is a customer obligation, not collection. Introduce/verify an explicit authorized idempotent cash collection ledger and policy before enabling Collect payment. Spooling or confirming paper must not mark cash paid automatically. Preserve online verification; do not replace it with an operator override.
- Hold is a temporary disposition; rejection is a distinct disposition with allowed transitions, customer-visible reason and refund/retention consequences. Existing reject=failed semantics are insufficient for a non-retryable rejection label. Without reviewed policy, show unavailable and request a decision.
- Revise detail/queue projections to return required safe fields. Do not expose full job internals or access grants in general shop listings.
- Rate changes apply to new server quotes and maintain accepted-quote immutability/revision. Membership changes revoke access promptly; active-claim behavior must be explicit.
- Local cleanup must operate on app-owned tracked files only and exclude active spool handles. No broad purge of a directory during printing. Report pending/failed cleanup truthfully.
- Rendering/printing supported formats and options is separate from UI design. Current RAW PDF path must block unimplemented range/copies/duplex/colour/N-up/images. Folder printing needs ordered attempts and partial-job recovery.
- UI updates use queued signals on the Qt main thread; network/render/spool work never blocks the GUI. Lifecycle models own state; labels do not invent it.

Clarifications that affect release or money must be resolved before those dependent actions are enabled: counter collection timing, rejection/refund policy, partial-output/reprint policy and hardware-vs-operator completion confirmation. Independent layout/read-only management work can continue while those decisions are open.

## Visual contract

Match approved owner web portal: parchment sidebar ~232px, ivory task canvas, espresso text, olive selection/status, terracotta physical-dispatch actions, fine warm borders and restrained shadows. Use the same labels/patterns on web and desktop where appropriate, while retaining a visible local station identity.

Full available desktop width, not a 1024px mock scene. Initial window should fit/maximize the available display; support resizable 1366x768, 1440x900, 1920x1080 and Windows DPI 125/150/200%. Native DPI-aware sizing, not transform/zoom of a screenshot. Body 17–18 logical px, metadata >=14, headings 36–44, controls >=48 high and rows >=56. Use 32–40 workspace gutters and 60/40 master/detail; at smaller widths move detail to a view/drawer rather than shrinking text. Vertical scrolling is acceptable; no hidden critical buttons.

One consistent shell and active selection. Every action labelled, keyboard accessible and has progress/error/disabled-reason states. USB scanner events are consumed only in the intended focused release field; scanner Enter never triggers Print. Dialog focus and Enter/default-button semantics must be explicitly safe. Space/keyboard activation of Print is permitted only with deliberate focus on that control. Lock masks previews and tokens; safe spool monitoring continues without cancelling hardware.

Image examples are illustrative. Do not copy staff entries, printer readiness, cash labels, counters, dates, rates or job IDs into runtime. Do not derive role permissions, lifecycle/refund policy or payment settings from generated image wording. Written spec overrides accidental icon/text/count variations.

Visual-review corrections: use one consistent header/status-strip position and icon set across screens. The review-required switch drawn in Settings is a locked ON policy indicator, never a user-editable auto-print switch. Scanner Enter only finds/reviews; it is not a global ban on deliberate keyboard activation of the focused Print control. Any Printed successfully history label requires actual outcome evidence, not spool acceptance. Images/other formats, rate units and sample addresses must not extend supported backend contracts. Connection success alone does not mean Ready to print. The illustrative nine images are not a single continuous recorded session.

## Phased implementation and verification

1. Audit current contracts and list existing versus new/unavailable capabilities. Preserve current auth and unrelated edits.
2. Build native unified shell with real read-only Overview/Queue/details/printer/history states, not demo data.
3. Refactor release into metadata/authorization/review/dispatch boundary; build lifecycle/attempt contracts and safe atomic guards before enabling Print.
4. Add authorized private preview and supported print-path checking; keep unimplemented formats/options visibly blocked.
5. Implement truthful monitor, outcome reporting, durable recovery and cleanup. Resolve payment/hold/rejection policy before enabling related mutations.
6. Bring rates/staff/profile into desktop through verified permission-checked APIs, then connect live refresh and operator-friendly errors.
7. Test duplicate scan/click, two-station race, revoked membership, wrong-shop token, expired grant, stale quote, download hash mismatch, no printer/unsupported driver, partial spool failure, uncertain outcome, crash/restart, failed confirmation, dropped result callback, active cleanup and outbox replay without reprint.
8. Verify amounts/settings/manifest across customer, web owner and desktop; counter due never becomes paid from print success. Assert DB transitions and audit consistency.
9. Manual hardware and visual testing required: actual compatible printers, page range/copies/duplex/colour/N-up where supported, printer offline/jam, short screens, DPI scaling, keyboard/scanner and lock. Unit tests may mock hardware; runtime cannot.
10. Report changed files, real tests and hardware limitations. Do not claim all printers work or the app is market-ready from mock tests.

## References and precedence

New: output/design/unified-owner-desktop/index.html and PROMPTS.md; Docs/IDE_UNIFIED_OWNER_DESKTOP_PROMPT.md.
Existing: Docs/design/OPERATOR_STATION_DESIGNS.md and output/design/operator-station/operator-*.png.
For this desktop redesign, this specification supersedes the earlier sparse station flow. Older handoff shop deferral describes earlier scope; this package prepares desktop integration, not permission to provision production shops, payments or secrets. Current source determines implementation reality. No website/design PNG should replace functional UI.

