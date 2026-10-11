"""Generate original CBPMS practical diagrams without changing the application.

Run using a Python environment with reportlab, Pillow and pypdf installed.
Pass --poppler with the path to pdftoppm.exe if it is not on PATH.
"""
import argparse
import shutil
import subprocess
import zipfile
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A3, landscape
from pypdf import PdfReader
from overview import gantt, usecases, scenarios
from flows import context, level_one, control
from structure import classes, sequence_submit, sequence_release


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--poppler',default='pdftoppm')
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[2]
    out=root/'output'/'pdf'/'cbpms_practicals'
    png,svg=out/'images',out/'vectors'
    png.mkdir(parents=True,exist_ok=True)
    svg.mkdir(parents=True,exist_ok=True)
    pdf=out/'CBPMS_Practical_Outputs.pdf'
    c=canvas.Canvas(str(pdf),pagesize=landscape(A3),pageCompression=1)
    c.setTitle('CBPMS - Software Engineering Practical Outputs')
    c.setAuthor('CBPMS Project')
    c.setSubject('Gantt, use cases and scenarios, DFD, control flow, UML classes and sequences')
    for draw in [gantt,usecases,scenarios,context,level_one,control,classes,sequence_submit,sequence_release]:
        draw(c,svg)
    c.save()
    reader=PdfReader(pdf)
    assert len(reader.pages)==9
    assert all(len(p.extract_text())>300 for p in reader.pages)
    names=sorted(p.stem for p in svg.glob('*.svg'))
    for i,name in enumerate(names,1):
        subprocess.run([args.poppler,'-f',str(i),'-l',str(i),'-singlefile','-r','300','-png',str(pdf),str(png/name)],check=True)
    # QA contact sheet is intentionally separate from the printable outputs.
    sheet=Image.new('RGB',(1500,1125),'#e7ebe6')
    pen=ImageDraw.Draw(sheet)
    for i,name in enumerate(names):
        with Image.open(png/f'{name}.png') as source:
            thumb=ImageOps.contain(source,(480,340))
        xx,yy=(i%3)*500+10,(i//3)*375+10
        sheet.paste(thumb,(xx,yy))
        pen.text((xx,yy+344),name.replace('_',' '),fill='#243832')
    sheet.save(out/'preview.png')
    shutil.copyfile(Path(__file__).with_name('PRINT_GUIDE.md'),out/'PRINT_GUIDE.md')
    with zipfile.ZipFile(out/'CBPMS_Practical_Images.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(png.glob('*.png'))+sorted(svg.glob('*.svg'))+[out/'PRINT_GUIDE.md']:
            archive.write(path,path.relative_to(out))
    print(f'Created {len(names)} 300-dpi PNG images, {len(names)} SVGs and {len(reader.pages)} vector PDF pages.')
    print(str(pdf))


if __name__=='__main__':
    main()
