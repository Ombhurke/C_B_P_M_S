# Option B: customer page concepts

Approved direction: **Paper desk** — warm ivory canvas, espresso top navigation,
terracotta actions, editorial headings and readable body text.

These are visual proposals with illustrative records. They do not change the running
frontend or imply that the displayed shops, files or payment features are live.

Latest scope: print shops will be added later. Follow `Docs/IMPLEMENTATION_HANDOFF.md`.
Implement directory/job empty states until real records exist. Do not seed the sample
shops or copy the images' records into the application.

## Find a shop

Core idea: help the customer choose a counter by its services and prices.

- Search by shop name or area.
- Filter by colour, duplex and paper-size support.
- Compare clear shop cards with address and per-page rates.
- View details before selecting a shop.
- Selection carries the chosen shop into document preparation.
- Avoid distance, ratings and waiting-time claims without a real data source.

Image: `output/design/dashboard/option-b-find-a-shop.png`.

## Print jobs

Core idea: understand what is happening to each submitted request.

- Filter current, completed and attention-needed jobs.
- Show document, shop, status and total in a readable list.
- Select a row to inspect configuration and next actions alongside it.
- Continue payment for eligible unpaid requests; show a release receipt only after verified payment.
- Offer cancellation only where the job state and payment policy allow it.
- Keep job history separate from the reusable document library.

Image: `output/design/dashboard/option-b-print-jobs.png`.

## My prints

Core idea: a private shelf of reusable documents.

Here, **My prints** means saved documents; **Print jobs** means printing requests.
The proposed route can remain `/account/documents` even if the navigation label is My prints.

- Upload, search and filter private documents.
- See paper previews, page counts and file sizes.
- Open a details panel without losing the list position.
- Print again creates a new job with a fresh shop-specific quote.
- Download securely or request deletion.
- Anonymous-job files never appear in the library.

Image: `output/design/dashboard/option-b-my-prints.png`.

## Shared appearance

Use the same horizontal navigation and active-page underline on every page.
Headings use the reference's editorial serif; controls and metadata use a clean sans serif.
Keep full desktop width with approximately 48–56px gutters, 16–18px body/control text
and controls at least 48px tall. Let content determine card size.

Generated with the built-in image-generation tool, using
`output/design/dashboard/concept-b-paper-desk.png` as the style reference.
