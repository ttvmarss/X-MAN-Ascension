#!/usr/bin/env python3
"""Generate KNOWWS Horror Pack textures and pack icon."""
import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).parent
BP = ROOT / "KNOWWS_Horror_BP"
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


def solid(w, h, color):
    return [color] * (w * h)


def gradient(w, h, top, bottom):
    px = []
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        px.extend([rgba(r, g, b)] * w)
    return px


def item_texture(name: str, colors):
    w, h = 16, 16
    px = solid(w, h, colors[0])
    for y in range(2, h - 2):
        for x in range(2, w - 2):
            px[y * w + x] = colors[1]
    for y in range(4, h - 4):
        for x in range(4, w - 4):
            px[y * w + x] = colors[2] if len(colors) > 2 else colors[1]
    write_png(RP / "textures" / "items" / f"{name}.png", px, w, h)


def entity_texture(name: str, body, accent, eye=None):
    w, h = 64, 64
    px = solid(w, h, rgba(0, 0, 0, 0))
    for y in range(8, 56):
        for x in range(16, 48):
            px[y * w + x] = body
    for y in range(12, 20):
        for x in range(22, 30):
            px[y * w + x] = accent
        for x in range(34, 42):
            px[y * w + x] = accent
    if eye:
        px[14 * w + 24] = eye
        px[14 * w + 39] = eye
    write_png(RP / "textures" / "entity" / f"{name}.png", px, w, h)


def block_texture(name: str, base, speckle):
    w, h = 16, 16
    px = solid(w, h, base)
    for i in range(0, w * h, 5):
        px[i] = speckle
    write_png(RP / "textures" / "blocks" / f"{name}.png", px, w, h)


def main():
    # Pack icon
    write_png(BP / "pack_icon.png", gradient(128, 128, (120, 0, 0), (20, 0, 0)), 128, 128)
    write_png(RP / "pack_icon.png", gradient(128, 128, (120, 0, 0), (20, 0, 0)), 128, 128)

    # Weapons
    item_texture("pistol", [rgba(40, 40, 40), rgba(70, 70, 70), rgba(180, 140, 60)])
    item_texture("shotgun", [rgba(50, 35, 25), rgba(90, 60, 40), rgba(200, 180, 120)])
    item_texture("assault_rifle", [rgba(30, 50, 30), rgba(60, 90, 60), rgba(120, 120, 120)])
    item_texture("sniper_rifle", [rgba(25, 25, 35), rgba(55, 55, 75), rgba(160, 160, 180)])
    item_texture("silver_sword", [rgba(60, 60, 80), rgba(200, 210, 230), rgba(240, 245, 255)])
    item_texture("holy_mace", [rgba(80, 60, 20), rgba(220, 180, 40), rgba(255, 230, 100)])
    item_texture("chainsaw", [rgba(50, 50, 50), rgba(180, 40, 40), rgba(220, 60, 60)])
    item_texture("combat_knife", [rgba(30, 30, 35), rgba(180, 180, 190), rgba(90, 50, 30)])
    item_texture("crossbow_silver", [rgba(70, 50, 30), rgba(190, 200, 210), rgba(140, 100, 60)])
    item_texture("flamethrower", [rgba(50, 50, 50), rgba(200, 80, 20), rgba(255, 140, 40)])

    # Ammo & utility
    item_texture("pistol_ammo", [rgba(140, 120, 40), rgba(200, 180, 60), rgba(80, 60, 20)])
    item_texture("shotgun_shells", [rgba(180, 60, 40), rgba(220, 100, 60), rgba(240, 200, 80)])
    item_texture("rifle_ammo", [rgba(100, 100, 100), rgba(160, 160, 160), rgba(60, 60, 60)])
    item_texture("flashlight", [rgba(30, 30, 30), rgba(200, 200, 180), rgba(255, 255, 200)])
    item_texture("medkit", [rgba(180, 40, 40), rgba(240, 240, 240), rgba(200, 60, 60)])
    item_texture("holy_water", [rgba(40, 60, 140), rgba(120, 160, 255), rgba(200, 220, 255)])
    item_texture("blood_stew", [rgba(60, 20, 20), rgba(120, 30, 30), rgba(180, 50, 50)])
    item_texture("survivor_rations", [rgba(80, 60, 40), rgba(140, 100, 60), rgba(200, 160, 100)])

    # Ores & materials
    item_texture("blood_ingot", [rgba(80, 10, 10), rgba(160, 20, 20), rgba(220, 40, 40)])
    item_texture("silver_ingot", [rgba(120, 130, 150), rgba(190, 200, 220), rgba(240, 245, 255)])
    item_texture("horror_crystal", [rgba(60, 0, 80), rgba(140, 20, 180), rgba(220, 80, 255)])
    item_texture("exorcist_essence", [rgba(180, 150, 40), rgba(255, 220, 80), rgba(255, 255, 180)])

    # Torches (off-hand glow)
    item_texture("glow_torch", [rgba(80, 60, 20), rgba(255, 200, 60), rgba(255, 255, 150)])
    item_texture("cave_lantern", [rgba(40, 40, 50), rgba(100, 180, 255), rgba(200, 240, 255)])
    item_texture("soul_flame_torch", [rgba(30, 20, 50), rgba(80, 40, 180), rgba(160, 100, 255)])

    # Armor
    for piece, colors in {
        "survivor_helmet": [rgba(50, 55, 45), rgba(90, 95, 80), rgba(120, 125, 100)],
        "survivor_chestplate": [rgba(45, 50, 40), rgba(85, 90, 75), rgba(110, 115, 95)],
        "survivor_leggings": [rgba(40, 45, 35), rgba(75, 80, 65), rgba(100, 105, 85)],
        "survivor_boots": [rgba(35, 30, 25), rgba(70, 60, 50), rgba(95, 85, 70)],
        "exorcist_helmet": [rgba(180, 160, 60), rgba(220, 200, 90), rgba(255, 240, 140)],
        "exorcist_chestplate": [rgba(160, 140, 50), rgba(200, 180, 80), rgba(240, 220, 120)],
        "exorcist_leggings": [rgba(140, 120, 40), rgba(180, 160, 70), rgba(220, 200, 100)],
        "exorcist_boots": [rgba(120, 100, 30), rgba(160, 140, 60), rgba(200, 180, 90)],
        "nightmare_helmet": [rgba(20, 0, 30), rgba(80, 0, 100), rgba(160, 20, 200)],
        "nightmare_chestplate": [rgba(15, 0, 25), rgba(70, 0, 90), rgba(140, 10, 180)],
        "nightmare_leggings": [rgba(10, 0, 20), rgba(60, 0, 80), rgba(120, 0, 160)],
        "nightmare_boots": [rgba(5, 0, 15), rgba(50, 0, 70), rgba(100, 0, 140)],
    }.items():
        item_texture(piece, colors)

    # Horror mobs
    entity_texture("knocker", rgba(30, 25, 20), rgba(180, 40, 30), rgba(255, 0, 0))
    entity_texture("shadow_stalker", rgba(10, 10, 15), rgba(40, 20, 60), rgba(200, 0, 255))
    entity_texture("wendigo", rgba(200, 190, 170), rgba(120, 100, 80), rgba(255, 50, 50))
    entity_texture("crawler", rgba(60, 80, 50), rgba(30, 40, 25), rgba(255, 200, 0))
    entity_texture("blood_hound", rgba(80, 20, 20), rgba(140, 30, 30), rgba(255, 100, 100))
    entity_texture("phantom_doll", rgba(220, 200, 180), rgba(180, 40, 60), rgba(0, 0, 0))
    entity_texture("screamer", rgba(180, 180, 190), rgba(100, 100, 110), rgba(255, 0, 0))
    entity_texture("the_watcher", rgba(15, 15, 20), rgba(50, 50, 60), rgba(255, 255, 0))

    # Biome horror mobs
    entity_texture("marsh_lurker", rgba(40, 60, 30), rgba(100, 40, 30), rgba(200, 50, 50))
    entity_texture("forest_shade", rgba(20, 35, 15), rgba(50, 80, 30), rgba(150, 255, 50))
    entity_texture("waste_howler", rgba(90, 80, 60), rgba(140, 100, 50), rgba(255, 80, 0))
    entity_texture("crystal_shardling", rgba(60, 100, 180), rgba(120, 180, 255), rgba(200, 240, 255))
    entity_texture("bone_stalker", rgba(200, 195, 180), rgba(140, 130, 110), rgba(255, 0, 0))
    entity_texture("swamp_wraith", rgba(30, 50, 40), rgba(60, 90, 70), rgba(100, 200, 150))

    # Variety passive mobs
    entity_texture("glow_beetle", rgba(40, 30, 10), rgba(200, 160, 40), rgba(255, 230, 80))
    entity_texture("variety_deer", rgba(100, 70, 40), rgba(160, 110, 60), rgba(200, 150, 80))
    entity_texture("crystal_sprite", rgba(80, 140, 200), rgba(140, 200, 255), rgba(220, 240, 255))

    # Blocks
    block_texture("blood_ore", rgba(60, 45, 45), rgba(180, 30, 30))
    block_texture("silver_ore", rgba(70, 70, 80), rgba(200, 210, 230))
    block_texture("deepslate_blood_ore", rgba(40, 40, 45), rgba(140, 20, 20))
    block_texture("deepslate_silver_ore", rgba(35, 38, 42), rgba(170, 180, 200))
    block_texture("horror_crystal_block", rgba(40, 0, 60), rgba(180, 40, 220))
    block_texture("cursed_grass", rgba(30, 50, 20), rgba(60, 100, 30))
    block_texture("blood_mushroom", rgba(80, 20, 20), rgba(160, 40, 40))
    block_texture("wasteland_soil", rgba(70, 55, 35), rgba(110, 85, 50))
    block_texture("crystal_grass", rgba(40, 60, 100), rgba(80, 140, 200))
    block_texture("cursed_ore", rgba(50, 30, 60), rgba(140, 60, 180))
    block_texture("deepslate_cursed_ore", rgba(35, 35, 42), rgba(100, 40, 140))
    block_texture("nightmare_ore", rgba(40, 20, 30), rgba(120, 20, 40))
    block_texture("deepslate_nightmare_ore", rgba(30, 30, 35), rgba(90, 15, 30))
    block_texture("plague_ore", rgba(40, 55, 30), rgba(80, 140, 50))
    block_texture("deepslate_plague_ore", rgba(32, 38, 30), rgba(60, 110, 40))

    item_texture("cursed_ingot", [rgba(60, 20, 80), rgba(120, 40, 160), rgba(180, 80, 220)])
    item_texture("nightmare_shard", [rgba(40, 10, 20), rgba(100, 20, 40), rgba(180, 40, 60)])
    item_texture("plague_ingot", [rgba(30, 50, 20), rgba(60, 100, 40), rgba(100, 180, 70)])
    item_texture("cursed_blade", [rgba(50, 20, 70), rgba(140, 60, 180), rgba(200, 120, 255)])
    item_texture("nightmare_scythe", [rgba(30, 10, 15), rgba(100, 20, 30), rgba(180, 40, 50)])
    item_texture("plague_cannon", [rgba(40, 50, 30), rgba(80, 120, 50), rgba(140, 200, 80)])
    item_texture("verity_mic", [rgba(40, 40, 45), rgba(180, 180, 190), rgba(255, 80, 80)])
    for piece, colors in {
        "cursed_helmet": [rgba(50, 20, 70), rgba(100, 40, 130), rgba(150, 70, 190)],
        "cursed_chestplate": [rgba(45, 15, 65), rgba(90, 35, 120), rgba(140, 60, 180)],
        "cursed_leggings": [rgba(40, 10, 60), rgba(80, 30, 110), rgba(130, 50, 170)],
        "cursed_boots": [rgba(35, 5, 55), rgba(70, 25, 100), rgba(120, 40, 160)],
    }.items():
        item_texture(piece, colors)

    print("Textures generated.")


if __name__ == "__main__":
    main()
