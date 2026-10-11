"""Black-only academic report layout; original text remains editable in Python."""
from pathlib import Path
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak

for name,file in [('TNR','times.ttf'),('TNR-Bold','timesbd.ttf'),('TNR-Italic','timesi.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('TNR',normal='TNR',bold='TNR-Bold',italic='TNR-Italic',boldItalic='TNR-Bold')
WIDTH=A4[0]-110
STYLES={
    'body':ParagraphStyle('body',fontName='TNR',fontSize=11.5,leading=15.3,textColor=colors.black,alignment=TA_JUSTIFY,spaceAfter=8),
    'h1':ParagraphStyle('h1',fontName='TNR-Bold',fontSize=14,leading=18,textColor=colors.black,spaceBefore=8,spaceAfter=12,keepWithNext=True),
    'h2':ParagraphStyle('h2',fontName='TNR-Bold',fontSize=12,leading=15.5,textColor=colors.black,spaceBefore=9,spaceAfter=7,keepWithNext=True),
    'table':ParagraphStyle('table',fontName='TNR',fontSize=10.5,leading=13.3,textColor=colors.black,spaceAfter=0),
    'small':ParagraphStyle('small',fontName='TNR',fontSize=10,leading=13,textColor=colors.black,spaceAfter=7),
    'center':ParagraphStyle('center',fontName='TNR',fontSize=12,leading=16,textColor=colors.black,alignment=TA_CENTER,spaceAfter=8),
    'title':ParagraphStyle('title',fontName='TNR-Bold',fontSize=21,leading=26,textColor=colors.black,alignment=TA_CENTER,spaceAfter=12),
    'institution':ParagraphStyle('institution',fontName='TNR-Bold',fontSize=14,leading=18,textColor=colors.black,alignment=TA_CENTER,spaceAfter=10),
}


def p(text,style='body'):
    return Paragraph(text,STYLES[style])


def h(text,level=1):
    return p(text,'h1' if level==1 else 'h2')


def bullet(label,text):
    return p(f'<b>{escape(label)}:</b> {text}')


def table(rows,widths,header=True,size=10.5,padding=7):
    style=ParagraphStyle('cell',parent=STYLES['table'],fontSize=size,leading=size*1.25)
    data=[]
    for i,row in enumerate(rows):
        data.append([Paragraph(f'<b>{t}</b>' if i==0 and header else str(t),style) for t in row])
    t=Table(data,colWidths=widths,repeatRows=1 if header else 0,hAlign='LEFT')
    t.setStyle(TableStyle([
        ('GRID',(0,0),(-1,-1),.55,colors.black),
        ('TEXTCOLOR',(0,0),(-1,-1),colors.black),
        ('BACKGROUND',(0,0),(-1,-1),colors.white),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('LEFTPADDING',(0,0),(-1,-1),padding),
        ('RIGHTPADDING',(0,0),(-1,-1),padding),
        ('TOPPADDING',(0,0),(-1,-1),padding),
        ('BOTTOMPADDING',(0,0),(-1,-1),padding),
    ]))
    return t


def toc(rows):
    data=[]
    for title,page,indent in rows:
        data.append([p(('&#160;'*4 if indent else '')+title,'small'),p(str(page),'small')])
    t=Table(data,colWidths=[WIDTH-32,32],hAlign='LEFT')
    t.setStyle(TableStyle([('TEXTCOLOR',(0,0),(-1,-1),colors.black),
                          ('LINEBELOW',(0,0),(-1,-1),.15,colors.black),
                          ('VALIGN',(0,0),(-1,-1),'TOP'),
                          ('TOPPADDING',(0,0),(-1,-1),2),
                          ('BOTTOMPADDING',(0,0),(-1,-1),2),
                          ('LEFTPADDING',(0,0),(-1,-1),0)]))
    return t


def footer(canvas,doc):
    canvas.saveState()
    canvas.setFillColor(colors.black)
    canvas.setFont('TNR',9)
    canvas.drawString(55,29,'Cloud Based Print Management System (CBPMS)')
    canvas.drawRightString(A4[0]-55,29,f'Page {doc.page}')
    canvas.restoreState()
