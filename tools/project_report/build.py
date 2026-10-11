"""Build and validate the reference-aligned black-only CBPMS project report."""
from pathlib import Path
import argparse
import subprocess
from reportlab.platypus import SimpleDocTemplate
from reportlab.lib.pagesizes import A4
from pypdf import PdfReader
from PIL import Image,ImageOps,ImageDraw
from layout import footer
from intro import cover,contents_intro,terms_references
from requirements import overall,problem_sdlc,functional,nonfunctional
from closing import closing


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--poppler',required=True)
    args=ap.parse_args()
    root=Path(__file__).resolve().parents[2]
    out=root/'output'/'pdf'/'cbpms_report'
    qa=root/'tmp'/'pdfs'/'cbpms_report'
    out.mkdir(parents=True,exist_ok=True)
    qa.mkdir(parents=True,exist_ok=True)
    target=out/'CBPMS_Project_Report.pdf'
    story=[]
    for page in [cover,contents_intro,terms_references,overall,problem_sdlc,functional,nonfunctional,closing]:
        story.extend(page())
    doc=SimpleDocTemplate(str(target),pagesize=A4,rightMargin=55,leftMargin=55,
                          topMargin=45,bottomMargin=47,
                          title='Cloud Based Print Management System Project Report',
                          author='OM Yuvraj Bhurke',subject='SEPM case study and software requirements specification')
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    reader=PdfReader(target)
    print('Pages:',len(reader.pages))
    for i,page in enumerate(reader.pages,1):
        print(i, (page.extract_text() or '')[:95].replace('\n',' | '))
    expected=['ST. VINCENT','TABLE OF CONTENTS','1.3 Intended Audience','2 OVERALL DESCRIPTION',
              '3 SYSTEM OVERVIEW','5 FUNCTIONAL REQUIREMENTS','6 NONFUNCTIONAL REQUIREMENTS','6.4 Verification']
    assert len(reader.pages)==len(expected), 'Pagination changed: revise layout and TOC.'
    for page,heading in zip(reader.pages,expected):
        assert heading in page.extract_text(),f'TOC mismatch: {heading}'
    # Check effective nonstroking text colour at every text-drawing operation.
    checked=0
    for page in reader.pages:
        fill=[0.0];stack=[]
        def visitor(op,values,cm,tm):
            nonlocal fill,checked
            if op==b'q': stack.append(fill[:])
            elif op==b'Q': fill=stack.pop() if stack else [0.0]
            elif op in (b'g',b'rg',b'k'): fill=[float(v) for v in values]
            elif op in (b'Tj',b'TJ',b"'",b'"'):
                checked+=1
                black=all(v==0 for v in fill) if len(fill)!=4 else fill==[0,0,0,1]
                assert black,f'Nonblack text: {fill}'
        page.extract_text(visitor_operand_before=visitor)
    subprocess.run([args.poppler,'-r','140','-png',str(target),str(qa/'page')],check=True)
    images=sorted(qa.glob('page-*.png'))
    assert len(images)==8
    contact=Image.new('RGB',(1600,1140),'white')
    pen=ImageDraw.Draw(contact)
    for i,path in enumerate(images):
        with Image.open(path) as im:
            pic=ImageOps.contain(im,(390,545))
        x=(i%4)*400+(400-pic.width)//2
        y=(i//4)*570
        contact.paste(pic,(x,y))
        pen.text(((i%4)*400+15,y+548),f'Page {i+1}',fill='black')
    contact.save(qa/'contact.png')
    print(f'PASS: {checked} text operations use black. Eight A4 pages and TOC headings validated.')
    print(target)


if __name__=='__main__':
    main()
