# Copy-paste implementation prompt: customer flow completion

You are working in the existing CBPMS repository. Implement the missing customer-facing desktop design and state handling described below. Do not rebuild the system from scratch.

Read repository instructions first, especially Docs/CLAUDE.md and any applicable AGENTS.md. Preserve unrelated uncommitted work. Do not reset, stage, commit or push without my request.

Required sources:
1. Docs/design/CUSTOMER_FLOW_COMPLETION.md — audited route coverage, exact current/future boundaries, desktop layout, state and security requirements.
2. output/design/customer-flow/index.html — ten new visual references.
3. output/design/customer-flow/PROMPTS.md — exact intent for each concept.
4. Docs/design/DESKTOP_FRONTEND.md — fluid desktop sizing.
5. Docs/design/OPTION_B_PAGE_CONCEPTS.md and the four approved images in output/design/dashboard — customer theme and navigation.
6. Docs/design/CUSTOMER_WORKSPACE_PLAN.md and Docs/IMPLEMENTATION_HANDOFF.md — product context; verify older implementation claims against current code.

Start by inspecting current route/component/API implementations. Give a short mapping of each requested visual to an existing route/pane and identify unsupported capabilities. Do not treat a reference image as an API specification or live dataset. If a missing fact affects security, authentication, payment or destructive behavior, stop that dependent change and ask a focused question. Continue independent, safely scoped presentation work.

Implement in this order:
A. Shared customer layout and readable type/control sizing.
B. /account/print/new and /shop/[shop_id] upload/privacy/configuration/review screens.
C. DocumentDetailPane and JobDetailPane using existing route structure.
D. Help, global 404 and safe recovery states.
E. Account settings only for verified existing backend capabilities.

Appearance: Paper Desk ivory customer workspace, espresso horizontal header, terracotta controls, warm borders, editorial serif headings. Keep landing/auth pages in their established direction. Do not borrow operator sidebars. Use essentially full viewport width minus clamp(32px, 3.2vw, 88px) gutters. Do not impose a 1280/1440/1640px page cap or shrink the entire interface with transforms. Body 17–18px, controls/labels 16px, minor metadata >=14px, buttons/inputs >=48px height. Use roomy desktop split panes at 1366x768, 1440x900 and 1920x1080; accessible reflow and 200% zoom must not clip content.

Functional requirements:
- Use real APIs and persistent records only. No fixture arrays, hardcoded personal data, synthetic shops/prices/printer counts, fake receipts, console-only save handlers, timeout-based fake success or fallback demo data.
- Real empty results, failed loading, signed-out, unauthorized and unavailable features must be separate visible states.
- Keep anonymous/account-linked mode per whole job. Anonymous remains possible for account holders; anonymous files never enter the library.
- Use existing sign-in flow rather than embedding an oversized duplicate login form. Validate local return paths against open redirects.
- Preserve selected document and shop across preparation; validate authorization and stale selections.
- All settings and quote choices use server capabilities; quote loading/error is not zero price.
- Secure preview must load the actual authorized file; a thumbnail illustration is not a document preview.
- Keep checkout unavailable until a real payment integration is separately authorized and implemented. The receipt image is FUTURE verified-payment state only; never simulate verification or derive a release token.
- No shop provisioning/onboarding, real payment activation, operator changes or desktop-agent changes in this task.
- Use actual profile/provider values. Persist supported alias edits; omit/disable unsupported account deletion/support forms with truthful explanations.
- Show safe user-facing errors, never raw exceptions or internal storage paths.
- Preserve frontend same-origin authenticated proxy restrictions, server ownership and shop isolation, CSRF protections and private storage. Do not weaken an allowlist/auth check just to make a button work.
- Never copy database passwords, service-role keys or tokens into source/public environment variables or logs.

Images are design specifications, not website backgrounds or fake working screenshots. Rebuild them with reusable semantic components. Do not add dependencies unless essential and approved by repository instructions.

Verification: run actual package typecheck/tests/production-build scripts, add focused tests for affected states and document/shop continuity, and report real outputs. Follow repository restrictions on visual automation; perform permitted manual visual review at the three desktop sizes, keyboard-only use, reduced motion and 200% zoom. Check full-width layout, focus, long filenames, long error messages and zero-record states.

Finish with changed files, tests executed, known limitations and remaining backend dependencies. Do not describe this work as live-payment enabled, fully secure or market-ready without independent evidence.

