# Copy this prompt into the other IDE

```text
Continue developing the existing CBPMS project in this repository. Treat this as
an implementation task, not a request for a new prototype or another generic plan.

FIRST read Docs/IMPLEMENTATION_HANDOFF.md completely. It is the consolidated
implementation brief and reference index. Then read Docs/CLAUDE.md and the audit,
workflow, design and setup references listed in the handoff. Open and visually
inspect all FOUR approved Option B reference images:

output/design/dashboard/concept-b-paper-desk.png
output/design/dashboard/option-b-find-a-shop.png
output/design/dashboard/option-b-print-jobs.png
output/design/dashboard/option-b-my-prints.png

The handoff supersedes conflicting historical mock/demo/mobile-first requirements.
Use current code and a safe read-only schema inspection to establish actual state.
Do not assume that a document's description means a feature has been implemented.

LATEST SCOPE: We will add real print shops later. Do not create or seed shops,
staff, printers or rates now. Implement the real customer/private-library milestone:
safe database migrations, shop-independent uploads, private Storage, durable
deletion/recovery, authorized library APIs, and the approved Option B customer pages.
An empty shop directory and empty print history are correct. Do not create a print
job, price, payment, release PIN or queued status without its actual prerequisites.

Build the approved desktop layouts with reusable React components and real data.
My prints means reusable private documents; Print jobs means actual print requests.
Follow the handoff's ordered phases, behaviours, visual sizes and acceptance gates.
Preserve the landing/auth design and unrelated work; do not redesign everything.

STRICT: No runtime demo records, fake counters, fabricated prices, fallback sample
shops, simulated payments/printing, fake document previews, artificial success
delays or decorative controls with no implementation. Do not copy sample data from
the reference images into the app. Isolated automated-test fixtures are test-only;
they must never enter live data or be presented as proof of a working real service.

Do not weaken auth, owner/shop isolation, TLS verification, private storage, secure
cookies, CSRF or the proxy allowlist. Do not expose secrets or privileged credentials.
Preserve existing records and dirty changes; no reset, destructive schema replacement,
automatic git staging/commits/pushes, or blind application of legacy migrations.

Do not invent missing business requirements or credentials. Inspect and document
ordinary implementation choices. If a necessary external setting or product decision
is missing, report the exact blocker, ask a focused question, and continue independent
work. Do not replace a missing integration with a fake success. Preserve current auth
methods until the unresolved Google-only versus email/Google decision is clarified.

First give a short evidence-based current-state summary and immediate implementation
slice, then implement the authorized work in small complete increments. Address the
known database/storage failure cases rather than hiding or deleting failing tests.
Run relevant checks, obey the repository's manual-only visual-review rule, and update
the handoff/checklist after each completed slice. Stop processes you start for testing.

Finish by reporting actual changes, exact tests/results, live verification versus
fixture coverage, remaining blockers and deferred work. Never call unconfigured
payments, absent shops or untested physical printing complete. Do not ask me to
repeat requirements already documented in the handoff.
```
