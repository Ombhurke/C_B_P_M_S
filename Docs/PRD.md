# Product Requirements Document (PRD)
> Historical product targets. [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) is the current implementation brief. Mocked checkout descriptions below are superseded: runtime simulations are prohibited, live payments remain disabled, Option B is selected, and shop provisioning is deferred. Timing, physical printing and secure-erasure targets are not verified guarantees.
## Project Name: Cloud Based Print Management System (CBPMS)

---

## 1. Executive Summary & Core Value Proposition
Traditional retail print shops, university copy centers, and document hubs rely heavily on insecure, unmanaged communication channels (WhatsApp, email) to receive customer files. This workflow exposes customer Personally Identifiable Information (PII) like phone numbers and email addresses, leaves permanent unencrypted document files on store PCs, and creates severe counter bottlenecks as operators manually configure print parameters.

The **Cloud Based Print Management System (CBPMS)** addresses these problems with a privacy-first, multi-tenant print management platform. Customers open a chosen shop in a desktop browser, upload documents, configure print options, complete mocked checkout, and receive a release barcode and PIN. Store operators use the Windows counter agent to release jobs to local printers. Anonymous files are temporary; account-linked documents can remain in a private customer library.

### Product decision addendum

The current implementation preserves the anonymous walk-in flow while adding an optional customer account mode. Customers choose the mode per complete print job. Anonymous jobs remain ephemeral and capability-token protected; account-linked jobs are retained in a private customer library until deletion. This addendum supersedes the original accountless-only assumption for the web-first release while retaining the privacy-first default.

**Desktop release decision (2026-10-07):** The website is designed and accepted for desktop browsers, with 1280×720 and larger as the primary validation range. This supersedes the earlier mobile-web/PWA-first direction. Landing sections fill a desktop viewport when content fits, and shared page layouts use fluid width with modest edge gutters. At high browser zoom or short window heights, content may grow vertically rather than be clipped. Mobile/PWA delivery is not part of this release. Existing QR links are retained as an optional entry method, not a requirement to use a phone.

---

## 2. Target User Personas
* **Customer (Desktop Website User):** Needs to upload, configure, and submit documents from a desktop browser, with optional accounts and an anonymous mode for temporary jobs.
* **Shop Operator (Desktop Agent User):** Manages a high-volume counter, often using legacy Windows PCs with limited memory. Needs to eliminate manual print configuration dialogs and process incoming walk-in queues rapidly.
* **System Administrator (Cloud Web Console):** Configures multi-tenant shop profiles, sets regional per-page pricing structures, and monitors system health and revenue metrics.

---

## 3. Scope of Work & Feature Set

### 3.1 In-Scope Features (MVP)
* **FR1: Shop Selection & Store Context Binding:** Opening a shop link routes the customer to `app.domain.com/shop/[shop_id]`, pre-loading the store's profile, supported options, and pricing. The existing counter QR is an optional link to the same route.
* **FR2: Document Ingestion & Validation:** Accepts compiled document formats (`.pdf`, `.docx`) and image containers (`.jpg`, `.png`). Enforces a 25MB file-size ceiling and client-side page-count extraction.
* **FR3: Interactive Print Configuration:** Customers configure color depth (Monochrome vs. Color), duplex mode (Simplex, Long-Edge, Short-Edge), copy count, and page scaling (1-up, 2-up, 4-up) before payment.
* **FR4: Upfront Payment Gateway Firewall:** Real-time price calculation based on configured pages and rates. The file is held in a pre-ingestion staging state until payment confirmation is validated via webhooks.
* **FR5: Cryptographic Token & 2D Barcode Generation:** Upon verified payment, the backend allocates an encrypted Supabase storage blob and issues a 4-digit numeric code and high-density 2D barcode to the client's screen.
* **FR6: Hardware-Assisted Counter Release:** Shop operators scan the customer's release barcode via a USB scanner (or manually enter the PIN) on the desktop agent to request printing through the operating system print subsystem.
* **FR7: Ephemeral File Deletion Engine:** Immediate physical file unlinking and memory shredding on the desktop terminal the moment the printer driver acknowledges job spooling, accompanied by an API callback that deletes the file from Supabase Storage. Unclaimed jobs automatically expire and purge after 2 hours.
* **FR8: Real-Time Live Queue Dashboard:** The desktop client displays a chronological, live-updating list of paid print jobs over WebSockets with estimated queue wait times.

### 3.2 Out-of-Scope (Strict Boundaries)
* **Mobile/PWA Release & Native App Binaries:** The current release is a desktop-browser website. A mobile website, installable PWA, and native iOS/Android applications are not current deliverables.
* **Long-Term File Archiving:** CBPMS is strictly a transit tool, not a cloud drive. Persistent document storage is prohibited.
* **Uncompiled / Hazardous Formats:** Executables (`.exe`), archives (`.zip`, `.rar`), or raw script files (`.py`, `.js`) will not be supported or processed.
* **Direct Printer Hardware Manufacturing / Driver Firmware:** CBPMS interfaces with standard OS printer drivers via standard APIs; it does not replace printer drivers.

---

## 4. Non-Functional Requirements
* **Performance:** Real-time queue event propagation over WebSockets must maintain sub-500ms latency. Counter release from barcode scan to printer spooling must complete within 1.5 seconds.
* **Hardware Resource Footprint:** The desktop agent memory footprint must stay below 100MB RAM to ensure stability on low-spec shop PCs (e.g., Intel Core i3 / 4GB RAM).
* **Security & Privacy:** Zero-PII retention. Customer sessions require no name, phone number, or email. All data in transit is encrypted using TLS 1.3, and files at rest are encrypted via AES-256.
* **Reliability:** 99.9% uptime for cloud API endpoints during standard commercial operating hours. Rate-limiting locks verification consoles for 300 seconds after 3 consecutive invalid release token attempts.
