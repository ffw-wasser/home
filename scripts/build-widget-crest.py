#!/usr/bin/env python3
"""Split the existing transparent H2O shield into fixed artwork and tintable rim.

Only light, neutral pixels belong to the white rim. The saturated flame/water
pixels and the near-black outline remain byte-for-byte in the fixed artwork.
Both layers keep the original size, position and alpha; no resampling occurs.
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/drinks/h2o-symbol-white-512.png"


def split_crest(source):
    source = source.convert("RGBA")
    width, height = source.size
    pixels = [source.getpixel((x, y)) for y in range(height) for x in range(width)]
    candidates = {i for i, (r, g, b, a) in enumerate(pixels)
                  if a > 0 and min(r, g, b) >= 32 and max(r, g, b) - min(r, g, b) <= 16}
    # The rim is the largest connected neutral region. White glints INSIDE the
    # water drop are separate components and must keep their original color.
    remaining, rim = set(candidates), set()
    while remaining:
        component = {remaining.pop()}
        pending = list(component)
        while pending:
            i = pending.pop()
            x, y = i % width, i // width
            for yy in range(max(0, y - 1), min(height, y + 2)):
                for xx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = yy * width + xx
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        component.add(neighbor)
                        pending.append(neighbor)
        if len(component) > len(rim):
            rim = component
    nearby = Image.new("L", source.size)
    nearby.putdata([255 if i in rim else 0 for i in range(width * height)])
    nearby = nearby.filter(ImageFilter.MaxFilter(5))
    nearby = [nearby.getpixel((x, y)) for y in range(height) for x in range(width)]
    rim |= {i for i in candidates if nearby[i]}
    artwork = Image.new("RGBA", source.size)
    border = Image.new("RGBA", source.size)
    art_pixels, border_pixels = [], []
    for i, (r, g, b, a) in enumerate(pixels):
        art_pixels.append((0, 0, 0, 0) if i in rim else (r, g, b, a))
        border_pixels.append((255, 255, 255, a) if i in rim else (0, 0, 0, 0))
    artwork.putdata(art_pixels)
    border.putdata(border_pixels)
    assert border.getbbox(), "The original white shield rim is missing"
    return artwork, border


if __name__ == "__main__":
    artwork, border = split_crest(Image.open(SOURCE))
    android = ROOT / "native/android/app/src/main/res/drawable-nodpi"
    for image, name in [(artwork, "artwork"), (border, "border")]:
        image.save(ROOT / f"assets/drinks/h2o-widget-crest-{name}.png", optimize=True)
        image.save(android / f"widget_crest_{name}.png", optimize=True)
