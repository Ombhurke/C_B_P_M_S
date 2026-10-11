"""Reference-aligned cover, contents, introduction and terminology."""
from layout import p,h,table,toc,WIDTH,Spacer,PageBreak


def cover():
    return [
        p('ST. VINCENT PALLOTTI COLLEGE OF<br/>ENGINEERING AND TECHNOLOGY','institution'),
        p('<b>Department of Artificial Intelligence</b><br/>Software Engineering and Project Management','center'),
        Spacer(1,17),
        p('<b>PROJECT REPORT</b>','center'),
        p('Cloud Based Print<br/>Management System','title'),
        p('CBPMS','center'),Spacer(1,12),
        table([
            ['<b>Student Name</b>','OM Yuvraj Bhurke'],['<b>UID</b>','24001010'],
            ['<b>Semester</b>','5th Semester'],['<b>Academic Year</b>','2026-27'],
            ['<b>Course</b>','Software Engineering and Project Management (SEPM)'],
        ],[140,WIDTH-140],header=False,size=11.5,padding=8),
        Spacer(1,13),h('Project Details',2),
        table([
            ['Field','Details'],['Document Title','Case Study and Software Requirements Specification'],
            ['Project Name','Cloud Based Print Management System (CBPMS)'],
            ['Status','Academic project report'],['Prepared By','OM Yuvraj Bhurke (UID 24001010)'],
        ],[140,WIDTH-140],padding=7),
        PageBreak(),
    ]


def contents_intro():
    rows=[('Project Details',1,False),('1 Introduction',2,False),('1.1 Purpose',2,True),
          ('1.2 Scope',2,True),('1.3 Intended Audience',3,True),
          ('1.4 Definitions Acronyms and Abbreviations',3,True),('1.5 References',3,True),
          ('2 Overall Description',4,False),('2.1 Product Perspective',4,True),
          ('2.2 User Classes and Characteristics',4,True),('2.3 Operating Environment',4,True),
          ('2.4 Assumptions and Dependencies',4,True),('3 System Overview and Problem Statement',5,False),
          ('4 Software Development Life Cycle',5,False),('5 Functional Requirements',6,False),
          ('6 Nonfunctional Requirements',7,False),('6.1 Performance Requirements',7,True),
          ('6.2 Security and Privacy Requirements',7,True),('6.3 Design Constraints',7,True),
          ('6.4 Verification and Current Status',8,True)]
    return [h('TABLE OF CONTENTS'),toc(rows),Spacer(1,13),h('1 INTRODUCTION'),h('1.1 Purpose',2),
        p('This report describes the Cloud Based Print Management System (CBPMS), its main requirements and its proposed working process. It is prepared for the Software Engineering and Project Management subject and will be used while developing and testing the project. The system is designed for private document submission and printing through a selected shop.'),
        h('1.2 Scope',2),
        p('CBPMS comprises a customer website, a shop web workspace, a FastAPI backend, persistent records, private document storage and a Windows printing agent. A customer selects a shop, chooses anonymous or account-linked mode, uploads a PDF or supported image, configures printing and obtains a release credential after server-verified payment. Anonymous files are temporary; account-linked files may remain in a private library.'),
        p('Native mobile applications, DOCX conversion and printer manufacturing are outside the current project scope. Real payment integration and testing with the final printer are still to be completed.'),PageBreak()]


def terms_references():
    return [h('1.3 Intended Audience',2),
        p('This document is intended for the student developer, faculty guide, academic evaluators, shop administrators and printing operators. Developers use it to define component boundaries and tests; evaluators use it to relate the implementation to project-management and software-engineering deliverables. Operators use the workflow requirements to understand authorized release, failure handling and document retention.'),
        h('1.4 Definitions Acronyms and Abbreviations',2),
        table([
            ['Term','Definition'],['CBPMS','Cloud Based Print Management System.'],
            ['SRS','Software Requirements Specification.'],['SDLC','Software Development Life Cycle.'],
            ['PII','Personally identifiable information, such as an account email address.'],
            ['OAuth and PKCE','Authorization flow and proof-key mechanism used for Google customer sign-in.'],
            ['Tenant','An independent printing shop with its own staff, settings and job queue.'],
            ['Capability token','An unguessable credential granting limited access to a job or document.'],
            ['TTL','Time to live: the interval after which a job or grant expires.'],
            ['Spooling','Submitting a document to the operating-system print queue; not proof of physical output.'],
            ['Ephemeral file','A temporary file subject to the applicable deletion and expiry policy.'],
        ],[108,WIDTH-108],padding=7),
        h('1.5 References',2),
        p('The following sources were used for the project design and implementation.','small'),
        p('[1] CBPMS project repository. <i>Google-only customer authentication</i>, Docs/GOOGLE_AUTH_SETUP.md; verification dated 07-08 October 2026. Current source modules: job schemas, document inspection, payments and release services.','small'),
        p('[2] CBPMS. <i>Practical Output Sheets</i>, 09 October 2026. Gantt chart, UML use cases and scenarios, DFDs, control flow, class diagram and sequence diagrams.','small'),
        p('[3] Supabase Documentation. <i>Sign in with Google</i>. Accessed 09 October 2026.<br/><link href="https://supabase.com/docs/guides/auth/social-login/auth-google" color="#000000">https://supabase.com/docs/guides/auth/social-login/auth-google</link>','small'),
        p('[4] PostgreSQL Documentation. <i>SSL Support</i> (TLS connection verification). Accessed 09 October 2026.<br/><link href="https://www.postgresql.org/docs/current/libpq-ssl.html" color="#000000">https://www.postgresql.org/docs/current/libpq-ssl.html</link>','small'),
        p('[5] Microsoft Learn. <i>RAW Data Type</i>, Windows printing documentation. Accessed 09 October 2026.<br/><link href="https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type" color="#000000">https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type</link>','small'),PageBreak()]
