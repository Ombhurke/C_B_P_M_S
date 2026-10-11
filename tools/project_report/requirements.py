"""Project-specific SRS content with explicit targets and production limits."""
from layout import p,h,bullet,table,WIDTH,Spacer,PageBreak


def overall():
    return [h('2 OVERALL DESCRIPTION'),h('2.1 Product Perspective',2),
        p('CBPMS connects two independently deployable interfaces: a web platform for customers and shop staff, and a Windows desktop agent for print release. Both depend on the same backend contracts for identity, shop ownership, job state and document access. Separate deployment does not mean an offline agent may invent queue entries or bypass authorization.'),
        p('The browser communicates with same-origin Next.js server routes. Those routes forward permitted operations to FastAPI, which applies business rules and accesses private PostgreSQL records and document storage. Google customer identity is provided through Supabase Auth [3]. The desktop agent authenticates to one shop and receives only limited job-specific download access.'),
        h('2.2 User Classes and Characteristics',2),
        bullet('Anonymous customer','Submits a temporary print job without an account. Access to status depends on a short-lived capability, not on a public document link.'),
        bullet('Account customer','Signs in with Google, views only their own library and history, and may still choose anonymous mode for a particular job.'),
        bullet('Shop operator','Uses a separately provisioned staff account to inspect the assigned shop queue and release eligible jobs through the desktop agent.'),
        bullet('Shop administrator','Manages staff, rates and printer configuration within the assigned shop. This role does not imply access to other shops or customer libraries.'),
        h('2.3 Operating Environment',2),
        p('The customer and shop interfaces use a desktop-first Next.js website in a modern browser. A shop-specific link or QR code identifies the selected counter. A native mobile app is outside the present scope. The backend uses Python and FastAPI; Supabase provides PostgreSQL and the intended private object-storage service. The printing agent uses Python, PySide6 and Windows printing interfaces.'),
        p('Printer support must be validated for the chosen model, driver and document format. RAW spooling expects printer-ready data and is not a general PDF/image renderer [5]. Unsupported print settings or formats must fail clearly rather than be reported as successful.'),
        h('2.4 Assumptions and Dependencies',2),
        bullet('Connectivity','Internet access is needed for authentication, upload, queue access and outcome reporting. The agent stores pending completion reports for retry after a network interruption.'),
        bullet('Provisioning','Real shops, staff accounts, a private storage bucket, provider credentials and authorized callback URLs must be configured before public use.'),
        bullet('Hardware','A compatible Windows printer and appropriate driver are required. A USB barcode scanner is optional when manual PIN entry is available.'),
        bullet('External services','Google authentication, Supabase availability and a future live payment gateway are external dependencies. Provider outages must produce an explicit unavailable state.'),
        PageBreak()]


def problem_sdlc():
    return [h('3 SYSTEM OVERVIEW AND PROBLEM STATEMENT'),
        p('A conventional print counter may receive documents through messaging applications, email or removable drives. Such workflows can leave files on shared computers and require staff to manually interpret print options, confirm payment and locate the correct document. These are the workflow risks addressed by the project; no field survey or measured time saving is claimed.'),
        p('CBPMS assigns each job to one selected shop and keeps document bytes private. The backend validates the upload, calculates the amount and requires verified payment before issuing a release PIN. An authorized operator claims the job, downloads it through a limited grant and sends it to the printer. Completion reporting determines subsequent retention: temporary anonymous files are deleted, while account-library documents remain private until the applicable deletion action.'),
        p('The objectives are to reduce manual file handling, isolate independent shops and make failures visible. Authorization and state checks must prevent forged payment, cross-shop access and duplicate claims.'),
        h('4 SOFTWARE DEVELOPMENT LIFE CYCLE'),
        p('The project uses the following seven-stage SDLC framework for SEPM documentation. Implementation may revisit earlier stages as requirements and tests change; the stages do not imply a strictly one-pass development process.'),
        table([
            ['Stage','Activities applied to CBPMS','Deliverables'],
            ['1 Planning','Define scope, stakeholders, feasibility, risks and the web-before-desktop delivery order.','Project overview, risk list and proposed Gantt schedule.'],
            ['2 Requirement Analysis','Define privacy modes, actors, tenant boundaries, document retention and acceptance conditions.','SRS, use-case diagram, scenarios and requirement IDs.'],
            ['3 Design','Specify data ownership, API boundaries, job states and interactions between web, backend and agent.','Architecture, DFDs, control flow, UML class and sequence diagrams.'],
            ['4 Implementation','Build persistent records, Google identity, document validation, shop queues and agent integration in increments.','Source modules, migrations, environment templates and integration notes.'],
            ['5 Testing','Check authorization, upload validation, payment idempotency, expiry, restart recovery and hardware failure paths.','Automated test results, defect records and manual acceptance evidence.'],
            ['6 Deployment','Provision real services, secrets, private storage, shop accounts, HTTPS and the desktop installation.','Deployment runbook, configured environment and operator instructions.'],
            ['7 Maintenance','Monitor failures, review access and dependencies, reconcile orphan files and refine the printing pipeline.','Maintenance log, security fixes and updated documentation.'],
        ],[89,222,WIDTH-311],padding=6),
        Spacer(1,10),p('Scheduling baseline: the companion Gantt chart illustrates 07 September to 29 November 2026. It is a proposed academic schedule, not evidence of actual completion dates. Documentation continues alongside all development stages.','small'),PageBreak()]


def functional():
    rows=[
        ['ID','Requirement','Actor','Required behaviour','Priority'],
        ['FR01','Shop discovery and context','Customer','The system shall list active shops and map a valid shop link or QR code to the correct printing counter.','High'],
        ['FR02','Identity and privacy mode','Customer','The system shall support Google account access and anonymous mode per complete job. Client input shall not grant staff roles.','High'],
        ['FR03','Upload and validation','Customer, API','The server shall validate PDF, PNG and JPEG uploads, enforce the configured size limit and reject invalid or encrypted PDFs.','High'],
        ['FR04','Options and price','Customer, API','The server shall validate copies, colour, duplex and layout options, derive page count and freeze a shop-rate-based price.','High'],
        ['FR05','Private library','Account customer','The system shall show only owner-linked documents. Reuse or deletion shall require ownership checks; active-job deletion shall be blocked.','High'],
        ['FR06','Verified payment','API, provider','A live adapter shall verify captured payment, order, amount and currency idempotently. An unavailable provider shall not mark a job paid.','High'],
        ['FR07','Release credential','API','The system shall issue a shop-unique active release PIN and barcode only after verified payment. Expired jobs shall not be released.','High'],
        ['FR08','Shop queue isolation','Shop staff','Authenticated staff shall see only their assigned shop queue. Unauthorized cross-shop requests shall fail without disclosing job data.','High'],
        ['FR09','Controlled print release','Operator, agent','The agent shall claim an eligible job, obtain a short-lived download grant, verify the file hash and spool supported content.','High'],
        ['FR10','Outcome and recovery','Agent, API','The agent shall report success or failure. Repeated outcome reports shall be safe, and reconnect retries shall not automatically reprint.','High'],
        ['FR11','Retention and deletion','System, customer','Anonymous files shall become inaccessible after completion or expiry and be deleted. Library documents follow owner deletion and retention rules.','High'],
        ['FR12','Administration and audit','Shop admin','The system shall persist shop rates and permitted staff changes, and record relevant operational events without storing document contents in logs.','High'],
    ]
    return [h('5 FUNCTIONAL REQUIREMENTS'),
        p('The requirements below define the intended system behaviour. High priority means necessary for the initial operational release, not necessarily completed. FR06 requires a live provider implementation; production payments currently remain disabled.'),
        table(rows,[39,85,57,WIDTH-229,48],size=10.2,padding=5),
        Spacer(1,10),p('File baseline: PDF, PNG and JPEG; DOCX must first be exported to PDF. The current validator accepts unencrypted PDFs with 1-1000 pages. The current job model uses one document per job; arbitrary page-range selection is not yet supported.','small'),
        PageBreak()]


def nonfunctional():
    return [h('6 NONFUNCTIONAL REQUIREMENTS'),
        p('The measurable values below are acceptance targets for a controlled pilot. They are not service guarantees or results of completed load testing.'),
        h('6.1 Performance Requirements',2),
        bullet('NFR01 Availability','Target at least 99.5% availability during agreed shop operating hours, measured over a pilot month. Record the monitoring window and all excluded maintenance periods.'),
        bullet('NFR02 Responsiveness','Target a 95th-percentile response time within 2 seconds for ordinary metadata and release-verification requests with 10 concurrent users. Exclude file transfer and external-provider latency, and record the test environment.'),
        bullet('NFR03 Queue updates and recovery','Target queue refresh within 5 seconds under normal connectivity. Persist records across restart. A network interruption shall trigger an error or stale-state indicator, not fabricated success.'),
        h('6.2 Security and Privacy Requirements',2),
        bullet('NFR04 Identity and authorization','Verify customer identity and enforce owner and shop boundaries on the backend. Anonymous access shall use unguessable capabilities. A four-digit PIN alone shall not authorize public document download.'),
        bullet('NFR05 Secure transport and secrets','Use HTTPS/WSS outside local development and verify database certificates and hostnames [4]. Keep database credentials and privileged storage keys server-side. Browser session cookies shall be HttpOnly and Secure in HTTPS deployments.'),
        bullet('NFR06 Private storage and data minimization','Store documents in a non-public bucket. Account mode necessarily retains limited identity information; anonymous jobs shall not be linked into an account library. Do not log raw tokens, credentials or document contents.'),
        bullet('NFR07 Retention and access expiry','Use the configured temporary-job TTL, currently two hours, and short-lived download grants. Deny access when a grant or job expires. Retry failed deletion and flag unresolved cleanup. Retained library documents follow a separate owner-controlled policy.'),
        bullet('NFR08 Abuse prevention','Throttle sign-in and PIN attempts, enforce upload limits and reject invalid state transitions. Before public launch, add upload/parser isolation, operational monitoring and dependency-risk review.'),
        h('6.3 Design Constraints',2),
        bullet('NFR09 Usability','Use a desktop-first, readable interface with visible controls, clear validation errors and keyboard access. Do not require animation to complete authentication or print submission.'),
        bullet('NFR10 Compatibility and maintainability','Keep web, API and Windows agent modules independently testable. Restrict printing to verified device capabilities. Document migrations, deployment steps, backups and recovery procedures.'),
        p('Deleting an application file does not establish forensic erasure from SSDs, backups, the Windows spooler or printer memory. The project shall not claim guaranteed physical erasure without separate evidence.','small'),PageBreak()]
