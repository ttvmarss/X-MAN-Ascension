/**
 * PROGRESSION SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Tracks the player's journey through the mod's 14-stage survival arc.
 *   Unlocks achievements, sends milestone messages, tracks kill counts,
 *   boss kills, crafted items, and ore discoveries.
 *
 * Progression Stages:
 *   1.  SURVIVOR      — Kill your first horror mob
 *   2.  MINER         — Mine first new ore (shadow/bloodstone/titanium/etc.)
 *   3.  ARMED         — Craft a basic weapon
 *   4.  EXPLORER      — Discover an abandoned structure
 *   5.  DRIVER        — Obtain refined fuel and a vehicle part
 *   6.  ARMORED       — Equip a full custom armor set
 *   7.  MINI_BOSS     — Defeat a mutant animal boss variant
 *   8.  GUNNER        — Craft and fire a gun
 *   9.  PILOT         — Craft and ride a vehicle
 *  10.  WANDERER      — Enter a custom biome
 *  11.  BOSS_SLAYER   — Defeat any major boss
 *  12.  LEGENDARY     — Craft any legendary weapon or armor piece
 *  13.  GAUNTLET      — Craft the Affinity Gauntlet
 *  14.  CHAMPION      — Defeat The Final Horror
 *
 * Storage:
 *   Stage stored as "xman:prog_stage" Dynamic Property on player.
 *   Kill/craft counters stored as "xman:prog_{key}" Dynamic Properties.
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js
 *
 * Testing checklist:
 *   [ ] Stage 1 triggers on first horror mob kill
 *   [ ] Stage advances sequentially, never skips
 *   [ ] Milestone message shows on stage advance
 *   [ ] Stage 14 triggers on Final Horror death
 *   [ ] Progress survives server restart (Dynamic Properties persist)
 *   [ ] Multiple players track independently
 */

import { system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendTitle, sendChat, scheduleRun,
    COLORS, sendActionbar
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// STAGE DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const STAGES = [
    {
        id: 1,
        key: "SURVIVOR",
        name: "First Blood",
        desc: "Kill your first horror mob",
        icon: "☠",
        color: COLORS.dark_red,
        reward: "xman:bloodstone_shard",
        rewardCount: 3,
    },
    {
        id: 2,
        key: "MINER",
        name: "Into the Dark",
        desc: "Mine a new ore",
        icon: "⛏",
        color: COLORS.gray,
        reward: "xman:titanium_ingot",
        rewardCount: 2,
    },
    {
        id: 3,
        key: "ARMED",
        name: "Armed and Ready",
        desc: "Craft a basic weapon",
        icon: "⚔",
        color: COLORS.gold,
        reward: "xman:pistol_ammo",
        rewardCount: 24,
    },
    {
        id: 4,
        key: "EXPLORER",
        name: "Into the Ruins",
        desc: "Discover an abandoned structure",
        icon: "🏚",
        color: COLORS.yellow,
        reward: "xman:rifle_ammo",
        rewardCount: 16,
    },
    {
        id: 5,
        key: "DRIVER",
        name: "Hit the Road",
        desc: "Obtain refined fuel",
        icon: "⛽",
        color: COLORS.green,
        reward: "xman:refined_fuel",
        rewardCount: 10,
    },
    {
        id: 6,
        key: "ARMORED",
        name: "Iron Shell",
        desc: "Wear a full custom armor set",
        icon: "🛡",
        color: COLORS.aqua,
        reward: "xman:repair_kit",
        rewardCount: 2,
    },
    {
        id: 7,
        key: "MINI_BOSS",
        name: "Alpha Predator",
        desc: "Defeat a mutant animal",
        icon: "🐺",
        color: COLORS.dark_gray,
        reward: "xman:mutant_crystal",
        rewardCount: 3,
    },
    {
        id: 8,
        key: "GUNNER",
        name: "Locked and Loaded",
        desc: "Fire a crafted gun",
        icon: "🔫",
        color: COLORS.red,
        reward: "xman:sniper_rounds",
        rewardCount: 8,
    },
    {
        id: 9,
        key: "PILOT",
        name: "Road Warrior",
        desc: "Ride a crafted vehicle",
        icon: "🚗",
        color: COLORS.gold,
        reward: "xman:gas_can",
        rewardCount: 3,
    },
    {
        id: 10,
        key: "WANDERER",
        name: "Cursed Lands",
        desc: "Enter a corrupted biome",
        icon: "🌑",
        color: COLORS.dark_purple,
        reward: "xman:void_essence",
        rewardCount: 5,
    },
    {
        id: 11,
        key: "BOSS_SLAYER",
        name: "Boss Slayer",
        desc: "Defeat a major boss",
        icon: "💀",
        color: COLORS.dark_red,
        reward: "xman:boss_trophy",
        rewardCount: 1,
    },
    {
        id: 12,
        key: "LEGENDARY",
        name: "Legendary",
        desc: "Craft a legendary item",
        icon: "✨",
        color: COLORS.gold,
        reward: "xman:void_ingot",
        rewardCount: 4,
    },
    {
        id: 13,
        key: "GAUNTLET",
        name: "Power Incarnate",
        desc: "Craft the Affinity Gauntlet",
        icon: "👊",
        color: COLORS.light_purple,
        reward: "xman:affinity_core",
        rewardCount: 1,
    },
    {
        id: 14,
        key: "CHAMPION",
        name: "CHAMPION OF THE WORLD",
        desc: "Defeat The Final Horror",
        icon: "🏆",
        color: COLORS.gold,
        reward: "xman:void_key",
        rewardCount: 1,
    },
];

// Horror mob type IDs for kill tracking
const HORROR_MOB_TYPES = new Set([
    "xman:mutant_wolf", "xman:mutant_bear", "xman:mutant_cow", "xman:mutant_pig",
    "xman:mutant_chicken", "xman:mutant_deer", "xman:shadow_stalker", "xman:cave_crawler",
    "xman:blood_spider", "xman:skinless_zombie", "xman:screaming_villager",
    "xman:forest_watcher", "xman:night_hunter", "xman:wendigo", "xman:mutant_giant",
    "xman:underground_parasite", "xman:flying_nightmare",
    "xman:boss_alpha_wolf", "xman:boss_blood_golem", "xman:boss_shadow_king",
    "xman:boss_parasite_queen", "xman:boss_void_beast", "xman:boss_infected_titan",
    "xman:boss_final_horror",
]);

const BOSS_TYPES = new Set([
    "xman:boss_alpha_wolf", "xman:boss_blood_golem", "xman:boss_shadow_king",
    "xman:boss_parasite_queen", "xman:boss_void_beast", "xman:boss_infected_titan",
    "xman:boss_final_horror",
]);

const ORE_TYPES = new Set([
    "xman:shadow_ore", "xman:bloodstone_ore", "xman:titanium_ore",
    "xman:mutant_crystal_ore", "xman:void_ore", "xman:infernal_ore",
    "xman:toxic_ore", "xman:ancient_steel_ore",
]);

// ──────────────────────────────────────────────────────────────────────────────
// PROGRESSION SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class ProgressionSystem {
    tick(player) {
        // No polling needed — all progression driven by events
    }

    getStage(player) {
        return getDynamicProp(player, "prog_stage", 0);
    }

    onKill(player, entityTypeId) {
        if (!HORROR_MOB_TYPES.has(entityTypeId)) return;

        // Stage 1: First horror kill
        if (this.getStage(player) < 1) {
            this._advanceStage(player, 1);
        }

        // Stage 7: Mutant animal kill
        const mutantTypes = ["xman:mutant_wolf","xman:mutant_bear","xman:mutant_cow",
                             "xman:mutant_pig","xman:mutant_chicken","xman:mutant_deer"];
        if (mutantTypes.includes(entityTypeId) && this.getStage(player) < 7) {
            if (this.getStage(player) >= 6) this._advanceStage(player, 7);
        }

        // Stage 11: Boss kill
        if (BOSS_TYPES.has(entityTypeId) && this.getStage(player) < 11) {
            if (this.getStage(player) >= 8) this._advanceStage(player, 11);
        }

        // Stage 14: Final horror kill
        if (entityTypeId === "xman:boss_final_horror" && this.getStage(player) < 14) {
            this._advanceStage(player, 14);
        }

        // Increment kill counter
        const kills = getDynamicProp(player, "prog_kills", 0) + 1;
        setDynamicProp(player, "prog_kills", kills);
    }

    onOreMined(player, blockTypeId) {
        if (!ORE_TYPES.has(blockTypeId)) return;
        if (this.getStage(player) < 2) {
            this._advanceStage(player, 2);
        }
    }

    onItemCrafted(player, typeId) {
        // Stage 3: basic weapon crafted
        const basicWeapons = [
            "xman:blood_sword", "xman:shadow_sword", "xman:mutant_bone_axe",
            "xman:cursed_scythe", "xman:heavy_hammer", "xman:spear",
            "xman:dagger", "xman:lightning_blade", "xman:fire_katana", "xman:void_greatsword",
        ];
        if (basicWeapons.includes(typeId) && this.getStage(player) < 3) {
            if (this.getStage(player) >= 2) this._advanceStage(player, 3);
        }

        // Stage 8: gun crafted
        const guns = [
            "xman:pistol","xman:revolver","xman:smg","xman:ak_rifle",
            "xman:assault_rifle","xman:shotgun","xman:sniper_rifle",
            "xman:heavy_rifle","xman:explosive_launcher",
        ];
        if (guns.includes(typeId) && this.getStage(player) < 8) {
            if (this.getStage(player) >= 7) this._advanceStage(player, 8);
        }

        // Stage 12: legendary item
        const legendaryItems = [
            "xman:void_greatsword", "xman:lightning_blade", "xman:fire_katana",
            "xman:infernal_helmet", "xman:void_chestplate",
        ];
        if (legendaryItems.includes(typeId) && this.getStage(player) < 12) {
            if (this.getStage(player) >= 11) this._advanceStage(player, 12);
        }

        // Stage 13: Affinity Gauntlet
        if (typeId === "xman:affinity_gauntlet" && this.getStage(player) < 13) {
            if (this.getStage(player) >= 12) this._advanceStage(player, 13);
        }
    }

    onStructureFound(player) {
        if (this.getStage(player) < 4 && this.getStage(player) >= 3) {
            this._advanceStage(player, 4);
        }
    }

    onFuelObtained(player) {
        if (this.getStage(player) < 5 && this.getStage(player) >= 4) {
            this._advanceStage(player, 5);
        }
    }

    onArmorEquipped(player) {
        if (this.getStage(player) < 6 && this.getStage(player) >= 5) {
            this._advanceStage(player, 6);
        }
    }

    onGunFired(player) {
        if (this.getStage(player) < 8 && this.getStage(player) >= 7) {
            this._advanceStage(player, 8);
        }
    }

    onVehicleRidden(player) {
        if (this.getStage(player) < 9 && this.getStage(player) >= 8) {
            this._advanceStage(player, 9);
        }
    }

    onBiomeEntered(player) {
        if (this.getStage(player) < 10 && this.getStage(player) >= 9) {
            this._advanceStage(player, 10);
        }
    }

    _advanceStage(player, stageId) {
        const current = this.getStage(player);
        if (current >= stageId) return;

        setDynamicProp(player, "prog_stage", stageId);

        const stage = STAGES[stageId - 1];
        if (!stage) return;

        sendTitle(player,
            `${stage.color}${stage.icon} ${stage.name}`,
            `${stage.desc}`,
            5, 60, 15
        );
        sendChat(`${stage.color}[X-Man] ${player.name} reached: ${stage.name}!`);

        // Give reward
        try {
            player.runCommandAsync(`give @s ${stage.reward} ${stage.rewardCount}`);
        } catch (e) {}

        player.runCommandAsync("playsound xman.progression.advance @s ~ ~ ~ 1 1 1");

        if (stageId === 14) {
            sendChat(`${COLORS.gold}${COLORS.bold}[X-Man] ${player.name} has defeated The Final Horror! THE WORLD IS SAVED!`);
        }
    }

    getProgressSummary(player) {
        const stage = this.getStage(player);
        const kills = getDynamicProp(player, "prog_kills", 0);
        const current = STAGES[Math.max(0, stage - 1)];
        const next = STAGES[stage] ?? null;
        return {
            stage,
            stageName: current?.name ?? "New Survivor",
            kills,
            nextGoal: next?.desc ?? "You are the Champion!",
        };
    }
}
