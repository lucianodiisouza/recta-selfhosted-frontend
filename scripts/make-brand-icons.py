#!/usr/bin/env python3
"""Generates the web icons (favicon, apple-touch-icon, PWA icons) from the Equilíbrio mark.

Same geometry as recta-ios/scripts/make-app-icon.py and the Android adaptive icon, in a 100×100
box: filled top half circle, bottom half as an outline, and a horizontal line across.

Usage: python3 scripts/make-brand-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SS = 4  # supersampling for smooth edges

PAPER = (246, 243, 236, 255)  # #F6F3EC
INK = (21, 19, 31, 255)  # #15131F
BRAND = (91, 61, 245, 255)  # #5B3DF5


def render(size, scale=1.0):
    """The mark on paper. `scale` shrinks the drawing around the center (maskable safe zone)."""
    s = size * SS / 100
    img = Image.new("RGBA", (size * SS, size * SS), PAPER)
    d = ImageDraw.Draw(img)
    c = 50
    r, stroke, x1, x2 = 26 * scale, 5 * scale, 50 - 37 * scale, 50 + 37 * scale
    half = stroke / 2
    d.pieslice([(c - r) * s, (c - r) * s, (c + r) * s, (c + r) * s], 180, 360, fill=BRAND)
    ring = [(c - r - half) * s, (c - r - half) * s, (c + r + half) * s, (c + r + half) * s]
    d.arc(ring, 0, 180, fill=INK, width=round(stroke * s))
    y0, y1 = (c - half) * s, (c + half) * s
    d.rectangle([x1 * s, y0, x2 * s, y1], fill=INK)
    for x in (x1, x2):
        d.ellipse([(x - half) * s, y0, (x + half) * s, y1], fill=INK)
    return img.resize((size, size), Image.LANCZOS).convert("RGB")


def main():
    render(16).save(PUBLIC / "favicon-16x16.png", optimize=True)
    render(32).save(PUBLIC / "favicon-32x32.png", optimize=True)
    render(180).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    # PWA icons are declared "any maskable": keep the drawing inside the 80% safe circle.
    render(192, 0.8).save(PUBLIC / "android-chrome-192x192.png", optimize=True)
    render(512, 0.8).save(PUBLIC / "android-chrome-512x512.png", optimize=True)
    render(48).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("ok")


if __name__ == "__main__":
    main()
