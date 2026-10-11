"""Small deterministic drawing toolkit: the same geometry becomes PDF and SVG."""
from pathlib import Path
from html import escape
from math import atan2, cos, sin, pi
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A3, landscape

W, H = 1200, 850
INK = '#243832'
MUTED = '#54665f'
LINE = '#9aaa9f'
TEAL = '#dcece4'
CREAM = '#f7eedc'
CORAL = '#f6e0d5'
WHITE = '#ffffff'
ACCENT = '#316452'


class Sheet:
    def __init__(self, canvas, folder, slug, title, subtitle, number):
        self.c, self.folder, self.slug = canvas, Path(folder), slug
        self.c.scale(landscape(A3)[0]/W, landscape(A3)[1]/H)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">']
        self.rect(0, 0, W, H, WHITE, WHITE)
        self.rect(35, 32, 6, 50, ACCENT, ACCENT)
        self.text(56, 39, 'CBPMS / SOFTWARE ENGINEERING & PROJECT MANAGEMENT', 12, bold=True, color=ACCENT)
        self.text(56, 60, title, 27, bold=True)
        self.text(56, 100, subtitle, 13, color=MUTED)
        self.line([(35, 127), (1165, 127)], color=LINE)
        self.line([(35, 797), (1165, 797)], color=LINE)
        self.text(35, 811, 'Cloud Based Print Management System  |  Academic design model  |  09 Oct 2026', 11, color=MUTED)
        self.text(1165, 809, f'{number:02d}', 15, bold=True, align='right')

    def text(self, x, y, value, size=16, bold=False, align='left', color=INK):
        font = 'Helvetica-Bold' if bold else 'Helvetica'
        for i, row in enumerate(str(value).split('\n')):
            yy = y + i * size * 1.3
            width = stringWidth(row, font, size)
            xx = x - (width / 2 if align == 'center' else width if align == 'right' else 0)
            if xx < 0 or xx + width > W + 1 or yy + size > H:
                raise ValueError(f'Out of page: {self.slug}: {row}')
            self.c.setFillColor(HexColor(color))
            self.c.setFont(font, size)
            self.c.drawString(xx, H - yy - size, row)
            self.svg.append(f'<text x="{xx}" y="{yy+size}" font-family="Arial,Helvetica,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(row)}</text>')

    def paragraph(self, x, y, value, width, size=15, color=INK, bold=False):
        font = 'Helvetica-Bold' if bold else 'Helvetica'
        row, lines = '', []
        for word in value.split():
            test = (row + ' ' + word).strip()
            if stringWidth(test, font, size) > width and row:
                lines.append(row)
                row = word
            else:
                row = test
        if row:
            lines.append(row)
        self.text(x, y, '\n'.join(lines), size, bold, color=color)
        return y + len(lines) * size * 1.3

    def rect(self, x, y, w, h, fill=WHITE, stroke=INK, radius=0):
        self.c.setStrokeColor(HexColor(stroke))
        self.c.setFillColor(HexColor(fill))
        self.c.setLineWidth(1.3)
        self.c.roundRect(x, H-y-h, w, h, radius, stroke=1, fill=1)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="1.3"/>')

    def ellipse(self, x, y, w, h, fill=TEAL):
        self.c.setStrokeColor(HexColor(INK))
        self.c.setFillColor(HexColor(fill))
        self.c.setLineWidth(1.3)
        self.c.ellipse(x, H-y-h, x+w, H-y, stroke=1, fill=1)
        self.svg.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="{fill}" stroke="{INK}" stroke-width="1.3"/>')

    def polygon(self, pts, fill=CREAM, stroke=INK):
        p = self.c.beginPath()
        p.moveTo(pts[0][0], H-pts[0][1])
        for x, y in pts[1:]:
            p.lineTo(x, H-y)
        p.close()
        self.c.setFillColor(HexColor(fill))
        self.c.setStrokeColor(HexColor(stroke))
        self.c.drawPath(p, stroke=1, fill=1)
        coords = ' '.join(f'{x},{y}' for x, y in pts)
        self.svg.append(f'<polygon points="{coords}" fill="{fill}" stroke="{stroke}"/>')

    def line(self, pts, arrow=False, dashed=False, color=INK, width=1.4, open_head=False):
        self.c.setStrokeColor(HexColor(color))
        self.c.setLineWidth(width)
        self.c.setDash([5, 4] if dashed else [])
        p = self.c.beginPath()
        p.moveTo(pts[0][0], H-pts[0][1])
        for x, y in pts[1:]:
            p.lineTo(x, H-y)
        self.c.drawPath(p)
        self.c.setDash([])
        coords = ' '.join(f'{x},{y}' for x, y in pts)
        dash = ' stroke-dasharray="5 4"' if dashed else ''
        self.svg.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{width}"{dash}/>')
        if arrow:
            x, y = pts[-1]
            a = atan2(y-pts[-2][1], x-pts[-2][0])
            left = (x-9*cos(a-pi/7), y-9*sin(a-pi/7))
            right = (x-9*cos(a+pi/7), y-9*sin(a+pi/7))
            if open_head:
                self.line([left, (x, y), right], color=color)
            else:
                self.polygon([(x, y), left, right], fill=color, stroke=color)

    def label(self, x, y, text, size=13):
        lines = text.split('\n')
        w = max(stringWidth(s, 'Helvetica', size) for s in lines) + 10
        h = len(lines)*size*1.3 + 2
        self.rect(x-w/2, y-1, w, h, WHITE, WHITE)
        self.text(x, y, text, size, align='center')

    def box(self, x, y, w, h, text, fill=TEAL, size=16, kind='rect'):
        if kind == 'ellipse':
            self.ellipse(x, y, w, h, fill)
        elif kind == 'diamond':
            self.polygon([(x+w/2,y),(x+w,y+h/2),(x+w/2,y+h),(x,y+h/2)], fill)
        elif kind == 'io':
            self.polygon([(x+15,y),(x+w,y),(x+w-15,y+h),(x,y+h)], fill)
        else:
            self.rect(x, y, w, h, fill, radius=12 if kind=='round' else 0)
        height = len(text.split('\n'))*size*1.3
        self.text(x+w/2, y+(h-height)/2, text, size, bold=True, align='center')

    def actor(self, x, y, text):
        self.ellipse(x-12, y, 24, 24, WHITE)
        self.line([(x,y+24),(x,y+64)])
        self.line([(x-26,y+39),(x+26,y+39)])
        self.line([(x-24,y+91),(x,y+64),(x+24,y+91)])
        self.text(x,y+101,text,15,bold=True,align='center')

    def store(self, x, y, w, text):
        self.rect(x,y,w,62,CREAM)
        self.line([(x+12,y),(x+12,y+62)])
        self.text(x+w/2+5,y+19,text,15,bold=True,align='center')

    def note(self, x, y, w, text, size=13):
        self.rect(x,y,w,60,CREAM,LINE,radius=6)
        self.paragraph(x+12,y+10,text,w-24,size)

    def finish(self):
        self.svg.append('</svg>')
        self.folder.mkdir(parents=True,exist_ok=True)
        (self.folder/f'{self.slug}.svg').write_text('\n'.join(self.svg),encoding='utf-8')
        self.c.showPage()
