"""Draw the app's coaster icon from vector shapes, without external image assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'drinks'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def icon(maskable=False):
    scale = 3
    image = Image.new('RGB', (512 * scale, 512 * scale), '#f4ecd9')
    draw = ImageDraw.Draw(image)
    def box(values):
        return tuple(round(x * scale) for x in values)
    def circle(values, fill, outline=None, width=1):
        draw.ellipse(box(values), fill=fill, outline=outline, width=round(width * scale))
    margin = 58 if maskable else 30
    circle((margin, margin + 8, 512 - margin, 512 - margin + 8), '#d8c7a8')
    circle((margin, margin, 512 - margin, 512 - margin), '#faf2df', '#b54a36', 8)
    inner = margin + 16
    circle((inner, inner, 512 - inner, 512 - inner), None, '#b54a36', 2)
    def label(text, y, size):
        draw.text((256 * scale, y * scale), text, fill='#a7382b',
                  font=ImageFont.truetype(FONT, size * scale), anchor='mm')
    label('MEIN DECKEL', 130 if maskable else 117, 27 if maskable else 30)
    draw.rounded_rectangle(box((284, 190, 340, 290)), radius=24 * scale,
                           fill='#faf2df', outline='#70422b', width=9 * scale)
    draw.rounded_rectangle(box((187, 180, 301, 312)), radius=15 * scale,
                           fill='#e9ae37', outline='#70422b', width=8 * scale)
    draw.rounded_rectangle(box((205, 203, 215, 290)), radius=5 * scale, fill='#fff3bf')
    draw.rounded_rectangle(box((273, 203, 280, 290)), radius=4 * scale, fill='#ca8826')
    for x, y, r in [(202, 183, 21), (228, 174, 25), (259, 179, 22), (286, 184, 20)]:
        circle((x - r, y - r, x + r, y + r), '#fffdf7', '#70422b', 5)
    draw.rounded_rectangle(box((192, 177, 296, 196)), radius=8 * scale, fill='#fffdf7')
    label('FFW', 360, 55)
    return image

def home_icon(maskable=False):
    """Bold home-screen mark; key shapes stay inside Android's safe circle."""
    scale = 4
    background, paper, ink = '#981e2c', '#fff3d5', '#481824'
    image = Image.new('RGB', (512 * scale, 512 * scale), background)
    draw = ImageDraw.Draw(image)
    def box(values):
        return tuple(round(x * scale) for x in values)
    def circle(values, fill, outline=None, width=1):
        draw.ellipse(box(values), fill=fill, outline=outline, width=round(width * scale))
    def rect(values, radius, fill, outline=None, width=1):
        draw.rounded_rectangle(box(values), radius=round(radius * scale),
                               fill=fill, outline=outline, width=round(width * scale))
    margin = 57 if maskable else 32
    circle((margin, margin + 12, 512 - margin, 512 - margin + 12), '#6f1420')
    circle((margin, margin, 512 - margin, 512 - margin), paper)
    inner = margin + 15
    circle((inner, inner, 512 - inner, 512 - inner), None, background, 9)
    # Mug handle, beer body and foam: large silhouettes instead of tiny lettering.
    rect((298, 203, 385, 321), 33, paper, ink, 17)
    rect((126, 172, 325, 376), 24, '#f5b626', ink, 15)
    rect((147, 205, 166, 346), 9, '#fff3ba')
    rect((286, 205, 304, 345), 8, '#d68919')
    foam = Image.new('RGBA', image.size)
    f = ImageDraw.Draw(foam)
    for x, y, r in [(149, 177, 26), (185, 157, 33), (229, 151, 36),
                    (272, 157, 33), (309, 177, 26)]:
        f.ellipse(box((x-r, y-r, x+r, y+r)), fill='#ffffff', outline=ink,
                  width=round(12 * scale))
    f.rounded_rectangle(box((133, 166, 322, 193)), radius=10*scale, fill='#ffffff')
    image.paste(foam, mask=foam.getchannel('A'))
    return image

if __name__ == '__main__':
    import sys
    ROOT.mkdir(parents=True, exist_ok=True)
    if '--legacy' in sys.argv:
        normal = icon()
        for size in (180, 192, 512):
            normal.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f'deckel-icon-{size}.png')
        icon(True).resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'deckel-icon-maskable-512.png')
    else:
        normal = home_icon()
        for size in (180, 192, 512):
            normal.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f'deckel-home-v2-{size}.png')
        home_icon(True).resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'deckel-home-v2-maskable-512.png')
