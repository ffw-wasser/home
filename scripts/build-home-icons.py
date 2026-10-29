#!/usr/bin/env python3
"""Build the public home-screen icon variants from their fixed artwork sources.

The FFW source is the existing municipal crest, never replaced or recolored.
Only its outer white canvas is removed, preserving enclosed white heraldic details.
H2O uses the fire/water shield selected for the personal portal.
"""
from collections import deque
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRANDING = ROOT / "assets" / "branding"
DRINKS = ROOT / "assets" / "drinks"
BRANDING.mkdir(parents=True, exist_ok=True)
DRINKS.mkdir(parents=True, exist_ok=True)

def unframe_crest():
    source = Image.open(ROOT / "icon-512.png").convert("RGBA")
    width, height = source.size
    pixels = source.load()
    connected = bytearray(width * height)
    queue = deque()
    def is_background(x, y):
        r, g, b, alpha = pixels[x, y]
        return alpha < 32 or (min(r, g, b) >= 158 and max(r, g, b) - min(r, g, b) < 22)
    for x in range(width):
        if is_background(x, 0): queue.append((x, 0))
        if is_background(x, height - 1): queue.append((x, height - 1))
    for y in range(height):
        if is_background(0, y): queue.append((0, y))
        if is_background(width - 1, y): queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        pos = y * width + x
        if connected[pos] or not is_background(x, y):
            continue
        connected[pos] = 1
        if x > 0: queue.append((x - 1, y))
        if y > 0: queue.append((x, y - 1))
        if x + 1 < width: queue.append((x + 1, y))
        if y + 1 < height: queue.append((x, y + 1))
    for y in range(height):
        for x in range(width):
            if connected[y * width + x]:
                pixels[x, y] = (0, 0, 0, 0)
    bbox = source.getbbox()
    if not bbox:
        raise RuntimeError("Municipal crest not found in original icon.")
    return source.crop(bbox)

def build_ffw_icon(crest, size):
    icon = Image.new("RGB", (size, size), "black")
    # Keep the municipality's original crest shape, at a legible home-screen size.
    factor = min(size * .79 / crest.width, size * .79 / crest.height)
    resized = crest.resize(
        (max(1, round(crest.width * factor)), max(1, round(crest.height * factor))),
        Image.Resampling.LANCZOS,
    )
    left, top = (size - resized.width) // 2, (size - resized.height) // 2
    icon.paste(resized, (left, top), resized)
    return icon

def build_h2o_icon(image, size):
    return image.resize((size, size), Image.Resampling.LANCZOS).convert("RGB")

def build_blue_h2o_icons():
    """Composite the approved transparent shield onto the portal blue canvas."""
    source = Image.open(DRINKS / "h2o-symbol-white-512.png").convert("RGBA")
    canvas = Image.new("RGBA", source.size, "#075baf")
    canvas.alpha_composite(source)
    for size in (180, 192, 512):
        canvas.convert("RGB").resize((size, size), Image.Resampling.LANCZOS).save(
            DRINKS / f"h2o-symbol-blue-{size}.png", optimize=True)

def build_startup_crest():
    # Use the same original, unframed crest as the existing Home icons.
    unframe_crest().save(BRANDING / "ffw-crest-transparent.png", optimize=True)

def main():
    crest = unframe_crest()
    source = Image.open(BRANDING / "h2o-symbol-white-source.webp").convert("RGB")
    if source.size != (512, 512):
        raise RuntimeError("Unexpected H2O source dimensions.")
    for size in (180, 192, 512):
        build_ffw_icon(crest, size).save(BRANDING / f"ffw-home-{size}.png", optimize=True)
    for size in (96, 180, 192, 512):
        build_h2o_icon(source, size).save(DRINKS / f"h2o-symbol-white-{size}.png", optimize=True)
    print("Created three FFW and four H2O home/portal PNG icons.")

if __name__ == "__main__":
    import sys
    if "--crest" in sys.argv:
        build_startup_crest()
    elif "--h2o-blue" in sys.argv:
        build_blue_h2o_icons()
    else:
        main()
