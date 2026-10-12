# Customer flow completion: design audit and handoff

Date: 11 October 2026. Scope: visual design references and implementation instructions, not application implementation or a production-readiness certification.

## What was checked

The current web routes, customer workspace components, saved dashboard concepts, and desktop design baseline were inspected. The supplied screenshot is the existing customer shop flow at /shop/[shop_id], not an operator portal.

The main problem is inconsistent presentation: the shop flow still uses the older dark glass layout, with small labels, a large embedded authentication panel, fallback hardware claims, and a sidebar that does not match the approved customer workspace. The current new-print page also has a narrow centered empty-state card. Help and global errors have no dedicated final references. Document and job detail panes exist but have not been given the same detailed visual specification.

This is a design coverage audit. It does not establish that all backend features, authentication flows, or live Supabase policies are correct.

## Coverage and route map

| Area | Current implementation | Design reference / action |
| --- | --- | --- |
| Landing / | Existing design | Preserve current landing direction; do not restyle it as a dashboard |
| /login and /signup | Existing authentication pages | Preserve established warm authentication direction and actual enabled providers |
| /account | Existing overview | output/design/dashboard/concept-b-paper-desk.png |
| /account/documents | Existing library and DocumentDetailPane | option-b-my-prints.png plus 05-document-details.png |
| /account/jobs | Existing job list and JobDetailPane | option-b-print-jobs.png plus 04-job-receipt.png, gated future receipt state |
| /shops | Existing directory | option-b-find-a-shop.png; show real records or honest empty/error states |
| /account/print/new | Existing selected-document/shop entry | 07-new-print-empty.png; fix error versus empty differentiation and selected-document continuity |
| /shop/[shop_id] | Existing upload/configuration workflow | 01-shop-upload.png and 02-print-configure.png; retain route and contracts |
| PaymentModal in shop flow | Checkout unavailable | 03-checkout-unavailable.png; keep unavailable until real provider exists |
| Account settings | No dedicated settings page found | 06-account-settings.png; profile/session UI only using verified existing capabilities |
| /help | Existing basic help page | 08-help-v2.png (final) |
| not-found.tsx | Existing old-style 404 | 09-not-found-v2.png (final) |
| error.tsx | Existing old-style recovery screen | 10-service-error.png; never display raw exception text |
| /admin/dashboard | Existing operator workspace | Already covered by output/design/operator-station and Docs/design/OPERATOR_STATION_DESIGNS.md |
| Desktop printing software | Existing application / separate concepts | Already covered by operator-station references; not part of this customer implementation task |
| Google OAuth callback and API routes | Server handlers, not visual pages | No separate dashboard mockup needed; give authentication failures a safe existing login-page state |

Image paths in the new set are under output/design/customer-flow/. Detail images can be implemented as an expanded pane or accessible dialog within existing library/job routes; do not create extra routes just because an image looks like a page. Proposed settings or public receipt routes require explicit capability and authorization review, not an assumed endpoint.

## Shared customer design contract

- Paper Desk only: espresso #231713 navigation, ivory #f7f4ee canvas, dark text #241814, warm white panels, beige #e6dfd5 borders and terracotta #c05634 primary actions.
- Use the existing editorial serif and sans-serif font setup. No unnecessary dependency or external font download.
- A full-width horizontal header, not an operator sidebar. Correct active tab; selected-shop routes belong to Find a shop. Signed-out visitors get home, Find a shop, Help and Sign in, not a pretend authenticated account menu.
- Fluid outer width with gutters clamp(32px, 3.2vw, 88px); remove page-level 1280/1440/1640px caps causing unused sides. Limit paragraph measure, not the whole page.
- Reference desktop widths: 1366x768, 1440x900, 1920x1080. Headings approximately 40–56px, body 17–18px, labels/control text 16px, minor metadata at least 14px, controls 48–52px tall. Do not scale an entire scene with transform.
- Use a 60/40 or 65/35 main/detail arrangement, consistent 24–32px card padding and 20–28px gaps. Let content grow vertically. Forms, previews and errors must not be clipped to exactly one viewport.
- No tiny navigation, dim body text, nested-scroll page, forced horizontal overflow or fixed-height content clipping. Narrow windows and 200% zoom must reflow accessibly, even though desktop is the design target.
- Restrained shadows and 16–24px corner radii; paper motif, not ornamental printer animation. Focus rings, contrast, keyboard access and reduced motion matter more than visual effects.
- Generated images are appearance references, not literal screenshots of working data. Recreate them in components; never use a PNG as the actual UI.
- Image-review corrections: standardize steps as Upload / Configure / Review, and keep Find a shop active throughout a selected-shop flow; job receipts belong to Print jobs. Generated service fees, shop names/addresses, paper specifications, dates, cancellation promises and support availability are illustrative, not requirements. Never add a service fee absent from the server quote or promise automatic cancellation absent from the lifecycle policy. Privacy is anonymous/account-linked, not an arbitrary sharing-permissions setting. Written requirements override these generated details.

## Interaction and state requirements

### Shop upload and configuration

Retain the complete-job privacy choice: anonymous or account-linked, never mixed per file. An account holder can still choose anonymous mode. Anonymous documents must not enter the library.

Account-linked selection when signed out shows a compact sign-in callout using existing authentication, with a safely validated local return destination. Do not duplicate password/authentication machinery inside the print flow. Switching privacy must invalidate stale staged-job/payment state.

Upload uses verified server limits and file inspection. Show pending, invalid type/size, parser rejection, upload failure and retry states. No successful file state until the server accepts it. Determine page count on the server. Capabilities, pricing, station status and shop address must come from real records; absent data is unavailable, not a fabricated standard default.

Configuration provides preview if a secure authorized preview exists. A document illustration is not a preview of its contents. Unsupported settings are disabled with a reason. Separate quote loading/error from a valid zero amount. Ignore stale quote responses after changes. The server remains authoritative for totals and permissible options.

### New print and document detail

Carry the authorized document selected by the doc query parameter through shop selection; do not silently drop it. A missing, deleted or unauthorized document must fail safely. Show empty shop list only after a successful empty response; network/auth failures are separate and retryable. Never invent shops to fill a layout.

Document detail exposes only real metadata, authorized downloads/previews and supported delete/print actions. Ask for deletion confirmation; show busy, failure and success. Server ownership checks remain mandatory. Do not optimistically imply deletion succeeded while the request failed. If active-job deletion rules are unknown, inspect the existing contract before offering the action.

### Checkout and receipt

Current checkout remains unavailable. No live adapter was established by this design work. Show the unavailable notice and no-money-taken message only when true. Do not add a simulated Pay action.

04-job-receipt.png is FUTURE VERIFIED-PAYMENT design, not permission to turn payments on. Render a release token only from an authorized server-issued receipt after verified payment. Never manufacture a code from a job ID or client state. Do not label legacy mock-paid jobs as verified production payments. Do not claim physical printing completed merely because a job was spooled.

Anonymous receipt access must preserve short-lived capability authentication; never expose jobs through guessable IDs. Download receipt is shown only if a real supported implementation exists. Pending, unavailable, failed, expired, rejected, queued, printing and completed are distinct states, each with only supported next actions.

### Account, help, and errors

Settings is a proposed page, not an existing route. Reuse actual profile/alias update capabilities after verifying their validation and persistence. Email/provider display must come from the actual session: do not claim every customer is a Google account. Saving must update persistent data or the control is unavailable with a clear reason. Sign-out failures must be surfaced rather than ignored.

Self-service account deletion is not assumed. A Get help link is preferable to a nonfunctional delete-account button; avoid saying a support request can be submitted unless a real support channel exists. Help content must accurately describe current file limits, privacy retention and checkout availability. No invented contact address, response-time guarantee or beta-onboarding claim.

404 does not reveal private document existence. Recovery screens use safe messages, a functioning retry/reset control and navigation. Never render error.message, stack traces or storage paths to customers. Do not promise unsaved data was preserved unless persistence was verified.

### Common supporting states

For every data page cover authentication loading/signed out, real loading, success, successful empty results, unavailable service, validation error, unauthorized/expired session, retryable failure and destructive action pending. For dialogs cover focus trapping, Escape, focus restoration and clear screen-reader status. OAuth cancellation/error returns to the existing auth screen with a safe message, no raw provider response.

## Scope boundary

Shops remain a later operational phase. This task can design and restyle existing shop/customer routes but must not provision shops, seed sample data, enable payments or implement unrelated operator/station features. The receipt, settings controls and document preview must stay capability-gated until their actual dependencies are verified.

No backend secrets in NEXT_PUBLIC variables, no storage service credentials in browsers, no public bucket/unsigned permanent URLs. Preserve same-origin backend proxy allowlists and authentication/authorization; an API route being hidden is not a substitute for server security.

## Deliverables and acceptance

1. Implement shared desktop customer layout/typography first.
2. Restyle existing shop/new-print/detail/help/error UI without replacing working contracts.
3. Implement settings only for verified available capabilities; document missing backend work rather than faking it.
4. Add state/permission/continuity tests relevant to modified components.
5. Run web type checks, existing tests and production build using actual package scripts. Follow repository rules: manual browser visual checks, not prohibited automated visual tooling.
6. Manually inspect the three desktop viewport sizes and 200% zoom: modest gutters, readable copy, no horizontal overflow, functional keyboard navigation.
7. Confirm failed fetches never become empty-success states; no mocked release receipt; no new public document access; no seeded sample records.
8. Report exact changed files, real test results and remaining unavailable features. Do not call the project production-ready based on this visual work.

## Reference files

- Docs/design/DESKTOP_FRONTEND.md
- Docs/design/OPTION_B_PAGE_CONCEPTS.md
- Docs/design/CUSTOMER_WORKSPACE_PLAN.md
- Docs/IMPLEMENTATION_HANDOFF.md
- Docs/design/OPERATOR_STATION_DESIGNS.md (boundary/reference only)
- output/design/customer-flow/index.html
- output/design/customer-flow/PROMPTS.md
- Docs/IDE_CUSTOMER_FLOW_PROMPT.md

Current code and this scoped addendum take precedence over outdated factual claims in older plans. Existing unrelated working-tree edits must be preserved.

