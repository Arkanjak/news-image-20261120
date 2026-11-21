#!/usr/bin/env python3
"""Draw the 20 November 2026 news summary onto base.png -> entry.png.

Fresh build for news-image-20261120. Pillow is local build tooling only;
the shipped main.ts is Node stdlib and only validates/copies entry.png.
Layout: top band (date + hero headline + subhead), bottom band with six
verified supporting stories. Image is centre-cropped to square first so
the 960x960 entry keeps the tower upright and centred.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE = 960

NAVY = (8, 12, 24)
GOLD = (255, 196, 66)
WHITE = (255, 255, 255)
SOFT = (235, 235, 225)


def load_font(bold, size):
    names = (
        "LiberationSans-Bold.ttf" if bold else "LiberationSans-Regular.ttf",
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
    )
    for name in names:
        for base in ("/usr/share/fonts/truetype/liberation",
                     "/usr/share/fonts/truetype/dejavu"):
            path = os.path.join(base, name)
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def shrink_to_fit(draw, text, first_size, smallest, width, bold=True):
    """Biggest font at or below first_size whose text fits inside width."""
    size = first_size
    while size > smallest:
        f = load_font(bold, size)
        if draw.textlength(text, font=f) <= width:
            return f
        size -= 1
    return load_font(bold, smallest)


def put_centre(draw, y, text, font, colour):
    draw.text((EDGE / 2, y), text, font=font, fill=colour, anchor="ma")


def square_crop(img):
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def main():
    base = Image.open(os.path.join(HERE, "base.png")).convert("RGB")
    img = square_crop(base).resize((EDGE, EDGE), Image.LANCZOS)
    draw = ImageDraw.Draw(img, "RGBA")

    # ---- top band: date, hero headline, subhead ------------------------
    draw.rectangle([0, 0, EDGE, 176], fill=NAVY + (228,))
    draw.rectangle([0, 176, EDGE, 180], fill=GOLD + (255,))
    put_centre(draw, 18, "20 NOVEMBER 2026",
               shrink_to_fit(draw, "20 NOVEMBER 2026", 46, 20, 880), GOLD)
    headline = "HOUTHI MISSILE HITS RIYADH'S PIF TOWER"
    put_centre(draw, 74, headline,
               shrink_to_fit(draw, headline, 44, 20, 900), WHITE)
    subhead = ("Saudi wealth fund HQ damaged \u2014 windows blown out "
               "across 7\u20138 floors, no injuries")
    put_centre(draw, 132, subhead,
               shrink_to_fit(draw, subhead, 24, 16, 900, bold=False), SOFT)

    # ---- bottom band: six supporting stories ---------------------------
    draw.rectangle([0, 744, EDGE, EDGE], fill=NAVY + (232,))
    draw.rectangle([0, 744, EDGE, 748], fill=GOLD + (255,))
    stories = [
        "ICJ: MYANMAR COMMITTED GENOCIDE",
        "ANTHROPIC IPO +17% \u2022 $81.3B RECORD",
        "NIKKEI -5.1% IN AI SELLOFF",
        "KERCH BRIDGE HIT 3RD TIME IN A WEEK",
        "SHENZHEN PEACE DECLARATION",
        "KENYA'S LAST EBOLA PATIENT GOES HOME",
    ]
    y = 760
    for line in stories:
        put_centre(draw, y, line,
                   shrink_to_fit(draw, line, 22, 15, 900), WHITE)
        y += 32

    out = os.path.join(HERE, "entry.png")
    img.save(out, "PNG", optimize=True)
    print("wrote", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
