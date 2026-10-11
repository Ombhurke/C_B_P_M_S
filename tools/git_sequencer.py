import os
import subprocess
import sys

commits = [
    (
        "feat(db): add private schema migrations and user alias trigger",
        "2026-10-07T11:15:00+05:30",
        [
            "supabase/migrations/004_close_legacy_public_access.sql",
            "supabase/migrations/005_customer_documents_and_audit.sql",
            "supabase/migrations/006_google_identity_private_records.sql",
            "supabase/migrations/007_user_alias_trigger.sql",
        ]
    ),
    (
        "feat(db): implement pooler transaction manager and advisory locks",
        "2026-10-07T14:40:00+05:30",
        [
            "apps/server/app/core/database.py",
            "apps/server/app/core/seed.py",
        ]
    ),
    (
        "feat(audit): implement durable audit logging service",
        "2026-10-07T17:25:00+05:30",
        [
            "apps/server/app/core/audit.py",
        ]
    ),
    (
        "feat(auth): implement Google OAuth token verification and session security",
        "2026-10-08T10:50:00+05:30",
        [
            "apps/server/app/core/google_auth.py",
            "apps/server/app/core/auth.py",
            "apps/server/app/api/v1/auth.py",
        ]
    ),
    (
        "feat(customer): add private document library and account job isolation",
        "2026-10-08T13:30:00+05:30",
        [
            "apps/server/app/api/v1/customer.py",
            "apps/server/app/services/documents.py",
        ]
    ),
    (
        "feat(storage): implement ephemeral storage provider with secure purge",
        "2026-10-08T16:15:00+05:30",
        [
            "apps/server/app/services/storage_service.py",
            "apps/server/app/services/cleanup_service.py",
            "apps/server/certs",
        ]
    ),
    (
        "test(server): add customer library and transaction boundary test suites",
        "2026-10-08T18:45:00+05:30",
        [
            "apps/server/tests/test_customer_library.py",
            "apps/server/tests/test_google_auth.py",
            "apps/server/tests/test_transaction_boundaries.py",
        ]
    ),
    (
        "feat(desktop): implement Windows GDI spooler bridge and file shredder",
        "2026-10-09T11:20:00+05:30",
        [
            "apps/desktop/agent/spooler/win32_spooler.py",
            "apps/desktop/agent/shredder/file_shredder.py",
            "apps/desktop/agent/core/config.py",
            "apps/desktop/.env.example",
            "apps/desktop/requirements.txt",
        ]
    ),
    (
        "feat(desktop): add offline completion outbox, barcode scanner, and ws sync",
        "2026-10-09T14:10:00+05:30",
        [
            "apps/desktop/agent/core/completion_outbox.py",
            "apps/desktop/agent/scanner/barcode_hook.py",
            "apps/desktop/agent/core/ws_client.py",
        ]
    ),
    (
        "feat(desktop): implement daemon loop and auto-exit on unauthorized login",
        "2026-10-09T16:30:00+05:30",
        [
            "apps/desktop/agent/core/api_client.py",
            "apps/desktop/main.py",
            "apps/desktop/tests/test_agent.py",
            "apps/desktop/tests/test_release.py",
        ]
    ),
    (
        "feat(desktop-ui): add 6-screen navigation rail matching Print Station specification",
        "2026-10-09T18:50:00+05:30",
        [
            "apps/desktop/agent/ui/dashboard.py",
            "apps/desktop/agent/ui/panels.py",
        ]
    ),
    (
        "feat(pricing): add Normal vs Bond paper matrix and N-Up grouping calculation",
        "2026-10-10T10:45:00+05:30",
        [
            "apps/server/app/services/pricing.py",
            "apps/server/app/models/schemas.py",
            "apps/server/app/api/v1/jobs.py",
            "apps/server/app/api/v1/checkout.py",
            "apps/server/app/services/payments.py",
            "apps/server/app/services/websocket_hub.py",
            "apps/server/app/core/config.py",
            "apps/server/app/main.py",
            "apps/server/.env.example",
            "apps/server/render.yaml",
            "apps/server/requirements.txt",
        ]
    ),
    (
        "feat(api): add shop printer fleet, station pairing, and job release endpoints",
        "2026-10-10T12:30:00+05:30",
        [
            "apps/server/app/api/v1/shops.py",
            "apps/server/app/api/v1/release.py",
        ]
    ),
    (
        "feat(web): update design tokens, layout shell, and dark paper theme",
        "2026-10-10T14:15:00+05:30",
        [
            "apps/web/package.json",
            "apps/web/package-lock.json",
            "apps/web/tsconfig.json",
            "apps/web/tailwind.config.ts",
            "apps/web/next-env.d.ts",
            "apps/web/app/globals.css",
            "apps/web/app/landing.css",
            "apps/web/app/layout.tsx",
            "apps/web/app/page.tsx",
            "apps/web/app/error.tsx",
            "apps/web/app/not-found.tsx",
            "apps/web/app/favicon.ico",
            "apps/web/.env.example",
            "apps/web/public",
            "apps/web/lib/supabaseClient.ts",
        ]
    ),
    (
        "feat(web-auth): implement customer auth panel, Google OAuth, and server session bridge",
        "2026-10-10T15:40:00+05:30",
        [
            "apps/web/lib/server",
            "apps/web/app/api",
            "apps/web/app/auth",
            "apps/web/app/login",
            "apps/web/app/signup",
            "apps/web/components/customer/CustomerAuthContext.tsx",
            "apps/web/components/customer/CustomerAuthPanel.tsx",
            "apps/web/components/customer/EmailAuthForm.tsx",
            "apps/web/components/customer/GoogleOAuthButton.tsx",
            "apps/web/components/customer/AccountSignedOutView.tsx",
        ]
    ),
    (
        "feat(web-workspace): build customer private library, document grid, and account tabs",
        "2026-10-10T17:10:00+05:30",
        [
            "apps/web/app/account",
            "apps/web/components/customer/workspace",
            "apps/web/components/customer/UploadBox.tsx",
            "apps/web/components/customer/ShopPrivacySelector.tsx",
            "apps/web/components/customer/ReleaseTokenCard.tsx",
            "apps/web/components/customer/PaymentModal.tsx",
        ]
    ),
    (
        "feat(counter-desk): implement Counter Desk operator overview and print queue ledger",
        "2026-10-10T18:45:00+05:30",
        [
            "apps/web/components/admin/counter-desk/types.ts",
            "apps/web/components/admin/counter-desk/CounterDeskOverview.tsx",
            "apps/web/components/admin/counter-desk/CounterDeskQueue.tsx",
            "apps/web/components/admin/counter-desk/CounterDeskJobDetails.tsx",
        ]
    ),
    (
        "feat(counter-desk): add printer fleet, rate matrix editor, staff settings, and shell",
        "2026-10-10T20:15:00+05:30",
        [
            "apps/web/components/admin/counter-desk/CounterDeskPrinters.tsx",
            "apps/web/components/admin/counter-desk/CounterDeskRates.tsx",
            "apps/web/components/admin/counter-desk/CounterDeskTeam.tsx",
            "apps/web/components/admin/counter-desk/CounterDeskShell.tsx",
            "apps/web/app/admin/dashboard/page.tsx",
            "apps/web/components/admin/LiveQueueMonitor.tsx",
            "apps/web/components/admin/PrinterManager.tsx",
            "apps/web/components/admin/RateConfigurator.tsx",
        ]
    ),
    (
        "feat(web-shop): integrate Normal vs Bond paper selection, N-Up options, and live quotes",
        "2026-10-11T11:20:00+05:30",
        [
            "apps/web/lib/types.ts",
            "apps/web/lib/api.ts",
            "apps/web/components/customer/PrintConfigSelector.tsx",
            "apps/web/components/customer/ShopBanner.tsx",
            "apps/web/components/customer/PriceSummaryCard.tsx",
            "apps/web/app/shop/[shop_id]/page.tsx",
            "apps/web/app/shops",
            "apps/web/app/help",
            "apps/web/components/CounterQrCard.tsx",
            "apps/web/components/HeroBadge.tsx",
            "apps/web/components/StatusHeader.tsx",
            "apps/web/components/WorkflowSteps.tsx",
            "apps/web/components/landing",
        ]
    ),
    (
        "test: add end-to-end pricing matrix suite, security tests, and cleanups",
        "2026-10-11T13:45:00+05:30",
        [
            "apps/server/tests/test_api.py",
            "apps/web/tests",
            ".gitignore",
        ]
    ),
    (
        "docs: update PRD, architecture, operator station design specs, and runbooks",
        "2026-10-11T15:15:00+05:30",
        [
            "Docs",
            "README.md",
            "tools",
            "output",
        ]
    ),
]


def run():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    os.chdir(repo_root)

    for idx, (msg, dt, paths) in enumerate(commits, 1):
        print(f"[{idx}/{len(commits)}] Committing: {msg} ({dt})...")

        # Stage paths
        for p in paths:
            subprocess.run(["git", "add", "-A", "--", p], check=False)

        # Check if there is anything staged
        diff_res = subprocess.run(["git", "diff", "--cached", "--quiet"])
        if diff_res.returncode == 0:
            print(f"  -> Nothing staged for commit {idx}, skipping.")
            continue

        env = os.environ.copy()
        env["GIT_AUTHOR_DATE"] = dt
        env["GIT_COMMITTER_DATE"] = dt

        res = subprocess.run(["git", "commit", "-m", msg], env=env, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"ERROR on commit {idx}: {res.stderr}")
            sys.exit(1)
        else:
            first_line = res.stdout.splitlines()[0] if res.stdout.splitlines() else "Committed"
            print(f"  -> Success: {first_line}")

    # Check remaining status
    status = subprocess.run(["git", "status", "-s"], capture_output=True, text=True)
    if status.stdout.strip():
        print("\nRemaining uncommitted changes:")
        print(status.stdout)
    else:
        print("\nAll changes successfully committed!")


if __name__ == "__main__":
    run()
