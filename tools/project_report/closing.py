"""Verification notes and remaining work for the academic project report."""
from layout import p,h,table,WIDTH,Spacer


def closing():
    return [h('6.4 Verification and Current Status',2),
        p('The project verification record [1] reports 41 passing backend tests and 11 passing web security tests, along with successful TypeScript and production-build checks. These results were recorded earlier and were not repeated while preparing this report. Automated tests still need to be supported by user acceptance, load testing and testing with the actual printer.'),
        table([
            ['Area','Recorded position and remaining condition'],
            ['Customer authentication','Google provider and authorization redirect verified. Complete a real Google-consent sign-in, callback, reload and logout test.'],
            ['Persistence and access','Private PostgreSQL initialization and access restrictions verified. Provision real shop and staff records; validate backup and restore.'],
            ['Documents and storage','Validation and access rules have automated coverage. Configure private production storage and test real upload, expiry and deletion.'],
            ['Payment','Production payments are disabled. Implement and verify a live adapter, signed webhook handling and payment reconciliation.'],
            ['Desktop printing','Agent code and recovery paths exist. Validate the actual printer, driver, scanner, supported settings and failure behaviour.'],
        ],[112,WIDTH-112],size=10.5,padding=7),
        Spacer(1,10),
        p('<b>Release checks:</b> test owner isolation, cross-shop rejection, server-side file validation, persistence after restart, payment verification before release and cleanup for each privacy mode. A failed or interrupted print must not be shown as successful. The selected printer must also be checked with real paper output.'),
        p('Before public use, the project still needs private-storage setup, real shop and staff records, payment-gateway integration, monitoring, dependency review and a recovery test. The current implementation is an academic development baseline.'),
    ]
