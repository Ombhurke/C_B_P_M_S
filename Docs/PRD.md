# Product Requirements Document (PRD)
## Project Name: Cloud Based Print Management System (CBPMS)

---

## 1. Executive Summary & Core Value Proposition
Traditional retail print shops, university copy centers, and document hubs rely heavily on insecure, unmanaged communication channels (WhatsApp, email) to receive customer files. This workflow exposes customer Personally Identifiable Information (PII) like phone numbers and email addresses, leaves permanent unencrypted document files on store PCs, and creates severe counter bottlenecks as operators manually configure print parameters.

The **Cloud Based Print Management System (CBPMS)** solves these problems with an automated, privacy-first, multi-tenant print management ecosystem. Customers scan a counter QR code, configure layout options on a zero-install mobile web portal, pay upfront via digital payments, and receive a secure 2D release barcode and 4-digit code. Store operators scan this code using a standard USB barcode reader to release the print job directly to local printers. Files are purged from cloud storage and local memory immediately after printing.

---

## 2. Target User Personas
* **Walk-in Customer (Mobile Web User):** Needs to print 1–50 pages quickly without registering an account, installing a native mobile app, or sharing personal contact details.
* **Shop Operator (Desktop Agent User):** Manages a high-volume counter, often using legacy Windows PCs with limited memory. Needs to eliminate manual print configuration dialogs and process incoming walk-in queues rapidly.
* **System Administrator (Cloud Web Console):** Configures multi-tenant shop profiles, sets regional per-page pricing structures, and monitors system health and revenue metrics.

---

## 3. Scope of Work & Feature Set

### 3.1 In-Scope Features (MVP)
* **FR1: QR Session Initialization & Store Context Binding:** Scanning a static counter QR code routes the customer directly to `app.domain.com/shop/[shop_id]`, pre-loading the store's profile, supported paper sizes, and pricing matrix.
* **FR2: Document Ingestion & Validation:** Accepts compiled document formats (`.pdf`, `.docx`) and image containers (`.jpg`, `.png`). Enforces a 25MB file-size ceiling and client-side page-count extraction.
* **FR3: Interactive Print Configuration:** Customers configure color depth (Monochrome vs. Color), duplex mode (Simplex, Long-Edge, Short-Edge), copy count, and page scaling (1-up, 2-up, 4-up) before payment.
* **FR4: Upfront Payment Gateway Firewall:** Real-time price calculation based on configured pages and rates. The file is held in a pre-ingestion staging state until payment confirmation is validated via webhooks.
* **FR5: Cryptographic Token & 2D Barcode Generation:** Upon verified payment, the backend allocates an encrypted Supabase storage blob and issues a 4-digit numeric code and high-density 2D barcode to the client's screen.
* **FR6: Hardware-Assisted Counter Release:** Shop operators scan the customer's mobile barcode via a USB scanner (or manually enter the 4-digit code) on the desktop background agent, triggering instant spooling to the operating system print subsystem.
* **FR7: Ephemeral File Deletion Engine:** Immediate physical file unlinking and memory shredding on the desktop terminal the moment the printer driver acknowledges job spooling, accompanied by an API callback that deletes the file from Supabase Storage. Unclaimed jobs automatically expire and purge after 2 hours.
* **FR8: Real-Time Live Queue Dashboard:** The desktop client displays a chronological, live-updating list of paid print jobs over WebSockets with estimated queue wait times.

### 3.2 Out-of-Scope (Strict Boundaries)
* **Native App Store Binaries:** No native iOS (App Store) or Android (Play Store) applications. The client interface is exclusively a mobile web app to eliminate user onboarding friction.
* **Long-Term File Archiving:** CBPMS is strictly a transit tool, not a cloud drive. Persistent document storage is prohibited.
* **Uncompiled / Hazardous Formats:** Executables (`.exe`), archives (`.zip`, `.rar`), or raw script files (`.py`, `.js`) will not be supported or processed.
* **Direct Printer Hardware Manufacturing / Driver Firmware:** CBPMS interfaces with standard OS printer drivers via standard APIs; it does not replace printer drivers.

---

## 4. Non-Functional Requirements
* **Performance:** Real-time queue event propagation over WebSockets must maintain sub-500ms latency. Counter release from barcode scan to printer spooling must complete within 1.5 seconds.
* **Hardware Resource Footprint:** The desktop agent memory footprint must stay below 100MB RAM to ensure stability on low-spec shop PCs (e.g., Intel Core i3 / 4GB RAM).
* **Security & Privacy:** Zero-PII retention. Customer sessions require no name, phone number, or email. All data in transit is encrypted using TLS 1.3, and files at rest are encrypted via AES-256.
* **Reliability:** 99.9% uptime for cloud API endpoints during standard commercial operating hours. Rate-limiting locks verification consoles for 300 seconds after 3 consecutive invalid release token attempts.
