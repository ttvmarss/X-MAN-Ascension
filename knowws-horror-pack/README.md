# KNOWWS Horror Pack for Minecraft Bedrock Edition

The ultimate horror & variety mod pack for Minecraft Bedrock — inspired by popular horror addons and Variety Bedrock Edition. Adds custom horror mobs, guns, melee weapons, three armor sets, **off-hand torch glow**, **enhanced cave brightness**, **4 custom biomes**, crafting recipes, sanity/jumpscare systems, and more.

**Compatible with Minecraft Bedrock 1.21+** (Windows, Xbox, PlayStation, Switch, Mobile)

---

## Verity Companion System (v4.0) — Original Recreation

Inspired by the viral ThatMob Verity ARG and community Bedrock addons. **This is our own original implementation** with custom textures, dialogue, and scripts.

### How Verity Works

1. **Mystery Box** spawns near you when you join a world for the first time
2. **Break the box** to release Verity — a yellow sphere companion
3. **Talk to Verity** by typing `Verity <message>` or `Hey Verity <message>` in chat
4. **Survive** as his personality shifts over time...

### 5 Personality Phases

| Phase | Name | Behavior |
|-------|------|----------|
| 1 | **Nice** | Friendly helper — answers questions, gives mining tips |
| 2 | **Zesty** | Sassy & playful — teasing, possessive "bestie" energy |
| 3 | **Weird** | Uncanny — asks personal questions, knows too much |
| 4 | **Scary** | Horror — "Something is coming in 3 days", creepy grin |
| 5 | **Entity** | **TRANSFORMATION** — becomes a tall monster that hunts you |

### Phase Triggers
- **Time:** Phases advance every 2 Minecraft days (days 2, 4, 6, 9)
- **Anger:** Hitting Verity or abandoning him speeds up the shift
- **Dialogue:** Ask about the "village in the east" for lore hints

### Debug Commands
- `!spawnbox` — spawn mystery box
- `!verity reset` — reset Verity progress
- `!verity phase2` / `phase3` / `phase4` / `transform` — skip to a phase (testing)

---

## Download

**[Open Download Page](download.html)** — click to download `KNOWWS_Horror_Pack.mcaddon`, then drag it into Minecraft.

Or grab the file directly: `KNOWWS_Horror_Pack.mcaddon` in this folder.

---

## What's Included (v3.0)

### Off-Hand Torch Glow (Real Dynamic Lighting)
- Hold **any torch** in your off-hand — vanilla torch, soul torch, or custom glow torches
- Script places real `light_block` entities around you (not fake UI effects)
- **Glow Torch** — brightest off-hand light (craft: torch + glowstone dust)
- **Cave Lantern** — maximum cave visibility
- **Soul Flame Torch** — purple-tinted off-hand glow
- Flame & end-rod particles on off-hand torch

### Enhanced Cave Brightness
- Subtle night vision when deep underground in dark areas
- Ambient light blocks when light level is very low
- Lighter fog settings for better cave visibility
- Works automatically — no config needed

### Custom Biomes (4)
| Biome | Features |
|-------|----------|
| **Cursed Forest** | Dark green terrain, Forest Shade mobs, Glow Beetles |
| **Blood Marsh** | Red swampy ground, Marsh Lurker & Swamp Wraith |
| **Horror Wastes** | Barren wasteland, Waste Howler & Bone Stalker |
| **Crystal Caverns** | Blue crystal terrain, Crystal Shardling & Crystal Sprite |

### Horror Mobs (17 total)
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
| **Marsh Lurker** | Blood Marsh ambush predator |
| **Forest Shade** | Cursed Forest stalker |
| **Waste Howler** | Horror Wastes alpha hunter |
| **Crystal Shardling** | Crystal Caverns swarm mob |
| **Bone Stalker** | Skeletal horror of the wastes |
| **Swamp Wraith** | Blood Marsh ghost entity |

### Variety Passive Mobs
- **Glow Beetle** — emits light particles
- **Variety Deer** — peaceful forest animal
- **Crystal Sprite** — friendly crystal cavern mob

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
5. Enable **Holiday Creator Features**, **Beta APIs**, and **Custom Biomes** in world settings (required for scripts, blocks & biomes).
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
   - ✅ **Holiday Creator Features** (custom blocks)
   - ✅ **Beta APIs** (gun scripts & torch lighting)
   - ✅ **Custom Biomes** (new biomes in new chunks)
6. Re-enter your world. New ores and biomes generate in **new chunks**; horror mobs spawn at night.

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
| Glow Torch x4 | Torch + glowstone dust |
| Cave Lantern x2 | Glowstone + horror crystal + torch |
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
