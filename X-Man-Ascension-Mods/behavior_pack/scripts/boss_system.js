/**
 * BOSS SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Manages all 7 bosses: phase transitions, special attacks, boss bar display
 *   (via action bar), announcements, summon mechanics, and special drops.
 *
 * Bosses and Phases:
 *   1. boss_alpha_wolf     — 3 phases (400/200/100 HP thresholds)
 *   2. boss_blood_golem    — 2 phases (800/400 HP thresholds)
 *   3. boss_shadow_king    — 3 phases (600/300/100 HP thresholds)
 *   4. boss_parasite_queen — 2 phases (1000/500 HP thresholds)
 *   5. boss_void_beast     — 3 phases (700/350/100 HP thresholds)
 *   6. boss_infected_titan — 2 phases (1200/600 HP thresholds)
 *   7. boss_final_horror   — 4 phases (2000/1200/600/200 HP thresholds)
 *
 * Architecture:
 *   - Bosses are registered when they spawn via entitySpawn event in main.js
 *   - BossSystem.tick() is called every 10 ticks to monitor boss HP and phases
 *   - Phase transitions trigger special abilities and broadcast announcements
 *   - Boss bar is simulated via setActionBar for nearby players
 *   - All boss-specific abilities are defined in BOSS_DEFINITIONS
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js
 *
 * Performance:
 *   Bosses tracked in a Map; only active bosses polled.
 *   Dead bosses auto-removed from tracking.
 *
 * Multiplayer:
 *   Boss bar shown to all players within 64 blocks.
 *   Phase announcements broadcast to all players in the dimension.
 *
 * Testing checklist:
 *   [ ] Boss registers on spawn
 *   [ ] Boss bar shows in action bar for nearby players
 *   [ ] Phase 2 triggers at correct HP threshold
 *   [ ] Phase 2 summons minions
 *   [ ] Phase 3 speed/damage modifier applied
 *   [ ] Death triggers loot and announcement
 *   [ ] Multiple bosses can be active simultaneously
 *   [ ] Boss bar disappears after death
 */

import { world, system } from "@minecraft/server";
import {
    getPlayersInRadius, sendTitle, vec3Dist, scheduleRun,
    spawnParticle, COLORS, sendActionbar, sendChat
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// BOSS DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const BOSS_DEFINITIONS = {
    "xman:boss_alpha_wolf": {
        name: "Mutant Alpha Wolf",
        color: COLORS.dark_gray,
        maxHP: 400,
        phases: [
            {
                threshold: 1.0,
                label: "The Hunt Begins",
                onEnter: (boss) => bossCommand(boss, "effect @s speed 200 1 true"),
            },
            {
                threshold: 0.5,
                label: "Bloodlust",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s speed 200 2 true");
                    bossCommand(boss, "effect @s strength 200 1 true");
                    _summonMinions(dim, boss.location, "xman:mutant_wolf", 3);
                },
            },
            {
                threshold: 0.25,
                label: "Final Frenzy",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s speed 200 3 true");
                    bossCommand(boss, "effect @s strength 200 2 true");
                    bossCommand(boss, "effect @s regeneration 200 0 true");
                    _summonMinions(dim, boss.location, "xman:mutant_wolf", 5);
                    dim.runCommandAsync(`particle minecraft:wolf_bitten ${boss.location.x} ${boss.location.y + 2} ${boss.location.z}`);
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:alpha_fang", "xman:mutant_crystal"],
        deathMessage: "§4The Mutant Alpha Wolf has been slain!",
        barColor: COLORS.dark_gray,
    },
    "xman:boss_blood_golem": {
        name: "Blood Golem",
        color: COLORS.dark_red,
        maxHP: 800,
        phases: [
            {
                threshold: 1.0,
                label: "Rising",
                onEnter: (boss) => bossCommand(boss, "effect @s resistance 200 1 true"),
            },
            {
                threshold: 0.5,
                label: "Blood Surge",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s resistance 200 2 true");
                    bossCommand(boss, "effect @s strength 200 2 true");
                    _bloodSurge(boss, dim);
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:bloodstone_ingot", "xman:blood_crystal"],
        deathMessage: "§4The Blood Golem has shattered!",
        barColor: COLORS.dark_red,
    },
    "xman:boss_shadow_king": {
        name: "Shadow King",
        color: COLORS.dark_purple,
        maxHP: 600,
        phases: [
            {
                threshold: 1.0,
                label: "Darkness Falls",
                onEnter: (boss) => bossCommand(boss, "effect @s invisibility 200 0 true"),
            },
            {
                threshold: 0.5,
                label: "Shadow Realm",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s invisibility 0 0");
                    bossCommand(boss, "effect @s strength 200 2 true");
                    _summonMinions(dim, boss.location, "xman:shadow_stalker", 4);
                    _applyBlindnessToNearby(boss, dim, 16);
                },
            },
            {
                threshold: 0.15,
                label: "Final Shadow",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s strength 200 4 true");
                    bossCommand(boss, "effect @s speed 200 3 true");
                    _shadowTeleport(boss);
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:shadow_crown", "xman:void_essence"],
        deathMessage: "§5The Shadow King has dissolved!",
        barColor: COLORS.dark_purple,
    },
    "xman:boss_parasite_queen": {
        name: "Cave Parasite Queen",
        color: COLORS.green,
        maxHP: 1000,
        phases: [
            {
                threshold: 1.0,
                label: "The Queen Awakens",
                onEnter: (boss) => bossCommand(boss, "effect @s speed 200 1 true"),
            },
            {
                threshold: 0.5,
                label: "Infestation",
                onEnter: (boss, dim) => {
                    _summonMinions(dim, boss.location, "xman:underground_parasite", 8);
                    bossCommand(boss, "effect @s regeneration 200 1 true");
                    _poisonNearby(boss, dim, 20);
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:queen_stinger", "xman:purified_toxin"],
        deathMessage: "§2The Parasite Queen is destroyed!",
        barColor: COLORS.green,
    },
    "xman:boss_void_beast": {
        name: "Void Beast",
        color: COLORS.dark_purple,
        maxHP: 700,
        phases: [
            {
                threshold: 1.0,
                label: "The Void Opens",
                onEnter: (boss) => bossCommand(boss, "effect @s resistance 200 0 true"),
            },
            {
                threshold: 0.5,
                label: "Void Rift",
                onEnter: (boss, dim) => {
                    _voidRift(boss, dim);
                    bossCommand(boss, "effect @s strength 200 2 true");
                },
            },
            {
                threshold: 0.2,
                label: "Annihilation",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s strength 200 4 true");
                    bossCommand(boss, "effect @s speed 200 2 true");
                    _summonMinions(dim, boss.location, "xman:flying_nightmare", 3);
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:void_core", "xman:void_ingot"],
        deathMessage: "§5The Void Beast has collapsed!",
        barColor: COLORS.dark_purple,
    },
    "xman:boss_infected_titan": {
        name: "Infected Titan",
        color: COLORS.green,
        maxHP: 1200,
        phases: [
            {
                threshold: 1.0,
                label: "The Titan Rises",
                onEnter: (boss) => {
                    bossCommand(boss, "effect @s resistance 200 2 true");
                    bossCommand(boss, "effect @s strength 200 1 true");
                },
            },
            {
                threshold: 0.5,
                label: "Full Infection",
                onEnter: (boss, dim) => {
                    _summonMinions(dim, boss.location, "xman:skinless_zombie", 6);
                    _poisonNearby(boss, dim, 24);
                    bossCommand(boss, "effect @s resistance 200 3 true");
                },
            },
        ],
        deathDrops: ["xman:boss_trophy", "xman:titan_core", "xman:ancient_steel_ingot"],
        deathMessage: "§2The Infected Titan has fallen!",
        barColor: COLORS.green,
    },
    "xman:boss_final_horror": {
        name: "The Final Horror",
        color: COLORS.dark_red,
        maxHP: 2000,
        phases: [
            {
                threshold: 1.0,
                label: "IT AWAKENS",
                onEnter: (boss, dim) => {
                    dim.runCommandAsync("playsound xman.boss.final_horror_roar @a ~ ~ ~ 2 1 2");
                    bossCommand(boss, "effect @s resistance 200 1 true");
                    bossCommand(boss, "effect @s strength 200 1 true");
                },
            },
            {
                threshold: 0.6,
                label: "THE HORROR GROWS",
                onEnter: (boss, dim) => {
                    _summonMinions(dim, boss.location, "xman:wendigo", 2);
                    _summonMinions(dim, boss.location, "xman:night_hunter", 4);
                    bossCommand(boss, "effect @s strength 200 2 true");
                    _applyBlindnessToNearby(boss, dim, 32);
                },
            },
            {
                threshold: 0.3,
                label: "DESPAIR",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s strength 200 3 true");
                    bossCommand(boss, "effect @s speed 200 2 true");
                    bossCommand(boss, "effect @s regeneration 200 1 true");
                    _poisonNearby(boss, dim, 40);
                    _voidRift(boss, dim);
                },
            },
            {
                threshold: 0.1,
                label: "THE END",
                onEnter: (boss, dim) => {
                    bossCommand(boss, "effect @s strength 200 5 true");
                    bossCommand(boss, "effect @s speed 200 4 true");
                    bossCommand(boss, "effect @s regeneration 200 2 true");
                    _summonMinions(dim, boss.location, "xman:boss_void_beast", 1);
                    dim.runCommandAsync("playsound xman.boss.final_horror_phase4 @a ~ ~ ~ 3 1 3");
                },
            },
        ],
        deathDrops: [
            "xman:boss_trophy", "xman:affinity_core", "xman:void_key",
            "xman:void_core", "xman:shadow_crown", "xman:boss_final_trophy",
        ],
        deathMessage: "§4§lTHE FINAL HORROR HAS BEEN DEFEATED! The world is saved... for now.",
        barColor: COLORS.dark_red,
    },
};

const BOSS_TYPE_IDS = new Set(Object.keys(BOSS_DEFINITIONS));

// ──────────────────────────────────────────────────────────────────────────────
// BOSS SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class BossSystem {
    constructor() {
        // entityId → { entity, def, currentPhase, isDead }
        this._activeBosses = new Map();
        this._tickCounter = 0;
    }

    isBoss(typeId) {
        return BOSS_TYPE_IDS.has(typeId);
    }

    registerBoss(entity) {
        if (this._activeBosses.has(entity.id)) return;

        const def = BOSS_DEFINITIONS[entity.typeId];
        if (!def) return;

        this._activeBosses.set(entity.id, {
            entity,
            def,
            currentPhase: 0,
            isDead: false,
        });

        sendChat(`${def.color}${COLORS.bold}[BOSS] ${def.name} has appeared!${COLORS.reset}`);
        try {
            entity.dimension.runCommandAsync(`playsound xman.boss.spawn @a ~ ~ ~ 2 1 2`);
        } catch (e) {}

        // Trigger phase 0 entry
        this._enterPhase(entity, def, 0);
    }

    tick() {
        this._tickCounter++;
        if (this._tickCounter % 10 !== 0) return;

        for (const [id, data] of this._activeBosses) {
            if (data.isDead) {
                this._activeBosses.delete(id);
                continue;
            }

            try {
                if (!data.entity.isValid()) {
                    this._activeBosses.delete(id);
                    continue;
                }
            } catch (e) {
                this._activeBosses.delete(id);
                continue;
            }

            this._updateBoss(data);
        }
    }

    onBossDeath(entity) {
        const data = this._activeBosses.get(entity.id);
        if (!data) return;
        data.isDead = true;

        sendChat(`${data.def.color}${COLORS.bold}${data.def.deathMessage}${COLORS.reset}`);

        // Drop special items near death location
        try {
            for (const dropId of data.def.deathDrops) {
                entity.dimension.runCommandAsync(
                    `give @a[r=32] ${dropId} 1`
                );
            }
        } catch (e) {}

        this._activeBosses.delete(entity.id);
    }

    _updateBoss(data) {
        const { entity, def } = data;

        let hp, maxHp;
        try {
            const healthComp = entity.getComponent("minecraft:health");
            if (!healthComp) return;
            hp = healthComp.currentValue;
            maxHp = healthComp.effectiveMax;
        } catch (e) { return; }

        const ratio = hp / maxHp;

        // Check phase transitions
        for (let i = def.phases.length - 1; i >= 0; i--) {
            if (i <= data.currentPhase) continue;
            if (ratio <= def.phases[i].threshold) {
                data.currentPhase = i;
                this._enterPhase(entity, def, i);
                break;
            }
        }

        // Update boss bar for nearby players
        this._renderBossBar(entity, def, hp, maxHp, data.currentPhase);
    }

    _enterPhase(entity, def, phaseIndex) {
        const phase = def.phases[phaseIndex];
        if (!phase) return;

        try {
            phase.onEnter(entity, entity.dimension);
        } catch (e) {}

        if (phaseIndex > 0) {
            sendChat(`${def.color}[${def.name}] ${phase.label}!${COLORS.reset}`);
            try {
                entity.dimension.runCommandAsync(`playsound xman.boss.phase_change @a ~ ~ ~ 2 1 2`);
            } catch (e) {}
        }
    }

    _renderBossBar(entity, def, hp, maxHp, phase) {
        const ratio = hp / maxHp;
        const filled = Math.round(ratio * 20);
        const empty = 20 - filled;
        const bar = `${def.barColor}${"█".repeat(filled)}${COLORS.dark_gray}${"░".repeat(empty)}`;
        const label = `${def.color}${COLORS.bold}${def.name}${COLORS.reset} ${bar} ${COLORS.white}${Math.floor(hp)}/${maxHp}`;

        const nearbyPlayers = getPlayersInRadius(entity.location, 64, entity.dimension);
        for (const player of nearbyPlayers) {
            try {
                sendActionbar(player, label);
            } catch (e) {}
        }
    }

    getActiveBossCount() {
        return this._activeBosses.size;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// BOSS ABILITY HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function bossCommand(boss, cmd) {
    try { boss.runCommandAsync(cmd); } catch (e) {}
}

function _summonMinions(dim, loc, typeId, count) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const x = loc.x + Math.cos(angle) * 4;
        const z = loc.z + Math.sin(angle) * 4;
        try {
            dim.spawnEntity(typeId, { x, y: loc.y, z });
        } catch (e) {}
    }
}

function _applyBlindnessToNearby(boss, dim, radius) {
    try {
        dim.runCommandAsync(`effect @a[r=${radius}] blindness 60 2 true`);
    } catch (e) {}
}

function _poisonNearby(boss, dim, radius) {
    try {
        dim.runCommandAsync(`effect @a[r=${radius}] poison 60 1 false`);
    } catch (e) {}
}

function _bloodSurge(boss, dim) {
    try {
        dim.runCommandAsync(`particle minecraft:redstone_ore_dust ${boss.location.x} ${boss.location.y + 2} ${boss.location.z}`);
        dim.runCommandAsync(`effect @a[r=12] wither 40 0 true`);
    } catch (e) {}
}

function _voidRift(boss, dim) {
    try {
        dim.runCommandAsync(`particle minecraft:enderman_teleport ${boss.location.x} ${boss.location.y + 2} ${boss.location.z}`);
        dim.runCommandAsync(`effect @a[r=16] levitation 60 1 true`);
        scheduleRun(() => {
            try { dim.runCommandAsync(`effect @a[r=16] levitation 0 0`); } catch (e) {}
        }, 65);
    } catch (e) {}
}

function _shadowTeleport(boss) {
    try {
        const nearby = boss.dimension.getEntities({
            location: boss.location,
            maxDistance: 32,
            excludeTypes: ["minecraft:item"],
        });
        const players = nearby.filter(e => e.typeId === "minecraft:player");
        if (players.length === 0) return;
        const target = players[Math.floor(Math.random() * players.length)];
        const angle = Math.random() * Math.PI * 2;
        const tp = {
            x: target.location.x + Math.cos(angle) * 3,
            y: target.location.y,
            z: target.location.z + Math.sin(angle) * 3,
        };
        boss.teleport(tp, { dimension: boss.dimension });
        boss.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${tp.x} ${tp.y + 1} ${tp.z}`);
    } catch (e) {}
}
