# Desktop frontend baseline

Decision: 2026-10-07. Restore the warm editorial landing design and make desktop browsers the release target. This replaces mobile-web/PWA-first positioning; it does not alter backend contracts or require users to install software.

## Layout rules

- Landing: four full-viewport sections (intro, workflow, privacy, counters), with the footer inside the last section.
- No fixed 1280/1500/1600px page-width caps. Landing and workspace containers occupy the available width minus `clamp(32px, 3.2vw, 88px)` on each side. At 1920px, the gutter is about 61px, not several hundred pixels.
- Large screens receive larger headings, body text, cards, and navigation. Paragraph line lengths remain bounded for readability; this is distinct from capping the page itself.
- Short screens and high browser zoom may expand vertically. Never hide content simply to force a viewport height. Narrow-window reflow is an accessibility fallback, not a separate mobile product.
- Warm brown, cream, peach, and bronze; reuse the existing hero photograph. No new visual dependencies.
- Native document scrolling with optional desktop proximity snapping; no nested scroll container or wheel interception. One-time blur/fade reveals use IntersectionObserver. Reduced-motion users receive visible content without animated scrolling or reveals.
- Keyboard focus, skip link, active-section navigation, and an Escape-dismissable compact menu remain available.

## Scope and preservation

Restored landing files: `apps/web/app/page.tsx`, `apps/web/app/landing.css`, `StatusHeader`, `WorkflowSteps`, `CounterQrCard`, and the landing experience hook. Customer, shop, and operator routes receive a shared fluid outer container only. Authentication, upload, pricing, payment, APIs, database, and desktop-agent logic are not changed.

Do not restore these files with a broad Git reset: the worktree also contains unrelated implementation changes. Preserve the current desktop design if another agent edits presentation.

## Manual checks

Run the web build and open the local preview at 1280×720, 1366×768, 1440×900, and 1920×1080. Confirm section heights, modest symmetric gutters, no horizontal overflow, working anchor links, and existing workspace/shop/operator destinations. Check a narrow window as a reflow fallback. QR checkout still needs a URL reachable by the scanning device; localhost is only reachable on the same computer.
