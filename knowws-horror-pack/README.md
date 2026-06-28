# KNOWWS Horror Pack for Minecraft Bedrock Edition

The ultimate horror mod pack for Minecraft Bedrock — inspired by popular horror addons and variety packs. Adds custom horror mobs, guns, melee weapons, three armor sets, new ores, crafting recipes, sanity/jumpscare systems, and more.

**Compatible with Minecraft Bedrock 1.21+** (Windows, Xbox, PlayStation, Switch, Mobile)

---

## What's Included

### Horror Mobs (8)
| Mob | Description |
|-----|-------------|
| **The Knocker** | Folklore-inspired stalker that hunts at night |
| **Shadow Stalker** | Fast, shadowy predator |
| **Wendigo** | Powerful cannibalistic horror |
| **Crawler** | Low, creeping nightmare |
| **Blood Hound** | Aggressive hunting beast |
| **Phantom Doll** | Creepy doll entity |
| **Screamer** | Shrieking horror mob |
| **The Watcher** | Slow but deadly observer |

### Guns (5)
- Pistol, Shotgun, Assault Rifle, Sniper Rifle, Flamethrower
- All guns use ammo crafted from silver ingots and gunpowder

### Melee Weapons (5)
- Silver Sword, Holy Mace, Chainsaw, Combat Knife, Silver Crossbow
- Silver and holy weapons deal bonus fire damage to horror mobs

### Armor Sets (3)
- **Survivor** — Basic protection for early game
- **Exorcist** — Mid-tier holy armor
- **Nightmare** — End-game horror-forged armor

### Variety Content
- **Blood Ore** & **Silver Ore** (overworld + deepslate variants)
- **Horror Crystal** — Rare drop from horror mobs
- **Exorcist Essence** — Crafting material for holy gear
- Flashlight, Medkit, Holy Water, Blood Stew, Survivor Rations

### Horror Systems (Script API)
- Night-time ambient horror messages
- Sanity system when horror mobs are nearby
- Random jumpscares when overwhelmed
- Cave ambience at night

---

## Quick Install (New Worlds)

1. Download **`KNOWWS_Horror_Pack.mcaddon`** from this folder (run `./package.sh` to build it).
2. Double-click / open the `.mcaddon` file — Minecraft will import both packs.
3. Create a **new world** → scroll to **Behavior Packs** → activate **KNOWWS Horror Pack BP**.
4. The resource pack will auto-activate (linked dependency).
5. Enable **Holiday Creator Features** and **Beta APIs** in world settings (required for scripts & custom blocks).
6. Play!

---

## Add to Your EXISTING World

This is the method to attach the pack to a world you already have:

### On Windows / Mobile / Console

1. Import the `.mcaddon` file first (steps above).
2. Open Minecraft → **Settings** → **Storage** → find your world → **Manage**.
3. Go to **Behavior Packs** → find **KNOWWS Horror Pack BP** → click **+** to activate.
4. The resource pack should auto-apply. If not, also add **KNOWWS Horror Pack RP** under Resource Packs.
5. **Important:** Go to world settings and enable:
   - ✅ **Holiday Creator Features** (or "Custom Biomes" / Creator features)
   - ✅ **Beta APIs** (for gun scripts)
6. Re-enter your world. New ores will generate in **new chunks**; horror mobs spawn at night.

### Manual Method (World Folder)

If you have access to your world's folder:

**Windows 10/11 path:**
```
%localappdata%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\minecraftWorlds\<WORLD_ID>\
```

**Android path:**
```
/storage/emulated/0/games/com.mojang/minecraftWorlds/<WORLD_ID>/
```

Copy these folders into your world:

```
<world>/behavior_packs/KNOWWS_Horror_BP/    ← copy from this repo
<world>/resource_packs/KNOWWS_Horror_RP/   ← copy from this repo
```

Then edit `<world>/world_behavior_packs.json`:
```json
[
  {
    "pack_id": "648b8260-ef91-41c7-95e7-3f62c8fd8c33",
    "version": [2, 0, 0]
  }
]
```

And `<world>/world_resource_packs.json`:
```json
[
  {
    "pack_id": "99bed64d-60e4-4735-9c43-f194de00b54a",
    "version": [2, 0, 0]
  }
]
```

Template files are in `world_templates/`.

---

## Crafting Guide

| Item | Recipe |
|------|--------|
| Pistol | Iron + Silver ingot + stick |
| Shotgun | Silver + iron + planks |
| Assault Rifle | Silver + blood ingot + redstone |
| Sniper Rifle | Silver + spyglass + iron |
| Silver Sword | 2 silver ingots + stick |
| Holy Mace | Exorcist essence + silver + stick |
| Pistol Ammo x8 | Silver + gunpowder |
| Survivor Helmet | Silver ingots |
| Exorcist Chestplate | Silver + horror crystal + essence |
| Nightmare Helmet | Horror crystal + blood ingot |

Mine **blood ore** (red-tinted) and **silver ore** (light gray) underground to get started.

---

## Spawn Eggs

All horror mobs have spawn eggs in Creative mode. Search "knws" in the creative inventory.

---

## Building from Source

```bash
cd knowws-horror-pack
chmod +x package.sh
./package.sh
```

This generates textures, all JSON definitions, and packages `KNOWWS_Horror_Pack.mcaddon`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Guns don't fire | Enable **Beta APIs** in world settings |
| No custom blocks/ores | Enable **Holiday Creator Features** |
| Mobs don't spawn | They only spawn at night (light level 0–7) in overworld |
| Pack not showing | Re-import the `.mcaddon` file |
| Scripts not working | Make sure you're on Bedrock 1.21+ |

---

## License

Free to use and modify. Not affiliated with Mojang or Microsoft.

**Survive the night. Don't let them knock.**
