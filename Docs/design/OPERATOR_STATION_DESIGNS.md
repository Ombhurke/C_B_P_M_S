# Operator portal and desktop Print Station

Desktop design update, 12 October 2026: [UNIFIED_OWNER_DESKTOP.md](UNIFIED_OWNER_DESKTOP.md) and [the unified gallery](../../output/design/unified-owner-desktop/index.html) supersede the separate sparse station navigation for the next desktop implementation. The owner web portal references below remain the visual foundation. This is a design handoff, not a claim the unified app is implemented.

Design proposals dated 10 October 2026. These extend the customer Option B / Paper desk theme. Shop implementation remains deferred under IMPLEMENTATION_HANDOFF.md; this request authorizes design artifacts only. No application code, records, credentials, prices or shop configuration were changed.

Open [the complete image gallery](../../output/design/operator-station/index.html) to view the two sets. Every screen has an individual PNG; the gallery displays one full-width image at a time, not small mobile-sized tiles. Open an image directly for original resolution.

## Two related identities

**Counter Desk — operator web portal:** warm ivory, parchment navigation, espresso text, olive selection accents, terracotta actions. Serif headings and thin ledger rules connect it to the customer workspace. Its purpose is to manage the assigned shop's queue, capabilities, rates and staff.

**Print Station — desktop software:** espresso navigation rail, ivory task panels, terracotta actions, geometric sans-serif headings and monospaced job references. Its purpose is to authorize a release, prepare and send a job to a local printer, verify the outcome and reconcile failures.

The portal does not silently trigger a physical print. The station does not become an unrestricted browser of customer libraries. These are design boundaries to carry into the later implementation.

## Desktop layout contract

- Design for 1920 x 1080 and validate at 1440 x 900 and 1366 x 768 at 100% browser zoom. Allow ordinary vertical scrolling at shorter heights.
- App shell occupies the whole available viewport. Do not put the whole app inside a centered 768px, 1024px or 1200px marketing container.
- Portal sidebar: 232px; station rail: 220px. Content uses the remaining width with 32–40px gutters. Use `minmax(0, 1fr)` for the workspace track.
- Portal top header: about 88px. Station uses a compact native title bar and a 56px connection strip. These are layout dimensions, not a request to scale the whole screenshot with CSS.
- At 1920px, the portal should have roughly 1608px of usable workspace after sidebar and gutters. At 1440px it should have roughly 1128px. Use that space for tables, settings and selected-item detail.
- Master/detail pages use roughly 65–70% / 30–35% columns, with a readable minimum detail width around 320px. At narrower desktop widths, move details into a drawer instead of squeezing every label.
- Body and control text: 17–18px. Secondary metadata: 14–16px. Page title: 36–44px. Table rows: 56–64px. Controls: 44–48px minimum height. Keep focus rings and text labels for icon actions.
- Scale layout tracks, not the whole interface. Never use CSS transform scale or browser zoom to make a narrow layout appear to fill the desktop.
- Use subtle 12px corners, fine warm borders and restrained shadows. Avoid oversize empty hero areas, oversized decorative illustrations and many identical statistic cards.
- No forced viewport-height clipping. Tables may scroll within a clearly bounded area; primary controls and error messages must remain reachable.
- Narrow-window reflow and browser zoom must remain usable. Desktop-first does not justify unreadable controls or inaccessible overflow.

## Operator portal screens

| Image | Page and purpose |
|---|---|
| `operator-01-overview.png` | Overview: current workload, a compact queue, printer states and recent staff activity. Counts come from actual records in implementation. |
| `operator-02-print-queue.png` | Print queue: search, state filters, paginated job table and selected job panel. The panel stays beside the table on wide screens. |
| `operator-03-job-details.png` | Job details: print configuration, payment/release eligibility and event history. File metadata is visible within authorized scope; document contents require an explicit grant. |
| `operator-04-printers.png` | Printers and linked stations: capabilities, observed connection state, last-seen time and device mapping. Pairing requires authorized staff. |
| `operator-05-services-rates.png` | Services and rates: supported print options and explicit pricing units. Saved rate changes apply to new quotes, not previously accepted prices. |
| `operator-06-team-settings.png` | Team and shop settings: memberships, invitations, role permissions and shop-profile entry point. Owner-only actions require backend checks. |

Shared staff sign-in should reuse the existing authentication design and provider policy; do not introduce separate prototype credentials. Invitation acceptance, role editing, shop profile, access review and rejection reasons are supporting forms/drawers within these pages. Their existence in a concept does not establish a finished backend contract.

## Desktop software screens

| Image | Page and purpose |
|---|---|
| `station-01-connect.png` | Connect station: authenticate staff, select an authorized shop, map a local printer. Never request unrestricted storage/database credentials in the UI. |
| `station-02-release.png` | Release desk: scanner input or manual release code, local printer readiness and recent activity. Keyboard/scanner focus is the main interaction. |
| `station-03-review.png` | Review released job: authorized preview, confirmed settings and compatible printer selection before dispatch. Changes affecting the quote require a new authorized workflow. |
| `station-04-monitor.png` | Print monitor: verified download, spool submission and outcome confirmation shown as distinct stages. No fabricated percent or page progress. |
| `station-05-history.png` | History and recovery: recorded outcomes, pending synchronization and uncertain-print review. Check outcome before any retry to avoid duplicate prints. |
| `station-06-settings.png` | Station settings: printer mapping, connection, redacted diagnostics and pending temporary-file cleanup. |

Lock/unlock, expired or invalid release, printer offline, paper jam, lost connection, uncertain outcome and disconnect confirmation are supporting states of these screens. No automatic reprint on reconnect. Do not claim physical success from a successful spool API call. Operator confirmation is a proposed fallback where the hardware cannot report reliable completion; the final policy must be agreed during the shop phase.

## Image interpretation and implementation boundaries

Illustrative job references, dates, rates, counters and staff entries exist only inside the design images. They are not seed data and must never be copied into runtime fallbacks. Render real empty states where services or records are absent. Known data, unknown data and stale data need distinct labels.

Generated images guide composition, visual hierarchy and appearance. Small generated text and icon variations are not authoritative requirements; use this written contract for exact labels and behavior. Reuse one consistent shell per product in implementation even where image variants differ slightly.

Specific implementation corrections to illustrative image copy:

- A public job reference such as `P-1042` is never a release credential. The release field must say "Enter release code" and validate a separate, expiring, shop-scoped secret with attempt limits. A barcode is only its transport, not proof by itself.
- Do not promise confirmation emails until an actual delivery integration exists. The release instruction should reference the customer's receipt.
- Do not infer retention periods, a filename logging policy, real shop addresses or printer capabilities from sample image text. Local cleanup must run after safe processing and on recovery; it must not wait indefinitely for an operator confirmation. Uncertain outcomes retain reconciliation metadata, not unnecessary document copies.
- Print settings and document counts for a real job must remain consistent across screens. These independently generated examples are not a single recorded session.
- Approved membership and server-validated scope are required even if a local printer is ready. During first-time setup, display "No shop selected" until the shop association is actually established.

Payments, printer status, availability, permissions and document access must come from their authoritative services. Missing integrations stay unavailable with a useful explanation. No public file URLs, payment override toggle, customer-library browsing, unredacted logs or secret configuration fields.

Web and desktop layouts should be implemented with native components, not image backgrounds. Any transitions should be brief and respect reduced-motion preferences. Animation is optional and must not delay operations.

## Files and provenance

- Images and HTML gallery: `output/design/operator-station/`.
- Exact generation prompts: [OPERATOR_STATION_PROMPTS.md](OPERATOR_STATION_PROMPTS.md).
- Customer visual reference: `output/design/dashboard/concept-b-paper-desk.png`.
- Current implementation scope: [IMPLEMENTATION_HANDOFF.md](../IMPLEMENTATION_HANDOFF.md).
- Generation method: built-in image-generation tool; twelve separately generated desktop screen concepts.
- PNG exports are 1672 x 941 pixels. The implementation target sizes above refer to real UI viewports, not the bitmap dimensions.

These concepts are ready for design review. They do not mark the shop portal or printing software as implemented, approved for production, or tested on hardware.
