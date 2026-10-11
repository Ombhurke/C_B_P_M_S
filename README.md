# Cloud Based Print Management System (CBPMS)

> **Continuing development in another IDE?** Start with
> [the consolidated implementation handoff](Docs/IMPLEMENTATION_HANDOFF.md) and
> [the copy-paste IDE prompt](Docs/IDE_START_PROMPT.md). Approved design: Option B.
> Real print-shop provisioning is deferred; the current milestone is the real
> customer/private-library workspace. Historical demo/mock instructions are superseded.

Desktop customer website, a shop administration console, a FastAPI service, and a Windows counter agent.

The current frontend release targets desktop browsers (1280×720 and larger), not a mobile website or PWA. Page layouts use fluid desktop-width content areas; narrower-window reflow remains for accessibility. See [the desktop design baseline](Docs/design/DESKTOP_FRONTEND.md).

Customer authentication uses Supabase with server-managed cookies. Current source supports Google and email/password; the final provider-policy decision is noted in the handoff. PostgreSQL and private Storage are required for normal operation. Runtime demo fallbacks found in the latest audit must be removed during implementation; no simulated payment or print success is permitted. Live checkout remains disabled until a real provider is integrated. Use [the authentication and environment guide](Docs/GOOGLE_AUTH_SETUP.md) for technical setup, with the handoff's newer scope and status corrections.

## Local setup

Use separate Python virtual environments for the server and desktop. Run each application from its own directory so its configuration file is loaded correctly.

1. Configure Google OAuth, a TLS-verified PostgreSQL connection, and the server environment using [GOOGLE_AUTH_SETUP.md](Docs/GOOGLE_AUTH_SETUP.md). Install `apps/server/requirements.txt`, then run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from `apps/server`.
2. In `apps/web`, copy `.env.example` to `.env.local`. Run `npm ci`, then `npm run dev`.
3. Visit `http://localhost:3000/account` for Google sign-in and `/shops` for real participating shops. The directory is empty until an actual shop is provisioned. Private Storage must be configured before uploads work.
4. Visit `http://localhost:3000/admin/dashboard` for the shop console. Staff accounts must be provisioned for a real shop. Customer Google accounts never grant staff access. Backend `/docs` is disabled by default.
5. In `apps/desktop`, copy `.env.example` to `.env`, install `requirements.txt`, and run `python main.py`. Enter the operator credentials when prompted.
6. Shop/desktop provisioning is deferred for the current milestone. Do not enable simulated printing or create demo counters. Use the customer library with real private Storage and display empty shop/job states where appropriate.

SQLite and local document files are available only to isolated automated tests, not normal operation. Do not use an ephemeral hosting filesystem for persistent data.

## Supabase deployment

Configure `DATABASE_URL` with a server-only PostgreSQL connection URL (`postgresql+psycopg://...`, TLS required for hosted connections), and configure `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for Storage. The anon key is not a server database credential.

For a fresh database, apply `006_google_identity_private_records.sql` directly and provision a private Storage bucket separately. Existing prototype databases also need migration 004's legacy-policy review. Original `public` tables and email-owned data are preserved, not automatically linked to Google identities. Never expose `cbpms_private` in PostgREST. Browser requests use Next.js's same-origin allowlisted proxy; keep backend CORS empty and use HTTPS/WSS for deployed services.

The supplied Supabase database connection has been verified with TLS certificate and hostname checks, and its private application schema has been initialized. Private Storage, real Google-consent sign-in, live payments and physical printing still need their configuration and end-to-end verification.

The customer identity, privacy-mode, document-library, and API ownership rules are documented in [Docs/WEB_DATA_ARCHITECTURE.md](Docs/WEB_DATA_ARCHITECTURE.md).

For hosted deployment, environment setup, migration order, smoke tests, backups, and desktop registration, follow [Docs/DEPLOYMENT_RUNBOOK.md](Docs/DEPLOYMENT_RUNBOOK.md).

## Verification

From `apps/server`: `python -B -m pytest -p no:cacheprovider tests -q`

From `apps/desktop`: `python -B -m pytest -p no:cacheprovider tests -q`

From `apps/web`: `npm run build` or `node node_modules/typescript/bin/tsc --noEmit --incremental false`

Tests use temporary SQLite databases and generated PDFs, never a real payment gateway or physical printer.

## Current boundaries

- PDF, PNG, and JPG uploads are validated on the server. Export DOCX to PDF before uploading.
- Checkout amounts come from verified pages and a saved price; repeat confirmation preserves the same receipt and release code.
- Operator/admin sessions are required for queues, release, completion, WebSockets and configuration changes.
- Printing failure retains the cloud document for retry until expiry. Successful spooling requests deletion; unsuccessful deletion remains pending and is retried.
- OS spool acceptance does not prove physical paper output. RAW printing is restricted and requires explicit configuration of a PDF-direct printer; arbitrary PDF rendering, duplex, copies, n-up and image printing still need a proper rendering backend.
- File deletion does not guarantee physical erasure from SSDs, backups, the OS spooler, or printer storage.
