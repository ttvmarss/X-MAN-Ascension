#!/usr/bin/env python3
"""
COMPLETE ADDON CONTENT GENERATOR
Generates all JSON files, textures, and recipes for X-Man Ascension Horror Survival
"""

import json
import os
from pathlib import Path
import random

BP = Path("horror_addon/behavior_pack")
RP = Path("horror_addon/resource_pack")

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def write_json(filepath, data):
    ensure_dir(Path(filepath).parent)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)

def gen_texture(filepath, color_rgb, size=16):
    """Placeholder — textures stored in RP/textures/{category}/{name}.png"""
    # Textures will be referenced in JSON but can be added manually
    # Creating the path ensures directory exists
    ensure_dir(Path(filepath).parent)

# ============================================================================
# BLOCKS
# ============================================================================

ORES = [
    ("shadow_ore", (50, 30, 80), 3, "shadow_ore_shard"),
    ("bloodstone_ore", (180, 20, 40), 3, "bloodstone_shard"),
    ("titanium_ore", (180, 180, 200), 4, "titanium_ingot"),
    ("mutant_crystal_ore", (100, 200, 100), 3, "mutant_crystal"),
    ("void_ore", (30, 0, 60), 4, "void_ingot"),
    ("infernal_ore", (200, 100, 0), 3, "infernal_ingot"),
    ("toxic_ore", (50, 255, 100), 3, "toxic_dust"),
    ("ancient_steel_ore", (100, 100, 120), 4, "ancient_steel_ingot"),
]

TERRAIN_BLOCKS = [
    ("blood_grass", (150, 50, 50)),
    ("dead_dirt", (80, 60, 40)),
    ("ash_sand", (150, 150, 150)),
    ("toxic_mud", (100, 150, 80)),
    ("corrupted_stone", (100, 80, 120)),
    ("haunted_wood", (60, 40, 30)),
    ("rusted_metal", (150, 100, 80)),
    ("cracked_concrete", (120, 120, 120)),
    ("oil_shale", (40, 40, 50)),
    ("mutant_nest_block", (150, 100, 150)),
    ("void_crystal_block", (80, 0, 160)),
]

def gen_ore_block(name, color, tool_level, drop_item):
    return {
        "format_version": "1.21.0",
        "minecraft:block": {
            "description": {"identifier": f"xman:{name}"},
            "components": {
                "minecraft:destructible_by_mining": {"seconds_to_destroy": 2 + tool_level},
                "minecraft:display_name": {"value": name.replace("_", " ").title()},
                "minecraft:geometry": "minecraft:geometry.full_block",
                "minecraft:material_instances": {
                    "*": {"texture": f"xman:{name}"}
                },
                "minecraft:loot": f"loot_tables/blocks/{name}",
            }
        }
    }

def gen_terrain_block(name, color):
    return {
        "format_version": "1.21.0",
        "minecraft:block": {
            "description": {"identifier": f"xman:{name}"},
            "components": {
                "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
                "minecraft:display_name": {"value": name.replace("_", " ").title()},
                "minecraft:material_instances": {"*": {"texture": f"xman:{name}"}},
            }
        }
    }

# Special blocks
SPECIAL_BLOCKS = {
    "fuel_refinery": {
        "format_version": "1.21.0",
        "minecraft:block": {
            "description": {"identifier": "xman:fuel_refinery"},
            "components": {
                "minecraft:display_name": {"value": "Fuel Refinery"},
                "minecraft:geometry": "minecraft:geometry.full_block",
                "minecraft:material_instances": {"*": {"texture": "xman:fuel_refinery"}},
                "minecraft:custom_components": ["xman:refinery"],
            }
        }
    },
    "fuel_pump": {
        "format_version": "1.21.0",
        "minecraft:block": {
            "description": {"identifier": "xman:fuel_pump"},
            "components": {
                "minecraft:display_name": {"value": "Fuel Pump"},
                "minecraft:geometry": "minecraft:geometry.full_block",
                "minecraft:material_instances": {"*": {"texture": "xman:fuel_pump"}},
            }
        }
    },
    "weapon_bench": {
        "format_version": "1.21.0",
        "minecraft:block": {
            "description": {"identifier": "xman:weapon_bench"},
            "components": {
                "minecraft:display_name": {"value": "Weapon Crafting Bench"},
                "minecraft:geometry": "minecraft:geometry.full_block",
                "minecraft:material_instances": {"*": {"texture": "xman:weapon_bench"}},
            }
        }
    },
}

# ============================================================================
# ITEMS
# ============================================================================

AMMO_TYPES = [
    ("pistol_ammo", 64, "small round"),
    ("rifle_ammo", 64, "rifle cartridge"),
    ("shotgun_shells", 16, "shotgun shell"),
    ("sniper_rounds", 16, "precision round"),
    ("heavy_ammo", 32, "heavy ordnance"),
]

MATERIALS = [
    ("shadow_ore_shard", 64),
    ("bloodstone_shard", 64),
    ("titanium_ingot", 64),
    ("mutant_crystal", 64),
    ("void_ingot", 64),
    ("infernal_ingot", 64),
    ("toxic_dust", 64),
    ("ancient_steel_ingot", 64),
    ("oil_resource", 64),
    ("refined_fuel", 64),
    ("gas_can", 16),
    ("gas_can_empty", 16),
    ("fuel_tank", 16),
    ("repair_kit", 16),
    ("boss_trophy", 64),
]

SPECIAL_ITEMS = {
    "affinity_core": 64,
    "affinity_gauntlet": 1,
    "void_key": 64,
    "shadow_crown": 16,
    "alpha_fang": 16,
    "bloodstone_ingot": 64,
    "blood_crystal": 16,
    "purified_toxin": 64,
    "queen_stinger": 16,
    "void_core": 16,
    "titan_core": 16,
    "void_essence": 64,
    "boss_final_trophy": 1,
    "power_stone": 1,
    "space_stone": 1,
    "reality_stone": 1,
    "mind_stone": 1,
    "time_stone": 1,
    "soul_stone": 1,
    "guide_book": 1,
}

def gen_item(name, max_stack=64):
    return {
        "format_version": "1.21.0",
        "minecraft:item": {
            "description": {"identifier": f"xman:{name}"},
            "components": {
                "minecraft:max_stack_size": max_stack,
                "minecraft:display_name": {"value": name.replace("_", " ").title()},
            }
        }
    }

def gen_weapon(name, damage, max_durability=500):
    return {
        "format_version": "1.21.0",
        "minecraft:item": {
            "description": {"identifier": f"xman:{name}"},
            "components": {
                "minecraft:max_stack_size": 1,
                "minecraft:display_name": {"value": name.replace("_", " ").title()},
                "minecraft:damage": damage,
                "minecraft:durability": {"max_durability": max_durability},
            }
        }
    }

def gen_armor(name, slot, armor_value=5):
    return {
        "format_version": "1.21.0",
        "minecraft:item": {
            "description": {"identifier": f"xman:{name}"},
            "components": {
                "minecraft:max_stack_size": 1,
                "minecraft:display_name": {"value": name.replace("_", " ").title()},
                "minecraft:armor": {"protection": armor_value},
                "minecraft:wearable": {"slot": slot},
                "minecraft:durability": {"max_durability": 400},
            }
        }
    }

# ============================================================================
# RECIPES
# ============================================================================

def gen_shapeless_recipe(output_id, output_count, ingredients):
    return {
        "format_version": "1.12",
        "type": "shapeless",
        "input": {"items": ingredients},
        "output": {
            "item_name": output_id,
            "count": output_count,
        }
    }

def gen_shaped_recipe(output_id, output_count, shape, key):
    return {
        "format_version": "1.12",
        "type": "shaped",
        "shape": shape,
        "key": key,
        "output": {
            "item_name": output_id,
            "count": output_count,
        }
    }

# ============================================================================
# LOOT TABLES
# ============================================================================

def gen_ore_loot(item_name, count):
    return {
        "pools": [
            {
                "rolls": 1,
                "entries": [
                    {
                        "type": "item",
                        "name": f"xman:{item_name}",
                        "weight": 1,
                        "functions": [{"function": "set_count", "count": count}],
                    }
                ]
            }
        ]
    }

def gen_entity_loot(drops):
    """drops: list of (item_id, weight, count)"""
    return {
        "pools": [
            {
                "rolls": 1,
                "entries": [
                    {
                        "type": "item",
                        "name": f"xman:{drop[0]}",
                        "weight": drop[1],
                        "functions": [{"function": "set_count", "count": drop[2]}],
                    }
                    for drop in drops
                ]
            }
        ]
    }

# ============================================================================
# MAIN GENERATION
# ============================================================================

def main():
    print("[*] Generating addon content...")

    # ========== BLOCKS ==========
    print("[*] Generating ore blocks...")
    for ore_name, color, tool_lvl, drop in ORES:
        block_data = gen_ore_block(ore_name, color, tool_lvl, drop)
        write_json(BP / f"blocks/{ore_name}.json", block_data)
        gen_texture(RP / f"textures/blocks/{ore_name}.png", color)

        loot = gen_ore_loot(drop, 1)
        write_json(BP / f"loot_tables/blocks/{ore_name}.json", loot)

    print("[*] Generating terrain blocks...")
    for terrain_name, color in TERRAIN_BLOCKS:
        block_data = gen_terrain_block(terrain_name, color)
        write_json(BP / f"blocks/{terrain_name}.json", block_data)
        gen_texture(RP / f"textures/blocks/{terrain_name}.png", color)

    print("[*] Generating special blocks...")
    for block_name, block_def in SPECIAL_BLOCKS.items():
        write_json(BP / f"blocks/{block_name}.json", block_def)
        # Random dark color for special blocks
        gen_texture(RP / f"textures/blocks/{block_name}.png", (random.randint(60, 120), random.randint(60, 120), random.randint(60, 120)))

    # ========== ITEMS ==========
    print("[*] Generating ammo items...")
    for ammo_name, max_stack, desc in AMMO_TYPES:
        item_data = gen_item(ammo_name, max_stack)
        write_json(BP / f"items/{ammo_name}.json", item_data)
        gen_texture(RP / f"textures/items/ammo/{ammo_name}.png", (200, 200, 0))

    print("[*] Generating material items...")
    for mat_name, max_stack in MATERIALS:
        item_data = gen_item(mat_name, max_stack)
        write_json(BP / f"items/materials/{mat_name}.json", item_data)
        gen_texture(RP / f"textures/items/materials/{mat_name}.png", (random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)))

    print("[*] Generating special items...")
    for item_name, max_stack in SPECIAL_ITEMS.items():
        item_data = gen_item(item_name, max_stack)
        write_json(BP / f"items/special/{item_name}.json", item_data)
        gen_texture(RP / f"textures/items/special/{item_name}.png", (random.randint(50, 220), random.randint(50, 220), random.randint(50, 220)))

    # ========== WEAPONS & MELEE ==========
    print("[*] Generating weapons...")
    WEAPONS = [
        ("blood_sword", 12, 500),
        ("shadow_sword", 14, 500),
        ("mutant_bone_axe", 16, 600),
        ("cursed_scythe", 18, 700),
        ("heavy_hammer", 20, 800),
        ("spear", 14, 550),
        ("dagger", 8, 400),
        ("lightning_blade", 22, 900),
        ("fire_katana", 20, 800),
        ("void_greatsword", 25, 1000),
    ]
    for name, dmg, dur in WEAPONS:
        w_data = gen_weapon(name, dmg, dur)
        write_json(BP / f"items/weapons/{name}.json", w_data)
        gen_texture(RP / f"textures/items/weapons/{name}.png", (random.randint(100, 200), random.randint(0, 100), random.randint(0, 100)))

    # ========== GUNS ==========
    print("[*] Generating guns...")
    GUNS = [
        ("pistol", 8), ("revolver", 15), ("smg", 5), ("ak_rifle", 12),
        ("assault_rifle", 10), ("shotgun", 6), ("sniper_rifle", 40),
        ("heavy_rifle", 25), ("explosive_launcher", 35),
    ]
    for name, dmg in GUNS:
        g_data = gen_weapon(name, dmg, 1000)
        write_json(BP / f"items/weapons/{name}.json", g_data)
        gen_texture(RP / f"textures/items/weapons/{name}.png", (50, 50, 50))

    # ========== ARMOR ==========
    print("[*] Generating armor...")
    ARMOR_SETS = ["shadow", "blood", "titanium", "mutant", "void", "infernal", "hunter", "heavy"]
    SLOTS_MAP = {"helmet": "Head", "chestplate": "Chest", "leggings": "Legs", "boots": "Feet"}
    ARMOR_COLORS = {
        "shadow": (80, 40, 120),
        "blood": (180, 0, 30),
        "titanium": (180, 180, 200),
        "mutant": (0, 200, 0),
        "void": (40, 0, 100),
        "infernal": (200, 80, 0),
        "hunter": (180, 140, 0),
        "heavy": (100, 100, 100),
    }
    for set_name in ARMOR_SETS:
        for piece, slot in SLOTS_MAP.items():
            item_name = f"{set_name}_{piece}"
            a_data = gen_armor(item_name, slot, 8)
            write_json(BP / f"items/armor/{item_name}.json", a_data)
            gen_texture(RP / f"textures/items/armor/{item_name}.png", ARMOR_COLORS[set_name])

    # ========== HERO ITEMS ==========
    print("[*] Generating hero items...")
    HEROES = [
        ("crimson_avenger_suit", "Chest"),
        ("shadow_knight_suit", "Chest"),
        ("thunder_hammer", "Mainhand"),
        ("speed_boots", "Feet"),
    ]
    for name, slot in HEROES:
        if "suit" in name or "boots" in name:
            h_data = gen_armor(name, slot, 10)
        else:
            h_data = gen_weapon(name, 30, 2000)
        write_json(BP / f"items/special/{name}.json", h_data)
        gen_texture(RP / f"textures/items/special/{name}.png", (255, 100, 0))

    # ========== RECIPES ==========
    print("[*] Generating recipes...")

    # Gun ammo recipes
    ensure_dir(BP / "recipes")
    for ammo, count in [("pistol_ammo", 12), ("rifle_ammo", 8), ("shotgun_shells", 6)]:
        recipe = gen_shapeless_recipe(f"xman:{ammo}", count, [
            {"item_name": "minecraft:iron_nugget", "count": 2},
            {"item_name": "minecraft:redstone", "count": 1},
        ])
        write_json(BP / f"recipes/{ammo}.json", recipe)

    # Refined fuel recipe
    fuel_recipe = gen_shapeless_recipe("xman:refined_fuel", 1, [
        {"item_name": "xman:oil_resource", "count": 4},
    ])
    write_json(BP / f"recipes/refined_fuel.json", fuel_recipe)

    # Weapon recipes (shapeless for simplicity)
    for weapon_name in ["blood_sword", "shadow_sword", "heavy_hammer"]:
        weapon_recipe = gen_shapeless_recipe(f"xman:{weapon_name}", 1, [
            {"item_name": "minecraft:iron_ingot", "count": 5},
            {"item_name": "xman:bloodstone_shard", "count": 3},
        ])
        write_json(BP / f"recipes/{weapon_name}.json", weapon_recipe)

    # ========== LOOT TABLES ==========
    print("[*] Generating loot tables...")
    ensure_dir(BP / "loot_tables/entities")

    # Mob loot
    mob_loots = {
        "mutant_wolf": [("mutant_crystal", 2, 2), ("bone", 1, 4)],
        "shadow_stalker": [("shadow_ore_shard", 1, 3), ("ender_pearl", 3, 2)],
        "blood_spider": [("bloodstone_shard", 1, 2), ("string", 1, 6)],
        "cave_crawler": [("toxic_dust", 1, 4)],
    }
    for mob, drops in mob_loots.items():
        loot = gen_entity_loot(drops)
        write_json(BP / f"loot_tables/entities/{mob}.json", loot)

    # Boss loot
    boss_loots = {
        "boss_alpha_wolf": [("boss_trophy", 1, 1), ("alpha_fang", 1, 1), ("mutant_crystal", 2, 3)],
        "boss_blood_golem": [("boss_trophy", 1, 1), ("bloodstone_ingot", 1, 2), ("blood_crystal", 2, 2)],
        "boss_shadow_king": [("boss_trophy", 1, 1), ("shadow_crown", 1, 1), ("void_essence", 2, 5)],
        "boss_final_horror": [("boss_final_trophy", 1, 1), ("affinity_core", 1, 1), ("void_key", 1, 1)],
    }
    for boss, drops in boss_loots.items():
        loot = gen_entity_loot(drops)
        write_json(BP / f"loot_tables/entities/{boss}.json", loot)

    print("[✓] Addon generation complete!")
    print(f"[✓] Created blocks, items, weapons, armor, recipes, and loot tables")
    print(f"[✓] Generated {len(ORES) + len(TERRAIN_BLOCKS) + len(SPECIAL_BLOCKS)} blocks")
    print(f"[✓] Generated {len(AMMO_TYPES) + len(MATERIALS) + len(SPECIAL_ITEMS) + len(WEAPONS) + len(GUNS) + (len(ARMOR_SETS)*4) + len(HEROES)} items")
    print(f"[✓] Ready for Bedrock Edition 1.21.x")

if __name__ == "__main__":
    main()
