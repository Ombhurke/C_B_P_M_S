# Deployment security review

Date: 13 October 2026. Scope: tracked application source, local environment boundaries, browser assets, API data exposure and deployment configuration. This is a targeted hardening pass, not a penetration-test certification or a statement that the entire product is market-ready.

## Confirmed findings and changes

1. Removed a real, hardcoded staff email/default roster from the operator frontend. The UI uses the authenticated operator identity and loaded team records. The password form is cleared after successful staff sign-in.
2. Production frontend configuration must be explicit HTTPS. Local development fallbacks remain development-only. Removed the Host-based loopback CSRF exception and made malformed referers fail closed.
3. End-user auth clients reject secret/service-role keys. Server configuration rejects production wildcard CORS, demo/local-storage/mock flags and enabled API docs. No private key was added to client/public configuration.
4. Operator job detail no longer returns the whole storage record. It excludes release PINs, checkout/download hashes, paths, storage keys, payment order objects, owner identities and unexpected future fields.
5. Public shop discovery returns prices/capabilities without internal printer/station arrays. Detailed hardware access requires same-shop staff authorization. Existing operator callers carrying a validated token still receive their own shop's management data.
6. Razorpay verification now requires captured status, captured flag, exact amount, currency, payment ID and job-bound order ID. The previous unconditional live `verify_capture` shortcut is rejected. External gateway error bodies/network details are no longer echoed to callers. Production refuses test keys.
7. Removed browser mock-payment confirmation code. Test-only backend payment fixtures remain test-only and the proxy does not expose their confirmation route. Production online payments are disabled in the export because only test credentials are available and webhook/reconciliation is not implemented.
8. Confirmation/problem/rejection transitions cannot override another operator's active claim. Completion commits its status, audit and cleanup intent before deleting bytes; a pre-commit failure no longer deletes a document while rolling back its record. Failed cleanup metadata reconciliation retains durable retry intent.
9. Customer and folder uploads read a bounded per-file amount before loading data into application memory, rather than reading each whole file before checking its size. This is not a substitute for edge request throttling, parser isolation or malware scanning.
10. Removed default demo shop/printer configuration from the desktop settings/example. Disabled simulation in the existing local desktop environment and the separate cloud-connected export.
11. Expanded Git ignore protection for environment variants. Created separate, filled, untracked Vercel/Render/desktop exports. Render's database URL retains full TLS verification and uses the bundled CA instead of a Windows path. The runtime Blueprint/export no longer pins Python 3.10.6.
12. Desktop API credentials require HTTPS outside loopback; credential-bearing/query-bearing destinations are rejected, TLS hostnames are preserved, and login/API requests do not automatically follow redirects carrying credentials.

## Hardcoded values that are not secrets

- Same-origin `/api/backend` is the intentional browser proxy path. The actual API destination is server-only.
- Razorpay's official checkout-script/API URLs identify a vendor, not credentials. Its public key ID is expected by checkout; its secret is never sent to the browser.
- Route allowlists, TTLs, protocol constraints and business defaults are explicit code/config contracts, not automatically security leaks.
- Localhost defaults remain only in the frontend's development configuration paths. Desktop loopback URLs are local development configuration; its production export uses HTTPS/WSS.
- The Supabase CA is a public certificate, not a private key.

A public Render URL cannot be made secret merely by hiding it from JavaScript. Security depends on authorization, capabilities, rate limits, private storage and TLS, not an undiscoverable route name. Some routes are intentionally public: shop discovery, cost calculation, anonymous staging and authenticated-provider initiation.

## Validation

- Environment exports were parsed and compared privately with their local sources. Database password, auth keys, private storage key and operator password were preserved; no values were printed in the chat.
- The exports contain no placeholders and are ignored by Git. Vercel's file contains no database, operator or Storage service-role credential.
- Current-secret scans before and after the frontend build: no matches among 330 tracked/public/browser-asset paths. Credential dotenv files were not tracked in Git history for their current standard paths. The current private Storage key's service-role/project claims and the database/auth project match were also checked offline.
- Frontend security suite: 13 passed. TypeScript check and production build passed. HTTP-only smoke checks passed and stopped their own server; no visual browser automation was performed.
- Backend suite: 86 passed, including claim ownership, failed-completion file preservation and upload bounds. Python tests were run with third-party plugin autoload disabled; the resulting `asyncio_mode` configuration warning is not a test failure.
- Desktop suite: 34 passed with a clean process exit on the final verification run. An earlier Windows runner teardown exited abnormally after reporting success; the clean rerun confirmed the final result.
- npm production dependency audit reported zero known vulnerabilities at audit time. This does not audit all Python dependencies or prove that dependencies have no unknown vulnerabilities.

## Running deployment checks

Read-only status checks against the provided deployment URLs found:

| Check | Observed result |
|---|---|
| Frontend home | 200 |
| Frontend `/.env` | 404 |
| Render `/health` | 200 on retry after initial timeout |
| Render `/.env` | 404 on retry |
| Render `/docs` | 404 |
| Render `/openapi.json` | 404 |
| Unauthenticated shop queue | 401 |

Response bodies containing data/secrets were not printed. These checks concern the previously deployed revision. Source changes and environment exports are local; platform settings/redeployment were not performed.

## Outstanding release work

See `Docs/PRODUCTION_ENVIRONMENT_SETUP.md` for exact import steps and auth callback URLs. Remaining requirements include provider/dashboard configuration, real online-payment webhook/reconciliation, large uploads that bypass Vercel's 4.5 MB function payload ceiling securely, parser/malware isolation, edge abuse controls, dependency/runtime validation on Render, and physical printer acceptance/restart testing. Previously identified desktop workflow issues must be assessed against the current implementation; this pass is not a full desktop redesign.

The source/environment hardening above does not justify declaring the product fully secure or market-ready. No live database records, real payments, provider settings or printer output were changed in this task.
