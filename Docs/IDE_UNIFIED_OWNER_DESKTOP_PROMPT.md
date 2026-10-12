# Implementation prompt: unified Counter Desk Desktop

Implement the approved unified owner desktop design in the existing CBPMS project. Preserve the existing owner web portal and customer website. Do not rebuild the system from scratch or migrate frameworks without approval.

Read repository instructions (including applicable AGENTS.md and Docs/CLAUDE.md), then read:
- Docs/design/UNIFIED_OWNER_DESKTOP.md in full: current-source audit, exact text workflow, page/action definitions, permissions, data requirements, lifecycle gaps and acceptance checks.
- output/design/unified-owner-desktop/index.html: nine full-desktop mockups.
- output/design/unified-owner-desktop/PROMPTS.md: generation intent.
- Docs/design/OPERATOR_STATION_DESIGNS.md and output/design/operator-station/operator-*.png: approved owner portal theme.
Inspect actual apps/desktop, owner portal components and backend routes before coding. Older documentation claims do not supersede current source or the new scoped desktop specification.

Deliver one native owner desktop workspace using the existing Python/PySide6 application: Overview, Print queue with scanner input, selected-job Review, Active prints, Printers & stations, Services & rates, Staff & shop, History & recovery and Station settings. Connect to the same authoritative backend used by web. Reuse contracts and design patterns, not copied fixture data or a website screenshot/WebView facade.

First produce a concise capability/contract mapping and implementation plan. Identify which endpoint operations already exist, which are unsafe for the new workflow, and which need reviewed changes. Do not simply add UI labels on top of the current auto-print path.

Mandatory workflow:
- Viewing metadata or scanning a receipt must NEVER physically print. Find & review stops at review.
- Preview requires shop/staff authorization and short-lived document access.
- The owner sees the full manifest/settings, payment obligation, release lease, hash verification and actual printer/app compatibility before Print.
- Only explicit deliberate Print activation submits a physical job, with fresh server eligibility checks and duplicate/race guards.
- Spool accepted, physical output confirmed, cloud result synchronized and cleanup finished are separate states.
- Pending sync retries the report only, never download or spool again.
- Unknown outcome needs reconciliation. No automatic reprint after restart, timeout or reconnect.
- Counter due is not Collected. Do not mark cash paid because printing/output confirmation succeeded.
- Completion/hold/rejection transitions and retention must match reviewed server policy; prevent the existing completed-before-confirm-output conflict.

Stay with the existing architecture: presentation panels, separate lifecycle/controller, API adapter, Windows spooler/render adapter, durable attempt/reconciliation store, and main-thread queued UI signals. Keep code modules within repository size guidelines. Long work runs off the Qt UI thread.

Required checks:
- Secure tenant/role authorization server-side on every operation; no unrestricted storage access or service/database keys in desktop/public code.
- Atomic claim and version/idempotency handling; reviewed contract for abandon/lease expiry.
- Durable dispatch-intent record and conservative unknown state after a crash. Physical print cannot be rolled back by a DB transaction.
- Actual page-range/copies/colour/duplex/N-up/paper/manifest support must be verified in the print path. The current RAW PDF implementation supports only a narrow subset; block unsupported jobs rather than silently changing them.
- Real observed printer/cloud/scanner states with freshness; no hardcoded Online or Ready.
- Secure local preview/download handling and tracked temporary cleanup, excluding active print files.
- Safe errors, redacted logs, no release secrets in tables, no repeated default role credentials.
- Authentication/locking/revocation remain effective while management and printing share one app.

Appearance: approved owner Counter Desk parchment/ivory, espresso text, olive selection, terracotta Print action. Full desktop workspace, approximately 232px sidebar and 32–40px content gutters; no whole-app narrow width cap. Readable 17–18px body, >=14px metadata, 36–44px titles, >=48px controls. Fit resizable laptop/desktop sizes and Windows DPI scaling. Generated images are guides, not pixel-perfect authority or seed datasets.

No production fixture shops, printers, personal emails, fabricated prices, counters, fake payment verification, timeout-based success or mock spool fallback. Test doubles are acceptable only in tests. If a service/capability is missing, show an honest blocked state and document it. No enabled button whose handler only logs or updates a label.

Policy questions requiring my decision: counter collection timing, rejection/refund rules, partial-output/reprint behavior and acceptable physical-output evidence. Ask targeted questions before enabling dependent irreversible/payment actions; continue independent shell/read-only work. Do not invent those policies or merchant settings. Do not provision real shops, alter credentials or enable payment processing under this task.

Implement in phases from the design specification, verify each phase with focused tests, and perform allowed manual visual/hardware review. Required failure tests include duplicate Enter/click, two stations claiming, expired/revoked claim, stale state, wrong-shop access, unsupported printer settings, hash mismatch, partial/uncertain output, failed confirmation, outbox replay, restart and active-file cleanup. Verify shared web/desktop record consistency. Follow repository prohibitions on automated visual browser testing.

Preserve unrelated dirty-worktree edits. Do not reset, stage, commit or push without explicit instruction. Before any irreversible database migration, show the contract/migration, compatibility and rollback plan and obtain approval where required. Do not weaken auth/allowlists/TLS or make storage public to unblock a feature.

Finish with files changed, actual commands/tests/results, manual printer checks performed, remaining unsupported actions and unresolved decisions. Do not claim universal printer compatibility, fully secure operation or production readiness without evidence.

