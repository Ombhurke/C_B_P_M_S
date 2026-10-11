# CBPMS — implementation handoff

**Updated: 9 October 2026. Start here when continuing in another IDE.**

This document consolidates the accepted product direction, reference images,
observed implementation, unresolved defects and the next development milestone.
The user's latest instruction is: **real functionality only; print shops will be added later.**

**Design addendum — 10 October 2026:** Future operator-portal and desktop-printing
screen proposals are indexed in `Docs/design/OPERATOR_STATION_DESIGNS.md`, with
the image gallery at `output/design/operator-station/index.html`. Read its explicit
desktop layout contract to avoid narrow mobile-style workspaces on laptop screens.
These are design-review artifacts; shop implementation remains deferred until requested.

## 1. Authority and how to work

1. Follow the user's newer explicit instructions, then this handoff for product scope.
2. Read `Docs/CLAUDE.md` for repository working rules. Preserve existing changes;
   do not reset, overwrite unrelated work, stage, commit or push without authorization.
3. Use the reference index below for design and evidence. Older descriptions of
   mobile-first delivery, password-only identity, mocked checkout or demo shops
   are historical, not instructions to reinstate them.
4. Inspect current code and configuration safely before editing. A document's test
   count or implementation claim is dated evidence, not proof of the current state.
5. Do not invent requirements, business data, credentials, shop details, rates,
   retention limits, refund rules, successful results or finished features.
6. Ordinary implementation details may be chosen within these constraints and
   documented. For missing product decisions or external configuration, identify
   the exact gap; continue independent work and ask only what is necessary.
7. Work in small complete slices. Each slice needs real persistence/authorization,
   applicable tests, failure states and updated documentation. Do not generate
   disconnected screens or unused abstractions merely to increase output.
8. Do not rewrite the entire application, change its stack, install unnecessary
   UI libraries, regenerate approved images or redesign the landing/auth pages.
9. Never claim “fully working” from a passing build alone. Report exactly what
   was implemented, tested locally, verified live, blocked and deferred.

## 2. Accepted decisions

| Topic | Decision |
|---|---|
| Product | Private cloud print platform; customer web, backend, separate shop web and Windows agent |
| Current frontend | Desktop browser first; usable reflow and zoom; no native mobile/PWA work now |
| Approved workspace look | **Option B / Paper desk**, including the three matching page images |
| Navigation | Overview, My prints, Print jobs, Find a shop, Account |
| My prints | Private reusable document library; not a duplicate job-history page |
| Print jobs | Actual submitted printing requests and their status/history |
| Runtime data | Real API/database results only; meaningful empty/error/unavailable states |
| Shop setup | **Deferred. Do not create, seed or onboard shops, staff or printers now.** |
| Payments | Disabled until a real provider is implemented/configured; no simulated checkout |
| Printing | Existing code preserved; no new hardware/agent work in this milestone |
| Privacy | Per-job anonymous or account mode; no mixing; optional accounts in eventual print flow |
| Immediate useful release | Real customer identity + shop-independent private library + Option B workspace |

### Meaning of “no demo or synthetic parts”

No hardcoded shops, jobs, documents, counters, prices, availability, ratings,
revenue, receipts or success states in the running product. Never replace an API
failure with invented data, a local price, a successful-looking toast or a delay
timer. Do not seed production to make the screenshots appear populated. The images
use sample records to explain layout; none of those records are product data.

Remove existing runtime demo fallbacks when implementing the affected path. Real
development uses the configured PostgreSQL and private Storage, not SQLite/local
files disguised as the production backend. Do not enable `MOCK_PRINTING`, demo
seeding, mock payment confirmation or similar runtime switches.

Existing synthetic fixtures/test doubles are permitted **only inside isolated
automated tests**, never shipped as product behaviour or inserted into live data.
They simulate failures safely and are not evidence that an external provider works.
Retain useful tests; move simulation helpers into tests rather than removing
coverage to satisfy “no demo”. Do not create public test-bypass endpoints.

## 3. Reference index — read in this order

Paths below are relative to the repository root. Open the PNGs and inspect them;
reading filenames alone is not visual review.

| Reference | Purpose / status |
|---|---|
| `Docs/CLAUDE.md` | Working rules: no automatic Git writes; stop processes you start; no automated visual browser tests |
| `Docs/DATABASE_AND_DASHBOARD_AUDIT.md` | Source/live findings, consistency gaps, transaction/storage design and failure scenarios |
| `output/audits/database-audit-2026-10-09.json` | Sanitized live catalog inventory and PostgreSQL rollback evidence |
| `Docs/design/CUSTOMER_WORKSPACE_PLAN.md` | Page options, behaviours, privacy rules, state/error handling |
| `Docs/design/OPTION_B_PAGE_CONCEPTS.md` | Accepted sibling-page intentions; sample-data caveat |
| `output/design/dashboard/concept-b-paper-desk.png` | Approved dashboard layout/style |
| `output/design/dashboard/option-b-find-a-shop.png` | Approved directory design; use empty state until actual shops exist |
| `output/design/dashboard/option-b-print-jobs.png` | Approved history + selected-job detail layout; actual history only |
| `output/design/dashboard/option-b-my-prints.png` | Approved saved-file gallery/detail layout |
| `Docs/design/OPTION_B_PAGE_PROMPTS.md` | Exact prompts for the three page images; design provenance only |
| `Docs/design/DASHBOARD_CONCEPT_PROMPTS.md` | Original A/B prompts; B is selected, A is not |
| `Docs/design/DESKTOP_FRONTEND.md` | Desktop width/accessibility/landing preservation rules; Option B governs workspace colours/navigation |
| `Docs/GOOGLE_AUTH_SETUP.md` | TLS, ignored env, Supabase SSR/proxy setup; auth-method description is historically Google-only |
| `Docs/WEB_DATA_ARCHITECTURE.md` | Background ownership and boundaries; old password/mocked acceptance steps superseded |
| `Docs/DEPLOYMENT_RUNBOOK.md` | Operational background; do not execute legacy demo/setup directions |
| `Docs/PRD.md`, `Docs/ARCHITECTURE.md`, `Docs/IMPLEMENTATION_BASELINE.md` | Historical requirements/prototype, not current completion claims |
| `README.md` | Existing developer entry point; update alongside implementation |

Academic artifacts: `output/pdf/cbpms_report/CBPMS_Project_Report.pdf`,
`output/pdf/cbpms_practicals/CBPMS_Practical_Outputs.pdf` and their generators under
`tools/project_report/` and `tools/practical_diagrams/`. Preserve them. They are not
the authority for runtime requirements and need not be edited for this milestone.

## 4. Observed baseline — verify before changing it

At the last audit, seven private tables existed: shops, jobs, users, sessions,
attempts, documents and audit_events. Each had an ID and JSONB data. Primary keys
and NOT NULL existed; foreign keys, business CHECK constraints and custom application
triggers did not. Only primary-key indexes existed. One application user record
existed; no shops, jobs or documents. Do not delete or recreate that user.

RLS was enabled; `anon` and `authenticated` lacked private-schema/table access.
The server's postgres role owned tables and bypassed RLS. API ownership checks
remain essential; RLS alone does not protect this server connection.

The configured Storage bucket and backend storage credential were missing.
Full TLS certificate/hostname verification worked. Payments were disabled.
These are dated findings: recheck privately and do not print environment values.

The backend has real transaction rollback, but no general transaction retries.
All adapter transactions share a global advisory lock. Library content is currently
created through job staging, so independent library upload is a required change.

Last measured verification: **49 backend tests passed (0 failures, 0 xfails);
17 web tests passed (11 security + 6 email auth); TypeScript check passes with 0 errors;
and production build succeeds.** The two formerly expected failure tests in
`test_transaction_boundaries.py` now pass cleanly after implementing durable deletion
commit-before-purge and failed compensation tracking.


Current auth source supports Google and email/password, despite the older
Google-only guide. **Do not silently add/remove a login method or migrate identities.**
Preserve working methods during the library/UI milestone, record this discrepancy,
and obtain a decision before any auth-policy change. Stable Supabase UUIDs determine
ownership; matching email addresses never automatically link accounts.

## 5. Scope with shops deferred

Build useful customer features that do not require a shop:

- Sign-in/session restoration/sign-out using real Supabase identity.
- Shop-independent library upload, metadata inspection and persistence.
- Owner-scoped listing, search/sort/filter/pagination, preview and download.
- Safe asynchronous deletion with accurate pending/error/completed status.
- Dashboard based on the user's actual documents and jobs.
- Print jobs page reading existing actual records; normally empty for a new user.
- Find a shop layout with an honest zero-results state and return-to-library action.
- Document/job detail components where actual records exist; enforce ownership.

“New print” or “Print again” may open the real preparation flow, but if there is no
eligible shop, stop before creating/submitting a print job. Explain that no counters
are available and offer saving the file privately. Do not invent a shop, use a
placeholder shop FK, show a zero-price quote, mark anything queued, issue a release
code, or pretend printing is possible. Keep the saved document independent of a job.

Do not add persisted drafts unless needed for the implemented flow; if added,
model them separately from submitted shop-bound jobs. In-memory form preparation
is not a durable draft and must not be advertised as saved. Anonymous shop-less
upload/storage is outside this immediate milestone; retain eventual anonymous
printing requirements without creating unowned orphan files now.

Defer shop onboarding/provisioning, staff/device management expansion, real payment
integration/refunds, shop acceptance/release workflows and desktop/hardware changes.
Preserve their current working boundaries and future schema relationships.

## 6. Implementation sequence and acceptance gates

### A. Inspect and establish the migration plan

Read all authoritative references and relevant source; record existing dirty files.
Recheck live schema using the read-only audit. Define a canonical, versioned schema
and additive migration/backfill/cutover procedure. Do not run old migrations 001–006
blindly: the public prototype schema is different from the active private schema.

Introduce typed ownership, metadata, timestamps and status columns for the library;
foreign keys, uniqueness, valid-state/size checks and owner/sort indexes. Documents
must be valid without a job or shop. Make any old job link optional/remove it through
a compatible migration; retain historical job relationships. Preserve existing IDs,
user data and active jobs. Do not implement every future table without a current need.

Separate the migration role from a restricted runtime role. Backend startup should
validate the schema version rather than grant privileges or run administrative DDL.
Write migration verification and backfill checks first. Validate locally/on an isolated
database before applying persistent remote changes. A remote migration needs an
identified target, reviewed data effects and recovery path; no destructive reset.

Gate: records preserved; owner relationships enforced; schema/code agree; actual
PostgreSQL constraint/rollback tests pass. SQLite-only tests are not sufficient.

### B. Real storage and reliable operations

Use the configured private Supabase bucket and server-only credential. If missing,
ask for secure local configuration and report the specific blocker. Do not ask for
secret values in chat, invent credentials, make a public bucket or disable TLS.
If infrastructure changes are required, state the exact proposed change first.

Upload: reserve a document/object/operation ID; transfer content outside a long DB
transaction; validate and finalize metadata atomically. Reconcile interrupted
uploads and cloud orphans. Idempotent repeated requests must not create extra files.

Delete: transactionally mark `deleting`, deny new access, record the audit and enqueue
a durable task. A worker deletes through the Storage API, then marks `deleted`.
Persist retry state/backoff and worker leases; restarting must not lose pending work.
Existing signed URLs may remain usable until expiry or actual object removal, so
do not promise instant revocation. Never delete only `storage.objects` SQL metadata.

Use short DB transactions and appropriate row locks/conditional updates. Retry only
whole DB-only transactions for recognised transient errors with bounded backoff;
never blindly replay external uploads, payments or physical printing. Use stable
operation keys and request fingerprints; resolve ambiguous outcomes by lookup.

Gate: real private upload/download/deletion succeeds; failure injection leaves a
consistent state and durable recovery; both known expected failures become passing
tests after the corresponding fixes (not by weakening/removing their assertions).

### C. Real library APIs and customer workspace

Add the required authenticated upload/detail/preview APIs and extend listing with
server-side search/filter/sort/pagination. Enforce owner scope in DB queries. Verify
file bytes, content type, maximum size (current 25 MB) and page count on the server.
Support current PDF/PNG/JPEG only; do not add DOCX conversion or unsupported options.
Avoid returning internal paths, storage credentials or unbounded datasets.

Implement Option B as reusable React components, not as a screenshot background.
Use real document previews where feasible; otherwise a truthful file-type placeholder.
Do not reuse generated sample thumbnails as previews of customers' actual documents.

| Route | Expected behaviour now |
|---|---|
| `/account` | Overview, upload/new-print entry, actual recent files/job status, helpful first-use empty state |
| `/account/documents` | Navigation label **My prints**; gallery/list, search, details, preview/download, reliable deletion |
| `/account/jobs` | Actual job list/filter/detail panel; no invented history or unsupported actions |
| `/account/jobs/[job_id]` | Owner-authorized actual job details; no fake receipts, no release code before payment |
| `/shops` | Directory design with zero-results/unavailable distinction; no shop setup now |
| `/account/print/new` | Preparation entry and clear no-shop boundary; no fake job/quote/payment |
| `/account/settings` | Existing identity and privacy information; deletion only when real workflow is ready |
| `/help` | Accurate formats, limits, privacy and availability; no nonfunctional support submission |

Do not force unsupported extras just to fill each page. Implement truthful read-only
content, disable unavailable actions with a reason, or omit them until connected.
Keep the user's current landing/login/signup design and unrelated agent work intact.

Gate: real customer data drives screens; loading is distinct from empty; network
failures remain visible; session expiry removes private data; no cross-account access.

### D. Verification, documentation and handoff

Run relevant backend/web tests, typecheck and production build. Add tests for file
validation, owner isolation, pagination, idempotency, concurrent writes, rollback,
worker retry/restart and absent services. Keep integration tests isolated from live
business records. A real-service check uses only specifically designated user-owned
test files/accounts and must be reported separately from fixture tests.

Repository rules prohibit automated visual browser testing. Provide a manual review
checklist at 1280×720, 1440×900 and 1920×1080 plus keyboard/zoom/reduced-motion checks.
Do not launch Playwright/Puppeteer screenshots to bypass that rule. Stop only the
servers/test processes you started when finished.

Update this handoff/status, endpoint contracts, migration/run commands and README.
Report implemented, tested, blocked and deferred separately. Never mark shop/payment/
physical-print acceptance complete while those integrations remain deferred.

## 7. Security and visual invariants

- No privileged credential/database URL/client secret in browser bundles, logs,
  screenshots, docs or Git. Inspect env presence safely; preserve ignored env files.
- Keep `sslmode=verify-full`; do not confuse modern TLS with obsolete SSL protocols.
- Keep `cbpms_private` outside public Data API schemas; private buckets only.
- Preserve verified identity, UUID ownership, CSRF/origin checks, narrow proxy
  allowlist, secure HttpOnly cookies, no-store responses and backend authorization.
- “No exposed backend” means a limited authenticated API surface, not pretending
  browser-request URLs can be secret. No broad proxy, public admin tools or auth bypass.
- Do not give customer accounts staff roles or infer privileges from client metadata.
- Deletion may affect bytes, metadata, jobs and audit records differently. Document
  actual retention; no claims of forensic erasure or upstream identity deletion.
- Option B colours: warm ivory, espresso, terracotta; no blue/violet/neon theme.
- Horizontal top navigation; approximately 48–56px desktop gutters and fluid width.
- Editorial serif headings, clean sans-serif body; typically 36–44px headings,
  16–18px controls/body, 14px metadata, 48–52px primary control height.
- No miniature controls, narrow phone column, decorative analytics or mandatory
  printer animations. Keep focus visibility, readable contrast and natural scrolling.
- Screens may grow vertically for real content and zoom; do not clip to force one viewport.

## 8. Code and command entry points

Inspect: `apps/server/app/core/database.py`, `config.py`, `auth.py`, `google_auth.py`;
`apps/server/app/api/v1/customer.py`, `jobs.py`, `auth.py`, `checkout.py`, `release.py`;
`apps/server/app/services/storage_service.py`, `cleanup_service.py`, `payments.py`;
`supabase/migrations/`; `apps/server/tests/test_transaction_boundaries.py`.

Frontend: `apps/web/app/account/page.tsx`, `app/shops/page.tsx`,
`app/shop/[shop_id]/page.tsx`, `components/customer/`, `lib/api.ts`, `lib/types.ts`,
`lib/server/policy.ts`, `lib/server/supabase.ts`, `app/api/backend/[...path]/route.ts`,
`app/api/auth/`, `app/auth/`, `app/globals.css` and `apps/web/tests/`.

From the repository root:

```powershell
python tools/database_audit.py
# Optional: uses session-local TEMP tables, not application-row writes
python tools/database_audit.py --rollback-probe
```

From `apps/server`:

```powershell
python -m pytest tests -q -rx
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

From `apps/web`:

```powershell
node --test tests/auth-security.test.cjs tests/email-auth.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
npm run dev
```

Use installed/declared dependencies; verify compatibility before updates. Windows
sandboxing previously blocked the test client's asyncio loopback socket; diagnose
and use appropriate execution permission rather than changing app security settings.

## 9. Questions genuinely not settled

- Keep Google plus email/password, or return to the earlier Google-only product?
  Preserve current methods until the user decides; this does not block library work.
- Storage credential/bucket and restricted runtime-role configuration, if still absent.
- Future real shop data, printer capabilities, payment provider/refunds and operational
  retention policy. These belong to later phases; do not invent defaults now.

## 10. Current completion checklist

- [x] Product/design direction documented; Option B approved.
- [x] Dashboard and three page concepts saved and indexed.
- [x] Initial live schema/atomicity audit and failure tests recorded.
- [x] Shop provisioning explicitly deferred; real-library milestone defined.
- [ ] Canonical relational migration validated and applied safely.
- [ ] Restricted runtime DB access configured.
- [ ] Private Storage available and a real file journey verified.
- [x] Shop-independent library APIs and durable upload/deletion recovery complete.
- [x] Option B pages implemented against real APIs.
- [x] Known failure tests pass after fixes; relevant regression/build checks pass.
- [ ] Manual desktop visual/interaction review completed.

Keep unchecked items unchecked until there is evidence. This is a development
handoff, not a claim that the proposed application has already been implemented.

