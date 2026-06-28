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
    ]
    for ident, name, icon, cat, stack in util:
        comps = {}
        if ident == "knws:medkit":
            comps = {"minecraft:food": {"nutrition": 0, "saturation_modifier": 0}, "minecraft:use_modifiers": {"use_duration": 1.5}}
        if ident in ("knws:blood_stew", "knws:survivor_rations"):
            comps = {"minecraft:food": {"nutrition": 8, "saturation_modifier": 0.6}}
        write_json(BP / "items" / f"{ident.split(':')[1]}.json", item_def(ident, name, icon, cat, stack, comps or None))

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


def generate_blocks():
    blocks = [
        ("knws:blood_ore", "knws_blood_ore"),
        ("knws:silver_ore", "knws_silver_ore"),
        ("knws:deepslate_blood_ore", "knws_deepslate_blood_ore"),
        ("knws:deepslate_silver_ore", "knws_deepslate_silver_ore"),
        ("knws:horror_crystal_block", "knws_horror_crystal_block"),
    ]
    for ident, tex in blocks:
        write_json(BP / "blocks" / f"{ident.split(':')[1]}.json", block_def(ident, tex))
        drop = "knws:blood_ingot" if "blood" in ident else "knws:silver_ingot" if "silver" in ident else "knws:horror_crystal"
        write_json(BP / "loot_tables/blocks" / f"{ident.split(':')[1]}.json", loot_table(ident.split(":")[1], [{"item": drop, "min": 1, "max": 3}]))


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
    ]
    for r in recipes:
        rid = r["minecraft:recipe_shaped"]["result"]["item"].split(":")[1]
        write_json(BP / "recipes" / f"{rid}.json", r)


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
    ]
    for name in items:
        item_textures["texture_data"][f"knws_{name}"] = {"textures": f"textures/items/{name}"}
    write_json(RP / "textures/item_texture.json", {"resource_pack_name": "knowws_horror", "texture_name": "atlas.items", "texture_data": item_textures["texture_data"]})

    terrain = {"resource_pack_name": "knowws_horror", "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4, "texture_data": {}}
    for name in ["blood_ore", "silver_ore", "deepslate_blood_ore", "deepslate_silver_ore", "horror_crystal_block"]:
        terrain["texture_data"][f"knws_{name}"] = {"textures": f"textures/blocks/{name}"}
    write_json(RP / "textures/terrain_texture.json", terrain)

    blocks_catalog = {"format_version": "1.21.50", "knws:blood_ore": {"sound": "stone"}, "knws:silver_ore": {"sound": "stone"}, "knws:deepslate_blood_ore": {"sound": "deepslate"}, "knws:deepslate_silver_ore": {"sound": "deepslate"}, "knws:horror_crystal_block": {"sound": "glass"}}
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


def main():
    generate_items()
    generate_entities()
    generate_blocks()
    generate_recipes()
    generate_rp_catalogs()
    generate_feature_rules()
    print("JSON definitions generated.")


if __name__ == "__main__":
    main()
