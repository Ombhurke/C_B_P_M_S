# Copy-paste prompt for the implementation IDE

Paste everything below into the IDE that has this repository open. It must read the referenced plan fully; this is an implementation instruction, not a request for another high-level plan.

---

You are implementing a security-sensitive production upload milestone in my existing Cloud Based Print Management System (CBPMS). Work on the current repository, preserve my existing changes, and complete the scoped functionality with tests and documentation. Do not rebuild the project from scratch or redesign its UI.

## Mandatory authority and reading

First read `Docs/CLAUDE.md` completely, then `Docs/SECURE_UPLOAD_IMPLEMENTATION_PLAN.md` completely, including every stage gate, acceptance test, and provider limitation. Follow that plan as the authority for this milestone. Then read the baseline files and existing documentation it lists. Do not skim only headings or start coding from this prompt alone.

The plan was prepared on 13 October 2026 from local source inspection. Recheck current code and installed dependency versions; files may have changed since then. Read `git status` and relevant diffs before editing. Existing uncommitted changes belong to the user. Do not reset, overwrite, delete, stage, commit, or push them. Do not run production migrations, change cloud settings, upload test data to production, or deploy without my explicit permission. Prepare versioned migrations and exact deployment steps instead.

Google sign-in is already fixed and works after deployment. Do not change OAuth redirects, Supabase auth settings, Google credentials, session storage, or the login design. Regression-test it without substituting fake production login. The actual frontend is `https://c-b-p-m-s.vercel.app`, and the API is `https://c-b-p-m-s.onrender.com`. Read the current Supabase identity from existing configuration; historical project URLs/passwords are not authoritative. Never print secret env contents.

## Browse before implementation: required, not optional

Use your websearch/browser now to read current official Vercel, Supabase Storage/Auth/Cron/Edge Function, PostgreSQL, upload-library, and OWASP sources linked in the master plan. Record URLs, check date, installed versions, and your selected design in `Docs/reviews/UPLOAD_PROVIDER_RESEARCH.md`. Search snippets or your training memory are insufficient for SDK methods and security claims. Verify releases before adding/changing dependencies, but do not perform unrelated upgrades.

Specifically verify these dangerous-to-get-wrong facts:

1. Vercel's 4.5 MB cap is the complete Function payload, not an individual-file setting. Application configuration cannot raise it.
2. Supabase standard signed upload grants currently last two hours and are bearer capabilities requiring no further authentication. They are not documented as single-use or immediately revocable.
3. Supabase TUS upload-resource lifetime can differ from signing-token lifetime. Verify the consequences for late completion after cancellation/expiry, the direct Storage hostname, required chunk sizing, and signed-token support.
4. A private bucket plus a privileged signed grant does not automatically enforce my per-user quota, exact declared bytes, or revocation.
5. SQL deletion from Storage metadata does not delete the actual binary. Use the Storage API.
6. SQL rollback does not undo external Storage operations. Use durable intent/tasks and retry-safe reconciliation.

Do not copy `upsert: true`, broad public/authenticated INSERT policies, browser service-role credentials, localStorage auth tokens, or permissive CORS from examples. Tutorials are examples, not my security policy.

## What to build

Build the master plan's stages A through F in order, completing and testing each prerequisite before moving on:

- One direct-to-private-Storage flow for ALL upload sizes. Small files use standard transfer; large eligible files use resumable transfer. Both share backend authorization, persistent admission, quota reservations, validation, and cleanup. No document bytes go through Vercel, no Base64 alternative, and no separate small-file bypass.
- Verified customer accounts for library storage and initially large files. Keep no-account walk-in printing using real server-verified CAPTCHA, hashed guest capabilities, smaller limits, and temporary-only access. A signed-in customer can deliberately choose anonymous privacy mode.
- 100,000,000-byte current customer storage cap and separate 100,000,000-byte UTC-day admission cap. Deleting frees confirmed active storage but never refunds today's consumed admission. Use stable user UUIDs, durable ledgers, transactional reservations, idempotency and concurrency controls. Other concrete defaults and their status are in the plan.
- Real enforced upload ceilings BEFORE issuing a grant. Do not trust declared bytes or a browser callback. Reserve the provider-enforced exposure, include pending/abandoned uploads, and resolve token replay and deleted-path recreation. A finalization-only quota check is unacceptable.
- Individually uploaded folder files with bounded concurrency and one manifest/privacy mode. All required files validate before batch publication/job creation. Preserve the current merged-PDF desktop contract, deterministic order, server pricing, and bounded derived-output capacity.
- Three-hour temporary privacy expiry, early cleanup after confirmed completion, independent scheduled Storage-API deletion, bounded processing leases, durable retries and orphan/reappearance reconciliation. Permanent account libraries must survive guest cleanup. Do not promise instant revocation or guaranteed physical deletion during provider outages.
- Readable policy/usage/progress/failure UI using the existing desktop-first warm minimal theme. No unrelated page redesign, synthetic data, fake success, mock production provider, or revived demo fallback.

Preserve shop isolation, operator claims, backend route allowlists, CSRF controls, HTTP-only auth, database TLS verification, existing pricing and payment behavior, and desktop compatibility. Do not enable online/live payments or add staff-management features.

## Security gate: no improvising around missing capabilities

Before shipping direct grants, write and test `Docs/decisions/UPLOAD_ADMISSION_AND_GRANT_LIFECYCLE.md` as required by the plan. Address enforceable size ceilings, admission exposure, canonical-object immutability, expired/cancelled permissions, late TUS completion, and write-after-delete. If the provider cannot enforce the agreed behavior, stop that feature and explain the precise conflict and minimum additional choice needed. Never weaken security to make a demo pass. Missing CAPTCHA/scheduler credentials are missing configuration, not permission to bypass checks.

Do not expose the private database schema or create a browser-writable quota endpoint. Backend endpoints can be discovered; security must come from authentication, authorization, restricted capabilities, limits, and monitoring, not hiding their URLs. A Supabase URL/publishable key is not a privileged secret; service/secret keys are. Keep account tokens server-side, and only return narrowly scoped upload capabilities as specified.

Do not hold DB transactions while doing external network calls, parsing, uploading, or deleting. Use atomic SQL transitions and idempotent task/outbox processing. Avoid unbounded full-table scans for every admission and unbounded full-bucket scans every sweep. New relational tables must coexist with the actual `cbpms_private` JSON-record model; do not implement against obsolete public-schema diagrams.

## Verification and finish criteria

Run existing backend, frontend security/type/build/customer-flow/HTTP-smoke, and desktop regressions with the correct working directories/interpreter. Add every focused adversarial and concurrency test from the master plan. Test PostgreSQL with real concurrent connections; do not claim SQLite tests prove PostgreSQL atomicity. Test real provider boundaries in disposable/local or approved staging environments, not customer production data. Test fixtures are fine in tests only.

No automated visual browser/Playwright/Puppeteer checks, per repository instructions. Give me a manual UI checklist. Stop every server/process you start. Do not claim a command passed unless you actually ran it successfully. Report test failures and limitations; don't replace failing checks with stubbed success.

Deliver the research/decision/API/policy/deployment/acceptance documents specified in the plan. Update nonsecret environment examples and document exactly which secret/config values I must provide and where, without leaking existing credentials. Include additive migration order, private-bucket policies, scheduler installation, backfill dry-run, monitored rollout, and rollback that preserves pending cleanup work.

Your final response must separate implemented code, passing tests, provider behavior verified, infrastructure prepared but NOT applied, blocked setup, and my remaining actions. It must cite actual file paths and commands/results. Do not call this complete or production-ready if scheduler, CAPTCHA, safe grant lifecycle, real integration, or required acceptance gates are missing.

Begin with a concise code/research inventory and staged checklist; then implement. Ask only for missing secrets, necessary infrastructure approval, or a material ambiguity not resolved by the explicit defaults/plan. Continue safe in-scope work while waiting. Do not ask me to restate requirements already written here.
