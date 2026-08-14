# System Architecture & Technical Blueprint
## Project Name: Cloud Based Print Management System (CBPMS)

---

## 1. Technology Stack Selection

| Layer | Technology | Primary Rationale |
| :--- | :--- | :--- |
| **Frontend (Client Web App)** | Next.js (App Router), React, Tailwind CSS | High-performance mobile-responsive web app; zero installation required for walk-in users. |
| **Cloud Backend API** | Python (FastAPI), Uvicorn, Pydantic v2 | High concurrency, native async WebSocket routing, high performance, and rapid API serialization. |
| **Database & Storage** | Supabase (PostgreSQL 15+), Supabase Storage | Multi-tenant relational integrity, Realtime PG Notify extensions, and private S3-compatible buckets. |
| **Desktop Background Agent** | Python 3.11+, PySide6 / PyQt6 | Native OS bindings via `pywin32` (`win32print`), low memory footprint (<100MB), compiled via PyInstaller. |
| **Messaging & Spooling** | Persistent WebSockets over TLS (`wss://`) | Outbound polling bypasses store firewall port-forwarding; enables instant job notification to the counter PC. |
| **Payment Integration** | Razorpay / Stripe / UPI Webhooks | Upfront financial firewall prevents spam uploads and ensures paid transactions before queueing. |

---

## 2. High-Level System Architecture & Flow

```
+-----------------------------------------------------------------------------------+
| 1. INGESTION (Mobile Browser)                                                     |
| [Customer Phone] ---> [Scan Counter QR] ---> [Next.js Web App (Upload + Config)]  |
|                                                       |                           |
|                                                       v (Payload Validation)      |
| [Payment Webhook] <--- [Inline Payment Gateway] <--- [FastAPI Gateway Endpoint]   |
+-----------------------------------------------------------------------------------+
|
v (Holds in Private Bucket)
+-----------------------------------------------------------------------------------+
| 2. CLOUD ORCHESTRATION                                                            |
| [Supabase DB (PostgreSQL)] <---> [Supabase Storage (Encrypted Transient Bucket)]   |
|                                                       |                           |
|                                                       v (WebSocket Event wss://)  |
+-----------------------------------------------------------------------------------+
|
v
+-----------------------------------------------------------------------------------+
| 3. COUNTER EXECUTION (Desktop Terminal)                                           |
| [USB Barcode Scanner] ---> [Python Desktop Agent (PySide6 / Win32 API)]           |
|                                                       |                           |
|                                                       v (Spool to RAW Driver)     |
| [Physical Paper Output] <------------------- [Local Hardware Printer]             |
|                                                       |                           |
|                                                       v (Spooler Success Signal)  |
| [Simultaneous Local Disk Shred + Supabase Cloud Storage Deletion]                 |
+-----------------------------------------------------------------------------------+
```

---

## 3. Monorepo / Directory Structure

```
cbpms-monorepo/
├── .cursorrules / CLAUDE.md
├── PRD.md
├── ARCHITECTURE.md
│
├── apps/
│   ├── web/                     # Next.js App Router (Customer Ingestion & Admin Portal)
│   │   ├── app/
│   │   │   ├── (customer)/
│   │   │   │   └── shop/[shop_id]/page.tsx   # QR Landing, Upload & Settings UI
│   │   │   ├── (admin)/
│   │   │   │   └── admin/dashboard/page.tsx  # Multi-tenant Rate & Log Management
│   │   │   ├── api/             # Next.js Server Actions / Edge Helpers
│   │   │   └── layout.tsx
│   │   ├── components/          # Reusable UI Components (UploadBox, ConfigSelector)
│   │   ├── lib/                 # Supabase Client, Validation & Fee Helpers
│   │   └── package.json
│   │
│   ├── server/                  # Python FastAPI Backend
│   │   ├── app/
│   │   │   ├── api/v1/          # Endpoints (upload, payment_webhook, verify_token)
│   │   │   ├── core/            # Config, Security, Rate Limiter, Crypto
│   │   │   ├── models/          # SQLAlchemy / Pydantic Data Models
│   │   │   ├── services/        # Storage Cleanup Service, WebSocket Hub
│   │   │   └── main.py          # FastAPI Application Root
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   └── desktop/                 # Storefront Background Agent (Python)
│       ├── agent/
│       │   ├── ui/              # PySide6 Minimal Status Dashboard
│       │   ├── core/            # WebSocket Client, Auth Token Cache
│       │   ├── spooler/         # Windows Spooler Native API Bridge (win32print)
│       │   ├── scanner/         # USB HID / Serial Barcode Reader Hook
│       │   └── shredder/        # Local Volatile File Destruction Worker
│       ├── main.py              # Desktop Agent Bootstrap
│       └── requirements.txt
│
└── supabase/
    ├── migrations/              # DDL Schemas & Row-Level Security Rules
    └── functions/               # Ephemeral Storage Auto-Delete Cron (2-hour TTL)
```

---

## 4. Database Schema Outline (Supabase PostgreSQL)

```sql
-- Multi-Tenant Shop Accounts
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    base_bw_rate NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
    base_color_rate NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Store Printers
CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    is_color_supported BOOLEAN DEFAULT TRUE,
    is_duplex_supported BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'online',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ephemeral Print Queue
CREATE TABLE print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    page_count INT NOT NULL,
    copy_count INT NOT NULL DEFAULT 1,
    is_color BOOLEAN NOT NULL DEFAULT FALSE,
    duplex_mode VARCHAR(50) CHECK (duplex_mode IN ('simplex', 'duplex_long', 'duplex_short')) DEFAULT 'simplex',
    layout_nup INT DEFAULT 1,
    total_cost NUMERIC(10, 2) NOT NULL,
    payment_status VARCHAR(50) CHECK (payment_status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
    payment_id VARCHAR(255),
    release_token VARCHAR(6) NOT NULL,
    job_status VARCHAR(50) CHECK (job_status IN ('queued', 'processing', 'completed', 'expired')) DEFAULT 'queued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '2 hours')
);

CREATE INDEX idx_print_jobs_shop_token ON print_jobs(shop_id, release_token);
```

---

## 5. Security & Ephemeral Storage Strategy

1. **Pre-Signed Short-Lived URLs:** Document downloads use private Supabase Storage buckets with pre-signed GET URLs valid for only 60 seconds, generated exclusively upon successful token verification.
2. **Local Sandboxing & Immediate Shredding:** Files downloaded to the store PC write directly into a sandboxed temp directory (`%TEMP%\\cbpms_spool\\`). The moment `win32print.EndDocPrinter()` successfully completes, Python executes `os.remove()` and overwrites file buffers.
3. **Database TTL / Cron Cleanup:** A Supabase scheduled pg_cron routine runs every 10 minutes to delete any binary storage object and set `job_status = 'expired'` for records exceeding `expires_at`.
