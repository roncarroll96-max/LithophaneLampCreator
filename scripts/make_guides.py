"""Builds the two PDF guides (docs/) for the Lithophane Lamp Creator.

Needs Python with reportlab:  pip install reportlab
Run:  python scripts/make_guides.py docs
"""
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, Flowable, KeepTogether)

OUT = sys.argv[1]

INK = colors.HexColor('#1f1d24')
MUTED = colors.HexColor('#5b5766')
ACCENT = colors.HexColor('#7a4fb0')
SOFT = colors.HexColor('#f1ecf8')
RULE = colors.HexColor('#d9d3e3')
WARN = colors.HexColor('#fff4e0')
WARN_EDGE = colors.HexColor('#e0a33a')

ss = getSampleStyleSheet()
H1 = ParagraphStyle('H1', parent=ss['Title'], fontName='Helvetica-Bold', fontSize=22, leading=26,
                    textColor=INK, alignment=0, spaceAfter=4)
SUB = ParagraphStyle('SUB', parent=ss['Normal'], fontName='Helvetica', fontSize=11, leading=15,
                     textColor=MUTED, spaceAfter=14)
H2 = ParagraphStyle('H2', parent=ss['Heading2'], fontName='Helvetica-Bold', fontSize=15, leading=19,
                    textColor=ACCENT, spaceBefore=14, spaceAfter=6)
H3 = ParagraphStyle('H3', parent=ss['Heading3'], fontName='Helvetica-Bold', fontSize=11.5, leading=15,
                    textColor=INK, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle('BODY', parent=ss['Normal'], fontName='Helvetica', fontSize=10, leading=14,
                      textColor=INK, spaceAfter=6)
SMALL = ParagraphStyle('SMALL', parent=BODY, fontSize=8.5, leading=11, textColor=MUTED)
CELL = ParagraphStyle('CELL', parent=BODY, fontSize=9, leading=12, spaceAfter=0)
CELLB = ParagraphStyle('CELLB', parent=CELL, fontName='Helvetica-Bold')
HEAD = ParagraphStyle('HEAD', parent=CELL, fontName='Helvetica-Bold', textColor=colors.white)
BUL = ParagraphStyle('BUL', parent=BODY, leftIndent=14, bulletIndent=4, spaceAfter=3)


def P(t, s=BODY):
    return Paragraph(t, s)


def bullets(items):
    return [Paragraph(t, BUL, bulletText='•') for t in items]


def table(rows, widths, head=True, zebra=True):
    data = []
    for i, r in enumerate(rows):
        style = HEAD if (head and i == 0) else CELL
        data.append([c if isinstance(c, Flowable) else Paragraph(c, CELLB if (j == 0 and not (head and i == 0)) else style)
                     for j, c in enumerate(r)])
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -1), 0.4, RULE),
    ]
    if head:
        st += [('BACKGROUND', (0, 0), (-1, 0), ACCENT)]
    if zebra:
        for i in range(1 if head else 0, len(rows)):
            if (i % 2 == 0):
                st.append(('BACKGROUND', (0, i), (-1, i), SOFT))
    t.setStyle(TableStyle(st))
    return t


def callout(text, title=None):
    content = [P(f'<b>{title}</b>', CELL)] if title else []
    content.append(P(text, CELL))
    t = Table([[content]], colWidths=[7.0 * inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), WARN),
        ('LINEBEFORE', (0, 0), (0, -1), 3, WARN_EDGE),
        ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return t


def footer(title):
    def draw(c, doc):
        c.saveState()
        c.setFont('Helvetica', 8)
        c.setFillColor(MUTED)
        c.drawString(0.75 * inch, 0.5 * inch, title)
        c.drawRightString(letter[0] - 0.75 * inch, 0.5 * inch, f'Page {doc.page}')
        c.restoreState()
    return draw


# ---------------------------------------------------------------- drawings
class GreyBar(Flowable):
    """Grey scale from black to white with the wall thickness under each step."""
    def __init__(self, tmin=0.8, tmax=3.0, w=7.0 * inch, steps=11):
        super().__init__()
        self.tmin, self.tmax, self.w, self.steps = tmin, tmax, w, steps
        self.height = 92

    def wrap(self, *a):
        return self.w, self.height

    def draw(self):
        c = self.canv
        n = self.steps
        cw = self.w / n
        top = self.height - 18
        c.setFont('Helvetica-Bold', 8.5)
        c.setFillColor(INK)
        c.drawString(0, top + 6, 'BLACK in the grey map  =  THICKEST plastic  =  darkest when lit')
        c.drawRightString(self.w, top + 6, 'WHITE  =  THINNEST  =  brightest')
        for i in range(n):
            g = i / (n - 1)
            c.setFillColorRGB(g, g, g)
            c.setStrokeColor(RULE)
            c.rect(i * cw, top - 34, cw, 34, fill=1, stroke=1)
            t = self.tmin + (1 - g) * (self.tmax - self.tmin)
            c.setFillColor(INK)
            c.setFont('Helvetica-Bold', 9)
            c.drawCentredString(i * cw + cw / 2, top - 48, f'{t:.2f} mm')
            c.setFont('Helvetica', 7.5)
            c.setFillColor(MUTED)
            c.drawCentredString(i * cw + cw / 2, top - 59, f'{round(g * 100)}% grey')
        c.setFont('Helvetica-Oblique', 8)
        c.drawString(0, 2, 'Shown with the default settings: Thinnest 0.8 mm, Thickest 3.0 mm. '
                           'Each 10% step in grey adds 0.22 mm of plastic.')


class BallZones(Flowable):
    """Side view of the ball with the areas that get different thicknesses."""
    def __init__(self, w=7.0 * inch, h=3.3 * inch):
        super().__init__()
        self.w, self.h = w, h

    def wrap(self, *a):
        return self.w, self.h

    def draw(self):
        c = self.canv
        cx, cy, r = 2.0 * inch, 1.75 * inch, 1.35 * inch
        # ball
        c.setFillColor(colors.HexColor('#f6f2fb'))
        c.setStrokeColor(MUTED)
        c.setLineWidth(1)
        c.circle(cx, cy, r, fill=1, stroke=1)
        # photo window (front)
        c.setFillColor(colors.HexColor('#cfc6dc'))
        c.setStrokeColor(ACCENT)
        c.roundRect(cx - 0.75 * inch, cy - 0.55 * inch, 1.5 * inch, 1.15 * inch, 8, fill=1, stroke=1)
        c.setFillColor(colors.HexColor('#8c8399'))
        c.setFont('Helvetica-Bold', 9)
        c.drawCentredString(cx, cy + 0.02 * inch, 'PHOTO')
        # carved line (curve)
        c.setStrokeColor(colors.HexColor('#3a3542'))
        c.setLineWidth(2.4)
        p = c.beginPath()
        p.moveTo(cx - r * 0.97, cy + 0.35 * inch)
        p.curveTo(cx - 0.6 * inch, cy + 1.25 * inch, cx + 0.6 * inch, cy + 1.25 * inch, cx + r * 0.97, cy + 0.35 * inch)
        c.drawPath(p, stroke=1, fill=0)
        # band above opening
        import math
        a0 = math.radians(-90 - 22)
        a1 = math.radians(-90 + 22)
        c.setStrokeColor(colors.HexColor('#b08bd9'))
        c.setLineWidth(7)
        c.arc(cx - r + 3.5, cy - r + 3.5, cx + r - 3.5, cy + r - 3.5, -90 - 32, 64)
        # collar
        c.setLineWidth(1)
        c.setFillColor(colors.HexColor('#e2dbec'))
        c.setStrokeColor(MUTED)
        cw = 0.75 * inch
        c.rect(cx - cw / 2, cy - r - 0.16 * inch, cw, 0.2 * inch, fill=1, stroke=1)

        # labels
        def label(x0, y0, x1, y1, title, text):
            c.setStrokeColor(MUTED)
            c.setLineWidth(0.6)
            c.line(x0, y0, x1 - 4, y1)
            c.setFillColor(ACCENT)
            c.circle(x0, y0, 2, fill=1, stroke=0)
            c.setFillColor(INK)
            c.setFont('Helvetica-Bold', 9)
            c.drawString(x1, y1 + 2, title)
            c.setFont('Helvetica', 8.5)
            c.setFillColor(MUTED)
            for k, line in enumerate(text):
                c.drawString(x1, y1 - 9 - 10 * k, line)

        lx = 3.85 * inch
        label(cx + 0.3 * inch, cy + 1.07 * inch, lx, 3.0 * inch, 'Carved lines',
              ['Up to Thickest + 0.4 mm (3.4 mm by default)'])
        label(cx + 1.05 * inch, cy - 0.15 * inch, lx, 2.45 * inch, 'Plain ball (outside the photo)',
              ['Set by "Plain ball brightness" (1.79 mm at 55%)'])
        label(cx + 0.5 * inch, cy - 0.2 * inch, lx, 1.85 * inch, 'Photo window',
              ['Between Thinnest and Thickest, by grey shade'])
        label(cx + 0.5 * inch, cy - r + 0.05 * inch, lx, 1.05 * inch, 'Plain band above the opening',
              ['Uses "Collar wall" (2.0 mm by default),', 'kept between Thinnest and Thickest'])
        label(cx + cw / 2, cy - r - 0.08 * inch, lx, 0.35 * inch, 'Collar', ['"Collar wall" thickness (2.0 mm)'])


class WallSection(Flowable):
    """Cross-sections of a 3 mm wall: few loops + sparse infill vs. all loops."""
    def __init__(self, w=7.0 * inch, h=1.75 * inch):
        super().__init__()
        self.w, self.h = w, h

    def wrap(self, *a):
        return self.w, self.h

    def panel(self, x, title, sub, loops_each_side, sparse):
        c = self.canv
        pw, wall = 3.2 * inch, 0.8 * inch  # wall drawn 0.9 in tall for 3 mm
        y0 = 0.25 * inch
        line = wall / 7.5  # 0.4 mm lines in a 3 mm wall
        c.setFillColor(INK)
        c.setFont('Helvetica-Bold', 10)
        c.drawString(x, self.h - 14, title)
        c.setFont('Helvetica', 8.5)
        c.setFillColor(MUTED)
        c.drawString(x, self.h - 26, sub)
        # outline
        c.setStrokeColor(MUTED)
        c.setLineWidth(0.8)
        c.setFillColor(colors.white)
        c.rect(x, y0, pw, wall, fill=1, stroke=1)
        # loops
        c.setFillColor(colors.HexColor('#e9e2f3'))
        c.setStrokeColor(colors.HexColor('#9c86bb'))
        c.setLineWidth(0.5)
        for k in range(loops_each_side):
            c.rect(x, y0 + k * line, pw, line, fill=1, stroke=1)
            c.rect(x, y0 + wall - (k + 1) * line, pw, line, fill=1, stroke=1)
        inner_lo = y0 + loops_each_side * line
        inner_hi = y0 + wall - loops_each_side * line
        c.setLineWidth(0.6)
        if sparse:
            c.setStrokeColor(colors.HexColor('#b9aecb'))
            step = 0.32 * inch
        else:
            c.setFillColor(colors.HexColor('#e9e2f3'))
            c.rect(x, inner_lo, pw, inner_hi - inner_lo, fill=1, stroke=0)
            c.setStrokeColor(colors.HexColor('#9c86bb'))
            step = 0.045 * inch
        xx = x
        while xx < x + pw:
            c.line(xx, inner_lo, min(xx + (inner_hi - inner_lo), x + pw), inner_hi)
            xx += step
        c.setFillColor(MUTED if sparse else INK)
        c.setFont('Helvetica-Oblique', 8)
        c.drawCentredString(x + pw / 2, (inner_lo + inner_hi) / 2 - 3, 'mostly air' if sparse else '')
        # labels
        c.setFont('Helvetica', 8)
        c.setFillColor(MUTED)
        c.drawString(x, y0 - 12, 'inside of ball (light goes in)')
        c.drawString(x, y0 + wall + 4, 'outside of ball (you look here)')

    def draw(self):
        self.panel(0, 'Sparse infill 15%, 2 wall loops', 'A 3 mm wall printed this way', 2, True)
        self.panel(3.7 * inch, 'Sparse infill 100%, 3-4 wall loops', 'The same wall: loops on both sides, solid between', 3, False)


# ---------------------------------------------------------------- document 1
def app_guide(path):
    doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.8 * inch,
                            title='Lithophane Lamp Creator - Settings Guide')
    s = []
    s.append(P('Lithophane Lamp Creator', H1))
    s.append(P('Settings guide for version 1.7: what every setting does, and how it changes the thickness of the '
               'lamp\'s walls', SUB))

    s.append(P('The one idea behind everything', H2))
    s.append(P('A lithophane is a picture made from plastic thickness. Thin plastic lets more light through and glows '
               'bright. Thick plastic blocks light and looks dark. The app turns your pictures into a grey map, then '
               'gives every spot on the lamp a wall thickness based on how light or dark that spot is:'))
    s.append(callout('<b>Wall thickness = Thinnest + (darkness x (Thickest - Thinnest))</b><br/>'
                     'White spots get the Thinnest setting. Black spots get the Thickest setting. '
                     'Every grey in between gets a thickness in proportion.'))
    s.append(Spacer(1, 10))
    s.append(GreyBar())
    s.append(Spacer(1, 6))
    s.append(P('The picture\'s detail is on the <b>inside</b> of the lamp. The outside stays smooth (unless you choose '
               'raised lines or raised text).'))
    s.append(callout('Click <b>Thickness</b> above the 3D preview to see the walls as a grey map. Point at the lamp '
                     '(or tap it on a phone or tablet) to read the wall thickness there in mm. "Plain ball brightness" '
                     'also shows its thickness in mm, for example "55% (1.79 mm)".', 'Reading thicknesses in the app'))

    s.append(P('Thickness in each area of the lamp', H2))
    s.append(BallZones())
    s.append(Spacer(1, 4))
    s.append(table([
        ['Area', 'Thickness comes from', 'Default'],
        ['Photo window', 'That photo\'s grey map, between Thinnest and Thickest', '0.80 to 3.00 mm'],
        ['Soft edge of a photo', 'Blends from the photo into whatever is behind it (another photo or the plain ball)',
         '8 mm wide blend'],
        ['Cut-out photo background', '"Background": Blend in (whatever is behind), Bright (Thinnest) or Dark (Thickest)',
         'Blend in'],
        ['Plain ball outside the photos', '"Plain ball brightness" (Photo tab). 100% = Thinnest, 0% = Thickest',
         '55% = 1.79 mm'],
        ['Moon surface', 'NASA\'s brightness map plus "Crater depth", between Thinnest and Thickest', '0.80 to 3.00 mm'],
        ['Carved lines', 'Pushed toward Thickest + 0.4 mm by "Darkness"; hidden inside photos by "Hide lines under photos"',
         '3.40 mm'],
        ['Soccer pentagons', 'Pushed toward Thickest by "Pentagon darkness"', '50% of the way'],
        ['Football end stripes', 'Thinnest (they glow bright)', '0.80 mm'],
        ['Raised lines and text', 'The wall underneath is unchanged; they stick out of the outside', '+1.0 mm outside'],
        ['Carved text', 'Thickest + 0.4 mm', '3.40 mm'],
        ['Bright text, bright outline', 'Thinnest', '0.80 mm'],
        ['Cube with even glow', 'Thinner where less light reaches (tops of the walls), thicker near the light',
         'Strength 50%'],
        ['Plain band above the opening', '"Collar wall", kept between Thinnest and Thickest; 4 mm, then blends over 6 mm',
         '2.0 mm'],
        ['Collar', '"Collar wall"', '2.0 mm'],
        ['Flat panel: frame', '"Frame thickness" above Thickest, within "Frame width" of the edge, then a 45-degree slope '
         'down to the picture', '+2 mm (5.0 mm), 6 mm wide'],
        ['Flat panel with the light box', 'Even glow: thinner higher up, farther from the LED strip', 'Strength 50%'],
        ['Lantern panels', 'Even glow: thinner higher up, farther from the puck in the base', 'Strength 50%'],
    ], [1.75 * inch, 3.75 * inch, 1.5 * inch]))
    s.append(P('"Picture detail on the" (Shape tab) changes which side is bumpy, never the thickness: the light and '
               'dark come out the same. Inside (the default) keeps a ball smooth outside; Outside presses the picture '
               'into the outer surface. On a flat panel the default puts the picture and frame on the back; Front puts '
               'them on the front with a flat back. A panel\'s edge is as thick as the frame.', SMALL))

    s.append(P('Photo tab', H2))
    s.append(P('Photos on the ball', H3))
    s.append(table([
        ['Control', 'What it does'],
        ['+ Add photo', 'Adds a photo (up to 6). Each new one goes on the next free side: front, back, left, right, then '
         'the top. On the cube, each fills its face.'],
        ['The list', 'Pick a photo to edit it. Where photos overlap, the one higher in the list is in front; its soft '
         'edge fades into the one below. Use the up and down arrows to change the order.'],
        ['Hide, Copy, Remove', 'Hide keeps the photo but leaves it off the lamp. Copy makes a second one a little further '
         'round. Remove takes it off.'],
        ['Dragging', 'Drag the <b>selected</b> photo on the 3D lamp to move it. Dragging anywhere else turns the view.'],
    ], [1.5 * inch, 5.5 * inch]))
    s.append(P('Selected photo and its grey map', H3))
    s.append(P('The black-and-white picture is the selected photo\'s <b>grey map</b>: exactly what gets turned into '
               'thickness. White = thinnest, black = thickest. <b>Change photo</b> swaps the picture and keeps its place. '
               '<b>Hold: original</b> shows the photo before your Tone changes. <b>Auto adjust</b> sets the Tone sliders '
               'for you (logos usually need more contrast than it picks). For a cut-out photo (transparent background), '
               'a <b>Background</b> section chooses Blend in, Bright or Dark, plus <b>Edge softness</b>.'))
    s.append(P('Tone: these change the grey map, so they change the thickness', H3))
    s.append(table([
        ['Setting', 'What it does to the picture', 'What it does to the walls'],
        ['Black point', 'Every grey at or darker than this becomes pure black.', 'Raising it makes more of the picture '
         'print at the Thickest setting. Good for making dark areas solid.'],
        ['White point', 'Every grey at or lighter than this becomes pure white.', 'Lowering it makes more of the picture '
         'print at the Thinnest setting. Good for clean bright areas.'],
        ['Brightness', 'Makes the whole picture lighter (+) or darker (-).', '+ makes every wall thinner. - makes every '
         'wall thicker.'],
        ['Contrast', 'Pushes greys away from middle grey, toward black and white.', 'Spreads thicknesses toward both '
         'ends. Middle grey (1.9 mm by default) stays put. The best slider for logos.'],
        ['Midtones', 'Moves the middle greys lighter (right) or darker (left). Black and white stay the same.',
         'Right = thinner mid-tone walls, which brings out detail in shadows.'],
        ['Sharpen', 'Makes edges crisper by lightening the light side and darkening the dark side of each edge.',
         'Steeper thickness changes at edges. Too much (above about 1.0) causes light halos around shapes.'],
        ['Invert (negative)', 'Swaps black and white.', 'Thin becomes thick and thick becomes thin.'],
    ], [1.15 * inch, 2.75 * inch, 3.1 * inch]))
    s.append(P('Position in window: moves the picture inside its window; does not change thickness', H3))
    s.append(table([
        ['Setting', 'What it does'],
        ['Zoom', 'Enlarges or shrinks the picture inside the window (0.5x to 4x).'],
        ['Move left / right, Move up / down', 'Slides the picture inside the window.'],
        ['Rotate', 'Turns the picture inside the window (-180 to 180 degrees).'],
    ], [2.2 * inch, 4.8 * inch]))
    s.append(P('Photo window on the ball: where the window sits and how big it is', H3))
    s.append(table([
        ['Setting', 'What it does'],
        ['Around the ball, Up / down', 'Where the window\'s centre is (0 degrees = front). Dragging the photo sets these too.'],
        ['Size (how far around)', 'How wide the window is, in degrees and mm.'],
        ['Window height', 'Matches the photo, or a fixed % of the width.'],
        ['Soft edge', 'Width of the fade at the window\'s edge (0 to 40 mm, default 8).'],
        ['Window shape', 'Rectangle or oval.'],
        ['Projection', '<b>Natural</b>: no squeezing, best for a side. <b>Flat</b>: best for the top or a small photo. '
         '<b>Straight-on</b>: no distortion on a flat face (the cube uses it). <b>Wrap</b>: all the way round.'],
    ], [2.2 * inch, 4.8 * inch]))
    s.append(P('Photo on the panel (flat panel instead of the window on the ball)', H3))
    s.append(table([
        ['Setting', 'What it does'],
        ['Fill the whole panel', 'On (the first photo): the photo covers the panel, cropped to its shape. Drag it on the '
         'panel, or use Zoom and Move, to choose what shows.'],
        ['Left / right, Up / down, Width', 'Off: the photo sits in a window of this size and place (later photos start '
         'this way). Drag it on the panel to move it.'],
        ['Arrange as collage', 'With 2 or more photos: lays them out in a grid inside the frame, in list order.'],
    ], [2.2 * inch, 4.8 * inch]))
    s.append(P('<b>Plain ball / plain panel</b> (bottom of the tab): the brightness outside your photos. '
               '100% = Thinnest, 0% = Thickest.', BODY))

    s.append(P('Shape tab', H2))
    s.append(table([
        ['Setting', 'What it does', 'Effect on the walls', 'Range / default'],
        ['Shape', 'Basketball, plain sphere, soccer, football, baseball/softball, volleyball, Moon, Cube (5 photos) or '
         'Flat panel.',
         'Sets the body and its lines.', 'Basketball'],
        ['Size', 'Small / Medium / Large or custom. Balls 100/150/200 mm; footballs 160 x 100 / 240 x 150 / '
         '280 x 175 mm; cube 80/100/130 mm.', 'A bigger lamp spreads the picture over more area.', 'Medium'],
        ['Thinnest (brightest)', 'Thickness used for pure white.', 'Lower = brighter highlights, but more fragile. Keep at '
         'least 0.8 mm with a 0.4 mm nozzle (two printed lines).', '0.4 to 2.0 mm<br/>Default 0.8'],
        ['Thickest (darkest)', 'Thickness used for pure black.', 'Higher = darker shadows. Past about 3 mm in white PLA '
         'little light gets through.', '1.5 to 5.0 mm<br/>Default 3.0'],
        ['Picture detail on the', 'Inside or Outside (balls, cube); Back or Front (panel). Outside / Front puts the '
         'bumpy side toward you, which usually looks crisper when lit; the ball is then textured to the touch. The '
         'collar, and a cube\'s top face (it prints on the bed), keep their detail inside.',
         'None: same thickness either way.', 'Inside (Back)'],
        ['Opening, collar height, collar wall', 'The hole the light shines through and the collar that drops into the '
         'base.', 'Collar wall also sets the plain band above the opening.', '50 mm, 5 mm, 2 mm'],
        ['Football: tip shape', 'From a smooth oval to pointed.', 'None (shape only).', 'Default 60%'],
        ['Moon: mode, crater depth, turn', 'Moon only or Photo + Moon; how deep the craters print; which side faces '
         'front.', 'Crater depth adds thickness detail from NASA\'s height map.', 'Moon only, 40%, 0 degrees'],
        ['Cube: edge rounding, photo border, even glow', 'Rounded edges; plain margin round each face photo ("Fit '
         'photos to faces" re-places them); evens out the glow.', 'Even glow thins the dim tops of the walls and '
         'thickens near the light.', '5 mm, 5 mm, on at 50%'],
        ['Flat panel: shape and size', 'Rectangle (Match photo, 4x6, 5x7, 8x10 in, or custom), or square, circle or heart '
         '(4, 6, 8 in or custom). Circles and hearts have a small flat on the bottom.', 'None (size only).',
         'Rectangle, matching the photo'],
        ['Flat panel: curve', 'Bends the panel side to side; its edges come toward you.', 'None (shape only).',
         'Flat (0 to 120 degrees)'],
        ['Flat panel: frame, feet', 'Raised frame (on the picture side); feet on the bottom edge to stand without a base.',
         'The frame is the thickest part.', 'Frame on, 6 mm; feet off'],
        ['Lantern: panels', 'Rectangle (4x6, 5x7, 8x10 in, portrait or landscape, or custom) or square (4, 6, 8 in or '
         'custom); 3 to 6 sides, all the same, flat, picture detail facing out.', 'None (size only).', '4x6 in portrait'],
        ['Lantern: frame', 'Pillar thickness, base height, slot fit and peg fit (extra room).', 'None: the frame is not a '
         'lithophane.', '16 mm, 24 mm, 0.4 mm, 0.25 mm'],
        ['Lantern: top', 'Like the photo (crossed beams, capped posts, open lattice), Pagoda roof or Simple lid; top '
         'height and overhang.', 'None.', 'Like the photo, 32 mm, 10 mm'],
        ['Lantern: Christmas theme', 'Low or two-tier roof, ring or star topper, snowflakes and trees or holly and berries; '
         'how far the side frames cover each picture; eaves; preview colours.', 'None, but the frames hide the outer edge '
         'of each picture.', 'Plain; frames 12 mm'],
    ],[1.35 * inch, 2.3 * inch, 2.15 * inch, 1.2 * inch]))
    s.append(Spacer(1, 4))
    s.append(P('Thinnest and Thickest always stay at least 0.5 mm apart. New projects keep your sizes, thicknesses, '
               'opening and base settings.', SMALL))

    s.append(P('Markings tab', H2))
    s.append(table([
        ['Setting', 'What it does', 'Effect on the walls'],
        ['Style', 'Carved (dark lines, smooth outside), Raised (stick out) or Off.',
         'Carved lines go up to 0.4 mm past Thickest; raised lines add their height outside.'],
        ['Line width', 'Auto = 2% of the lamp size (3.0 mm on a 150 mm ball).', 'Wider lines cover more of the lamp.'],
        ['Darkness / Raised height', 'How dark carved lines are, or how far raised ones stick out (0.3 to 3 mm).',
         '100% darkness = Thickest + 0.4 mm.'],
        ['Hide lines under photos', 'How much lines fade where they cross a photo. 100% (the default) hides them; '
         'they fade back in at the photo\'s soft edge.', 'At 70%, lines inside a photo go 30% of the way.'],
        ['Pentagon darkness (soccer)', 'How much darker the 12 pentagons glow.', 'Pushes them toward Thickest.'],
        ['End stripes (football)', 'Bright bands near the tips, like a college ball.', 'Thinnest (they glow bright).'],
        ['Spin, Tilt (not football)', 'Turns the line pattern.', 'None; moves where the lines are.'],
    ], [1.55 * inch, 2.75 * inch, 2.7 * inch]))
    s.append(P('Lines always stop 1.5 mm short of text, so text stays readable.', SMALL))

    s.append(P('Text tab', H2))
    s.append(table([
        ['Setting', 'What it does', 'Effect on the walls'],
        ['+ Add text, the list', 'Several text items; each can be hidden, copied or removed.', ''],
        ['Font', 'Varsity, Bold sans, Script or Serif.', ''],
        ['Style', 'Carved (dark), Bright (glows light) or Raised.',
         'Carved = Thickest + 0.4 mm; Bright = Thinnest; Raised adds height outside.'],
        ['Letter height', 'Capital letter height (4 to 60 mm, default 15). Warns below 6 mm (Script 10 mm).', ''],
        ['Bend', 'Curves the text from a smile to an arch.', ''],
        ['Bright outline', 'A thin glowing outline round the letters, for reading over dark photo areas.',
         'Thinnest in a 0.8 mm ring.'],
        ['Placing', 'Click (or tap) the lamp to move the text there; then Around, Up / down and Rotate. On a panel: '
         'Left / right, Up / down and Rotate (no Raised style: the front stays smooth).', ''],
    ], [1.5 * inch, 3.2 * inch, 2.3 * inch]))

    s.append(P('Base tab', H2))
    s.append(table([
        ['Setting', 'What it does'],
        ['Light', '<b>LED puck</b>: the puck goes in from below (enter its diameter and height). <b>LED strip on a '
         'riser</b>: a hollow post rises into the lamp to wrap the strip round. <b>Bulb socket</b> (E12 / E26): holds '
         'a socket on a 1/8" threaded lamp nipple.'],
        ['Collar fit', 'Extra room for the collar in the seat (default 0.4 mm). Too tight: add room. Too loose: take '
         'some away.'],
        ['Base shape, extra width', 'Matches the lamp (round under balls, square under the cube), or round or square; '
         'extra width all round.'],
        ['Cable notch', 'Width and height of the notch at the back.'],
        ['Export base STL', 'A separate file, already turned the right way up for printing.'],
        ['Flat panel: base', '<b>Light box</b>: the panel stands in a slot; an LED strip on a leaning floor behind it '
         'shines up its back (set the strip width; even glow on/off). <b>Slot stand</b>: just the slot. <b>None</b>: '
         'feet, a window or a frame.'],
        ['Flat panel: slot fit', 'Extra room in the slot (default 0.4 mm). The app shows the slot width.'],
        ['Lantern: light', 'Your puck\'s diameter and height (it stands on the table in a hole in the base\'s floor, or sits '
         'in a tray: a closed floor with a rim round it and a gap for the cord; lift the lantern off to switch it on), the cable notch width, and even glow on/off and strength.'],
    ], [1.6 * inch, 5.4 * inch]))

    s.append(P('Export tab', H2))
    s.append(table([
        ['Setting', 'What it does'],
        ['Printer bed', 'Your printer\'s build size; the app checks the lamp fits, and says when it only fits diagonally.'],
        ['Detail: Draft / Standard / Fine', 'Points on the photo side 0.5 / 0.3 / 0.2 mm apart. Standard is best for '
         'most prints. Detail does not change wall thickness. Each choice shows its file size; a very big file gets a '
         'warning (sooner on phones and tablets, which have less memory).'],
        ['Export ball / panel STL', 'The lamp. The cube comes out upside down (top face on the bed); a panel stands '
         'on its bottom edge. Both are ready to print.'],
        ['Lantern', 'A button for each panel (Front, Right, Back, Left; Front, Side 2... for other numbers of sides), the pillar (print one per corner), the base and the top, '
         'each with its own printer-fit check, already turned for printing without supports.'],
        ['Export all parts as one 3MF', 'Every part in one file: the lamp and its base, or every lantern panel and pillar, '
         'the base and the top. Each part is named and already turned for printing; press Arrange in your slicer to place them '
         '(on more plates if needed). Uses the detail chosen above; about a fifth the size of the STLs.'],
    ], [2.2 * inch, 4.8 * inch]))

    s.append(P('Getting a clearer picture', H2))
    s += bullets([
        '<b>Check the grey map and the Thickness view.</b> For a logo, aim for clean white and solid black with little '
        'middle grey: raise Contrast and move Black point and White point toward each other.',
        '<b>Colored logos lose contrast.</b> Colors like gold and grey turn into similar greys. A black-and-white version '
        'works best.',
        '<b>Bright light?</b> Raise Thinnest to about 1.0 to 1.2 mm so thin areas do not glow past their edges.',
        '<b>Soft edges?</b> Try Sharpen at about 1.0.',
        '<b>Resolution:</b> about 1500 px across or more is plenty; under 900 px the app warns you.',
        '<b>Print settings matter as much as these sliders.</b> See the companion Printer Settings guide.',
    ])

    doc.build(s, onFirstPage=footer('Lithophane Lamp Creator 1.7 - Settings Guide'),
              onLaterPages=footer('Lithophane Lamp Creator 1.7 - Settings Guide'))


# ---------------------------------------------------------------- document 2
def printer_guide(path):
    doc = SimpleDocTemplate(path, pagesize=letter, leftMargin=0.75 * inch, rightMargin=0.75 * inch,
                            topMargin=0.7 * inch, bottomMargin=0.8 * inch,
                            title='Lithophane Lamp - Printer Settings')
    s = []
    s.append(P('Printer Settings for Lithophane Lamps', H1))
    s.append(P('For Lithophane Lamp Creator 1.7: slicer settings for the lamp and the base, and what each one changes. '
               'Names match Bambu Studio and OrcaSlicer; other slicers use similar names.', SUB))

    s.append(P('Why the slicer matters', H2))
    s.append(P('The app decides how thick each spot of the wall should be (0.8 mm to 3.4 mm with default settings). The '
               'slicer decides how that thickness gets filled with plastic. A lithophane only works if the wall is '
               '<b>solid</b> plastic, because the picture is made of thickness. With normal settings, the slicer prints a '
               'couple of loops on each side and fills the middle with a sparse pattern that is mostly air. Light '
               'scatters off that pattern, so dark areas look blotchy and edges blur.'))
    s.append(Spacer(1, 4))
    s.append(WallSection())
    s.append(Spacer(1, 6))

    s.append(P('Recommended settings for the lamp', H2))
    s.append(table([
        ['Setting (where to find it)', 'Set to', 'What it changes'],
        ['Sparse infill density<br/>(Strength tab)', '<b>100%</b>', 'Fills the middle of the wall solid instead of a '
         'sparse pattern. The most important setting on this page.'],
        ['Wall loops<br/>(Strength tab)', '<b>3 to 4</b>', 'Each loop is printed on both the outside and the inside of '
         'the shell, so 4 loops cover about 3.4 mm, nearly the whole wall; 100% infill fills the rest. This is what '
         'most lithophane guides use. More loops also work if the light looks grainy.'],
        ['Layer height<br/>(Quality tab or preset)', '<b>0.12 mm</b><br/>(0.08 mm for finest)', 'Much of the lamp is '
         'close to vertical, so up-and-down detail cannot be finer than one layer. Thinner layers give sharper '
         'edges and less banding.'],
        ['Seam position<br/>(Quality tab)', '<b>Back</b>', 'Every layer starts and ends at the seam, leaving a thin '
         'line. Put it on the side away from the picture.'],
        ['Wall generator<br/>(Quality tab)', '<b>Arachne</b>', 'Handles walls whose thickness keeps changing, like a '
         'lithophane. It is the default in recent versions.'],
        ['Outer wall speed<br/>(Speed tab)', '<b>Slower than default</b> (try about half)', 'A cleaner surface and '
         'more even light.'],
        ['Supports<br/>(Support tab)', '<b>On</b>, tree, build plate only (balls, football, Moon). <b>Off</b> for the '
         'cube and flat panels.',
         'Balls need them for the curve just above the collar. The cube and panels are designed to print without them.'],
        ['Brim<br/>(Others tab)', '<b>On</b> for flat panels, about 5 mm', 'A panel stands on a narrow edge; a brim stops '
         'it tipping or lifting, especially hearts and tall panels.'],
        ['Ironing', '<b>Off</b>', 'Not needed.'],
    ], [1.75 * inch, 1.65 * inch, 3.6 * inch]))
    s.append(Spacer(1, 10))
    s.append(callout('In your slicer, "infill" is split into two settings. <b>Sparse infill</b> is the inside of the '
                     'part; change this one to 100%. <b>Solid infill</b> is only the top and bottom layers; leave it as '
                     'is. Wall loops is a third, separate setting.', 'Which "infill"?'))

    s.append(P('Orientation: how each file goes on the bed', H2))
    s.append(table([
        ['File', 'How it prints'],
        ['Balls, Moon', 'Opening down, as exported. Turn the lamp so the picture faces away from the seam.'],
        ['Football', 'Lying on its side, opening down, as exported. The Large football only fits a 256 mm bed placed '
         'diagonally: rotate it 45 degrees in the slicer (the app tells you).'],
        ['Cube', 'Already upside down in the file: top face flat on the bed. The 45-degree funnel underneath needs no '
         'supports.'],
        ['Base: LED puck, bulb socket', 'Already upside down in the file (top on the bed). No supports.'],
        ['Base: LED strip riser', 'Standing up, as it sits on the table. No supports.'],
        ['Flat panel', 'Standing up on its bottom edge, as exported, with the front facing the seam-free side. Brim on, '
         'no supports.'],
        ['Panel light box, slot stand', 'Standing up, as it sits on the table. No supports.'],
        ['Lantern panels', 'Standing up on the bottom edge, as exported, picture side out. Brim on, no supports.'],
        ['Lantern pillar (one per corner)', 'Standing on its foot (the end with the hole), as exported; a pillar too tall for '
         'your printer comes out lying on its side. No supports.'],
        ['Lantern base, top', 'As exported: the base and the photo-style and pagoda tops as they sit (overhangs cut at '
         '45 degrees), the simple lid upside down. No supports.'],
        ['Christmas trim', 'Flat on the bed, in your second colour (gold, cream...). 0.2 mm layers or finer, no supports; '
         'glue on with thin super glue or a PLA glue pen.'],
    ], [1.9 * inch, 5.1 * inch]))

    s.append(P('Printing the base', H2))
    s.append(P('The base is not a lithophane, so it does not need solid walls: normal settings are fine (0.2 mm layers, '
               '2 to 3 wall loops, 15 to 20% sparse infill). Use <b>black or another dark, opaque filament</b> so light '
               'only comes out through the lamp, not the base.', BODY))
    s.append(P('The lantern\'s pillars, base and top print the same way. Print the base and one pillar first and push them '
               'together: if the peg is too tight or too loose, change Peg fit (Shape tab); if a panel won\'t slide down a '
               'slot, add Slot fit.', BODY))

    s.append(P('Printer and material', H2))
    s.append(table([
        ['Item', 'Recommendation'],
        ['Nozzle', '0.4 mm works well. A 0.2 or 0.25 mm nozzle gives sharper edges but prints much slower. With 0.4 mm '
                   'keep the app\'s Thinnest at 0.8 mm or more (two printed lines).'],
        ['Filament', 'White PLA for the lamp, from one spool: brands and even shades of white let different amounts of '
                     'light through. Dark PLA for the base.'],
        ['Print time', 'Expect 2 to 3 times longer than a normal print of the same size. That is normal for lithophanes.'],
    ], [1.4 * inch, 5.6 * inch]))

    s.append(P('Checklist before you print the lamp', H2))
    s += bullets([
        'Sparse infill density 100%',
        'Wall loops 3 to 4',
        'Layer height 0.12 mm (or 0.08 mm)',
        'Seam position Back, and the picture turned away from it',
        'Supports on, build plate only (off for the cube and panels; a brim for panels)',
        'In the slicer preview, scroll through the layers: the wall should show only loops and solid fill, with no '
        'open, diagonal sparse pattern.',
    ])

    s.append(P('Troubleshooting', H2))
    s.append(table([
        ['What you see', 'Likely cause', 'Fix'],
        ['Blotchy or patchy dark areas', 'Sparse infill inside the thick parts of the wall',
         'Sparse infill 100%, wall loops 3 to 4'],
        ['Grainy or streaky light', 'Infill lines showing through', 'Try more wall loops (6 to 10) so loops fill more '
         'of the wall'],
        ['Horizontal stripes across the picture', 'Layer lines', 'Layer height 0.12 mm or 0.08 mm; slow the outer wall'],
        ['Blurry edges', 'Thick layers, glow spilling from very thin areas, or low contrast in the picture',
         'Thinner layers; raise the app\'s Thinnest to 1.0 to 1.2 mm; raise Contrast in the app'],
        ['A thin vertical line through the picture', 'The seam', 'Seam position Back; turn the lamp'],
        ['Very bright spots or small holes', 'Walls thinner than the nozzle can print',
         'Keep Thinnest at 0.8 mm or more with a 0.4 mm nozzle'],
        ['Whole lamp looks washed out', 'Light too bright for the wall range', 'Raise Thinnest a little, or dim the light'],
        ['Collar too tight or loose in the base', 'Printer tolerance', 'Base tab: change Collar fit by 0.1 to 0.2 mm'],
        ['Light leaks out of the base', 'Light-colored base filament', 'Print the base in dark, opaque filament'],
    ], [1.9 * inch, 2.35 * inch, 2.75 * inch]))
    s.append(Spacer(1, 8))
    s.append(P('Tip: to test settings quickly, export a Small lamp with the picture shrunk to fit. It prints much faster '
               'and shows the same problems.', SMALL))

    doc.build(s, onFirstPage=footer('Lithophane Lamp Creator 1.7 - Printer Settings'),
              onLaterPages=footer('Lithophane Lamp Creator 1.7 - Printer Settings'))


if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    app_guide(os.path.join(OUT, 'Lithophane-Settings-Guide.pdf'))
    printer_guide(os.path.join(OUT, 'Lithophane-Printer-Settings.pdf'))
    print('done')
