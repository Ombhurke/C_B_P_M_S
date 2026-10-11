# CBPMS web and data architecture

> Read [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) first. The ownership concepts below remain useful, but the legacy customer password endpoints and mocked-checkout acceptance steps are superseded. The current milestone requires real shop-independent library storage; shop provisioning is deferred.

## Purpose

This document defines the first customer-facing release: a desktop-browser website backed by the FastAPI service, private storage, and durable records. As of 2026-10-07, desktop is the supported frontend target; a mobile website, installable PWA, and native Android/iOS clients are outside the current release scope. Narrow-window reflow remains for accessibility and does not change that product direction. API, identity, payment, and storage contracts remain unchanged.

## Identity and privacy modes

Customer accounts are optional. A customer chooses one mode for each complete print job:

- **Anonymous:** no account is required. The checkout capability token is the only customer status credential. The document is visible to the selected shop only after successful checkout and is deleted after successful printing or expiry.
- **Account-linked:** the customer signs in or registers. The document belongs to that account, appears in the private library, and remains available until the customer deletes it. The selected shop still receives only the job assigned to it.

An account does not force every future job to be account-linked. A signed-in customer can still choose anonymous mode for a sensitive document.

## Trust boundaries

1. The browser is untrusted and never determines page count, price, payment success, shop visibility, or job transitions.
2. FastAPI is the business authority. It validates files, calculates and freezes prices, issues capabilities, checks ownership, and controls state transitions.
3. The database stores users, shops, jobs, documents, sessions, and audit events. Customer and operator records use the same server-only transaction layer but different roles.
4. Storage is private. A shop receives a short-lived download grant only after it claims its own paid job.
5. The desktop agent is a shop-scoped worker. It cannot browse storage or another shop's jobs.

## Main records

| Record | Ownership | Retention | Purpose |
|---|---|---|---|
| `users` | Customer or shop | Until deletion/deactivation | Hashed credentials and role |
| `documents` | Customer or anonymous job | Library or job TTL | File metadata and private storage pointer |
| `jobs` | Selected shop plus optional customer | Operational history | Configuration, price, payment and print state |
| `sessions` | User | Session TTL | Hashed bearer session |
| `audit_events` | Server | Operational policy | Security-relevant actions |

The current small-project adapter stores JSON records behind a transaction interface. It can later migrate to indexed relational columns without changing these ownership rules or API contracts.

## Customer API contract

- `POST /api/v1/auth/register` creates a customer account and returns a session.
- `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, and `POST /api/v1/auth/logout` manage sessions.
- `POST /api/v1/jobs/stage` accepts `access_mode=anonymous|account`; account mode requires a customer bearer token.
- `GET /api/v1/jobs/{job_id}/status` accepts either the anonymous checkout token or the owning customer session.
- `GET /api/v1/customer/documents` lists only the authenticated customer's library.
- `GET /api/v1/customer/documents/{id}/download` returns content only to the owner.
- `DELETE /api/v1/customer/documents/{id}` deletes owner content when it is not attached to an active print job.
- `GET /api/v1/customer/jobs` lists only account-linked jobs for the authenticated customer.

The existing payment and shop queue APIs remain server-authoritative. Shop queue responses contain operational metadata but no checkout token, release PIN, storage path, or customer account identifier.

## Acceptance boundary

The web slice is ready when a customer can register, select a privacy mode, upload a validated file, complete the mocked checkout, see the resulting job, and—when using account mode—later see and delete the document from the private library. Two customer accounts and two shops must not be able to cross-read documents or jobs.
