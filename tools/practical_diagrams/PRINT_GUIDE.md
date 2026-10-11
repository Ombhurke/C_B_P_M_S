# CBPMS practical output sheets

These original diagrams adapt the *level of detail* in the supplied references to
CBPMS. They do not copy the unrelated task/property-management systems.
Application code, environment settings and backend data have not been changed.

## Outputs and aims

| Sheet | Output | Practical aim |
| --- | --- | --- |
| 01 | Gantt chart | Project scheduling |
| 02 | UML use-case diagram | Actors and use cases |
| 03 | Four use-case scenarios | Preconditions, normal flow, exceptions, outcomes |
| 04 | Context DFD (Level 0) | System boundary and external data flows |
| 05 | DFD Level 1 | Processes, logical data stores and data movement |
| 06 | Control-flow diagram | Decisions, success paths and error paths |
| 07 | UML class diagram | Attributes, operations, associations and multiplicity |
| 08 | UML sequence: submission | Upload, pricing, persistence and verified payment |
| 09 | UML sequence: print release | Authorized claim, download, spooling and cleanup |

## Printing

- Separate PNGs are in `images/`, at 300 dpi with a white background.
- The combined PDF contains vector text and shapes, one diagram per page.
- The native page size is A3 landscape. Use A3 for the clearest diagram labels;
  A4 landscape with **Fit to printable area** works when A3 is unavailable.
- Do not use Fill/Crop. The preview contact sheet is not intended for printing.
- All content uses rectangles, ellipses, diamonds, UML actors, lifelines and
  labelled connectors that can be recreated in draw.io. SVGs in `vectors/` are
  scalable reference images, not native editable `.drawio` documents.

## Assumptions and model scope

1. The schedule is an **illustrative proposed baseline**, 7 September to
   29 November 2026. It does not claim these dates are your actual history or
   deadline. Documentation is concurrent throughout all 12 weeks.
2. These are design models, not evidence that the full production system is
   deployed. The live payment gateway is **planned**; production payment is
   currently disabled until a real adapter is configured. Test-only mock
   payment is deliberately not presented as a production capability.
3. Customer identity is Google via Supabase, with optional per-job anonymous
   mode. Staff uses separate shop-scoped authentication. Shop admin inherits
   operator capabilities; there is no implied global cross-shop access.
4. A job uses one document at one selected shop. The class model is conceptual:
   operations express domain responsibilities and do not claim every displayed
   entity is a standalone Python class or SQL table. Payment/grant data may be
   embedded in job records in the implementation.
5. A customer status capability and a short-lived download grant serve different
   purposes; neither is a public storage URL. A release PIN alone must not grant
   unauthenticated document download access.
6. Anonymous document bytes are temporary. Account-linked library documents may
   be retained privately. Active-job checks apply before user-requested deletion.
7. A completed spool submission is not proof that paper physically printed.
   Temporary-file cleanup is not a claim of guaranteed forensic erasure on SSDs.
8. The context DFD boundary encloses web, API and persistence; shop staff/desktop
   agent, Google/Supabase Auth and payment gateway are external participants.
   Logical stores first appear in Level 1, not as context-level external actors.
9. The Level 1 stores group information by purpose, not by current physical
   schema. Processes can share stores. API-mediated and direct signed-object
   downloads are both shown abstractly as an authorized storage interaction.

## Source alignment

The model was aligned with the repository's current Google-authentication setup,
job/document schemas, payment-provider boundary, and the user's project plan.
Stale password-customer-registration and DOCX assumptions from early project
documents were not reused. No credentials or personal uploaded documents appear
in these outputs.

## Reproduction

Generator source: `tools/practical_diagrams/`.

```powershell
python tools/practical_diagrams/build.py --poppler "C:/path/to/pdftoppm.exe"
```

Requires the already available ReportLab, Pillow and pypdf packages plus Poppler.
Rebuilds only the practical artifacts under `output/pdf/cbpms_practicals/`.
