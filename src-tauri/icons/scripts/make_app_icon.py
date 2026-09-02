#!/usr/bin/env python3
"""Generate the app icon (1024x1024 PNG) with no dependencies.

macOS-style rounded square on a vertical blue gradient, carrying the same
line-art logo the tray icon and the in-app `Icon name="logo"` use: three
shrinking rules (a prompt file being tidied) and a small x sweeping the last
line away. Rendered at 4x supersampling and box-downsampled.

Run from src-tauri/icons: `python3 scripts/make_app_icon.py` writes
`app-icon-1024.png`; then `pnpm tauri icon src-tauri/icons/app-icon-1024.png`
regenerates every size Tauri bundles (32/128/icns/ico/...).
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZE = 1024
SS = 4  # supersample factor
N = SIZE * SS

# The macOS grid: the icon shape is inset ~10% on each side.
INSET = 0.098 * N
RADIUS = 0.2237 * (N - 2 * INSET)  # Big Sur corner ratio

# Gradient stops (top -> bottom), the app's blue leaning deeper.
TOP = (64, 140, 255)
BOTTOM = (10, 82, 216)

# Logo geometry on the 24-unit grid of src/components/Icon (logo paths):
# lines y=6 (x 5..19), y=11 (x 5..14), y=16 (x 5..9, faded), x-mark ~(15..17, 15..17.5)
GRID = 24.0
STROKE = 2.0  # grid units, round caps


def smoothstep(e0: float, e1: float, x: float) -> float:
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def rounded_rect_alpha(x: float, y: float) -> float:
    """Coverage of the rounded-square silhouette at supersample pixel (x, y)."""
    left, top = INSET, INSET
    right, bottom = N - INSET, N - INSET
    if x < left or x > right or y < top or y > bottom:
        return 0.0
    cx = min(max(x, left + RADIUS), right - RADIUS)
    cy = min(max(y, top + RADIUS), bottom - RADIUS)
    dx, dy = x - cx, y - cy
    d = (dx * dx + dy * dy) ** 0.5
    return 1.0 - smoothstep(RADIUS - 1.5, RADIUS + 1.5, d)


def seg_dist(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    t = 0.0 if denom == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / denom))
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return (dx * dx + dy * dy) ** 0.5


# (segments, opacity) on the 24 grid
# The x uses a thinner stroke than the rules, like the in-app icon (1.4 vs 2).
GLYPH: list[tuple[tuple[float, float, float, float], float, float]] = [
    ((5.0, 6.0, 19.0, 6.0), 1.0, 2.0),
    ((5.0, 11.0, 14.0, 11.0), 1.0, 2.0),
    ((5.0, 16.0, 9.0, 16.0), 0.55, 2.0),
    ((15.2, 15.2, 17.4, 17.4), 1.0, 1.3),
    ((17.4, 15.2, 15.2, 17.4), 1.0, 1.3),
]


def glyph_alpha(x: float, y: float, scale: float, ox: float, oy: float) -> float:
    """White-glyph coverage at supersample pixel (x, y)."""
    gx, gy = (x - ox) / scale, (y - oy) / scale
    best = 0.0
    for (ax, ay, bx, by), opacity, stroke in GLYPH:
        w = stroke / 2.0
        d = seg_dist(gx, gy, ax, ay, bx, by)
        aa = 1.5 / scale
        cov = (1.0 - smoothstep(w - aa, w + aa, d)) * opacity
        if cov > best:
            best = cov
    return best


def render() -> bytes:
    # Glyph occupies the middle ~56% of the shape, optically centered.
    shape = N - 2 * INSET
    scale = shape * 0.62 / GRID
    ox = (N - GRID * scale) / 2.0
    oy = (N - GRID * scale) / 2.0 + shape * 0.008

    rows = []
    for oy_px in range(SIZE):
        row = bytearray()
        for ox_px in range(SIZE):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    x = ox_px * SS + sx + 0.5
                    y = oy_px * SS + sy + 0.5
                    shape_a = rounded_rect_alpha(x, y)
                    if shape_a <= 0.0:
                        continue
                    t = (y - INSET) / (N - 2 * INSET)
                    br = TOP[0] + (BOTTOM[0] - TOP[0]) * t
                    bg = TOP[1] + (BOTTOM[1] - TOP[1]) * t
                    bb = TOP[2] + (BOTTOM[2] - TOP[2]) * t
                    ga = glyph_alpha(x, y, scale, ox, oy)
                    pr = br + (255 - br) * ga
                    pg = bg + (255 - bg) * ga
                    pb = bb + (255 - bb) * ga
                    r += pr * shape_a
                    g += pg * shape_a
                    b += pb * shape_a
                    a += shape_a
            n = SS * SS
            alpha = a / n
            if alpha > 0:
                row += bytes(
                    (
                        min(255, round(r / a)),
                        min(255, round(g / a)),
                        min(255, round(b / a)),
                        min(255, round(alpha * 255)),
                    )
                )
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    return b"".join(b"\x00" + r for r in rows)


def png(width: int, height: int, raw: bytes) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "app-icon-1024.png"
    out.write_bytes(png(SIZE, SIZE, render()))
    print(f"wrote {out}")
