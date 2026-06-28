#!/usr/bin/env python3
"""Generate Verity entity textures — original assets inspired by the horror ARG concept."""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).parent
RP = ROOT / "KNOWWS_Horror_RP"


def write_png(path: Path, pixels, w: int, h: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = b""
    for y in range(h):
        raw += b"\x00"
        for x in range(w):
            raw += bytes(pixels[y * w + x])
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.write_bytes(png)


def rgba(r, g, b, a=255):
    return bytes([r, g, b, a])


def draw_sphere(w, h, yellow, face_fn):
    px = [rgba(0, 0, 0, 0)] * (w * h)
    cx, cy, cz = w // 2, h // 2, 0
    radius = min(w, h) // 2 - 4
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= radius * radius:
                shade = max(0, min(255, yellow[0] - abs(dx) * 2))
                px[y * w + x] = rgba(shade, min(255, yellow[1] - abs(dy)), max(0, yellow[2] - abs(dx) - abs(dy)), 255)
    face_fn(px, w, h, cx, cy, radius)
    return px


def face_nice(px, w, h, cx, cy, r):
    # Happy smile eyes
    for ex in (cx - r // 3, cx + r // 3):
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx * dx + dy * dy <= 4:
                    y, x = cy - r // 5 + dy, ex + dx
                    if 0 <= y < h and 0 <= x < w:
                        px[y * w + x] = rgba(40, 30, 20)
    # Smile arc
    for x in range(cx - r // 2, cx + r // 2):
        y = cy + r // 4 + int(0.01 * (x - cx) ** 2)
        if 0 <= y < h and 0 <= x < w:
            px[y * w + x] = rgba(40, 30, 20)
            if y + 1 < h:
                px[(y + 1) * w + x] = rgba(40, 30, 20)


def face_zesty(px, w, h, cx, cy, r):
    # Wide excited eyes
    for ex in (cx - r // 3, cx + r // 3):
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if dx * dx + dy * dy <= 9:
                    y, x = cy - r // 5 + dy, ex + dx
                    if 0 <= y < h and 0 <= x < w:
                        px[y * w + x] = rgba(20, 20, 20)
    # Big grin
    for x in range(cx - r // 2 + 2, cx + r // 2 - 2):
        for yoff in range(0, 4):
            y = cy + r // 5 + yoff
            if 0 <= y < h and 0 <= x < w:
                px[y * w + x] = rgba(30, 20, 20)


def face_weird(px, w, h, cx, cy, r):
    # Uneven eyes
    for dx, dy, sz in [(-r // 3, -r // 5, 3), (r // 3 + 2, -r // 5 - 2, 2)]:
        ex = cx + dx
        ey = cy + dy
        for py in range(-sz, sz + 1):
            for pxo in range(-sz, sz + 1):
                if pxo * pxo + py * py <= sz * sz:
                    y, x = ey + py, ex + pxo
                    if 0 <= y < h and 0 <= x < w:
                        px[y * w + x] = rgba(10, 10, 10)
    # Crooked smile
    for x in range(cx - r // 3, cx + r // 2):
        y = cy + r // 4 + (x - cx) // 4
        if 0 <= y < h and 0 <= x < w:
            px[y * w + x] = rgba(50, 30, 30)


def face_scary(px, w, h, cx, cy, r):
    # Hollow dark eyes
    for ex in (cx - r // 3, cx + r // 3):
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                if dx * dx + dy * dy <= 16:
                    y, x = cy - r // 5 + dy, ex + dx
                    if 0 <= y < h and 0 <= x < w:
                        px[y * w + x] = rgba(0, 0, 0)
    # Tooth grin
    for x in range(cx - r // 2, cx + r // 2):
        y = cy + r // 5
        if 0 <= y < h and 0 <= x < w:
            px[y * w + x] = rgba(0, 0, 0)
            for tooth in range(0, r // 2, 5):
                tx = cx - r // 2 + tooth
                if 0 <= tx < w and y - 3 >= 0:
                    px[(y - 3) * w + tx] = rgba(240, 240, 230)
                    px[(y - 2) * w + tx] = rgba(240, 240, 230)


def monster_texture():
    w, h = 64, 128
    px = [rgba(0, 0, 0, 0)] * (w * h)
    # Tall dark body
    for y in range(10, 110):
        width = 8 if y < 80 else 12
        cx = w // 2 - width // 2
        for x in range(cx, cx + width):
            shade = 25 + (y % 8)
            px[y * w + x] = rgba(shade, shade, shade + 5)
    # Long limbs
    for y in range(50, 120):
        for x in range(8, 14):
            px[y * w + x] = rgba(20, 20, 25)
        for x in range(50, 56):
            px[y * w + x] = rgba(20, 20, 25)
    # Glowing eyes
    for ex in (22, 42):
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if dx * dx + dy * dy <= 9:
                    px[(14 + dy) * w + ex + dx] = rgba(255, 50, 50)
    # Wide mouth
    for x in range(20, 44):
        px[22 * w + x] = rgba(0, 0, 0)
        px[23 * w + x] = rgba(180, 30, 30)
    return px, w, h


def box_texture():
    w, h = 16, 16
    px = [rgba(80, 50, 30)] * (w * h)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            px[y * w + x] = rgba(120, 75, 40)
    # Question mark hint
    for y in range(4, 12):
        for x in range(6, 10):
            px[y * w + x] = rgba(255, 220, 80)
    return px, w, h


def main():
    yellow = (255, 220, 50)
    faces = [
        ("verity_nice", face_nice),
        ("verity_zesty", face_zesty),
        ("verity_weird", face_weird),
        ("verity_scary", face_scary),
    ]
    for name, fn in faces:
        px = draw_sphere(64, 64, yellow, fn)
        write_png(RP / "textures" / "entity" / f"{name}.png", px, 64, 64)

    px, w, h = monster_texture()
    write_png(RP / "textures" / "entity" / "verity_monster.png", px, w, h)

    px, w, h = box_texture()
    write_png(RP / "textures" / "blocks" / "verity_box.png", px, w, h)
    write_png(RP / "textures" / "items" / "verity_companion.png", draw_sphere(16, 16, yellow, face_nice), 16, 16)

    print("Verity textures generated.")


if __name__ == "__main__":
    main()
