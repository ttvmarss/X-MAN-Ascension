#!/usr/bin/env python3
"""Generate KNOWWS Horror Pack textures — detailed procedural art for items, blocks, and mobs."""
import math
import random
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).parent
BP = ROOT / "KNOWWS_Horror_BP"
RP = ROOT / "KNOWWS_Horror_RP"
RNG = random.Random(42)


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
    return bytes([max(0, min(255, int(r))), max(0, min(255, int(g))), max(0, min(255, int(b))), a])


def blend(c1, c2, t):
    return rgba(c1[0] * (1 - t) + c2[0] * t, c1[1] * (1 - t) + c2[1] * t, c1[2] * (1 - t) + c2[2] * t)


def solid(w, h, color):
    return [color] * (w * h)


def set_px(px, w, x, y, color):
    if 0 <= x < w and 0 <= y < len(px) // w:
        px[y * w + x] = color


def fill_rect(px, w, x1, y1, x2, y2, color):
    for y in range(y1, y2):
        for x in range(x1, x2):
            set_px(px, w, x, y, color)


def draw_outline_rect(px, w, x1, y1, x2, y2, color, thickness=1):
    for t in range(thickness):
        for x in range(x1, x2):
            set_px(px, w, x, y1 + t, color)
            set_px(px, w, x, y2 - 1 - t, color)
        for y in range(y1, y2):
            set_px(px, w, x1 + t, y, color)
            set_px(px, w, x2 - 1 - t, y, color)


def gradient(w, h, top, bottom):
    px = []
    for y in range(h):
        t = y / max(h - 1, 1)
        px.extend([blend(top, bottom, t)] * w)
    return px


def item_gun(name, body, metal, accent):
    w, h = 16, 16
    px = solid(w, h, rgba(0, 0, 0, 0))
    fill_rect(px, w, 1, 6, 14, 9, body)
    fill_rect(px, w, 10, 5, 15, 8, metal)
    fill_rect(px, w, 2, 9, 6, 13, accent)
    fill_rect(px, w, 11, 7, 13, 8, rgba(30, 30, 30))
    set_px(px, w, 14, 6, rgba(255, 220, 80))
    write_png(RP / "textures" / "items" / f"{name}.png", px, w, h)


def item_blade(name, handle, blade_top, blade_bot):
    w, h = 16, 16
    px = solid(w, h, rgba(0, 0, 0, 0))
    for y in range(2, 12):
        shade = blend(blade_top, blade_bot, y / 12)
        for x in range(7, 10):
            set_px(px, w, x, y, shade)
    fill_rect(px, w, 6, 11, 10, 15, handle)
    set_px(px, w, 8, 1, blend(blade_top, (255, 255, 255), 0.4))
    write_png(RP / "textures" / "items" / f"{name}.png", px, w, h)


def item_texture(name, colors):
    w, h = 16, 16
    px = solid(w, h, colors[0])
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            px[y * w + x] = colors[1]
    for y in range(3, h - 3):
        for x in range(3, w - 3):
            px[y * w + x] = colors[2] if len(colors) > 2 else colors[1]
    highlight = blend(colors[2] if len(colors) > 2 else colors[1], (255, 255, 255), 0.25)
    for x in range(3, 6):
        set_px(px, w, x, 3, highlight)
    write_png(RP / "textures" / "items" / f"{name}.png", px, w, h)


def block_ore(name, stone, ore, glow=None):
    w, h = 16, 16
    px = solid(w, h, stone)
    for _ in range(18):
        x, y = RNG.randint(0, w - 1), RNG.randint(0, h - 1)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            if 0 <= x + dx < w and 0 <= y + dy < h:
                px[(y + dy) * w + x + dx] = ore
    if glow:
        for _ in range(4):
            x, y = RNG.randint(1, w - 2), RNG.randint(1, h - 2)
            set_px(px, w, x, y, glow)
    write_png(RP / "textures" / "blocks" / f"{name}.png", px, w, h)


def block_surface(name, base, patch, patches=10):
    w, h = 16, 16
    px = solid(w, h, base)
    for _ in range(patches):
        x, y = RNG.randint(0, w - 3), RNG.randint(0, h - 3)
        fill_rect(px, w, x, y, x + RNG.randint(2, 4), y + RNG.randint(2, 4), patch)
    write_png(RP / "textures" / "blocks" / f"{name}.png", px, w, h)


def humanoid_skin(body, accent, eye, extra_fn=None):
    """Draw a 64x64 Minecraft humanoid mob texture."""
    w, h = 64, 64
    px = solid(w, h, rgba(0, 0, 0, 0))
  # Head faces
    for face_x in (8, 16, 24, 0):
        fill_rect(px, w, face_x, 8, face_x + 8, 16, body)
    fill_rect(px, w, 8, 0, 16, 8, accent)
    fill_rect(px, w, 16, 0, 24, 8, accent)
  # Eyes on head front
    set_px(px, w, 10, 10, eye)
    set_px(px, w, 11, 10, eye)
    set_px(px, w, 13, 10, eye)
    set_px(px, w, 14, 10, eye)
  # Body
    fill_rect(px, w, 20, 20, 28, 32, body)
    fill_rect(px, w, 16, 20, 20, 32, accent)
    fill_rect(px, w, 28, 20, 32, 32, accent)
    fill_rect(px, w, 32, 20, 40, 32, body)
  # Arms
    fill_rect(px, w, 44, 20, 48, 32, accent)
    fill_rect(px, w, 40, 20, 44, 32, body)
    fill_rect(px, w, 48, 20, 52, 32, accent)
    fill_rect(px, w, 52, 20, 56, 32, body)
  # Legs
    fill_rect(px, w, 4, 20, 8, 32, accent)
    fill_rect(px, w, 8, 20, 12, 32, body)
    fill_rect(px, w, 20, 48, 24, 64, accent)
    fill_rect(px, w, 24, 48, 28, 64, body)
    if extra_fn:
        extra_fn(px, w)
    return px, w, h


def mob_skin(name, body, accent, eye, extra_fn=None):
    px, w, h = humanoid_skin(body, accent, eye, extra_fn)
    write_png(RP / "textures" / "entity" / f"{name}.png", px, w, h)


def pack_icon():
    w, h = 128, 128
    px = gradient(w, h, (90, 0, 0), (15, 0, 0))
    cx, cy = w // 2, h // 2
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if 30 < dist < 46:
                px[y * w + x] = rgba(220, 220, 210)
            if dist < 24:
                px[y * w + x] = rgba(30, 0, 0)
            if 10 < dist < 18 and y < cy:
                px[y * w + x] = rgba(255, 40, 40)
            if dist < 10 and y > cy + 4:
                px[y * w + x] = rgba(180, 30, 30)
    write_png(BP / "pack_icon.png", px, w, h)
    write_png(RP / "pack_icon.png", px, w, h)


def armor_layer(name, base, trim):
    w, h = 64, 32
    px = solid(w, h, rgba(0, 0, 0, 0))
    fill_rect(px, w, 20, 8, 28, 16, base)
    fill_rect(px, w, 16, 8, 20, 16, trim)
    fill_rect(px, w, 28, 8, 32, 16, trim)
    fill_rect(px, w, 36, 8, 44, 16, base)
    fill_rect(px, w, 4, 20, 12, 28, base)
    fill_rect(px, w, 20, 20, 28, 28, base)
    write_png(RP / "textures" / "models" / "armor" / f"{name}.png", px, w, h)


def main():
    pack_icon()

    # Weapons
    item_gun("pistol", rgba(45, 45, 50), rgba(100, 100, 110), rgba(70, 55, 35))
    item_gun("shotgun", rgba(60, 40, 25), rgba(120, 90, 60), rgba(90, 60, 35))
    item_gun("assault_rifle", rgba(35, 55, 35), rgba(80, 90, 80), rgba(50, 40, 25))
    item_gun("sniper_rifle", rgba(30, 30, 40), rgba(70, 75, 90), rgba(45, 40, 30))
    item_gun("flamethrower", rgba(50, 50, 50), rgba(90, 90, 90), rgba(220, 90, 20))
    item_blade("silver_sword", rgba(60, 45, 30), rgba(210, 220, 240), rgba(160, 170, 190))
    item_blade("holy_mace", rgba(80, 60, 20), rgba(240, 210, 60), rgba(200, 160, 30))
    item_blade("cursed_blade", rgba(50, 20, 60), rgba(160, 60, 220), rgba(100, 30, 140))
    item_blade("nightmare_scythe", rgba(30, 10, 15), rgba(140, 20, 35), rgba(90, 15, 25))
    item_blade("combat_knife", rgba(50, 35, 25), rgba(190, 195, 205), rgba(140, 145, 155))
    item_texture("chainsaw", [rgba(40, 40, 40), rgba(180, 40, 40), rgba(240, 80, 50)])
    item_texture("crossbow_silver", [rgba(70, 50, 30), rgba(190, 200, 210), rgba(140, 100, 60)])
    item_texture("plague_cannon", [rgba(40, 50, 30), rgba(80, 120, 50), rgba(140, 200, 80)])

    # Ammo & utility
    item_texture("pistol_ammo", [rgba(140, 120, 40), rgba(200, 180, 60), rgba(255, 220, 80)])
    item_texture("shotgun_shells", [rgba(180, 60, 40), rgba(220, 100, 60), rgba(255, 200, 80)])
    item_texture("rifle_ammo", [rgba(100, 100, 100), rgba(160, 160, 160), rgba(220, 220, 220)])
    item_texture("flashlight", [rgba(30, 30, 30), rgba(200, 200, 180), rgba(255, 255, 200)])
    item_texture("medkit", [rgba(180, 40, 40), rgba(240, 240, 240), rgba(220, 60, 60)])
    item_texture("holy_water", [rgba(40, 60, 140), rgba(120, 160, 255), rgba(200, 230, 255)])
    item_texture("blood_stew", [rgba(60, 20, 20), rgba(120, 30, 30), rgba(200, 50, 50)])
    item_texture("survivor_rations", [rgba(80, 60, 40), rgba(140, 100, 60), rgba(200, 160, 100)])

    # Materials
    item_texture("blood_ingot", [rgba(80, 10, 10), rgba(160, 20, 20), rgba(255, 60, 60)])
    item_texture("silver_ingot", [rgba(120, 130, 150), rgba(190, 200, 220), rgba(245, 250, 255)])
    item_texture("cursed_ingot", [rgba(60, 20, 80), rgba(120, 40, 160), rgba(200, 100, 255)])
    item_texture("nightmare_shard", [rgba(40, 10, 20), rgba(100, 20, 40), rgba(220, 50, 80)])
    item_texture("plague_ingot", [rgba(30, 50, 20), rgba(60, 100, 40), rgba(120, 200, 80)])
    item_texture("horror_crystal", [rgba(60, 0, 80), rgba(140, 20, 180), rgba(240, 120, 255)])
    item_texture("exorcist_essence", [rgba(180, 150, 40), rgba(255, 220, 80), rgba(255, 255, 200)])

    # Torches
    item_texture("glow_torch", [rgba(80, 60, 20), rgba(255, 200, 60), rgba(255, 255, 180)])
    item_texture("cave_lantern", [rgba(40, 40, 50), rgba(100, 180, 255), rgba(200, 240, 255)])
    item_texture("soul_flame_torch", [rgba(30, 20, 50), rgba(80, 40, 180), rgba(180, 120, 255)])
    item_texture("verity_mic", [rgba(40, 40, 45), rgba(180, 180, 190), rgba(255, 80, 80)])

    # Armor icons
    for piece, colors in {
        "survivor_helmet": [rgba(50, 55, 45), rgba(90, 95, 80), rgba(140, 150, 120)],
        "survivor_chestplate": [rgba(45, 50, 40), rgba(85, 90, 75), rgba(130, 140, 110)],
        "survivor_leggings": [rgba(40, 45, 35), rgba(75, 80, 65), rgba(110, 120, 95)],
        "survivor_boots": [rgba(35, 30, 25), rgba(70, 60, 50), rgba(100, 90, 75)],
        "exorcist_helmet": [rgba(180, 160, 60), rgba(220, 200, 90), rgba(255, 240, 160)],
        "exorcist_chestplate": [rgba(160, 140, 50), rgba(200, 180, 80), rgba(255, 230, 140)],
        "exorcist_leggings": [rgba(140, 120, 40), rgba(180, 160, 70), rgba(240, 220, 120)],
        "exorcist_boots": [rgba(120, 100, 30), rgba(160, 140, 60), rgba(220, 200, 100)],
        "nightmare_helmet": [rgba(20, 0, 30), rgba(80, 0, 100), rgba(180, 40, 220)],
        "nightmare_chestplate": [rgba(15, 0, 25), rgba(70, 0, 90), rgba(160, 30, 200)],
        "nightmare_leggings": [rgba(10, 0, 20), rgba(60, 0, 80), rgba(140, 20, 180)],
        "nightmare_boots": [rgba(5, 0, 15), rgba(50, 0, 70), rgba(120, 10, 160)],
        "cursed_helmet": [rgba(50, 20, 70), rgba(100, 40, 130), rgba(170, 80, 210)],
        "cursed_chestplate": [rgba(45, 15, 65), rgba(90, 35, 120), rgba(150, 70, 200)],
        "cursed_leggings": [rgba(40, 10, 60), rgba(80, 30, 110), rgba(140, 60, 180)],
        "cursed_boots": [rgba(35, 5, 55), rgba(70, 25, 100), rgba(120, 50, 170)],
    }.items():
        item_texture(piece, colors)

    # Armor worn layers
    armor_layer("knws_survivor_1", rgba(70, 75, 60), rgba(110, 120, 90))
    armor_layer("knws_exorcist_1", rgba(220, 190, 70), rgba(255, 240, 150))
    armor_layer("knws_nightmare_1", rgba(60, 10, 80), rgba(150, 30, 190))
    armor_layer("knws_cursed_1", rgba(90, 35, 120), rgba(170, 70, 210))

    # Horror mobs — distinct humanoid skins
    def wendigo_extra(px, w):
        fill_rect(px, w, 6, 4, 10, 6, rgba(200, 200, 190))
        fill_rect(px, w, 22, 4, 26, 6, rgba(200, 200, 190))

    def crawler_extra(px, w):
        fill_rect(px, w, 20, 28, 28, 32, rgba(40, 60, 30))

    def hound_extra(px, w):
        fill_rect(px, w, 8, 8, 16, 12, rgba(120, 30, 30))

    mob_skin("knocker", rgba(50, 35, 25), rgba(120, 30, 20), rgba(255, 60, 40))
    mob_skin("shadow_stalker", rgba(12, 12, 18), rgba(35, 15, 50), rgba(220, 0, 255))
    mob_skin("wendigo", rgba(210, 200, 185), rgba(140, 120, 100), rgba(255, 40, 40), wendigo_extra)
    mob_skin("crawler", rgba(55, 75, 40), rgba(30, 45, 25), rgba(255, 220, 0), crawler_extra)
    mob_skin("blood_hound", rgba(90, 25, 25), rgba(150, 35, 35), rgba(255, 120, 120), hound_extra)
    mob_skin("phantom_doll", rgba(230, 210, 195), rgba(180, 50, 70), rgba(0, 0, 0))
    mob_skin("screamer", rgba(200, 200, 210), rgba(110, 110, 120), rgba(255, 0, 0))
    mob_skin("the_watcher", rgba(18, 18, 24), rgba(55, 55, 65), rgba(255, 255, 0))
    mob_skin("marsh_lurker", rgba(45, 65, 35), rgba(100, 45, 30), rgba(255, 80, 60))
    mob_skin("forest_shade", rgba(22, 38, 18), rgba(55, 90, 35), rgba(180, 255, 80))
    mob_skin("waste_howler", rgba(95, 85, 65), rgba(150, 105, 50), rgba(255, 100, 20))
    mob_skin("crystal_shardling", rgba(65, 105, 185), rgba(130, 185, 255), rgba(230, 250, 255))
    mob_skin("bone_stalker", rgba(210, 205, 190), rgba(145, 135, 115), rgba(255, 30, 30))
    mob_skin("swamp_wraith", rgba(32, 52, 42), rgba(65, 95, 75), rgba(120, 230, 180))
    mob_skin("glow_beetle", rgba(45, 35, 12), rgba(210, 170, 45), rgba(255, 240, 120))
    mob_skin("variety_deer", rgba(105, 75, 45), rgba(165, 115, 65), rgba(220, 170, 100))
    mob_skin("crystal_sprite", rgba(85, 145, 205), rgba(150, 210, 255), rgba(240, 250, 255))

    # Blocks
    block_ore("blood_ore", rgba(120, 95, 95), rgba(200, 35, 35), rgba(255, 80, 80))
    block_ore("silver_ore", rgba(115, 115, 125), rgba(210, 220, 240), rgba(245, 250, 255))
    block_ore("deepslate_blood_ore", rgba(55, 58, 62), rgba(160, 25, 25), rgba(220, 50, 50))
    block_ore("deepslate_silver_ore", rgba(50, 53, 58), rgba(175, 185, 205), rgba(230, 235, 245))
    block_ore("cursed_ore", rgba(110, 95, 120), rgba(150, 60, 200), rgba(220, 140, 255))
    block_ore("deepslate_cursed_ore", rgba(52, 54, 60), rgba(110, 40, 150), rgba(180, 100, 230))
    block_ore("nightmare_ore", rgba(100, 85, 90), rgba(130, 25, 45), rgba(220, 60, 90))
    block_ore("deepslate_nightmare_ore", rgba(48, 50, 55), rgba(95, 18, 35), rgba(180, 45, 70))
    block_ore("plague_ore", rgba(105, 115, 90), rgba(90, 150, 55), rgba(160, 230, 90))
    block_ore("deepslate_plague_ore", rgba(50, 55, 48), rgba(70, 120, 40), rgba(130, 200, 70))
    block_surface("horror_crystal_block", rgba(50, 0, 70), rgba(170, 50, 220), 14)
    block_surface("cursed_grass", rgba(35, 55, 22), rgba(70, 110, 40), 12)
    block_surface("blood_mushroom", rgba(70, 18, 18), rgba(170, 45, 45), 8)
    block_surface("wasteland_soil", rgba(75, 58, 38), rgba(120, 95, 55), 10)
    block_surface("crystal_grass", rgba(42, 62, 105), rgba(90, 150, 220), 10)

    print("Textures generated.")


if __name__ == "__main__":
    main()
