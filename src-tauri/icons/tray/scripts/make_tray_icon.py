#!/usr/bin/env python3
"""Render the app's logo line-art as a macOS menu-bar template image.

A menu-bar icon is not a picture: macOS wants a *template* — pure black ink in
the alpha channel, which the system then tints for the light bar, the dark bar,
the highlighted (clicked) state and Reduce Transparency. Handing it the
full-colour app icon is what makes the icon read as a blue square.

The ink is the `logo` glyph from `src/components/Icon/Icon.tsx`, defined on the
same 24-unit grid the app's icon set uses: three left-aligned rules of
decreasing length (the shortest half-faded) and a small cross. Everything is
strokes with round caps, so the rasteriser only needs one primitive — the
distance to a capsule — and anti-aliasing comes from supersampling 8x and box
down-sampling, which keeps the hairlines from crawling on a 1x display.

The canvas is 18 pt because that is the only size that survives: tray-icon
re-encodes the image and pins `NSImage` to `icon_height = 18.0`
(`platform_impl/macos/mod.rs`), scaling the width to match. Art authored on a
22 pt canvas therefore arrives letterboxed — its 16 pt of ink lands at ~13 pt,
noticeably smaller than every neighbour in the bar. Authoring at 18 with 1 pt of
clear space puts the ink at the size it is actually drawn.

Stdlib only (struct + zlib write the PNG) so the icons can be regenerated on any
machine with a Python 3, with no wheel to install and nothing to vendor.

    python3 src-tauri/icons/tray/scripts/make_tray_icon.py

writes `trayTemplate.png` (22x22) and `trayTemplate@2x.png` (44x44) next to the
`scripts/` directory. Both are committed: the build includes the bytes.
"""

import math
import os
import struct
import zlib

# --- the glyph -------------------------------------------------------------

#: Design grid of `Icon.tsx` — every coordinate below is in these units.
GRID = 24.0

#: One stroke: (x1, y1, x2, y2, width, alpha). Straight from the `logo` icon:
#: three rules, the last at 50% opacity, and the two crossing strokes of the
#: small x.
#:
#: The x is longer and thinner than the on-screen icon's (1.0 against 1.4, over
#: 3.2 units against 2.1). At 18 pt the original's two 1.4-wide strokes crossing
#: inside a 2.9 pt box overlap along most of their length and rasterise as a
#: solid blob — a smudge beside the rules rather than a mark. Stretched and
#: thinned, the four arms clear each other at 1x and the centre still reads as a
#: crossing.
STROKES = [
    (5.0, 6.0, 19.0, 6.0, 2.0, 1.0),
    (5.0, 11.0, 14.0, 11.0, 2.0, 1.0),
    (5.0, 16.0, 9.0, 16.0, 2.0, 0.5),
    (14.6, 14.8, 17.8, 18.0, 1.0, 1.0),
    (17.8, 14.8, 14.6, 18.0, 1.0, 1.0),
]

#: Canvas edge in points. tray-icon pins the NSImage to 18 pt tall on macOS, so
#: this is the size the glyph is drawn at whatever it is authored at.
CANVAS = 18.0
#: Clear space between the ink and the canvas edge, in points. AppKit already
#: pads the status item; more than a hairline here only shrinks the glyph.
PADDING = 1.0
#: Samples per axis. 8x8 = 64 coverage samples per output pixel.
SUPERSAMPLE = 8


def ink_bounds():
    """The bounding box of the drawn ink, in grid units.

    Half a stroke width past each end point: a round cap is a half-disc, so the
    ink reaches further than the centre line it is drawn along.
    """
    xs, ys = [], []
    for x1, y1, x2, y2, width, _ in STROKES:
        half = width / 2.0
        xs += [min(x1, x2) - half, max(x1, x2) + half]
        ys += [min(y1, y2) - half, max(y1, y2) + half]
    return min(xs), min(ys), max(xs), max(ys)


def placement(edge):
    """Scale and offset mapping grid units onto an `edge`x`edge` pixel canvas.

    The ink box — not the 24-unit grid — is what gets centred: the glyph only
    occupies the middle of its grid, and fitting the grid instead would leave
    the icon visibly smaller than every other icon in the menu bar.
    """
    x0, y0, x1, y1 = ink_bounds()
    pixels_per_point = edge / CANVAS
    available = (CANVAS - 2.0 * PADDING) * pixels_per_point
    scale = min(available / (x1 - x0), available / (y1 - y0))
    dx = (edge - (x1 - x0) * scale) / 2.0 - x0 * scale
    dy = (edge - (y1 - y0) * scale) / 2.0 - y0 * scale
    # Snap the ink to whole pixels. Centring lands the rules on a quarter-pixel
    # phase, which spreads a 2 pt rule over three rows — one solid and two grey —
    # and at 18 pt that grey is a third of the mark. Rounding the offset costs a
    # quarter pixel of centring and buys rules with hard edges. This is the one
    # hinting step the glyph needs; everything else it does is anti-aliasing.
    return scale, round(dx), round(dy)


def capsule_distance(px, py, x1, y1, x2, y2):
    """Distance from a point to a segment — a round-capped stroke's centre line."""
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq == 0.0:
        return math.hypot(px - x1, py - y1)
    t = ((px - x1) * dx + (py - y1) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def coverage(edge):
    """Alpha per output pixel, 0-255, row-major.

    Strokes are rasterised into a supersampled mask one at a time and combined
    with `max`, not by adding: the x's two strokes overlap at their crossing,
    and summing there would push the alpha past the stroke's own opacity and
    leave a dark knot in the middle of the mark.
    """
    scale, dx, dy = placement(edge)
    side = edge * SUPERSAMPLE
    mask = bytearray(side * side)

    for x1, y1, x2, y2, width, alpha in STROKES:
        # Into supersample space, where one unit is one sample.
        ax, ay = (x1 * scale + dx) * SUPERSAMPLE, (y1 * scale + dy) * SUPERSAMPLE
        bx, by = (x2 * scale + dx) * SUPERSAMPLE, (y2 * scale + dy) * SUPERSAMPLE
        half = width * scale * SUPERSAMPLE / 2.0
        value = int(round(alpha * 255))

        # Only the stroke's own neighbourhood is worth testing; the whole
        # canvas would be ~100x the samples for the same picture.
        lo_x = max(0, int(math.floor(min(ax, bx) - half)))
        hi_x = min(side - 1, int(math.ceil(max(ax, bx) + half)))
        lo_y = max(0, int(math.floor(min(ay, by) - half)))
        hi_y = min(side - 1, int(math.ceil(max(ay, by) + half)))

        for sy in range(lo_y, hi_y + 1):
            row = sy * side
            py = sy + 0.5
            for sx in range(lo_x, hi_x + 1):
                if capsule_distance(sx + 0.5, py, ax, ay, bx, by) <= half:
                    if mask[row + sx] < value:
                        mask[row + sx] = value

    # Box down-sample: the mean of each SUPERSAMPLE x SUPERSAMPLE block.
    samples = SUPERSAMPLE * SUPERSAMPLE
    out = bytearray(edge * edge)
    for y in range(edge):
        for x in range(edge):
            total = 0
            for sy in range(y * SUPERSAMPLE, (y + 1) * SUPERSAMPLE):
                row = sy * side + x * SUPERSAMPLE
                total += sum(mask[row : row + SUPERSAMPLE])
            out[y * edge + x] = (total + samples // 2) // samples
    return out


# --- the PNG ---------------------------------------------------------------


def chunk(tag, payload):
    """One PNG chunk: length, tag, payload, CRC over tag+payload."""
    body = tag + payload
    return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, edge, alpha):
    """Write an 8-bit RGBA PNG whose colour is black everywhere.

    Black plus alpha is exactly what a template image is; macOS reads only the
    alpha channel, so the RGB bytes are there to satisfy the format.
    """
    raw = bytearray()
    for y in range(edge):
        raw.append(0)  # filter type 0 (None) — the image is tiny, and it keeps
        # the writer to one obvious code path.
        for x in range(edge):
            raw += b"\x00\x00\x00" + bytes((alpha[y * edge + x],))

    header = struct.pack(">IIBBBBB", edge, edge, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def dump(edge):
    """The alpha channel as text, for judging the glyph without a menu bar."""
    ramp = " .:-=+*#%@"
    alpha = coverage(edge)
    return "\n".join(
        "".join(ramp[min(9, alpha[y * edge + x] * 10 // 256)] for x in range(edge))
        for y in range(edge)
    )


def main():
    # Only the 2x art is written. tray-icon hands one PNG to `NSImage` and pins
    # it to 18 pt; a second density is never read, and a file nothing loads is a
    # file nobody keeps correct. 36 px is what a Retina bar wants, and AppKit
    # down-samples it for a 1x one.
    out_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(out_dir, "trayTemplate@2x.png")
    write_png(path, 36, coverage(36))
    print("wrote {} (36x36)".format(path))
    # The 18 px raster is not written, only shown: it is the glyph at the size
    # macOS draws it, and the only way to judge it on a headless machine.
    print("\nalpha at 18 px (the pt size AppKit renders):\n" + dump(18))


if __name__ == "__main__":
    main()
