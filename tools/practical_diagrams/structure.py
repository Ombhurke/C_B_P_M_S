"""Conceptual domain classes and two complementary UML sequence diagrams."""
from drawing import Sheet, TEAL, CREAM, CORAL, INK, MUTED, WHITE, LINE


def klass(s,x,y,w,title,attrs,ops,fill=TEAL):
    h=42+len(attrs)*20+16+len(ops)*20+15
    s.rect(x,y,w,h,WHITE,INK)
    s.rect(x,y,w,38,fill,INK)
    s.text(x+w/2,y+9,title,18,True,align='center')
    s.text(x+13,y+48,'\n'.join(attrs),14)
    div=y+48+len(attrs)*20
    s.line([(x,div),(x+w,div)])
    s.text(x+13,div+10,'\n'.join(ops),14)
    return h


def classes(c,out):
    s=Sheet(c,out,'07_class_diagram','UML class diagram - core domain',
            'Conceptual object model: responsibilities and multiplicities, not the physical PostgreSQL table layout.',7)
    klass(s,35,161,305,'User',
          ['- id: UUID','- email: String','- role: Customer | Operator | Admin'],
          ['+ canAccess(resource): Boolean','+ signOut(): void'])
    klass(s,448,161,304,'Document',
          ['- id: UUID','- ownerId: UUID [0..1]','- hash: String; mimeType: String','- retention: Temporary | Library'],
          ['+ validate(): ValidationResult','+ deleteIfInactive(): void'])
    klass(s,859,161,306,'PrintJob',
          ['- id: UUID; shopId: UUID','- accessMode: Anonymous | Account','- status: JobStatus; expiresAt: DateTime','- copies: Integer; color: Boolean','- duplex: DuplexMode; layoutNup: Integer'],
          ['+ calculatePrice(): Money','+ claim(shop): ClaimResult','+ complete(outcome): void'])
    klass(s,35,530,305,'Shop',
          ['- id: UUID; name: String','- currency: String','- bwRate: Decimal; colorRate: Decimal'],
          ['+ updateRates(): void','+ listOwnQueue(): List<PrintJob>'],CREAM)
    klass(s,448,530,304,'AccessGrant',
          ['- tokenHash: String','- expiresAt: DateTime','- purpose: DocumentDownload'],
          ['+ isValid(now): Boolean','+ revoke(): void'],CREAM)
    klass(s,859,530,306,'PaymentOrder',
          ['- id: String; provider: String','- amountMinor: Integer; currency: String','- status: Pending | Captured | Failed'],
          ['+ verifyCapture(): Receipt','+ matches(job): Boolean'],CORAL)
    # Multiplicities live at their respective ends of each association.
    s.line([(340,218),(448,218)])
    s.text(348,194,'0..1',12);s.text(419,194,'0..*',12)
    s.label(393,223,'owns',12)
    s.line([(752,218),(859,218)])
    s.text(758,194,'1',12);s.text(830,194,'0..*',12)
    s.label(806,223,'uses',12)
    s.line([(187,334),(187,530)])
    s.text(201,367,'0..*',12);s.text(201,508,'0..1',12)
    s.label(186,421,'staff assigned to',13)
    s.line([(340,582),(390,582),(390,473),(1060,473),(1060,394)])
    s.text(346,558,'1',12);s.text(1070,428,'0..*',12)
    s.label(997,454,'receives jobs',13)
    s.line([(600,354),(600,530)])
    s.text(614,383,'1',12);s.text(614,508,'0..*',12)
    s.label(599,412,'protected by',13)
    s.line([(1140,394),(1140,530)])
    s.text(1148,427,'1',12);s.text(1143,506,'0..1',12)
    s.label(1130,479,'has',12)
    s.text(35,746,'- private attribute   + public operation   |   0..1 optional   0..* many   |   Solid lines: associations',13,color=MUTED)
    s.text(35,768,'Constraints: anonymous document has no owner; each job uses one document at one shop. Live PaymentOrder adapter is planned.',12,color=MUTED)
    s.finish()


def participants(s,names,end=750):
    for x,name in names:
        s.box(x-73,150,146,52,name,TEAL if 'planned' not in name else CORAL,14)
        s.line([(x,202),(x,end)],dashed=True,color=LINE)


def message(s,a,b,y,label,dashed=False):
    s.line([(a,y),(b,y)],arrow=True,dashed=dashed,open_head=dashed)
    s.label((a+b)/2,y-23,label,12)


def frame(s,x,y,w,h,kind,condition):
    s.rect(x,y,w,h,WHITE,INK)
    s.rect(x,y,54,25,CREAM,INK)
    s.text(x+8,y+4,kind,12,True)
    s.text(x+65,y+5,condition,12)


def sequence_submit(c,out):
    s=Sheet(c,out,'08_sequence_submission','UML sequence diagram - customer submission',
            'Scenario UC02. Authentication and server validation precede payment; the browser cannot mark a job as paid.',8)
    # Fragments are drawn before lifelines so the dashed lifelines remain visible.
    frame(s,35,212,720,38,'ref','UC01: Google sign-in only for account mode; anonymous flow skips sign-in')
    frame(s,35,558,1130,219,'alt','[valid captured payment, matching amount / currency / order]')
    s.line([(35,691),(1165,691)],dashed=True)
    s.text(101,696,'[payment failed or provider unavailable: keep job staged]',12)
    participants(s,[(110,'Customer'),(295,'Web / BFF'),(485,'API services'),(680,'Database'),(870,'Private storage'),(1080,'Payment gateway\n[planned]')],777)
    s.rect(481,302,8,438,TEAL,INK)
    s.rect(1076,458,8,51,CORAL,INK)
    s.rect(1076,536,8,62,CORAL,INK)
    message(s,110,295,280,'1. Shop + privacy mode + file / options')
    message(s,295,481,316,'2. Authorized upload request')
    s.line([(489,345),(530,345),(530,369),(489,369)],arrow=True)
    s.label(681,345,'3. Validate file; derive pages and price; enforce access',12)
    message(s,489,870,396,'4. Store validated file privately')
    message(s,489,680,428,'5. Persist staged job')
    message(s,489,1076,466,'6. Create order with server-priced amount and currency')
    message(s,1076,489,502,'7. Order reference / provider checkout data',True)
    message(s,489,1076,540,'8. Verify capture after customer completes provider checkout')
    message(s,1076,489,592,'9. Verified receipt (idempotent processing)',True)
    message(s,489,680,620,'10. Save paid job + PIN')
    message(s,481,295,650,'11. Receipt + release PIN',True)
    message(s,295,110,678,'12. Show receipt + PIN',True)
    message(s,481,295,734,'13. Payment not confirmed',True)
    message(s,295,110,763,'14. Show safe error',True)
    s.text(35,782,'Solid arrow: request/call. Dashed open arrow: response. Narrow bar: activation. alt: alternative outcomes. ref: referenced interaction.',10,color=MUTED)
    s.finish()


def sequence_release(c,out):
    s=Sheet(c,out,'09_sequence_print_release','UML sequence diagram - print release and cleanup',
            'Scenario UC07. A paid, unexpired job is released only within its assigned shop; documents are never public.',9)
    frame(s,35,561,1130,211,'alt','[spool accepted]')
    s.line([(35,706),(1165,706)],dashed=True)
    s.text(102,711,'[spool rejected]',12)
    participants(s,[(110,'Shop operator'),(295,'Desktop agent'),(485,'API services'),(680,'Database'),(870,'Private storage'),(1080,'Printer / spooler')],772)
    s.rect(291,234,8,530,TEAL,INK)
    s.rect(481,270,8,205,TEAL,INK)
    message(s,110,291,237,'1. Scan / enter release PIN')
    message(s,299,481,279,'2. Claim with staff session / PIN')
    message(s,489,680,321,'3. Check + atomic claim')
    message(s,680,489,363,'4. Claimed job metadata',True)
    message(s,481,299,405,'5. Grant + expected hash',True)
    message(s,299,870,447,'6. Download via authorized grant (direct or API-mediated)')
    message(s,870,299,489,'7. Document bytes; agent verifies hash',True)
    message(s,299,1080,532,'8. Submit validated document + print options')
    message(s,1080,299,596,'9. Spool acceptance / spool job ID',True)
    message(s,299,485,627,'10. Report completion')
    message(s,485,680,654,'11. Persist completed state')
    message(s,485,870,684,'12. Delete anonymous object; retain library object')
    message(s,299,485,757,'13. Report spool failure')
    s.text(35,780,'On failure: retain cloud file until expiry. Download/hash errors abort before step 8. Always clear local files. Spooling is not physical printing.',11,color=MUTED)
    s.finish()
