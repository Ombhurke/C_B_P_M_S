# Cloud Based Print Management System (CBPMS)

An automated, privacy-first, multi-tenant print management ecosystem for walk-in retail print shops, copy centers, and document hubs.

---

## 🏗️ Monorepo Architecture

* **`apps/web`**: Next.js 14+ (App Router), React, Tailwind CSS, QR & 2D Barcode generation, Zero-Install Mobile Web Portal (`/shop/[shop_id]`) and Admin Console (`/admin/dashboard`).
* **`apps/server`**: Python FastAPI (v0.110+), Uvicorn, Pydantic v2, Ephemeral Storage Manager, WebSocket Push Hub, and 3-attempt Rate Limiter.
* **`apps/desktop`**: Python 3.10+ Background Counter Agent with PySide6 dashboard, USB HID Barcode Reader listener, Windows `win32print` native spooler, and instant disk shredder (`%TEMP%\cbpms_spool\`).
* **`supabase/`**: PostgreSQL migrations for shops, printers, and print jobs with RLS and 2-hour TTL auto-expirations.

---

## 🚀 Quickstart & Development

### 1. Cloud API Backend
```bash
cd apps/server
pip install -r requirements.txt
python -m pytest tests/ -v
uvicorn app.main:app --reload --port 8000
```

### 2. Mobile Web & Admin Frontend
```bash
cd apps/web
npm install
npm run dev
# Open http://localhost:3000 in your browser
```

### 3. Storefront Desktop Agent
```bash
cd apps/desktop
pip install -r requirements.txt
python -m pytest tests/ -v
python main.py
```

---

## 🔒 Security & Ephemeral Guarantees
1. **Zero-PII**: No phone numbers, email addresses, or account creation required for walk-in customers.
2. **Ephemeral Transit Only**: Documents staged in temporary storage are locked and only downloadable for 60 seconds with valid token.
3. **Multi-Pass Shredding**: The moment printer hardware acknowledges spooling, Python overwrites local memory/disk and triggers a cloud purge callback. Unclaimed jobs automatically expire and purge after 2 hours.
