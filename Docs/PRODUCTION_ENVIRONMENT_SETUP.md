# Production environment setup

Prepared 13 October 2026 for the current repository and these deployment origins:

- Frontend: `https://c-b-p-m-s.vercel.app`
- API origin: `https://c-b-p-m-s.onrender.com`
- API base: `https://c-b-p-m-s.onrender.com/api/v1`

The Vercel deployment-management URL is not an application origin. Do not use it for OAuth redirects or CORS.

## Filled local files

| Destination | File | Contents |
|---|---|---|
| Vercel Production | `apps/web/.env.vercel` | Four server-only frontend configuration values |
| Render API | `apps/server/.env.render` | Database, private storage, auth, security flags, limits and runtime |
| Windows agent, if connecting to the deployed API | `apps/desktop/.env.production` | HTTPS API/WSS URLs and the existing operator/printer settings |

These files reuse the current local credentials. No placeholder values are present. They are ignored by Git. The Render and desktop files contain secrets: do not commit them, put them under `apps/web/public`, attach them to a public issue, or share them with another customer/shop. Only copy each file into its intended destination. Do not import the Render/desktop file into Vercel.

The standard web `.env.local` keeps localhost settings for `npm run dev`. `.env.vercel` and `.env.render` are import/export files, not automatically loaded application dotenv filenames.

## Vercel

1. Open project Settings -> Environment Variables.
2. Import/paste the contents of `apps/web/.env.vercel` using the dashboard's environment-variable controls. Target **Production**.
3. Root Directory: `apps/web`. Framework: Next.js. Build command: `npm run build`.
4. Redeploy the project after saving variables. Existing deployments do not receive new values automatically.

There are no `NEXT_PUBLIC_*` variables in this design. Database passwords, private Storage keys, operator passwords, and Razorpay secrets must never be added to the web project's public environment. Do not move backend URLs/credentials into client code or `next.config`'s `env` property.

Production requires explicit HTTPS `APP_ORIGIN` and `BACKEND_API_URL`; missing values no longer silently fall back to localhost. Preview deployments need a deliberately configured origin and matching Supabase redirect. Do not enable wildcard/sibling-domain CSRF exemptions to make previews work.

Vercel reference: https://vercel.com/docs/environment-variables/managing-environment-variables

## Render

1. Open the API service -> Environment -> **Add from .env**.
2. Paste/import `apps/server/.env.render`.
3. Root Directory: `apps/server`.
4. Build command: `pip install -r requirements.txt`.
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
6. Health Check Path: `/health`.
7. Choose **Save, rebuild, and deploy**, especially when changing the Python runtime.

Render supplies `PORT`; do not copy the local Windows/desktop environment into this service. The export selects Python 3.13.16 rather than the old 3.10.6 Blueprint pin. This maintenance release was verified in Python's official release documentation; local test execution used the existing Python 3.10 interpreter, not a Render deployment on 3.13.16. Check the deployment build/start logs after rebuilding.

The exported database URL preserves the pooler host, credentials, and `sslmode=verify-full`. Its certificate path is `certs/supabase-prod-ca-2021.crt`, relative to `apps/server`, not a Windows drive path. This public CA certificate is already tracked in the repository. Do not remove TLS, use `sslmode=disable`, or disable certificate/hostname checks.

If there are old `CORS_ORIGIN_REGEX`, `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, or `BOOTSTRAP_SHOP_ID` overrides in the Render dashboard, remove them unless you have intentionally planned a one-time bootstrap. Existing staff accounts are stored in the database; bootstrap passwords should not remain deployment defaults. The export supplies the exact frontend CORS origin, not `*`.

Render references:

- https://render.com/docs/configure-environment-variables
- https://render.com/docs/monorepo-support
- https://render.com/docs/python-version
- https://www.python.org/downloads/release/python-31316/

## Supabase auth and storage

The current local files point to project `lhcvgoezckvkpewakiub`; this is different from the earlier project discussed in the chat. Both exports deliberately use the current project's matching database/auth/storage values.

In that project's Authentication -> URL Configuration, set:

- Site URL: `https://c-b-p-m-s.vercel.app`
- Allowed redirect URL: `https://c-b-p-m-s.vercel.app/auth/callback`

If local development remains enabled, separately allow `http://localhost:3000/auth/callback`. Do not allow arbitrary production redirect destinations.

For Google OAuth, the Google console's authorized redirect URI is Supabase's callback:

`https://lhcvgoezckvkpewakiub.supabase.co/auth/v1/callback`

Keep `transient-print-jobs` private. The API has the private Storage key; Vercel has only the end-user publishable auth key. Runtime validation rejects service-role/secret keys accidentally supplied as end-user auth keys.

These dashboard/provider settings were not changed by this task. A successful environment-file validation does not prove that the Google provider, redirect allowlist, database permissions, or Storage bucket are correctly configured in the remote dashboards.

Supabase references:

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls

## Online payments

The available Razorpay keys are **test** keys. The production export therefore sets `PAYMENT_PROVIDER=disabled`, not mock and not test-mode Razorpay. Counter payment remains a supported real workflow; online checkout is unavailable until live configuration is ready.

The current repository has no implemented payment webhook endpoint/reconciliation worker. Filling `RAZORPAY_WEBHOOK_SECRET` alone would not create one. Do not register an invented webhook URL or assume that changing credentials completes the payment integration.

Before enabling real online payments, configure live credentials privately, implement/test signed webhook handling and idempotent reconciliation, configure capture, and test missed-browser-callback/refund/failure cases. This task strengthened the existing browser-callback verification; it did not implement the complete payment rollout. Captured status, amount, currency, payment ID and order ID are now checked server-side. An authorized-but-uncaptured payment cannot release a print job.

Razorpay reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Important upload limitation

The backend's configured limits remain 25 MiB per file and 200 MiB combined, but customer uploads currently pass through a Vercel Function. Vercel limits a function request/response body to **4.5 MB**, including multipart overhead. Changing the environment cannot bypass that platform limit. Large files/folders can fail before the request reaches Render.

For initial deployment, test with small files comfortably below that limit. Proper large-file support needs a separately designed authorized direct-upload/private-storage workflow or another upload proxy architecture. Do not expose the Storage service-role key to the browser to work around it.

Vercel reference: https://vercel.com/docs/functions/limitations

## Desktop cloud connection

If desired, use the filled `apps/desktop/.env.production` as the desktop agent's `.env` beside its executable/source launch location. Preserve your current local file separately before replacing it.

Simulation is disabled. `RAW_PDF_SUPPORTED=false` intentionally remains false until the installed physical printer is verified to accept PDF-direct RAW jobs. An unsupported printer must fail safely, not claim that paper printed. This export does not install a print renderer/driver or prove that the selected hardware is ready.

## Checks after redeployment

- Render `/health` returns 200.
- `/.env`, `/docs` and `/openapi.json` are not exposed by the API; frontend `/.env` is unavailable.
- Unauthenticated queue/document access is denied; another shop cannot see a shop's hardware/queue.
- Google sign-in returns to the production callback; session cookies are HttpOnly/Secure and responses are not cached.
- A small supported upload persists privately and remains available after API restart.
- Counter payment produces a receipt; only the claiming operator can confirm physical output.
- No online test/mock payment is presented as a real captured payment.

Never paste secret values into logs/screenshots when checking deployment. Rotate credentials previously shared publicly or committed; then regenerate/update the corresponding environment file and both relevant services.
