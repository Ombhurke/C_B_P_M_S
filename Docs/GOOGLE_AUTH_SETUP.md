# Google-only customer authentication

> Historical Google-only policy and verification record. Current source also includes Supabase email/password auth. Preserve current methods pending the decision recorded in [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md); do not silently change identity policy. TLS, secure-cookie and proxy guidance remains relevant. Shop provisioning is deferred, and old test counts are dated evidence.

This guide supersedes earlier password-registration, SQLite, demo-shop and mock-checkout instructions. Customer sign-in and sign-up are the same Google OAuth flow. Shop staff still use separately provisioned, shop-scoped credentials.

## Architecture and security boundary

Browser → Next.js same-origin route handlers → FastAPI → private PostgreSQL records.

- Google authorization uses the official Supabase SSR client with PKCE and a fixed callback URL. Tokens and the code verifier live in HttpOnly cookies; HTTPS deployments also set Secure. The browser receives only a safe profile, not customer access/refresh tokens.
- Next route handlers refresh cookies and propagate cache headers; no Supabase browser client or localStorage session is used. Session/profile/API responses are not shared-cacheable.
- FastAPI verifies customer bearer tokens with this project's HTTPS Supabase `/auth/v1/user` endpoint. Client-supplied roles are ignored. Google identities always map to `customer`, never `admin` or `operator`.
- Ownership uses the verified Supabase UUID. Old email-owned records and password sessions are not automatically linked or accepted. Preserve old data for an explicitly verified migration; matching an email is not enough.
- Mutating browser routes require an exact configured Origin. The backend proxy has a method/path allowlist, a bounded upload body, fixed destination and no automatic upstream redirects. Desktop claim/completion routes are not proxied.
- Backend authorization remains mandatory even with the proxy. Public shop discovery and OAuth initiation necessarily remain reachable. A hidden URL or CORS is not access control.
- Production does not seed demo shops, use local file storage, or confirm mock payments. Automated tests alone opt in to fixtures. A missing live payment provider returns unavailable and cannot mark a job paid.

## Supabase dashboard setup

1. Authentication → Providers → Google: enable it and enter the Google OAuth Web client ID/secret. Keep those credentials in Supabase, not in frontend code.
2. In Google Cloud, allow Supabase's callback: `https://lhcvgoezckvkpewakiub.supabase.co/auth/v1/callback`.
3. Supabase Authentication → URL Configuration: local Site URL `http://localhost:3000`; exact redirect allowlist entry `http://localhost:3000/auth/callback`. Add the exact HTTPS production callback when deploying; avoid wildcard production redirects.
4. Disable the email/password provider for a Google-only customer product. Review Google consent-screen publishing/test-user restrictions as appropriate.
5. Use `localhost` consistently, not a mix of `localhost` and `127.0.0.1` in the browser. Cookies and the configured Origin must match.

Reference: [Supabase Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google), [server-side clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client).

## Environment files

The real local values are in ignored `apps/web/.env.local` and `apps/server/.env`. Do not commit or print them.

Web: `APP_ORIGIN`, `BACKEND_API_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. None needs a `NEXT_PUBLIC_` prefix. Never put a database password or service-role key in the web environment.

Server: `DATABASE_URL` (SQLAlchemy `postgresql+psycopg` URL, password URL-encoded), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. The configured session pooler uses port 5432, not transaction-pooler port 6543.

For the database, retain `sslmode=verify-full`. The ignored local environment now points `sslrootcert` to `apps/server/certs/supabase-prod-ca-2021.crt` using its absolute path. This public certificate was retrieved from the URL in Supabase's official dashboard source; provenance is recorded in `apps/server/certs/README.md`. The session pooler successfully authenticated with certificate and hostname verification enabled. No operating-system trust settings were changed.

The historic `ssl` setting name refers to modern TLS in PostgreSQL, not obsolete SSLv3. Downloading a public CA certificate is separate from toggling Supabase's server-side enforcement setting. No dashboard enforcement setting was changed. See [PostgreSQL TLS support](https://www.postgresql.org/docs/16/libpq-ssl.html) and [Supabase connection verification](https://supabase.com/docs/guides/database/connecting-to-postgres).

For uploads, set `SUPABASE_SERVICE_ROLE_KEY` **only in the server environment**, and provision the private `transient-print-jobs` bucket. Do not paste privileged credentials into chat. Authentication can be configured without Storage, but uploads return 503 until Storage is ready. A configured public bucket is refused at startup.

`PAYMENT_PROVIDER=disabled`, `ALLOW_MOCK_PAYMENTS=false`, `ALLOW_LOCAL_STORAGE=false`, `SEED_DEMO_SHOPS=false`, `ENABLE_API_DOCS=false`, `CORS_ORIGINS=[]`. Leave bootstrap credentials empty until a real shop exists.

## Database and migration

For a fresh database, apply `006_google_identity_private_records.sql` directly; the earlier public prototype tables are not needed by the current backend. This migration was applied to the supplied empty Supabase database on 2026-10-08. All seven private tables have RLS enabled and both `anon` and `authenticated` roles lack schema access. No sample users, jobs or shops were inserted. If upgrading an existing prototype database, also review migration 004 to close legacy public policies, and preserve existing data. Provision Storage as a private bucket without the prototype's public-upload policy.

The existing SQLAlchemy record adapter remains intact; migration 006 is additive, creates missing private tables, revokes public/anon/authenticated access and enables RLS. Do not expose `cbpms_private` through the Supabase Data API. Backend startup ensures these private tables exist and applies the same access restrictions. For deployment, separate a migration role from a least-privilege runtime role; the provided postgres credential is an administrative bootstrap credential, not the desired long-term runtime role.

Account data deletion removes the current UUID's documents after active jobs finish and leaves a disabled UUID tombstone. It does not delete the upstream Supabase/Google identity. Staff/audit retention needs a documented production retention policy. Old email-owned library migration remains a manual, verified operation.

## Run and verify

The local database certificate and private tables are configured, and Google is enabled. Confirm the redirect settings described above, then use separate terminals:

```powershell
cd D:\DEKSTOP_\PROJECT\Cloud_Printing\C_B_P_M_S\apps\server
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
cd D:\DEKSTOP_\PROJECT\Cloud_Printing\C_B_P_M_S\apps\web
npm ci
npm run dev
```

Open `http://localhost:3000/account`. Continue with Google; reload the page to check restoration, then sign out. Try a different Google account and verify libraries remain separate. Rejected/cancelled OAuth should show an error, not a success screen. The directory at `/shops` lists actual active shops or an honest empty state.

```powershell
# In apps/server; fixture configuration cannot touch the production database
python -m pytest tests -q
# In apps/web
node --test tests/auth-security.test.cjs
npx tsc --noEmit --incremental false
npm run build
node tests/http-smoke.cjs
npm audit
```

Browser login requires human Google consent and is not replaced by fixture tests. The project prohibits automated visual browser testing. No live payment, document Storage upload, or physical printer success is claimed by these tests.

## Verification record (2026-10-07, database setup updated 2026-10-08)

- Backend: 41 tests passed, including forged tokens, role escalation, tenant isolation, stable UUID ownership, staff session separation, expiration, private-library deletion, and preservation of unmigrated local documents during production cleanup.
- Web: 11 security tests passed, including fixed OAuth redirect, CSRF, safe profile responses, HttpOnly/Secure cookie enforcement, verified identity and proxy allowlisting.
- TypeScript and production build passed on Next.js 15.5.27. HTTP smoke checks verified the real production routes, PKCE challenge, HttpOnly cookie, no-store session response, rejected cross-origin requests and disabled mock endpoint. Its temporary loopback server was stopped.
- Production npm audit: zero reported advisories after upgrading Next.js and compatible PostCSS/source-map dependencies. The full audit still reports seven development-tooling advisories (five high, two moderate); a Tailwind/build-tool upgrade needs a separate compatibility review. This is not a blanket security certification.
- Ignored real environment files are not tracked by Git. No backend origin/database/service-role settings were found in the generated client JavaScript check.
- Supabase Auth settings responded successfully to the publishable key; Google was confirmed enabled on 2026-10-08.
- A live PKCE authorization request returned HTTP 302 to `accounts.google.com` with the project's Supabase callback. The Google consent step was not followed; a real browser sign-in is still needed to verify the full callback and customer workspace flow.
- The supplied session pooler authenticated successfully after configuring Supabase's official public CA. Full TLS certificate and hostname verification passed. Migration 006 created the seven private application tables; RLS and denied browser-role schema access were verified.
- The backend started successfully against the real Supabase database: `/health` returned 200, `/api/v1/shops` returned an empty list, unauthenticated private-document access returned 401, and `/docs` returned 404. Startup and cleanup stopped normally after verification.
- Private Storage credentials, real shop provisioning, live payments and an actual Google-consent sign-in remain outstanding. Automated regression tests use isolated data. The only live database writes were private schema initialization and access restrictions; no account, shop or print-job data was inserted.

## Before public deployment

Use HTTPS and an exact `APP_ORIGIN`; make FastAPI private/restricted to the web service where practical and separately secure desktop connectivity. Keep secrets in the host secret manager. Add gateway request/body/concurrency limits, OAuth abuse monitoring and security log redaction (authorization codes, tokens, file contents and passwords must not be logged). Fix/audit outstanding dependencies; integration tests are not a guarantee of no vulnerabilities. Configure backups, retention, malware/parser isolation and a live server-verified payment adapter before accepting real jobs. Rotate the database password that was shared in chat, then update only the ignored/server-secret configuration.
