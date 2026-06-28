#!/usr/bin/env python3
"""Generate all KNOWWS Horror Pack JSON definitions."""
import json
from pathlib import Path

ROOT = Path(__file__).parent
BP = ROOT / "KNOWWS_Horror_BP"
RP = ROOT / "KNOWWS_Horror_RP"


def write_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def item_def(identifier, name, icon, category="Equipment", max_stack=1, components=None):
    comps = {
        "minecraft:icon": icon,
        "minecraft:display_name": {"value": name},
        "minecraft:max_stack_size": max_stack,
    }
    if components:
        comps.update(components)
    return {
        "format_version": "1.21.50",
        "minecraft:item": {
            "description": {
                "identifier": identifier,
                "menu_category": {"category": category},
            },
            "components": comps,
        },
    }


def gun_item(identifier, name, icon, component):
    return item_def(identifier, name, icon, components={
        "minecraft:hand_equipped": True,
        "minecraft:use_modifiers": {"use_duration": 0.1},
        f"knws:{component}_fire": {},
    })


def melee_item(identifier, name, icon, component, durability=500):
    return item_def(identifier, name, icon, components={
        "minecraft:hand_equipped": True,
        "minecraft:durability": {"max_durability": durability},
        f"knws:{component}_melee": {},
    })


def armor_item(identifier, name, icon, slot, protection):
    return item_def(identifier, name, icon, components={
        "minecraft:wearable": {"slot": slot, "protection": protection},
        "minecraft:enchantable": {"slot": slot.replace("slot.armor.", ""), "value": 15},
    })


def passive_entity_def(identifier, health, speed):
    return {
        "format_version": "1.21.50",
        "minecraft:entity": {
            "description": {
                "identifier": identifier,
                "is_spawnable": True,
                "is_summonable": True,
                "is_experimental": False,
            },
            "components": {
                "minecraft:type_family": {"family": ["passive", "knws_passive", "mob"]},
                "minecraft:health": {"value": health, "max": health},
                "minecraft:movement": {"value": speed},
                "minecraft:navigation.walk": {"can_path_over_water": True},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:collision_box": {"width": 0.6, "height": 1.0},
                "minecraft:nameable": {},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.panic": {"priority": 1, "speed_multiplier": 1.5},
                "minecraft:behavior.random_stroll": {"priority": 5, "speed_multiplier": 0.8},
                "minecraft:behavior.look_at_player": {"priority": 6, "look_distance": 6},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True},
            },
        },
    }


def biome_spawn_rule(entity, weight, biome_tag, herd_min=1, herd_max=3):
    return {
        "format_version": "1.21.50",
        "minecraft:spawn_rules": {
            "description": {"identifier": entity},
            "conditions": [
                {
                    "minecraft:spawns_on_surface": {},
                    "minecraft:brightness_filter": {"min": 0, "max": 15, "adjust_for_weather": False},
                    "minecraft:weight": {"default": weight},
                    "minecraft:herd": {"min_size": herd_min, "max_size": herd_max},
                    "minecraft:biome_filter": {
                        "all_of": [
                            {"test": "has_biome_tag", "operator": "==", "value": biome_tag}
                        ]
                    },
                }
            ],
        },
    }


def biome_def(identifier, tag, top_mat, mid_mat, climate_temp, climate_downfall, climates, height_noise="default"):
    return {
        "format_version": "1.21.40",
        "minecraft:biome": {
            "description": {"identifier": identifier},
            "components": {
                "minecraft:climate": {
                    "temperature": climate_temp,
                    "downfall": climate_downfall,
                    "snow_accumulation": [0.0, 0.0],
                },
                "minecraft:overworld_height": {"noise_type": height_noise},
                "minecraft:surface_parameters": {
                    "sea_floor_depth": 7,
                    "sea_floor_material": "minecraft:gravel",
                    "foundation_material": "minecraft:stone",
                    "mid_material": mid_mat,
                    "top_material": top_mat,
                    "sea_material": "minecraft:water",
                },
                "minecraft:overworld_generation_rules": {
                    "hills_transformation": identifier,
                    "generate_for_climates": climates,
                },
                "minecraft:tags": {
                    "tags": ["overworld", "monster", tag, "no_legacy_worldgen"],
                },
            },
        },
    }


def entity_def(identifier, name, health, damage, speed, family_extra=None):
    families = ["monster", "knws_horror"]
    if family_extra:
        families.append(family_extra)
    return {
        "format_version": "1.21.50",
        "minecraft:entity": {
            "description": {
                "identifier": identifier,
                "is_spawnable": True,
                "is_summonable": True,
                "is_experimental": False,
            },
            "component_groups": {
                "knws:hostile": {
                    "minecraft:behavior.nearest_attackable_target": {
                        "priority": 2,
                        "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 32}],
                    },
                    "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True},
                    "minecraft:attack": {"damage": damage},
                },
            },
            "components": {
                "minecraft:type_family": {"family": families},
                "minecraft:health": {"value": health, "max": health},
                "minecraft:movement": {"value": speed},
                "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True},
                "minecraft:movement.basic": {},
                "minecraft:jump.static": {},
                "minecraft:can_climb": {},
                "minecraft:collision_box": {"width": 0.6, "height": 1.9},
                "minecraft:nameable": {},
                "minecraft:loot": {"table": f"loot_tables/entities/{identifier.split(':')[1]}.json"},
                "minecraft:behavior.float": {"priority": 0},
                "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
                "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
                "minecraft:behavior.random_look_around": {"priority": 8},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
                "minecraft:conditional_bandwidth_optimization": {},
            },
            "events": {
                "minecraft:entity_spawned": {"add": {"component_groups": ["knws:hostile"]}},
            },
        },
    }


def spawn_rule(entity, weight, herd_min=1, herd_max=2):
    return {
        "format_version": "1.21.50",
        "minecraft:spawn_rules": {
            "description": {"identifier": entity},
            "conditions": [
                {
                    "minecraft:spawns_on_surface": {},
                    "minecraft:brightness_filter": {"min": 0, "max": 7, "adjust_for_weather": True},
                    "minecraft:weight": {"default": weight},
                    "minecraft:herd": {"min_size": herd_min, "max_size": herd_max},
                    "minecraft:biome_filter": {
                        "test": "has_biome_tag", "operator": "==", "value": "overworld"
                    },
                }
            ],
        },
    }


def recipe(result_id, result_count, ingredients):
    keys = "ABCDEFGHI"
    pattern = []
    key_map = {}
    idx = 0
    for row in ingredients:
        pattern_row = ""
        for ing in row:
            if ing is None:
                pattern_row += " "
            else:
                k = keys[idx]
                pattern_row += k
                key_map[k] = {"item": ing}
                idx += 1
        pattern.append(pattern_row)
    return {
        "format_version": "1.21.50",
        "minecraft:recipe_shaped": {
            "description": {"identifier": f"knws:recipe_{result_id.split(':')[1]}"},
            "tags": ["crafting_table"],
            "pattern": pattern,
            "key": key_map,
            "result": {"item": result_id, "count": result_count},
        },
    }


def loot_table(entity_name, drops):
    pools = [{"rolls": 1, "entries": []}]
    for drop in drops:
        pools[0]["entries"].append({
            "type": "item",
            "name": drop["item"],
            "weight": drop.get("weight", 1),
            "functions": [{"function": "set_count", "count": {"min": drop.get("min", 1), "max": drop.get("max", 1)}}] if drop.get("max", 1) > 1 else [],
        })
    return {"pools": [p for p in pools if p["entries"]]}


def block_def(identifier, texture):
    return {
        "format_version": "1.21.50",
        "minecraft:block": {
            "description": {"identifier": identifier, "menu_category": {"category": "nature"}},
            "components": {
                "minecraft:destructible_by_mining": {"seconds_to_destroy": 3},
                "minecraft:destructible_by_explosion": {"explosion_resistance": 3},
                "minecraft:map_color": "#8B0000",
                "minecraft:loot": f"loot_tables/blocks/{identifier.split(':')[1]}.json",
                "minecraft:material_instances": {
                    "*": {"texture": texture, "render_method": "opaque"},
                },
            },
        },
    }


def client_entity(identifier, texture, geometry="geometry.humanoid"):
    short = identifier.split(":")[1]
    return {
        "format_version": "1.21.50",
        "minecraft:client_entity": {
            "description": {
                "identifier": identifier,
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{short}"},
                "geometry": {"default": geometry},
                "render_controllers": ["controller.render.default"],
                "spawn_egg": {
                    "base_color": "#8B0000",
                    "overlay_color": "#1A1A1A",
                },
            },
        },
    }


def generate_items():
    guns = [
        ("knws:pistol", "§7Pistol", "knws_pistol", "pistol"),
        ("knws:shotgun", "§6Shotgun", "knws_shotgun", "shotgun"),
        ("knws:assault_rifle", "§2Assault Rifle", "knws_assault_rifle", "assault_rifle"),
        ("knws:sniper_rifle", "§bSniper Rifle", "knws_sniper_rifle", "sniper_rifle"),
        ("knws:flamethrower", "§cFlamethrower", "knws_flamethrower", "flamethrower"),
    ]
    for ident, name, icon, comp in guns:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", gun_item(ident, name, icon, comp))

    melees = [
        ("knws:silver_sword", "§fSilver Sword", "knws_silver_sword", "silver_sword", 800),
        ("knws:holy_mace", "§eHoly Mace", "knws_holy_mace", "holy_mace", 600),
        ("knws:chainsaw", "§cChainsaw", "knws_chainsaw", "chainsaw", 400),
        ("knws:combat_knife", "§7Combat Knife", "knws_combat_knife", "combat_knife", 300),
        ("knws:crossbow_silver", "§fSilver Crossbow", "knws_crossbow_silver", "silver_sword", 500),
    ]
    for ident, name, icon, comp, dur in melees:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", melee_item(ident, name, icon, comp, dur))

    ammo = [
        ("knws:pistol_ammo", "§ePistol Ammo", "knws_pistol_ammo", 64),
        ("knws:shotgun_shells", "§6Shotgun Shells", "knws_shotgun_shells", 32),
        ("knws:rifle_ammo", "§7Rifle Ammo", "knws_rifle_ammo", 64),
    ]
    for ident, name, icon, stack in ammo:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", item_def(ident, name, icon, "Items", stack))

    util = [
        ("knws:flashlight", "§fFlashlight", "knws_flashlight", "Items", 1),
        ("knws:medkit", "§cMedkit", "knws_medkit", "Items", 16),
        ("knws:holy_water", "§bHoly Water", "knws_holy_water", "Items", 16),
        ("knws:blood_stew", "§4Blood Stew", "knws_blood_stew", "Nature", 16),
        ("knws:survivor_rations", "§eSurvivor Rations", "knws_survivor_rations", "Items", 16),
        ("knws:blood_ingot", "§4Blood Ingot", "knws_blood_ingot", "Items", 64),
        ("knws:silver_ingot", "§fSilver Ingot", "knws_silver_ingot", "Items", 64),
        ("knws:horror_crystal", "§5Horror Crystal", "knws_horror_crystal", "Items", 64),
        ("knws:exorcist_essence", "§eExorcist Essence", "knws_exorcist_essence", "Items", 16),
        ("knws:cursed_ingot", "§5Cursed Ingot", "knws_cursed_ingot", "Items", 64),
        ("knws:nightmare_shard", "§4Nightmare Shard", "knws_nightmare_shard", "Items", 64),
        ("knws:plague_ingot", "§2Plague Ingot", "knws_plague_ingot", "Items", 64),
    ]
    for ident, name, icon, cat, stack in util:
        comps = {}
        if ident == "knws:medkit":
            comps = {"minecraft:food": {"nutrition": 0, "saturation_modifier": 0}, "minecraft:use_modifiers": {"use_duration": 1.5}}
        if ident in ("knws:blood_stew", "knws:survivor_rations"):
            comps = {"minecraft:food": {"nutrition": 8, "saturation_modifier": 0.6}}
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", item_def(ident, name, icon, cat, stack, comps or None))

    # Verity microphone
    write_json(BP / "items" / "verity_mic.json", item_def("knws:verity_mic", "§e§lVerity Microphone", "knws_verity_mic", "Equipment", 1, {
        "minecraft:hand_equipped": True,
        "knws:verity_mic_use": {},
        "minecraft:use_modifiers": {"use_duration": 0.1},
    }))

    # Ore-crafted weapons
    for ident, name, icon, comp in [
        ("knws:cursed_blade", "§5Cursed Blade", "knws_cursed_blade", "cursed_blade"),
        ("knws:nightmare_scythe", "§4Nightmare Scythe", "knws_nightmare_scythe", "nightmare_scythe"),
    ]:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", melee_item(ident, name, icon, comp, 700))
    write_json(BP / "items" / "plague_cannon.json", gun_item("knws:plague_cannon", "§2Plague Cannon", "knws_plague_cannon", "plague_cannon"))

    # Cursed armor set
    for ident, name, icon, slot, prot in [
        ("knws:cursed_helmet", "§5Cursed Helmet", "knws_cursed_helmet", "slot.armor.head", 3),
        ("knws:cursed_chestplate", "§5Cursed Plate", "knws_cursed_chestplate", "slot.armor.chest", 8),
        ("knws:cursed_leggings", "§5Cursed Leggings", "knws_cursed_leggings", "slot.armor.legs", 6),
        ("knws:cursed_boots", "§5Cursed Boots", "knws_cursed_boots", "slot.armor.feet", 3),
    ]:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", armor_item(ident, name, icon, slot, prot))

    armors = [
        ("knws:survivor_helmet", "§aSurvivor Helmet", "knws_survivor_helmet", "slot.armor.head", 2),
        ("knws:survivor_chestplate", "§aSurvivor Vest", "knws_survivor_chestplate", "slot.armor.chest", 6),
        ("knws:survivor_leggings", "§aSurvivor Pants", "knws_survivor_leggings", "slot.armor.legs", 4),
        ("knws:survivor_boots", "§aSurvivor Boots", "knws_survivor_boots", "slot.armor.feet", 2),
        ("knws:exorcist_helmet", "§eExorcist Hood", "knws_exorcist_helmet", "slot.armor.head", 3),
        ("knws:exorcist_chestplate", "§eExorcist Robe", "knws_exorcist_chestplate", "slot.armor.chest", 8),
        ("knws:exorcist_leggings", "§eExorcist Leggings", "knws_exorcist_leggings", "slot.armor.legs", 6),
        ("knws:exorcist_boots", "§eExorcist Boots", "knws_exorcist_boots", "slot.armor.feet", 3),
        ("knws:nightmare_helmet", "§5Nightmare Mask", "knws_nightmare_helmet", "slot.armor.head", 4),
        ("knws:nightmare_chestplate", "§5Nightmare Plate", "knws_nightmare_chestplate", "slot.armor.chest", 10),
        ("knws:nightmare_leggings", "§5Nightmare Greaves", "knws_nightmare_leggings", "slot.armor.legs", 8),
        ("knws:nightmare_boots", "§5Nightmare Boots", "knws_nightmare_boots", "slot.armor.feet", 4),
    ]
    for ident, name, icon, slot, prot in armors:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", armor_item(ident, name, icon, slot, prot))

    torches = [
        ("knws:glow_torch", "§eGlow Torch", "knws_glow_torch", 64),
        ("knws:cave_lantern", "§bCave Lantern", "knws_cave_lantern", 64),
        ("knws:soul_flame_torch", "§5Soul Flame Torch", "knws_soul_flame_torch", 64),
    ]
    for ident, name, icon, stack in torches:
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", item_def(ident, name, icon, "Items", stack, {
            "minecraft:hand_equipped": True,
            "minecraft:allow_off_hand": True,
            "minecraft:max_stack_size": stack,
        }))


def generate_entities():
    mobs = [
        ("knws:knocker", 40, 8, 0.35, "knocker"),
        ("knws:shadow_stalker", 30, 10, 0.42, "shadow"),
        ("knws:wendigo", 60, 14, 0.38, "wendigo"),
        ("knws:crawler", 25, 6, 0.28, "crawler"),
        ("knws:blood_hound", 35, 9, 0.45, "hound"),
        ("knws:phantom_doll", 20, 5, 0.3, "doll"),
        ("knws:screamer", 28, 7, 0.4, "screamer"),
        ("knws:the_watcher", 50, 12, 0.25, "watcher"),
    ]
    for ident, hp, dmg, spd, fam in mobs:
        write_json(BP / "entities" / f"{ident.split(':')[1]}.json", entity_def(ident, ident, hp, dmg, spd, fam))
        write_json(BP / "loot_tables/entities" / f"{ident.split(':')[1]}.json", loot_table(ident.split(":")[1], [
            {"item": "knws:horror_crystal", "weight": 3, "min": 1, "max": 2},
            {"item": "knws:blood_ingot", "weight": 2, "min": 1, "max": 3},
            {"item": "knws:exorcist_essence", "weight": 1},
        ]))
        write_json(BP / "spawn_rules" / f"{ident.split(':')[1]}.json", spawn_rule(ident, 8 + mobs.index((ident, hp, dmg, spd, fam))))
        write_json(RP / "entity" / f"{ident.split(':')[1]}.entity.json", client_entity(ident, ident.split(":")[1]))

    # Biome-specific horror mobs
    biome_mobs = [
        ("knws:marsh_lurker", 32, 7, 0.32, "lurker", "blood_marsh"),
        ("knws:forest_shade", 28, 9, 0.4, "shade", "cursed_forest"),
        ("knws:waste_howler", 45, 11, 0.36, "howler", "horror_wastes"),
        ("knws:crystal_shardling", 22, 5, 0.3, "shardling", "crystal_caverns"),
        ("knws:bone_stalker", 38, 8, 0.38, "bone", "horror_wastes"),
        ("knws:swamp_wraith", 30, 6, 0.35, "wraith", "blood_marsh"),
    ]
    for ident, hp, dmg, spd, fam, biome in biome_mobs:
        write_json(BP / "entities" / f"{ident.split(':')[1]}.json", entity_def(ident, ident, hp, dmg, spd, fam))
        write_json(BP / "loot_tables/entities" / f"{ident.split(':')[1]}.json", loot_table(ident.split(":")[1], [
            {"item": "knws:horror_crystal", "weight": 2, "min": 1, "max": 2},
            {"item": "knws:blood_ingot", "weight": 2},
        ]))
        write_json(BP / "spawn_rules" / f"{ident.split(':')[1]}.json", biome_spawn_rule(ident, 10, biome))
        write_json(RP / "entity" / f"{ident.split(':')[1]}.entity.json", client_entity(ident, ident.split(":")[1]))

    # Variety passive mobs
    passive_mobs = [
        ("knws:glow_beetle", 8, 0.2),
        ("knws:variety_deer", 20, 0.25),
        ("knws:crystal_sprite", 12, 0.22),
    ]
    for ident, hp, spd in passive_mobs:
        write_json(BP / "entities" / f"{ident.split(':')[1]}.json", passive_entity_def(ident, hp, spd))
        write_json(BP / "spawn_rules" / f"{ident.split(':')[1]}.json", biome_spawn_rule(ident, 6, "cursed_forest", 2, 4))
        write_json(RP / "entity" / f"{ident.split(':')[1]}.entity.json", client_entity(ident, ident.split(":")[1]))


def generate_blocks():
    blocks = [
        ("knws:blood_ore", "knws_blood_ore"),
        ("knws:silver_ore", "knws_silver_ore"),
        ("knws:deepslate_blood_ore", "knws_deepslate_blood_ore"),
        ("knws:deepslate_silver_ore", "knws_deepslate_silver_ore"),
        ("knws:horror_crystal_block", "knws_horror_crystal_block"),
        ("knws:cursed_grass", "knws_cursed_grass"),
        ("knws:blood_mushroom", "knws_blood_mushroom"),
        ("knws:wasteland_soil", "knws_wasteland_soil"),
        ("knws:crystal_grass", "knws_crystal_grass"),
        ("knws:cursed_ore", "knws_cursed_ore"),
        ("knws:deepslate_cursed_ore", "knws_deepslate_cursed_ore"),
        ("knws:nightmare_ore", "knws_nightmare_ore"),
        ("knws:deepslate_nightmare_ore", "knws_deepslate_nightmare_ore"),
        ("knws:plague_ore", "knws_plague_ore"),
        ("knws:deepslate_plague_ore", "knws_deepslate_plague_ore"),
    ]
    drop_map = {
        "blood": "knws:blood_ingot", "silver": "knws:silver_ingot", "crystal_block": "knws:horror_crystal",
        "cursed": "knws:cursed_ingot", "nightmare": "knws:nightmare_shard", "plague": "knws:plague_ingot",
        "cursed_grass": "knws:cursed_grass", "wasteland": "knws:wasteland_soil", "crystal_grass": "knws:crystal_grass",
        "mushroom": "knws:blood_mushroom", "verity_box": "knws:verity_box",
    }
    for ident, tex in blocks:
        write_json(BP / "blocks" / f"{ident.split(':')[1]}.json", block_def(ident, tex))
        short = ident.split(":")[1]
        drop = "knws:horror_crystal"
        for key, val in drop_map.items():
            if key in short:
                drop = val
                break
        write_json(BP / "loot_tables/blocks" / f"{short}.json", loot_table(short, [{"item": drop, "min": 1, "max": 3}]))


def generate_recipes():
    recipes = [
        recipe("knws:pistol", 1, [["minecraft:iron_ingot", "knws:silver_ingot", None], [None, "minecraft:stick", None]]),
        recipe("knws:shotgun", 1, [["knws:silver_ingot", "minecraft:iron_ingot", "knws:silver_ingot"], [None, "minecraft:stick", "minecraft:oak_planks"]]),
        recipe("knws:assault_rifle", 1, [["knws:silver_ingot", "knws:blood_ingot", "knws:silver_ingot"], ["minecraft:iron_ingot", "minecraft:redstone", "minecraft:iron_ingot"], [None, "minecraft:stick", None]]),
        recipe("knws:sniper_rifle", 1, [["knws:silver_ingot", None, "knws:silver_ingot"], ["minecraft:iron_ingot", "minecraft:spyglass", "minecraft:iron_ingot"], [None, "minecraft:stick", None]]),
        recipe("knws:silver_sword", 1, [[None, "knws:silver_ingot", None], [None, "knws:silver_ingot", None], [None, "minecraft:stick", None]]),
        recipe("knws:holy_mace", 1, [["knws:exorcist_essence", "knws:silver_ingot", "knws:exorcist_essence"], [None, "minecraft:stick", None], [None, "minecraft:stick", None]]),
        recipe("knws:chainsaw", 1, [["knws:blood_ingot", "minecraft:iron_ingot", "knws:blood_ingot"], ["minecraft:redstone", "minecraft:iron_ingot", "minecraft:redstone"]]),
        recipe("knws:pistol_ammo", 8, [["knws:silver_ingot", None, None], ["minecraft:gunpowder", "minecraft:gunpowder", "minecraft:gunpowder"]]),
        recipe("knws:shotgun_shells", 4, [["knws:silver_ingot", "minecraft:gunpowder", None], [None, "minecraft:gunpowder", None]]),
        recipe("knws:rifle_ammo", 8, [["knws:silver_ingot", "knws:silver_ingot", None], ["minecraft:gunpowder", "minecraft:gunpowder", "minecraft:gunpowder"]]),
        recipe("knws:flashlight", 1, [[None, "minecraft:glowstone_dust", None], ["minecraft:iron_ingot", "minecraft:redstone", "minecraft:iron_ingot"], [None, "minecraft:iron_ingot", None]]),
        recipe("knws:medkit", 1, [["minecraft:paper", "minecraft:paper", "minecraft:paper"], ["knws:blood_ingot", "minecraft:golden_apple", "knws:blood_ingot"]]),
        recipe("knws:holy_water", 3, [[None, "knws:exorcist_essence", None], ["minecraft:glass_bottle", "minecraft:glass_bottle", "minecraft:glass_bottle"]]),
        recipe("knws:survivor_helmet", 1, [["knws:silver_ingot", "knws:silver_ingot", "knws:silver_ingot"], ["knws:silver_ingot", None, "knws:silver_ingot"]]),
        recipe("knws:survivor_chestplate", 1, [["knws:silver_ingot", None, "knws:silver_ingot"], ["knws:silver_ingot", "knws:silver_ingot", "knws:silver_ingot"], ["knws:silver_ingot", "knws:silver_ingot", "knws:silver_ingot"]]),
        recipe("knws:survivor_leggings", 1, [["knws:silver_ingot", "knws:silver_ingot", "knws:silver_ingot"], ["knws:silver_ingot", None, "knws:silver_ingot"], [None, None, None]]),
        recipe("knws:survivor_boots", 1, [[None, None, None], ["knws:silver_ingot", None, "knws:silver_ingot"], ["knws:silver_ingot", None, "knws:silver_ingot"]]),
        recipe("knws:exorcist_helmet", 1, [["knws:exorcist_essence", "knws:silver_ingot", "knws:exorcist_essence"], ["knws:silver_ingot", None, "knws:silver_ingot"]]),
        recipe("knws:exorcist_chestplate", 1, [["knws:exorcist_essence", None, "knws:exorcist_essence"], ["knws:silver_ingot", "knws:horror_crystal", "knws:silver_ingot"], ["knws:silver_ingot", "knws:silver_ingot", "knws:silver_ingot"]]),
        recipe("knws:exorcist_leggings", 1, [["knws:exorcist_essence", "knws:silver_ingot", "knws:exorcist_essence"], ["knws:silver_ingot", None, "knws:silver_ingot"], [None, None, None]]),
        recipe("knws:exorcist_boots", 1, [[None, None, None], ["knws:exorcist_essence", None, "knws:exorcist_essence"], ["knws:silver_ingot", None, "knws:silver_ingot"]]),
        recipe("knws:nightmare_helmet", 1, [["knws:horror_crystal", "knws:blood_ingot", "knws:horror_crystal"], ["knws:blood_ingot", None, "knws:blood_ingot"]]),
        recipe("knws:nightmare_chestplate", 1, [["knws:horror_crystal", None, "knws:horror_crystal"], ["knws:blood_ingot", "knws:horror_crystal", "knws:blood_ingot"], ["knws:horror_crystal", "knws:horror_crystal", "knws:horror_crystal"]]),
        recipe("knws:nightmare_leggings", 1, [["knws:horror_crystal", "knws:blood_ingot", "knws:horror_crystal"], ["knws:blood_ingot", None, "knws:blood_ingot"], [None, None, None]]),
        recipe("knws:nightmare_boots", 1, [[None, None, None], ["knws:blood_ingot", None, "knws:blood_ingot"], ["knws:horror_crystal", None, "knws:horror_crystal"]]),
        recipe("knws:horror_crystal_block", 1, [["knws:horror_crystal", "knws:horror_crystal", "knws:horror_crystal"], ["knws:horror_crystal", "knws:horror_crystal", "knws:horror_crystal"], ["knws:horror_crystal", "knws:horror_crystal", "knws:horror_crystal"]]),
        recipe("knws:glow_torch", 4, [[None, "minecraft:torch", None], ["minecraft:torch", "minecraft:glowstone_dust", "minecraft:torch"]]),
        recipe("knws:cave_lantern", 2, [[None, "minecraft:glowstone", None], ["minecraft:iron_ingot", "knws:horror_crystal", "minecraft:iron_ingot"], [None, "minecraft:torch", None]]),
        recipe("knws:soul_flame_torch", 4, [[None, "minecraft:soul_torch", None], ["minecraft:soul_torch", "knws:exorcist_essence", "minecraft:soul_torch"]]),
        recipe("knws:verity_mic", 1, [[None, "minecraft:redstone", None], ["minecraft:iron_ingot", "knws:horror_crystal", "minecraft:iron_ingot"], [None, "minecraft:stick", None]]),
        recipe("knws:cursed_blade", 1, [[None, "knws:cursed_ingot", None], [None, "knws:cursed_ingot", None], [None, "minecraft:stick", None]]),
        recipe("knws:nightmare_scythe", 1, [["knws:nightmare_shard", "knws:nightmare_shard", None], [None, "knws:nightmare_shard", None], [None, "minecraft:stick", None]]),
        recipe("knws:plague_cannon", 1, [["knws:plague_ingot", "knws:blood_ingot", "knws:plague_ingot"], ["minecraft:iron_ingot", "minecraft:redstone", "minecraft:iron_ingot"]]),
        recipe("knws:cursed_helmet", 1, [["knws:cursed_ingot", "knws:cursed_ingot", "knws:cursed_ingot"], ["knws:cursed_ingot", None, "knws:cursed_ingot"]]),
        recipe("knws:cursed_chestplate", 1, [["knws:cursed_ingot", None, "knws:cursed_ingot"], ["knws:cursed_ingot", "knws:cursed_ingot", "knws:cursed_ingot"], ["knws:cursed_ingot", "knws:cursed_ingot", "knws:cursed_ingot"]]),
        recipe("knws:cursed_leggings", 1, [["knws:cursed_ingot", "knws:cursed_ingot", "knws:cursed_ingot"], ["knws:cursed_ingot", None, "knws:cursed_ingot"], [None, None, None]]),
        recipe("knws:cursed_boots", 1, [[None, None, None], ["knws:cursed_ingot", None, "knws:cursed_ingot"], ["knws:cursed_ingot", None, "knws:cursed_ingot"]]),
    ]
    for r in recipes:
        rid = r["minecraft:recipe_shaped"]["result"]["item"].split(":")[1]
        write_json(BP / "recipes" / f"{rid}.json", r)


def generate_furnace_recipes():
    pairs = [
        ("knws:blood_ore", "knws:blood_ingot"),
        ("knws:deepslate_blood_ore", "knws:blood_ingot"),
        ("knws:silver_ore", "knws:silver_ingot"),
        ("knws:deepslate_silver_ore", "knws:silver_ingot"),
        ("knws:cursed_ore", "knws:cursed_ingot"),
        ("knws:deepslate_cursed_ore", "knws:cursed_ingot"),
        ("knws:nightmare_ore", "knws:nightmare_shard"),
        ("knws:deepslate_nightmare_ore", "knws:nightmare_shard"),
        ("knws:plague_ore", "knws:plague_ingot"),
        ("knws:deepslate_plague_ore", "knws:plague_ingot"),
    ]
    for inp, out in pairs:
        write_json(BP / "recipes" / f"smelt_{inp.split(':')[1]}.json", {
            "format_version": "1.21.50",
            "minecraft:recipe_furnace": {
                "description": {"identifier": f"knws:smelt_{inp.split(':')[1]}"},
                "tags": ["furnace", "blast_furnace"],
                "input": inp,
                "output": out,
            },
        })


def generate_rp_catalogs():
    item_textures = {"texture_data": {}}
    items = [
        "pistol", "shotgun", "assault_rifle", "sniper_rifle", "flamethrower",
        "silver_sword", "holy_mace", "chainsaw", "combat_knife", "crossbow_silver",
        "pistol_ammo", "shotgun_shells", "rifle_ammo", "flashlight", "medkit",
        "holy_water", "blood_stew", "survivor_rations", "blood_ingot", "silver_ingot",
        "horror_crystal", "exorcist_essence",
        "survivor_helmet", "survivor_chestplate", "survivor_leggings", "survivor_boots",
        "exorcist_helmet", "exorcist_chestplate", "exorcist_leggings", "exorcist_boots",
        "nightmare_helmet", "nightmare_chestplate", "nightmare_leggings", "nightmare_boots",
        "glow_torch", "cave_lantern", "soul_flame_torch", "verity_companion", "verity_mic",
        "cursed_ingot", "nightmare_shard", "plague_ingot",
        "cursed_blade", "nightmare_scythe", "plague_cannon",
        "cursed_helmet", "cursed_chestplate", "cursed_leggings", "cursed_boots",
    ]
    for name in items:
        item_textures["texture_data"][f"knws_{name}"] = {"textures": f"textures/items/{name}"}
    write_json(RP / "textures/item_texture.json", {"resource_pack_name": "knowws_horror", "texture_name": "atlas.items", "texture_data": item_textures["texture_data"]})

    terrain = {"resource_pack_name": "knowws_horror", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4, "texture_data": {}}
    ore_blocks = ["blood_ore", "silver_ore", "deepslate_blood_ore", "deepslate_silver_ore", "horror_crystal_block",
                 "cursed_grass", "blood_mushroom", "wasteland_soil", "crystal_grass", "verity_box",
                 "cursed_ore", "deepslate_cursed_ore", "nightmare_ore", "deepslate_nightmare_ore",
                 "plague_ore", "deepslate_plague_ore"]
    for name in ore_blocks:
        terrain["texture_data"][f"knws_{name}"] = {"textures": f"textures/blocks/{name}"}
    write_json(RP / "textures/terrain_texture.json", terrain)

    blocks_catalog = {"format_version": "1.21.50"}
    ore_blocks = ["blood_ore", "silver_ore", "deepslate_blood_ore", "deepslate_silver_ore", "horror_crystal_block",
                 "cursed_grass", "blood_mushroom", "wasteland_soil", "crystal_grass", "verity_box",
                 "cursed_ore", "deepslate_cursed_ore", "nightmare_ore", "deepslate_nightmare_ore",
                 "plague_ore", "deepslate_plague_ore"]
    for name in ore_blocks:
        sound = "grass" if "grass" in name or "mushroom" in name or "soil" in name else "glass" if "crystal" in name else "deepslate" if "deepslate" in name else "stone"
        blocks_catalog[f"knws:{name}"] = {"sound": sound}
    write_json(RP / "blocks.json", blocks_catalog)

    write_json(RP / "sounds/sound_definitions.json", {
        "format_version": "1.21.0",
        "sound_definitions": {
            "knws.horror.ambient": {"category": "ambient", "sounds": [{"name": "sounds/ambient/cave/cave1", "volume": 0.5}]},
            "knws.gun.pistol": {"category": "neutral", "sounds": [{"name": "sounds/random/bow", "volume": 1.0}]},
            "knws.jumpscare": {"category": "hostile", "sounds": [{"name": "sounds/mob/wither/spawn1", "volume": 0.8}]},
        },
    })


def generate_feature_rules():
    write_json(BP / "feature_rules/blood_ore_overworld.json", {
        "format_version": "1.21.50",
        "minecraft:feature_rules": {
            "description": {"identifier": "knws:blood_ore_overworld", "places_feature": "knws:blood_ore_feature"},
            "conditions": {"placement_pass": "underground_pass", "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
            "distribution": {"iterations": 8, "x": {"distribution": "uniform", "extent": [0, 16]}, "y": {"distribution": "uniform", "extent": [-64, 32]}, "z": {"distribution": "uniform", "extent": [0, 16]}},
        },
    })
    write_json(BP / "features/blood_ore_feature.json", {
        "format_version": "1.21.50",
        "minecraft:ore_feature": {
            "description": {"identifier": "knws:blood_ore_feature"},
            "count": 6,
            "replace_rules": [{"places_block": "knws:blood_ore", "may_replace": [{"name": "minecraft:stone"}, {"name": "minecraft:deepslate"}]}],
        },
    })
    write_json(BP / "feature_rules/silver_ore_overworld.json", {
        "format_version": "1.21.50",
        "minecraft:feature_rules": {
            "description": {"identifier": "knws:silver_ore_overworld", "places_feature": "knws:silver_ore_feature"},
            "conditions": {"placement_pass": "underground_pass", "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
            "distribution": {"iterations": 6, "x": {"distribution": "uniform", "extent": [0, 16]}, "y": {"distribution": "uniform", "extent": [-48, 48]}, "z": {"distribution": "uniform", "extent": [0, 16]}},
        },
    })
    write_json(BP / "features/silver_ore_feature.json", {
        "format_version": "1.21.50",
        "minecraft:ore_feature": {
            "description": {"identifier": "knws:silver_ore_feature"},
            "count": 5,
            "replace_rules": [{"places_block": "knws:silver_ore", "may_replace": [{"name": "minecraft:stone"}]}, {"places_block": "knws:deepslate_silver_ore", "may_replace": [{"name": "minecraft:deepslate"}]}],
        },
    })
    for ore_name, block, y_range, count in [
        ("cursed", "knws:cursed_ore", [-32, 16], 5),
        ("nightmare", "knws:nightmare_ore", [-64, 0], 4),
        ("plague", "knws:plague_ore", [0, 48], 5),
    ]:
        deepslate_block = f"knws:deepslate_{ore_name}_ore"
        write_json(BP / f"features/{ore_name}_ore_feature.json", {
            "format_version": "1.21.50",
            "minecraft:ore_feature": {
                "description": {"identifier": f"knws:{ore_name}_ore_feature"},
                "count": count,
                "replace_rules": [
                    {"places_block": block, "may_replace": [{"name": "minecraft:stone"}]},
                    {"places_block": deepslate_block, "may_replace": [{"name": "minecraft:deepslate"}]},
                ],
            },
        })
        write_json(BP / f"feature_rules/{ore_name}_ore_overworld.json", {
            "format_version": "1.21.50",
            "minecraft:feature_rules": {
                "description": {"identifier": f"knws:{ore_name}_ore_overworld", "places_feature": f"knws:{ore_name}_ore_feature"},
                "conditions": {"placement_pass": "underground_pass", "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
                "distribution": {"iterations": 5, "x": {"distribution": "uniform", "extent": [0, 16]}, "y": {"distribution": "uniform", "extent": y_range}, "z": {"distribution": "uniform", "extent": [0, 16]}},
            },
        })


def generate_biomes():
    biomes = [
        ("knws:cursed_forest", "cursed_forest", "knws:cursed_grass", "minecraft:dirt", 0.6, 0.8, [["medium", 2], ["cold", 1]]),
        ("knws:blood_marsh", "blood_marsh", "knws:blood_mushroom", "minecraft:mud", 0.9, 0.9, [["warm", 2], ["medium", 1]]),
        ("knws:horror_wastes", "horror_wastes", "knws:wasteland_soil", "minecraft:coarse_dirt", 1.2, 0.1, [["warm", 1], ["medium", 2]]),
        ("knws:crystal_caverns", "crystal_caverns", "knws:crystal_grass", "minecraft:stone", 0.3, 0.0, [["cold", 2], ["frozen", 1]], "lowlands"),
    ]
    for entry in biomes:
        ident, tag, top, mid, temp, down, climates = entry[:7]
        height = entry[7] if len(entry) > 7 else "default"
        short = ident.split(":")[1]
        write_json(BP / "biomes" / f"{short}.biome.json", biome_def(ident, tag, top, mid, temp, down, climates, height))

    # Client biomes for visuals
    client_biomes = {
        "knws:cursed_forest": {"water_surface_color": "#2d4a1f", "fog_color": "#1a2e12", "foliage_color": "#3d6628"},
        "knws:blood_marsh": {"water_surface_color": "#5c1010", "fog_color": "#3a0808", "foliage_color": "#6b2020"},
        "knws:horror_wastes": {"water_surface_color": "#4a3a2a", "fog_color": "#2a2018", "foliage_color": "#5a4a30"},
        "knws:crystal_caverns": {"water_surface_color": "#3a5a8a", "fog_color": "#1a2a4a", "foliage_color": "#4a8acc"},
    }
    for ident, colors in client_biomes.items():
        short = ident.split(":")[1]
        write_json(RP / "biomes" / f"{short}.biome.json", {
            "format_version": "1.21.40",
            "minecraft:client_biome": {
                "description": {"identifier": ident},
                "components": {
                    "minecraft:fog_appearance": {
                        "fog_identifier": f"knws:{short}_fog",
                    },
                    "minecraft:water_appearance": {
                        "surface_color": colors["water_surface_color"],
                    },
                    "minecraft:foliage_appearance": {
                        "color": colors["foliage_color"],
                    },
                    "minecraft:grass_appearance": {
                        "color": colors["foliage_color"],
                    },
                    "minecraft:sky_color": {
                        "sky_color": colors["fog_color"],
                    },
                },
            },
        })


def generate_fog():
    fogs = {
        "knws:cursed_forest_fog": {"r": 0.1, "g": 0.18, "b": 0.07, "density": 0.06},
        "knws:blood_marsh_fog": {"r": 0.23, "g": 0.03, "b": 0.03, "density": 0.08},
        "knws:horror_wastes_fog": {"r": 0.16, "g": 0.12, "b": 0.09, "density": 0.05},
        "knws:crystal_caverns_fog": {"r": 0.1, "g": 0.16, "b": 0.28, "density": 0.04},
        "knws:cave_brightness_fog": {"r": 0.18, "g": 0.16, "b": 0.14, "density": 0.02},
    }
    for fog_id, c in fogs.items():
        write_json(RP / "fogs" / f"{fog_id.split(':')[1]}.json", {
            "format_version": "1.21.40",
            "minecraft:fog_settings": {
                "description": {"identifier": fog_id},
                "distance": {
                    "air": {
                        "fog_start": 8.0,
                        "fog_end": 96.0,
                        "fog_color": f"#{int(c['r']*255):02x}{int(c['g']*255):02x}{int(c['b']*255):02x}",
                        "render_distance_type": "render",
                    },
                    "water": {
                        "fog_start": 0.0,
                        "fog_end": 48.0,
                        "fog_color": "#1a3040",
                        "render_distance_type": "render",
                    },
                },
            },
        })


def main():
    generate_items()
    generate_entities()
    generate_blocks()
    generate_recipes()
    generate_furnace_recipes()
    generate_rp_catalogs()
    generate_feature_rules()
    generate_biomes()
    generate_fog()
    print("JSON definitions generated.")


if __name__ == "__main__":
    main()
