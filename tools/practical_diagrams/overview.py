"""Schedule, human-facing use cases, and structured scenario outputs."""
from drawing import Sheet, INK, MUTED, LINE, TEAL, CREAM, CORAL, ACCENT, WHITE


def gantt(c, out):
    s = Sheet(c,out,'01_gantt_chart','Project scheduling - Gantt chart',
              'Proposed academic baseline: 07 September - 29 November 2026 (12 weeks). Bars are planned effort, not actual progress.',1)
    x0, cw, top, rh = 445, 59, 214, 34
    s.rect(35,154,1130,60,TEAL,LINE)
    s.text(47,172,'ID / WORK PACKAGE',14,True)
    s.text(369,172,'AFTER',13,True)
    dates=['07 Sep','14 Sep','21 Sep','28 Sep','05 Oct','12 Oct','19 Oct','26 Oct','02 Nov','09 Nov','16 Nov','23 Nov']
    for j,date in enumerate(dates):
        s.text(x0+(j+.5)*cw,158,f'W{j+1:02}',13,True,align='center')
        s.text(x0+(j+.5)*cw,180,date,11,align='center')
    tasks=[
        ('01','Scope, requirements & feasibility',1,1,'-',TEAL),
        ('02','Privacy, domain & API design',2,2,'01',TEAL),
        ('03','Persistent data & private storage',3,4,'02',CREAM),
        ('04','Google identity & access control',3,4,'02',CREAM),
        ('05','Customer website & document flow',5,6,'03,04',CORAL),
        ('06','Shop queue & tenant isolation',6,7,'03,04',CORAL),
        ('07','Verified payment integration',6,7,'03,04',CORAL),
        ('08','Desktop claim / spool / cleanup',8,9,'05-07',TEAL),
        ('09','Integration & failure recovery',10,10,'08',TEAL),
        ('10','Security & acceptance testing',11,11,'09',CREAM),
        ('11','Deployment & handover',12,12,'10',CREAM),
        ('12','Documentation & practical outputs',1,12,'parallel',CORAL),
        ('13','Final demonstration & review',12,12,'10,11',CORAL),
    ]
    for i,(num,title,start,end,after,fill) in enumerate(tasks):
        yy=top+i*rh
        s.rect(35,yy,1130,rh,WHITE if i%2==0 else '#f7f9f7',LINE)
        s.text(47,yy+8,num,13,True)
        s.text(79,yy+8,title,13)
        s.text(397,yy+9,after,11,align='center')
        for j in range(13):
            s.line([(x0+j*cw,yy),(x0+j*cw,yy+rh)],color=LINE,width=.5)
        if num=='13':
            mx=x0+12*cw-12
            s.polygon([(mx,yy+6),(mx+10,yy+17),(mx,yy+28),(mx-10,yy+17)],ACCENT)
        else:
            s.rect(x0+(start-1)*cw+6,yy+7,(end-start+1)*cw-12,20,fill,ACCENT,radius=4)
    s.text(45,677,'Milestone gates',16,True)
    s.text(45,705,'W04  Identity + data foundation   |   W07  Web + queue + payment contracts   |   W11  Acceptance sign-off',14)
    s.note(35,735,1130,'Dependencies are finish-to-start gates unless marked parallel. The diamond is the final review milestone at the end of W12, after handover. Dates are illustrative; revise them to match your deadline.',13)
    s.finish()


def usecases(c,out):
    s=Sheet(c,out,'02_use_case_diagram','UML use-case diagram',
            'Human actors and system responsibilities. Customer sign-in is optional for anonymous printing.',2)
    s.rect(195,149,815,550,WHITE,INK)
    s.text(602,165,'CBPMS SYSTEM BOUNDARY',16,True,align='center')
    s.actor(88,325,'Customer')
    s.actor(1111,258,'Shop operator')
    s.actor(1111,546,'Shop admin')
    left=[('UC01\nSign in with Google',218),('UC02\nSubmit a print job',329),
          ('UC03\nTrack job / view receipt',440),('UC04\nManage private library',551)]
    for text,y in left:
        s.line([(115,367),(249,y+37)])
        s.box(249,y,298,74,text,TEAL,17,'ellipse')
    right=[('UC05\nSign in as shop staff',218),('UC06\nView own-shop queue',329),
           ('UC07\nRelease job for printing',440),('UC08\nManage shop configuration',551)]
    for i,(text,y) in enumerate(right):
        if i<3:
            s.line([(1084,300),(959,y+37)])
        else:
            s.line([(1084,588),(959,y+37)])
        s.box(650,y,309,74,text,CREAM,17,'ellipse')
    s.line([(1111,545),(1111,403)],open_head=False)
    s.polygon([(1111,389),(1101,406),(1121,406)],WHITE)
    s.text(1050,473,'inherits',12,color=MUTED)
    s.text(225,655,'UC04 requires an account.',14,color=MUTED)
    s.text(650,655,'Admin inherits operator capabilities.',14,color=MUTED)
    s.note(35,716,552,'Associations are solid, undirected lines. The hollow triangle is UML actor generalization; it points to the more general shop-operator role.',13)
    s.note(608,716,557,'Google/Supabase and the planned payment gateway are supporting external services, detailed in the data-flow and sequence diagrams.',13)
    s.finish()


def scenarios(c,out):
    s=Sheet(c,out,'03_use_case_scenarios','Use-case scenarios',
            'Four representative scenarios. IDs match the use-case diagram; exceptions and privacy rules are part of the expected behaviour.',3)
    cases=[
        ('UC01 / Sign in with Google',35,150,TEAL,[
            ('Actor / trigger','Customer selects Continue with Google.'),
            ('Precondition','Google provider and callback URL are configured.'),
            ('Main flow','1. Redirect for Google consent. 2. Exchange the authorization code. 3. Verify identity and establish a secure session. 4. Open the customer workspace.'),
            ('Alternative','Cancelled or invalid authorization returns a safe error; no authenticated session is created.'),
            ('Postcondition','A returning identity is reused; a new identity gets a customer profile. No staff permissions are granted.')]),
        ('UC02 / Submit a print job',610,150,TEAL,[
            ('Actor / trigger','Customer chooses a shop and starts an upload.'),
            ('Precondition','Shop is active; account mode requires sign-in.'),
            ('Main flow','1. Choose privacy mode. 2. Upload PDF/image. 3. Server validates and prices options. 4. Stage job privately. 5. Verify payment on server. 6. Queue job and issue release PIN.'),
            ('Alternative','Invalid file is rejected. Failed or unavailable payment does not queue the job or issue a release PIN.'),
            ('Postcondition','Job belongs to one shop. A capability token protects anonymous status. Live payment remains planned.')]),
        ('UC07 / Release job for printing',35,468,CREAM,[
            ('Actor / trigger','Shop operator scans or enters a release PIN.'),
            ('Precondition','Staff belongs to the job shop; paid job is unexpired.'),
            ('Main flow','1. Atomically claim job. 2. Issue a short-lived download grant. 3. Agent downloads and verifies hash. 4. Spool to printer. 5. Report outcome and clear local temporary file.'),
            ('Alternative','Wrong shop, invalid PIN or duplicate claim is denied. Spool failure is reported; retain cloud file for retry until expiry.'),
            ('Postcondition','Spool success marks completion. Anonymous cloud file is deleted; a reusable library file remains private.')]),
        ('UC04 / Manage private library',610,468,CREAM,[
            ('Actor / trigger','Signed-in customer opens the document library.'),
            ('Precondition','A valid customer session identifies the owner.'),
            ('Main flow','1. List only the owner\'s account-linked documents. 2. Choose a document to reuse or delete. 3. Check ownership and active jobs. 4. Apply the permitted operation.'),
            ('Alternative','Other owners\' files are inaccessible. Deletion during an active print job is blocked; retry after the job finishes.'),
            ('Postcondition','Reusable documents remain private. Deleted documents become inaccessible. Anonymous uploads never appear here.')]),
    ]
    for title,x,y,color,rows in cases:
        s.rect(x,y,555,307,WHITE,LINE,radius=8)
        s.rect(x,y,555,38,color,LINE,radius=8)
        s.text(x+16,y+9,title,17,True)
        yy=y+50
        for label,value in rows:
            s.text(x+16,yy,label.upper(),10,True,color=ACCENT)
            yy=s.paragraph(x+16,yy+14,value,523,12.5)+9
        if yy > y+309:
            raise ValueError(f'Scenario overflow: {title} ({yy-y})')
    s.finish()
