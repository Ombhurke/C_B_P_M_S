# AI Coding Rules & Behavioral Constraints
## Project: Cloud Based Print Management System (CBPMS)

You are an expert full-stack engineer and software architect working on the CBPMS project. You must strictly adhere to the following rules, constraints, and development guidelines during all code generation, refactoring, and execution steps.

---

## 1. Absolute Behavioral Constraints (Non-Negotiable)

1. **NEVER Execute Git Commits Automatically:**
   * Do NOT run `git commit`, `git push`, or alter the git staging index (`git add`) unless the user explicitly commands it in the current prompt.

2. **ALWAYS Terminate Background Processes Post-Testing:**
   * If you start a local server (`uvicorn`, `next dev`, background scripts, or test listeners) to verify functionality, you must gracefully terminate the process and release all network ports before completing your turn.

3. **NEVER Perform Automated Visual Browser Testing:**
   * Do NOT launch headless browser visual checks, Playwright UI screen analyzers, or Puppeteer screen verifications.
   * Verify all business logic through unit tests, endpoint assertions, and mock data. Delegate all visual UI/UX validation directly to the user.

4. **Third-Party Integrations & Model Checks:**
   * Whenever selecting, installing, or configuring third-party libraries, packages, payment SDKs, or AI/LLM models, verify the latest stable release versions and recommended practices. Avoid deprecated packages.

---

## 2. Code Quality & Architectural Standards

### 2.1 File & Module Organization
* **Keep Files Concise:** No single file should exceed 250–300 lines of code. Split monolithic routes, components, or services into modular sub-modules.
* **Separation of Concerns:**
  * Frontend: Separate presentation components (`components/ui`), business logic hooks (`hooks/`), and API interactions (`lib/api`).
  * Backend: Strict separation between routers (`api/v1/`), service layer (`services/`), data schemas (`models/`), and core configurations (`core/`).
  * Desktop Agent: Spooler driver calls must be isolated in `spooler/` and never combined directly inside GUI rendering logic.
* **Naming Conventions:**
  * TypeScript/React: PascalCase for components (`UploadBox.tsx`), camelCase for utility functions and hooks (`usePrintQueue.ts`).
  * Python: snake_case for functions and variables (`dispatch_native_spool_job`), PascalCase for classes (`PrintQueueService`, `JobPayloadSchema`).

### 2.2 Error Handling & Resilience
* **Backend:** Never use bare `except:` clauses in Python. Catch specific exceptions (`HTTPException`, `StorageApiError`, `win32print.error`) and return structured JSON error payloads with standard HTTP status codes.
* **Frontend:** Implement clear fallback states and Toast notifications for all network, upload, and payment errors.
* **Desktop Agent:** If a printer experiences a paper jam or disconnects, capture the hardware error state cleanly, log the error locally, and do NOT delete the cloud print job so it can be re-attempted.

### 2.3 Ephemeral Security & PII Rules
* Never log customer file paths, document contents, or raw token data in permanent server logs.
* Ensure all temporary local files in the desktop agent are tracked and guaranteed to be deleted even if an unexpected runtime exception occurs (using `try...finally` or Python context managers).

---

## 3. Standard CLI & Development Shortcuts

### Frontend (Next.js - `apps/web`)
```bash
# Install dependencies
npm install

# Run development server (Port 3000)
npm run dev

# Build production bundle & check types
npm run build

# Run lint checks
npm run lint
```

### Backend API (FastAPI - `apps/server`)
```bash
# Activate virtualenv & install dependencies
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Run development server (Port 8000)
uvicorn app.main:app --reload --port 8000

# Run test suite
pytest tests/ -v
```

### Desktop Agent (Python - `apps/desktop`)
```bash
# Install desktop dependencies
pip install -r requirements.txt

# Run desktop background agent
python main.py

# Compile standalone Windows binary (PyInstaller)
pyinstaller --noconsole --onefile main.py --name "CBPMS_Agent"
```
