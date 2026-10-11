# Customer workspace: pages, options and workflow

Design proposal, 9 October 2026. This describes the target experience; proposed
routes and controls are not claims that those features already work.

Current scope: [the implementation handoff](../IMPLEMENTATION_HANDOFF.md) governs
delivery. **Print-shop provisioning is deferred.** Build the real private library
independently of jobs; show truthful shop/job empty states. The shop-dependent flows
below describe the eventual product and must not be simulated now.

## Visual direction

Selected by the user: **Paper desk (Option B)**. Use a warm ivory workspace beneath
a dark espresso top navigation bar, terracotta actions, editorial serif headings
and readable sans-serif body text. Give most of the space to documents and current
work. The matching Find a shop, Print jobs and My prints concepts are described in
`OPTION_B_PAGE_CONCEPTS.md`.

The earlier **Warm workspace (Option A)** remains an alternative concept only.
The selected design uses horizontal navigation rather than a sidebar.

The accompanying images are concept mockups with illustrative sample data, not
screenshots of the current app. Their proposed actions still need backend support.

- Warm workspace: `output/design/dashboard/concept-a-warm-workspace.png`.
- Paper desk: `output/design/dashboard/concept-b-paper-desk.png`.
- Exact generation prompts: `Docs/design/DASHBOARD_CONCEPT_PROMPTS.md`.

- At 1440–1920px width: full-width top navigation, approximately 48–56px main gutters
  and a fluid content grid. Do not place the whole dashboard in a narrow centered column.
- Headings 36–44px, section headings 22–26px, body/fields/buttons 16–18px and
  secondary metadata normally 14px. Main controls are 48–52px high.
- Larger text should wrap without hiding actions at increased browser zoom.
- Use two or three card types: primary upload action, compact job status, and
  a document table. Avoid making every element a separate floating card.
- Use short hover/focus transitions; no scroll-jacking or mandatory animations.
- Use clear keyboard focus, text labels with icons, and explicit loading, empty,
  error and stale-data states. Never show zero totals while a request is loading.
- Show real counts only. Avoid invented queue times, printer availability or
  payment success. An empty new account gets a useful first-upload prompt.

## 1. Dashboard — `/account`

Purpose: answer “What can I print now, and what happened to my last job?”

- **New print:** opens the preparation flow. The user can upload a new file or
  select a private saved document, choose a shop and set printing options.
- **Current print:** shows the most recent unfinished job with document, shop,
  status and the next valid action. “Awaiting payment” is different from “Queued”.
- **View job:** opens the full job detail page, including the status history and
  receipt when available. Show a release code only after server-confirmed payment.
- **Recent documents:** displays up to five items with type, size and added date.
  “View all” opens the library; selecting a file opens its details.
- **Resume:** reopens a saved draft or an eligible unpaid job. It must not create
  another job automatically when the previous response was lost.
- **Find a shop:** opens the real directory. If no shop is available, explain that
  printing cannot be submitted yet; do not substitute a demo counter.
- **Sign out:** ends the customer session and clears private workspace state.

Prefer current work and useful actions over spending charts or redundant counts.
Anonymous jobs are not added to the signed-in account's activity or totals.

## 2. New print — `/account/print/new`

1. **Choose privacy mode.** “Save to my library” links the job to the account;
   “Print anonymously” creates a temporary job without an account owner. A logged-in
   customer can still choose anonymous mode.
2. **Choose a document.** Upload PDF/PNG/JPEG or select a saved file in account mode.
   Selecting an existing private-library file while switching to anonymous mode
   should require a fresh anonymous upload initially, avoiding implicit account linkage.
3. **Choose a shop.** Show its address, supported capabilities and current rates.
   A scanned shop QR preselects the shop but does not bypass authorization.
4. **Set printing options.** Copies, colour, simplex/duplex and pages per sheet;
   show only supported choices. Page range, new paper sizes and other unsupported
   settings remain absent until the backend and printer support them.
5. **Review.** Show server-validated pages and exact total, selected shop and
   retention choice. Reconfirm if the shop/rates/options change before submission.
6. **Submit.** Use a stable operation key so double-clicks and safe retries produce
   one job. Upload/storage problems retain the user's form state and show recovery.
7. **Payment or pending state.** When enabled, use server-verified checkout. Until
   configured, say payment is unavailable; do not issue a paid receipt/release PIN.

The same preparation components can serve the existing `/shop/[shop_id]` route.
Keep anonymous users outside the account workspace and give them a secure receipt
route that uses a short-lived capability, never a public job ID alone.

## 3. My prints (document library) — `/account/documents`

- **Upload document:** saves a validated file to the private library without
  forcing the user to select a shop or pay. Requires a new independent upload API.
- **Search/filter/sort:** filename/type/date with server pagination; owner scope is
  mandatory in the query. The UI must not download other users' rows and filter them.
- **Open details:** filename, file type, size, verified page count and retention.
- **Preview/download:** checks ownership and lifecycle before obtaining a brief
  access grant. No permanent public storage URL is embedded in the page.
- **Print again:** creates a new job referencing the existing saved document;
  selects current shop/rates and gets a new quote. Do not reset or reuse an old job.
- **Delete:** asks once, explains active-job restrictions, then shows “Deleting”
  until the worker confirms deletion. Repeated requests are safe.

Defer folders, bulk actions and rename to a later release. A useful secure list is
more valuable for the first milestone than many partially connected controls.

## 4. Print jobs — `/account/jobs`

- **Active / Completed / Needs attention:** useful filters over paginated history.
- **Open job:** shows the latest authoritative state rather than only a coloured badge.
- **Cancel:** available only in explicitly allowed states before a print claim.
  Paid cancellations require a refund policy; do not silently cancel captured work.
- **Retry checkout:** resolves the existing order first and avoids duplicate charges.
- **Print again:** starts a new job with a fresh quote, using a retained file only.
  For deleted temporary content, explain that a new upload is required.

Use honest labels such as Uploaded, Awaiting payment, Queued, Printing, Failed,
Expired and Cancelled. “Sent to printer” must not be presented as proof of physical
completion unless the printer integration supplies that evidence.

## 5. Job detail and receipt — `/account/jobs/[job_id]`

Show document summary, selected shop/address, configuration, price breakdown,
payment state, timestamps and the next useful action. Include a readable textual
status timeline. A short release PIN/barcode is shown only while eligible, with
expiry and a warning not to share it. No PIN alone grants document download.

Distinguish a payment receipt from a printable invoice; legal/business invoice
details need separate shop configuration. Display printer error/recovery information
without exposing storage paths, tokens or internal server exceptions.

On reconnect, fetch fresh state. If the outcome is uncertain, show “Checking status”
or “Shop assistance needed”, not a new automatic print request.

## 6. Find a shop — existing `/shops`

Provide a real directory with name, address, current prices and supported printing
options. Search by shop/location text; do not invent distance without location data.
“Select shop” returns to the current draft. “View shop” opens the existing shop page.
Opening hours, device online status and queue estimates need real data sources before
being displayed. The current API's active flag is not proof that a counter is open now.

## 7. Account and privacy — `/account/settings`

Show the signed-in identity/provider, explain library versus anonymous retention,
provide sign out and an account-data deletion option after reliable deletion is built.
The current deletion API affects CBPMS data only; it does not delete Google/Supabase
identity. State the actual scope and active-job restrictions clearly.

If email/password is kept, add password recovery and verified-email handling.
If the original Google-only decision stands, remove email controls coherently from
the UI, web routes and backend provider policy. Do not silently change this during design.

## 8. Help — `/help`

Answer supported formats/limits, pricing, privacy modes, payment unavailable,
expired receipts, shop selection and printer failure. Provide the selected shop's
contact details where configured. Do not add a support-ticket button until tickets
can actually be submitted and tracked.

## Staff pages remain separate

Customers do not see shop management controls. Expand the existing staff console
into Queue, Job detail, Devices, Pricing and Activity as real operations become
available. Staff memberships define the selected shop; customer metadata cannot
assign roles. Device status must come from the agent, not a static “online” label.

## First implementation milestone

Build the database/storage foundation, then deliver **Dashboard and My prints**
with actual shop-independent upload, owner isolation, preview/download, search,
restart persistence and retryable deletion. Build the Print jobs and Find a shop
layouts against real APIs, accepting empty results; no shops are provisioned now.
New print/Print again must explain the no-shop boundary before any job submission.

Complete job creation/reprinting, live payment and hardware release after actual
shops and their integrations are configured in a later milestone. The current
milestone does not require fabricated jobs or checkout to demonstrate library use.
