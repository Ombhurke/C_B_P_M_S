"""Balanced context / level-one data flows and a print-job control flow."""
from drawing import Sheet, TEAL, CREAM, CORAL, INK, MUTED, LINE, WHITE


def context(c,out):
    s=Sheet(c,out,'04_dfd_context','Data-flow diagram - Level 0 (context)',
            'Boundary: CBPMS cloud platform (customer/shop web + API + private persistence). Desktop agent is outside this boundary.',4)
    s.box(35,238,230,147,'Customer',CREAM,21)
    s.box(35,459,230,147,'Shop staff /\ndesktop agent',CREAM,21)
    s.box(935,238,230,147,'Google /\nSupabase Auth',CREAM,21)
    s.box(935,459,230,147,'Payment gateway\n[planned]',CORAL,21)
    s.box(440,235,320,375,'0\n\nCBPMS\nCloud Platform',TEAL,27,'round')
    flows=[
        ([(265,275),(440,275)],352,218,'Identity / library requests,\nfile, options, shop,\nprivacy mode'),
        ([(440,345),(265,345)],352,301,'Quote, receipt,\nstatus, library data'),
        ([(265,496),(440,496)],352,452,'Staff session, PIN,\nconfig, print outcome'),
        ([(440,566),(265,566)],352,522,'Queue data, grants,\njob file, shop settings'),
        ([(760,275),(935,275)],847,234,'Authorization request /\ncode exchange'),
        ([(935,345),(760,345)],847,304,'Verified identity /\nauthentication result'),
        ([(760,496),(935,496)],847,455,'Order amount, currency,\nverification request'),
        ([(935,566),(760,566)],847,525,'Order reference /\nverified payment result'),
    ]
    for pts,x,y,label in flows:
        s.line(pts,arrow=True)
        s.text(x,y,label,12,align='center')
    s.note(35,669,550,'External entities are rectangles; the rounded process represents the entire platform. Arrows carry named data, not execution order.',14)
    s.note(610,669,555,'Internal databases and private object storage are hidden at context level. They appear as data stores in Level 1.',14)
    s.text(35,754,'Design scope: live payment integration is proposed; Google authentication and anonymous job mode are part of the current design.',13,color=MUTED)
    s.finish()


def level_one(c,out):
    s=Sheet(c,out,'05_dfd_level_1','Data-flow diagram - Level 1',
            'Decomposition of process 0. Repeated external-entity symbols represent the same actors/services shown in the context diagram.',5)
    # A vertical process spine keeps store traffic separate from actor traffic.
    s.box(35,151,205,43,'Customer',CREAM,16)
    s.box(35,236,205,43,'Google / Supabase Auth',CREAM,14)
    s.box(480,164,255,104,'1.0\nManage identity & access',TEAL,17,'round')
    s.store(927,184,238,'D1  Users / sessions')
    pairs=[
        ([(240,171),(480,171)],350,151,'Customer identity request'),
        ([(480,190),(240,190)],350,193,'Session / authentication result'),
        ([(480,240),(240,240)],350,220,'Authorization / code exchange'),
        ([(240,263),(480,263)],350,265,'Verified identity / auth result'),
    ]
    for pts,x,y,t in pairs:
        s.line(pts,arrow=True);s.label(x,y,t,11)
    ys=[320,432,544,656]
    actors=['Customer','Payment gateway\n[planned]','Shop staff /\ndesktop agent','Customer']
    processes=['2.0\nValidate & stage job','3.0\nVerify payment','4.0\nAuthorize & release print','5.0\nManage lifecycle / library']
    stores=['D2  Jobs / files / shop data','D3  Payment records','D2  Jobs / files / shop data','D2  Jobs / files / shop data']
    incoming=['File, options, shop, privacy mode','Order reference / captured result','Staff session, PIN, config, result','Library / deletion request']
    outgoing=['Price quote / staged receipt','Order data / verification request','Queue, grant, file, settings','Job status / receipt / library data']
    for i,y in enumerate(ys):
        s.box(35,y,205,76,actors[i],CORAL if i==1 else CREAM,16)
        s.box(480,y,255,76,processes[i],TEAL,16,'round')
        s.store(927,y+7,238,stores[i])
        s.line([(240,y+20),(480,y+20)],arrow=True)
        s.label(356,y+1,incoming[i],11)
        s.line([(480,y+57),(240,y+57)],arrow=True)
        s.label(356,y+38,outgoing[i],11)
    # Each store exchange is represented explicitly as read and write data flows.
    for y,write,read in [(187,'Identity / session records','User / session data'),
                         (337,'Private file / staged job','Job / shop configuration'),
                         (449,'Order / receipt records','Payment state'),
                         (561,'Claim / spool / config data','Job / file / shop data'),
                         (673,'State / retention / audit data','Expiry / library / job data')]:
        s.line([(735,y),(927,y)],arrow=True)
        s.label(831,y-18,write,11)
        s.line([(927,y+36),(735,y+36)],arrow=True)
        s.label(831,y+18,read,11)
    for a,b,label in [(268,320,'Authorized identity / capability'),(396,432,'Job + server-priced amount'),
                       (508,544,'Verified paid job'),(620,656,'Spool result / retention policy')]:
        s.line([(607,a),(607,b)],arrow=True)
        s.label(748,(a+b)/2-8,label,10)
    s.text(35,751,'D2 is repeated for clarity: it is one logical group containing private files, job records, shop data and lifecycle audit information.',12,color=MUTED)
    s.text(35,771,'Staff sessions are independently authenticated. Store groups are not physical tables. Expiry scheduling is internal to process 5.0.',12,color=MUTED)
    s.finish()


def control(c,out):
    s=Sheet(c,out,'06_control_flow','Control-flow diagram - submit, release and retain',
            'Arrow direction is execution order. Every decision branch is labelled; failures do not silently become successful print jobs.',6)
    # Main path is deliberately split into two columns to remain readable on paper.
    s.box(220,149,220,40,'Start',TEAL,16,'round')
    s.box(200,215,260,50,'Choose shop + privacy mode',CREAM,15,'io')
    s.box(227,293,206,78,'Account mode?',CREAM,15,'diamond')
    s.box(35,405,200,65,'Google sign-in if needed\nRetry if unsuccessful',TEAL,14)
    s.box(286,405,230,65,'Upload + configure\nPDF / JPEG / PNG',CREAM,15,'io')
    s.box(299,497,204,78,'Valid file + options?',CREAM,14,'diamond')
    s.box(35,503,200,65,'Show validation error\nCorrect input / retry',CORAL,14,'io')
    s.box(281,600,240,60,'Store privately + stage job\nServer calculates price',TEAL,14)
    s.box(281,697,240,65,'Create / verify payment\n[live provider planned]',CORAL,15)
    s.line([(330,189),(330,215)],arrow=True)
    s.line([(330,265),(330,293)],arrow=True)
    s.line([(227,332),(135,332),(135,405)],arrow=True);s.label(160,309,'Yes')
    s.line([(433,332),(545,332),(545,383),(401,383),(401,405)],arrow=True);s.label(481,309,'No')
    s.line([(235,437),(286,437)],arrow=True);s.label(261,410,'Valid')
    s.line([(401,470),(401,497)],arrow=True)
    s.line([(299,536),(235,536)],arrow=True);s.label(263,511,'No')
    s.line([(135,503),(135,486),(270,486),(270,451),(286,451)],arrow=True)
    s.line([(401,575),(401,600)],arrow=True);s.label(429,577,'Yes')
    s.line([(401,660),(401,697)],arrow=True)
    s.line([(521,729),(572,729),(572,187),(692,187)],arrow=True)
    s.box(692,149,230,76,'Verified paid?',CREAM,15,'diamond')
    s.box(978,150,187,74,'Stop: keep staged\nRetry or cancel later\nNo release PIN',CORAL,14,'round')
    s.line([(922,187),(978,187)],arrow=True);s.label(950,163,'No')
    s.box(670,254,274,52,'Queue job + issue release PIN',TEAL,15)
    s.line([(807,225),(807,254)],arrow=True);s.label(841,228,'Yes')
    s.box(670,332,274,84,'Valid shop / PIN?\nAtomic claim succeeds?',CREAM,14,'diamond')
    s.line([(807,306),(807,332)],arrow=True)
    s.box(978,335,187,66,'Stop: claim rejected\nUnauthorized / expired\nNo document access',CORAL,13,'round')
    s.line([(944,374),(978,374)],arrow=True);s.label(961,347,'No')
    s.box(670,434,274,61,'Grant download; verify hash\nSpool to printer; clear local file',TEAL,14)
    s.line([(807,416),(807,434)],arrow=True);s.label(842,416,'Yes')
    s.box(692,521,230,76,'Spool accepted?',CREAM,15,'diamond')
    s.line([(807,495),(807,521)],arrow=True)
    s.box(978,521,187,76,'Stop: report failure\nRetain cloud file\nRetry later until expiry',CORAL,13,'round')
    s.line([(922,559),(978,559)],arrow=True);s.label(950,535,'No')
    s.box(671,622,273,68,'Report completion\nAnonymous: delete cloud file\nAccount: retain private library',TEAL,14)
    s.line([(807,597),(807,622)],arrow=True);s.label(840,599,'Yes')
    s.box(717,721,180,41,'End',TEAL,16,'round')
    s.line([(807,690),(807,721)],arrow=True)
    s.text(984,661,'Expiry worker:',12,True)
    s.text(984,681,'Revoke expired grants;\ndelete temporary files.\nSpool acceptance is not\nphysical-print confirmation.',11,color=MUTED)
    s.finish()
