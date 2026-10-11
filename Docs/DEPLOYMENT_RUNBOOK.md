# CBPMS deployment and operations runbook

> Current implementation scope and reference precedence: [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md). Real shop/staff/printer provisioning is deferred. Use this runbook as operational background, not an instruction to activate every integration now.

Historical baseline runbook: authentication, environment configuration, proxy routing and demo/payment defaults below have been superseded by [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). Use that guide for current setup. Do not enable mocked payments or seed demo records in a real environment. Hosted-provider, payment-gateway and physical-printer validation are still required.

## Deployment shape

```text
Customer desktop website / Admin web (Vercel or local)
                │ HTTPS / WSS
                ▼
       FastAPI service (Render or local)
          │ server-only credentials
          ├── PostgreSQL / Supabase database
          └── private Supabase Storage bucket
                ▲
                │ HTTPS / WSS
       Windows desktop agent at each shop
```

The browser never receives a database URL, service-role key, storage credential, or unrestricted file URL. Each desktop agent is configured for exactly one shop and one operator account.

## Local verification deployment

1. Create separate Python environments for `apps/server` and `apps/desktop`.
2. Configure the ignored environment files using [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md). Normal operation requires PostgreSQL, a private Storage bucket, Google OAuth, and a TLS-verified database connection. Local SQLite/local-file storage are test-only.
3. Start the API from `apps/server`:

   ```powershell
   pip install -r requirements.txt
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

4. Start the web client from `apps/web`:

   ```powershell
   npm ci
   npm run dev
   ```

5. Open `/account` and use Google sign-in after enabling the provider. `/shops` lists real active shops; an empty directory is expected until one is provisioned.
6. Open `/admin/dashboard` with a separately provisioned staff account and verify that the queue appears only for the selected shop. Mock checkout is not available in normal operation.
7. Start the desktop agent with the operator credentials. Use `MOCK_PRINTING=true` for a demonstration without hardware. The default is fail-closed physical mode.

## Supabase / hosted database setup

1. Create a private PostgreSQL connection and a private Storage bucket named by `SUPABASE_STORAGE_BUCKET`.
2. For a fresh database, apply `006_google_identity_private_records.sql` directly and provision a private Storage bucket. The current API does not require the earlier public prototype schema. For an existing prototype database, review migration 004's legacy-policy closure before applying 006. Do not reintroduce the prototype's public-upload policy.
3. Treat the existing `public` prototype tables as legacy. The runtime authoritative records are created by the FastAPI service in the server-only `cbpms_private` schema.
4. Set:

   - `DATABASE_URL=postgresql+psycopg://...` using the Session pooler, port 5432, `sslmode=verify-full`, and the Supabase CA certificate.
   - `SUPABASE_URL`.
   - `SUPABASE_SERVICE_ROLE_KEY` only in the server environment.
   - `SUPABASE_STORAGE_BUCKET`.
   - `CORS_ORIGINS=[]`; browser API requests use the Next.js same-origin allowlisted proxy.
   - `PAYMENT_PROVIDER=disabled`, `ALLOW_MOCK_PAYMENTS=false`, `ALLOW_LOCAL_STORAGE=false`, and `SEED_DEMO_SHOPS=false`.

5. Do not put `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or operator passwords in the web environment. The web server environment contains only `APP_ORIGIN`, `BACKEND_API_URL`, `SUPABASE_URL`, and the publishable key; none is prefixed `NEXT_PUBLIC_`.
6. Use persistent PostgreSQL and Storage. A free or ephemeral application filesystem must not be used as the authoritative document store.

## Render backend and Vercel web

The included `apps/server/render.yaml` and `apps/server/Dockerfile` provide the backend shape. Configure all `sync: false` values in the hosting dashboard and set the backend health check to `/health`.

For the web deployment, set `APP_ORIGIN` to the exact HTTPS site origin and `BACKEND_API_URL` to the fixed backend `/api/v1` origin. Keep the backend restricted to the web service where possible. The desktop WebSocket URL must use `wss://` in hosted environments; the browser admin dashboard uses authenticated polling through the proxy.

After deployment, verify:

- `GET /health` returns `{"status":"healthy"}`.
- `GET /` reports the configured provider without claiming payment readiness.
- Google sign-in/callback works only after provider setup; anonymous staging is available only when private Storage and a real shop are configured.
- Account-linked documents are listed only for their owner.
- The shop queue does not expose checkout tokens, release codes, storage paths, or customer identifiers.
- A desktop agent can authenticate, receive a queue event, claim one job, download the hash-verified file, and report completion.

## Desktop shop registration

1. Create a shop operator through the admin API.
2. On the shop computer, set `SHOP_ID`, `CLOUD_API_URL`, and `CLOUD_WS_URL` in `apps/desktop/.env`.
3. Leave `OPERATOR_USERNAME` and `OPERATOR_PASSWORD` blank if credentials should be entered at startup. Do not commit them.
4. Set `SELECTED_PRINTER_NAME` only to an installed Windows printer.
5. Keep `RAW_PDF_SUPPORTED=false` unless the selected device is explicitly verified to accept PDF bytes directly. General PDF rendering, duplex, n-up, copy handling, and image printing require a rendering backend and must not be inferred from spool acceptance.
6. Keep `MOCK_PRINTING=false` for real operation. The agent will fail closed if native Windows printing is unavailable.
7. Keep the durable completion outbox under `LOCALAPPDATA\CBPMS\state`, separate from the temporary spool directory. If the API is unavailable after spooling, the agent retries only the completion callback and never reprints automatically.

## Backup and recovery

- Back up PostgreSQL according to the provider's encrypted backup policy.
- Back up or inventory the private Storage bucket according to the approved document-retention policy.
- Never restore the public prototype tables over the private runtime records without an explicit migration.
- After restoring the database, run the API cleanup sweep and inspect jobs in `processing`, `failed`, and `cleanup_pending` states.
- A `processing` job must be reconciled with the operator before any reprint because the printer may already have accepted it.
- Rotate service-role keys, bootstrap credentials, and operator credentials after a suspected disclosure.

## Rollback and incident controls

- Disable public traffic at the web/API layer if storage or authorization checks are not healthy.
- Keep `PAYMENT_PROVIDER=disabled` until a server-verified, idempotent live provider adapter has been implemented and tested. Adding credentials alone must not enable real payments.
- Preserve audit events and server logs during investigation.
- Do not delete a job record before its storage deletion is confirmed or a documented retention decision is made.
- If a customer reports the wrong shop received a document, immediately disable the affected operator account, inspect shop membership and audit events, and rotate credentials before resuming operations.

## Release gate

A release is acceptable for assignment/demo use only after backend, desktop, and web checks pass, the smoke test above is recorded, and the known limitations in `IMPLEMENTATION_BASELINE.md` are included in the report. Production claims require hosted database/storage, parser isolation, normalized migrations, real document rendering, operational monitoring, and an independently verified payment adapter.
