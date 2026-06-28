#!/usr/bin/env python3
"""High-detail pixel art for KNOWWS Horror Pack — guns, armor, blocks, mobs."""
import math
import random
from pathlib import Path
from build_pack import write_png, rgba, RP, BP, pack_icon, block_ore, block_surface

RNG = random.Random(99)


def palette_map(palette):
    return {".": rgba(0, 0, 0, 0), **palette}


def sprite(rows, palette, scale=1):
    pal = palette_map(palette)
    h, w = len(rows), len(rows[0])
    px = []
    for row in rows:
        for ch in row:
            px.append(pal.get(ch, rgba(255, 0, 255)))
    if scale > 1:
        big = []
        for y in range(h):
            for _ in range(scale):
                for x in range(w):
                    c = px[y * w + x]
                    big.extend([c] * scale)
        px, w, h = big, w * scale, h * scale
    return px, w, h


def save_item(name, rows, palette):
    w = 16
    fixed = []
    for row in rows:
        row = row.ljust(w, ".")[:w]
        fixed.append(row)
    while len(fixed) < 16:
        fixed.append("." * w)
    px, w, h = sprite(fixed[:16], palette)
    write_png(RP / "textures" / "items" / f"{name}.png", px, w, h)


def save_entity(name, rows, palette, scale=4):
    px, w, h = sprite(rows, palette, scale=scale)
    write_png(RP / "textures" / "entity" / f"{name}.png", px, w, h)


# --- GUN SPRITES (16x16 detailed) ---
GUN_PAL = {
    "k": (35, 35, 42), "K": (55, 55, 65), "m": (110, 115, 125), "M": (150, 155, 165),
    "w": (180, 140, 50), "W": (220, 180, 70), "r": (160, 45, 35), "o": (255, 160, 40),
    "g": (45, 75, 45), "G": (70, 110, 70), "b": (50, 80, 140), "B": (90, 140, 210),
    "p": (120, 50, 160), "c": (200, 50, 50), "s": (210, 210, 220),
}

PISTOL = [
    "................",
    "................",
    "....kkkkkkkk....",
    "...kmmmmmmmwk...",
    "..kmmmmmmmmmwk..",
    "..kmmmmmmmmmmk..",
    ".kmmmmmmmmmmmwk.",
    ".kmmmmmoWwwwwww.",
    ".kKmmmmmmmmmmwk.",
    "..kmmmmmmmmmmk..",
    "..kKmmmmmmmmKk..",
    "...kkkkkkkkkkk..",
    "....kk....kk....",
    "................",
    "................",
    "................",
]

REVOLVER = [
    "................",
    ".....kkkkkk.....",
    "...kmmmmmmmwk...",
    "..kmmmmmmmmmmk..",
    ".kmmmmmoWwwwwwk.",
    ".kKmmmmmmmmmmKk.",
    ".kKmmmmrrrrrrKk.",
    "..kKmmmmmmmmKk..",
    "..kKmmmmmmmmKk..",
    "...kkkkkkkkkkk..",
    "....kk....kk....",
    "................",
    "................",
    "................",
    "................",
    "................",
]

SHOTGUN = [
    "................",
    "kkkkkkkkkkkkkkkk",
    "kmmmmmmmmmmmmmmk",
    "kmmmmmoWwwwwwwwk",
    "kKmmmmmmmmmmmmKk",
    "kKmmmmmmmmmmmmKk",
    "kKmmmmmmmmmmmmKk",
    ".kKmmmmmmmmmmKk.",
    "..kKmmmmmmmmKk..",
    "...kKmmmmmmKk...",
    "....kKmmmmKk....",
    ".....kKmmKk.....",
    "......kKkK......",
    ".......kk.......",
    "................",
    "................",
]

RIFLE = [
    "................",
    "..........kkkkkk",
    "........kkmmmmmm",
    "...kkkkkmmmmmmmm",
    "..kmmmmmmmmmmmGk",
    ".kmmmmmmoWwwwwwk",
    "kKmmmmmmmmmmmmmm",
    "kKmmmmmmmmmmmmKk",
    "kKmmmmmmmmmmmmKk",
    ".kKmmmmmmmmmmKk.",
    "..kKmmmmmmmmKk..",
    "...kKkkkkkkKk...",
    ".....kk..kk.....",
    "................",
    "................",
    "................",
]

SMG = [
    "................",
    "....kkkkkkkk....",
    "...kmmmmmmmmk...",
    "..kmmmmmmoWwk...",
    ".kKmmmmmmmmmmk..",
    ".kKmmmmmmmmmmKk.",
    ".kKmmmmmmmmmmKk.",
    ".kKmmmmmmmmmmKk.",
    "..kKmmmmmmmmKk..",
    "...kKkkkkkkKk...",
    "....kk....kk....",
    "................",
    "................",
    "................",
    "................",
    "................",
]

SNIPER = [
    "................",
    "..............kk",
    "............kkmm",
    "..........kkmmmm",
    "........kkmmmmmm",
    "......kkmmmmmmbb",
    "...kkkkmmmmmmbbk",
    "..kmmmmmmmmmbbbk",
    ".kmmmmmmoWwwwwwk",
    "kKmmmmmmmmmmmmmm",
    "kKmmmmmmmmmmmmKk",
    ".kKmmmmmmmmmmKk.",
    "..kKkkkkkkkkKk..",
    "...kk......kk...",
    "................",
    "................",
]

MINIGUN = [
    "................",
    "kkkkkkkkkkkkkkkk",
    "kcccccccccccccck",
    "kccccmmoWwwwwcck",
    "kKccccccccccccKk",
    "kKccccccccccccKk",
    "kKccccccccccccKk",
    "kKccccccccccccKk",
    ".kKccccccccccKk.",
    "..kKccccccccKk..",
    "...kKkkkkkkKk...",
    ".....kk..kk.....",
    "................",
    "................",
    "................",
    "................",
]

FLAME = [
    "................",
    "...kkkkkkkkkk...",
    "..kmmmmmmmmmmk..",
    ".kmmmmmoWwwwwwk.",
    "kKmmmmmmmmmmmmKk",
    "kKmmmmrrrrrrrrKk",
    "kKmmrrrrrrrrrrKk",
    "kKrrrrrrrrrrrrKk",
    ".kKrrrrrrrrrrKk.",
    "..kKkkkkkkkkKk..",
    "...kk......kk...",
    "................",
    "................",
    "................",
    "................",
    "................",
]

RPG = [
    "................",
    ".......kkkk.....",
    "......kmmmwk....",
    ".....kmmmmmmk...",
    "....kmmmmmmoWk..",
    "...kKmmmmmmmmk..",
    "..kKmmmmmmmmmmk.",
    ".kKmmmmmmmmmmmmk",
    "kKmmmmmmmmmmmmKk",
    "kKrrrrrrrrrrrrKk",
    "kKrrrrrrrrrrrrKk",
    ".kKrrrrrrrrrrKk.",
    "..kKkkkkkkkkKk..",
    "...kk......kk...",
    "................",
    "................",
]

# --- ARMOR / WEAPON SPRITES ---
ARMOR_PAL = {
    "d": (45, 50, 40), "D": (75, 82, 65), "L": (120, 130, 100), "H": (160, 170, 130),
    "e": (160, 130, 40), "E": (210, 180, 60), "Y": (255, 230, 120),
    "n": (25, 5, 35), "N": (70, 10, 90), "P": (150, 30, 190),
    "u": (50, 15, 70), "U": (100, 40, 130), "V": (170, 70, 210),
    "s": (200, 200, 210), "S": (240, 245, 255), "t": (60, 45, 30),
}

HELMET = [
    "....dddddddd....",
    "...dDDDDDDDDd...",
    "..dDDLLLLLLDDd..",
    ".dDDLLHHHHLLDDd.",
    ".dDDLLHHHHLLDDd.",
    "dDDLLLHHHHLLLDDd",
    "dDDLLLHHHHLLLDDd",
    "dDDLLLHHHHLLLDDd",
    ".dDDLLLLLLLLDDd.",
    "..dDDDDDDDDDDd..",
    "...dddddddddd...",
    "................",
    "................",
    "................",
    "................",
    "................",
]

SWORD = [
    ".......SS.......",
    "......SSS.......",
    ".....SSS........",
    "....SSS.........",
    "...SSS..........",
    "..SSS...........",
    ".SSS............",
    "SSS.............",
    ".SSS............",
    "..ttt...........",
    "..ttt...........",
    "...tt...........",
    "................",
    "................",
    "................",
    "................",
]

SCYTHE = [
    ".....SSSSS......",
    "....SSSSSSS.....",
    "...SSSSSSSSS....",
    "..SSSSSSSSSSS...",
    ".SSSSSSSSSSSSS..",
    "....SSSS........",
    ".....ttt........",
    ".....ttt........",
    ".....ttt........",
    ".....ttt........",
    ".....ttt........",
    ".....ttt........",
    "................",
    "................",
    "................",
    "................",
]

def draw_humanoid_mob(name, body, accent, eye, horns=False, claws=False):
    w, h = 64, 64
    px = [rgba(0, 0, 0, 0)] * (w * h)
    def fill(x1, y1, x2, y2, c):
        for y in range(y1, y2):
            for x in range(x1, x2):
                if 0 <= x < w and 0 <= y < h:
                    px[y * w + x] = c
    # Head UV (8,8)-(16,16) front face at 8,8
    fill(8, 8, 16, 16, body)
    fill(0, 8, 8, 16, accent)
    fill(16, 8, 24, 16, accent)
    fill(8, 0, 16, 8, accent)
    fill(10, 10, 12, 12, eye)
    fill(13, 10, 15, 12, eye)
    if horns:
        fill(9, 4, 11, 8, accent)
        fill(14, 4, 16, 8, accent)
    # Body
    fill(20, 20, 28, 32, body)
    fill(16, 20, 20, 32, accent)
    fill(28, 20, 32, 32, accent)
    fill(32, 20, 40, 32, body)
    # Arms
    fill(44, 20, 48, 32, accent)
    fill(40, 20, 44, 32, body)
    fill(48, 20, 52, 32, accent)
    fill(52, 20, 56, 32, body)
    # Legs
    fill(4, 20, 8, 32, accent)
    fill(8, 20, 12, 32, body)
    fill(20, 48, 24, 64, accent)
    fill(24, 48, 28, 64, body)
    if claws:
        fill(44, 28, 48, 32, eye)
        fill(52, 28, 56, 32, eye)
    write_png(RP / "textures" / "entity" / f"{name}.png", px, w, h)


def armor_layer(name, dark, mid, light):
    w, h = 64, 32
    px = [rgba(0, 0, 0, 0)] * (w * h)
    def fill(x1, y1, x2, y2, c):
        for y in range(y1, y2):
            for x in range(x1, x2):
                if 0 <= x < w and 0 <= y < h:
                    px[y * w + x] = c
    fill(20, 8, 28, 16, mid)
    fill(16, 8, 20, 16, dark)
    fill(28, 8, 32, 16, dark)
    fill(36, 8, 44, 16, mid)
    fill(4, 20, 12, 28, mid)
    fill(20, 20, 28, 28, mid)
    fill(22, 10, 26, 14, light)
    fill(38, 10, 42, 14, light)
    write_png(RP / "textures" / "models" / "armor" / f"{name}.png", px, w, h)


def main():
    pack_icon()

    save_item("pistol", PISTOL, GUN_PAL)
    save_item("revolver", REVOLVER, GUN_PAL)
    save_item("shotgun", SHOTGUN, GUN_PAL)
    save_item("assault_rifle", RIFLE, GUN_PAL)
    save_item("smg", SMG, GUN_PAL)
    save_item("sniper_rifle", SNIPER, GUN_PAL)
    save_item("minigun", MINIGUN, GUN_PAL)
    save_item("flamethrower", FLAME, GUN_PAL)
    save_item("rpg", RPG, GUN_PAL)
    save_item("plague_cannon", RPG, {**GUN_PAL, "g": (60, 120, 40), "G": (100, 180, 60)})

    save_item("silver_sword", SWORD, {"S": (210, 220, 240), "s": (160, 170, 190), "t": (60, 45, 30)})
    save_item("cursed_blade", SWORD, {"S": (160, 60, 220), "s": (100, 30, 140), "t": (50, 20, 70)})
    save_item("nightmare_scythe", SCYTHE, {"S": (180, 40, 50), "s": (120, 20, 30), "t": (30, 10, 15)})
    save_item("holy_mace", [
        "................",
        "....YYYYYY......",
        "...YEEEEEEY.....",
        "..YEEEEEEEEY....",
        "..YEEEEEEEEY....",
        "...YEEEEEEY.....",
        "....YYYYYY......",
        ".....ttt........",
        ".....ttt........",
        ".....ttt........",
        ".....ttt........",
        "................",
        "................",
        "................",
        "................",
        "................",
    ], ARMOR_PAL)
    save_item("combat_knife", [
        "................", "........SS......", ".......SSS......", "......SSS.......",
        ".....SSS........", "....SSS.........", "...SSS..........", "..ttt...........",
        "..ttt...........", "...tt...........", "................", "................",
        "................", "................", "................", "................",
    ], {"S": (190, 195, 205), "t": (50, 35, 25)})
    save_item("chainsaw", [
        "................", "..kkkkkkkkkk....", ".kcccccccccck.", ".kccmmoWwwcck.",
        "kKccccccccccKk", "kKccccccccccKk", "kKccccccccccKk", ".kKccccccccKk.",
        "..kKkkkkkkKk..", "...kk....kk....", "................", "................",
        "................", "................", "................", "................",
    ], GUN_PAL)
    save_item("crossbow_silver", [
        "................", "t.............t.", "tS...........S.t", "tSS.........SS.t",
        ".SSS.......SSS..", "..SSSS...SSSS...", "...SSSSSSSSS....", "....SSSSSSS.....",
        ".....ttttt......", "................", "................", "................",
        "................", "................", "................", "................",
    ], {"S": (200, 210, 225), "t": (70, 50, 30)})

    for piece, rows, pal in [
        ("survivor_helmet", HELMET, {"d": (45, 50, 40), "D": (75, 82, 65), "L": (100, 110, 85), "H": (140, 150, 115)}),
        ("exorcist_helmet", HELMET, {"d": (120, 100, 30), "D": (170, 140, 50), "L": (220, 190, 70), "H": (255, 240, 140)}),
        ("nightmare_helmet", HELMET, {"d": (15, 0, 25), "D": (60, 5, 80), "L": (120, 20, 160), "H": (200, 50, 230)}),
        ("cursed_helmet", HELMET, {"d": (45, 15, 65), "D": (90, 35, 120), "L": (140, 60, 180), "H": (200, 100, 240)}),
    ]:
        save_item(piece, rows, pal)

    ARMOR_ICON = [
        "................",
        ".DDDDDDDDDDDDDD.",
        ".DLLHHHHHHHHLLD.",
        ".DLLHHHHHHHHLLD.",
        ".DDDDDDDDDDDDDD.",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ]

    for name, d, m, l in [
        ("survivor_chestplate", (45, 50, 40), (75, 82, 65), (120, 130, 100)),
        ("survivor_leggings", (40, 45, 35), (70, 78, 60), (110, 120, 90)),
        ("survivor_boots", (35, 30, 25), (65, 58, 48), (95, 88, 72)),
        ("exorcist_chestplate", (140, 115, 35), (190, 160, 55), (240, 210, 100)),
        ("exorcist_leggings", (120, 100, 30), (170, 140, 50), (220, 190, 90)),
        ("exorcist_boots", (100, 85, 25), (150, 125, 45), (200, 170, 80)),
        ("nightmare_chestplate", (12, 0, 20), (55, 5, 75), (130, 25, 170)),
        ("nightmare_leggings", (8, 0, 15), (45, 0, 65), (110, 15, 150)),
        ("nightmare_boots", (5, 0, 10), (40, 0, 55), (95, 10, 130)),
        ("cursed_chestplate", (40, 12, 58), (85, 32, 115), (150, 65, 195)),
        ("cursed_leggings", (35, 8, 52), (75, 28, 105), (135, 55, 180)),
        ("cursed_boots", (30, 5, 48), (65, 22, 95), (120, 45, 165)),
    ]:
        save_item(name, ARMOR_ICON, {"d": d, "D": m, "L": tuple(min(255, c + 25) for c in m), "H": l, ".": (0, 0, 0, 0)})

    save_item("pistol_ammo", ["..." + "oW" * 5 + "..." + "." * 5] * 4 + [".oWoWoWoWoWoWoW.", ".oWoWoWoWoWoWoW."] + ["." * 16] * 10, GUN_PAL)
    save_item("shotgun_shells", [".oW...", ".oW...", ".rrr.."] * 5 + ["."] * 1, GUN_PAL)
    save_item("rifle_ammo", ["..oW.."] * 16, GUN_PAL)
    save_item("rocket", RPG, {**GUN_PAL, "r": (200, 50, 40), "c": (180, 40, 30)})

    save_item("glow_torch", [
        ".......ff.......", "......ffff......", "......ffff......", ".......ff.......",
        ".......tt.......", ".......tt.......", ".......tt.......", ".......tt.......",
        ".......tt.......", ".......tt.......", "................", "................",
        "................", "................", "................", "................",
    ], {"f": (255, 220, 80), "t": (80, 55, 25)})
    save_item("cave_lantern", [
        "................",
        "...bbbbbbbb.....",
        "..bLLLLLLLLb....",
        "..bLLffLLLLb....",
        "..bLLffLLLLb....",
        "..bLLLLLLLLb....",
        "...bbbbbbbb.....",
        ".....tttt.......",
        ".....tttt.......",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
        "................",
    ], {"b": (50, 50, 60), "L": (100, 180, 255), "f": (255, 255, 200), "t": (70, 50, 30)})
    save_item("soul_flame_torch", [
        ".......pp.......", "......pppp......", "......pppp......", ".......pp.......",
        ".......tt.......", ".......tt.......", ".......tt.......", ".......tt.......",
        "................", "................", "................", "................",
        "................", "................", "................", "................",
    ], {"p": (120, 60, 255), "t": (40, 25, 55)})

    for name, ingot in [
        ("blood_ingot", "c"), ("silver_ingot", "s"), ("cursed_ingot", "p"),
        ("nightmare_shard", "r"), ("plague_ingot", "g"), ("horror_crystal", "p"),
        ("exorcist_essence", "Y"), ("flashlight", "b"), ("medkit", "c"),
        ("holy_water", "b"), ("blood_stew", "c"), ("survivor_rations", "w"),
        ("verity_mic", "m"),
    ]:
        save_item(name, [
            "................", "..dddddddddddd..", ".dLLLLLLLLLLLLd.", ".dLLHHHHHHHHLLd.",
            ".dLLHHHHHHHHLLd.", ".dLLLLLLLLLLLLd.", "..dddddddddddd..", "................",
            "................", "................", "................", "................",
            "................", "................", "................", "................",
        ], {**GUN_PAL, **ARMOR_PAL, "d": (40, 40, 45), "L": (100, 100, 110), "H": (200, 200, 210)})

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

    # Mobs — detailed humanoid skins
    draw_humanoid_mob("knocker", rgba(50, 35, 25), rgba(120, 30, 20), rgba(255, 60, 40))
    draw_humanoid_mob("shadow_stalker", rgba(12, 12, 18), rgba(35, 15, 50), rgba(220, 0, 255))
    draw_humanoid_mob("wendigo", rgba(210, 200, 185), rgba(140, 120, 100), rgba(255, 40, 40), horns=True, claws=True)
    draw_humanoid_mob("crawler", rgba(55, 75, 40), rgba(30, 45, 25), rgba(255, 220, 0), claws=True)
    draw_humanoid_mob("blood_hound", rgba(90, 25, 25), rgba(150, 35, 35), rgba(255, 120, 120))
    draw_humanoid_mob("phantom_doll", rgba(230, 210, 195), rgba(180, 50, 70), rgba(0, 0, 0))
    draw_humanoid_mob("screamer", rgba(200, 200, 210), rgba(110, 110, 120), rgba(255, 0, 0))
    draw_humanoid_mob("the_watcher", rgba(18, 18, 24), rgba(55, 55, 65), rgba(255, 255, 0))
    draw_humanoid_mob("marsh_lurker", rgba(45, 65, 35), rgba(100, 45, 30), rgba(255, 80, 60))
    draw_humanoid_mob("forest_shade", rgba(22, 38, 18), rgba(55, 90, 35), rgba(180, 255, 80))
    draw_humanoid_mob("waste_howler", rgba(95, 85, 65), rgba(150, 105, 50), rgba(255, 100, 20))
    draw_humanoid_mob("crystal_shardling", rgba(65, 105, 185), rgba(130, 185, 255), rgba(230, 250, 255))
    draw_humanoid_mob("bone_stalker", rgba(210, 205, 190), rgba(145, 135, 115), rgba(255, 30, 30))
    draw_humanoid_mob("swamp_wraith", rgba(32, 52, 42), rgba(65, 95, 75), rgba(120, 230, 180))
    draw_humanoid_mob("glow_beetle", rgba(45, 35, 12), rgba(210, 170, 45), rgba(255, 240, 120))
    draw_humanoid_mob("variety_deer", rgba(105, 75, 45), rgba(165, 115, 65), rgba(220, 170, 100))
    draw_humanoid_mob("crystal_sprite", rgba(85, 145, 205), rgba(150, 210, 255), rgba(240, 250, 255))

    armor_layer("knws_survivor_1", (45, 50, 40), (75, 82, 65), (120, 130, 100))
    armor_layer("knws_exorcist_1", (140, 115, 35), (190, 160, 55), (255, 230, 120))
    armor_layer("knws_nightmare_1", (15, 0, 25), (60, 5, 80), (150, 30, 190))
    armor_layer("knws_cursed_1", (45, 15, 65), (90, 35, 120), (170, 70, 210))

    print("Detailed art generated.")


if __name__ == "__main__":
    main()
