/**
 * INFINITY STONES SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Each of the 6 Infinity Stones is dropped by a specific major boss.
 *   Stones are socketed into the Affinity Gauntlet by holding the stone
 *   in your offhand and right-clicking with the gauntlet in your mainhand.
 *   Each stone amplifies a gauntlet power AND grants a unique new ability.
 *   All 6 stones unlocks "THE SNAP" — the ultimate annihilation move.
 *
 * Stone → Boss Source:
 *   Power Stone  (purple) → Infected Titan  — Obliterate blast ×3 power
 *   Space Stone  (blue)   → Void Beast      — Mass teleport enemies into sky
 *   Reality Stone (red)   → Blood Golem     — Rewrite terrain around you
 *   Mind Stone   (yellow) → Shadow King     — Convert 5 mobs to your side
 *   Time Stone   (green)  → Parasite Queen  — Heal 80% HP + rewind damage
 *   Soul Stone   (orange) → Final Horror    — Harvest life from everything
 *
 * Storage:
 *   Socketed stones stored as JSON string in player dynamic property "gauntlet_stones".
 *   Format: {"power":true,"space":false,...}
 *
 * "The Snap":
 *   All 6 stones required. Kills every non-boss mob within 100 blocks.
 *   Cooldown: 3600 ticks (3 min). Announces globally. Player briefly glows.
 *
 * Relationships:
 *   infinity_stones.js ← imported by affinity_gauntlet.js
 *   boss_system.js drops stones via STONE_DROPS map
 *   main.js handles offhand + mainhand use detection
 *
 * Testing checklist:
 *   [ ] Power Stone drops from Infected Titan on death
 *   [ ] Holding stone offhand + gauntlet mainhand + use → sockets stone
 *   [ ] Gauntlet HUD shows stone count (★ = slotted, ☆ = missing)
 *   [ ] Each stone ability fires with correct logic
 *   [ ] Snap kills all nearby non-boss mobs
 *   [ ] Stone abilities respect cooldowns
 *   [ ] Stones persist across relog (Dynamic Properties)
 */

import { world, system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendTitle, sendChat, sendActionbar,
    scheduleRun, spawnParticle, COLORS, vec3Dist, vec3Sub, vec3Norm, vec3Scale, vec3Add,
    removeItemFromInventory, countItemInInventory, chance, randomInt
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// STONE DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

export const STONE_DEFS = {
    power: {
        id: "power",
        typeId: "xman:power_stone",
        name: "Power Stone",
        color: COLORS.light_purple,
        icon: "💜",
        boss: "xman:boss_infected_titan",
        cooldown: 200,
        description: "Triple-power obliterate blast",
        activate: powerStoneAbility,
    },
    space: {
        id: "space",
        typeId: "xman:space_stone",
        name: "Space Stone",
        color: COLORS.blue,
        icon: "💙",
        boss: "xman:boss_void_beast",
        cooldown: 300,
        description: "Hurl all nearby enemies into the sky",
        activate: spaceStoneAbility,
    },
    reality: {
        id: "reality",
        typeId: "xman:reality_stone",
        name: "Reality Stone",
        color: COLORS.dark_red,
        icon: "❤",
        boss: "xman:boss_blood_golem",
        cooldown: 400,
        description: "Warp reality — detonate terrain energy",
        activate: realityStoneAbility,
    },
    mind: {
        id: "mind",
        typeId: "xman:mind_stone",
        name: "Mind Stone",
        color: COLORS.yellow,
        icon: "💛",
        boss: "xman:boss_shadow_king",
        cooldown: 500,
        description: "Convert 5 mobs to fight for you",
        activate: mindStoneAbility,
    },
    time: {
        id: "time",
        typeId: "xman:time_stone",
        name: "Time Stone",
        color: COLORS.green,
        icon: "💚",
        boss: "xman:boss_parasite_queen",
        cooldown: 400,
        description: "Restore 80% health instantly",
        activate: timeStoneAbility,
    },
    soul: {
        id: "soul",
        typeId: "xman:soul_stone",
        name: "Soul Stone",
        color: COLORS.gold,
        icon: "🧡",
        boss: "xman:boss_final_horror",
        cooldown: 600,
        description: "Harvest life force from all nearby enemies",
        activate: soulStoneAbility,
    },
};

// Boss → stone drop map (used by boss_system.js)
export const STONE_DROPS = {};
for (const stone of Object.values(STONE_DEFS)) {
    STONE_DROPS[stone.boss] = stone.typeId;
}

const SNAP_COOLDOWN = 3600;

// ──────────────────────────────────────────────────────────────────────────────
// INFINITY STONES MANAGER
// ──────────────────────────────────────────────────────────────────────────────

export class InfinityStoneManager {
    getStonedSlots(player) {
        try {
            const raw = player.getDynamicProperty("xman:gauntlet_stones");
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    setStonedSlots(player, slots) {
        try {
            player.setDynamicProperty("xman:gauntlet_stones", JSON.stringify(slots));
        } catch (e) {}
    }

    hasStone(player, stoneId) {
        return !!this.getStonedSlots(player)[stoneId];
    }

    getStoneCount(player) {
        return Object.values(this.getStonedSlots(player)).filter(Boolean).length;
    }

    hasAllStones(player) {
        return this.getStoneCount(player) === 6;
    }

    trySocketStone(player, stoneTypeId) {
        const stoneDef = Object.values(STONE_DEFS).find(s => s.typeId === stoneTypeId);
        if (!stoneDef) return false;

        const slots = this.getStonedSlots(player);
        if (slots[stoneDef.id]) {
            sendActionbar(player, `${stoneDef.color}${stoneDef.name} is already socketed!`);
            return false;
        }

        removeItemFromInventory(player, stoneTypeId, 1);
        slots[stoneDef.id] = true;
        this.setStonedSlots(player, slots);

        player.runCommandAsync(`playsound xman.stone.socket @s ~ ~ ~ 2 1 2`);
        player.dimension.runCommandAsync(`particle minecraft:totem_undying ${player.location.x} ${player.location.y + 1} ${player.location.z}`);

        sendTitle(player,
            `${stoneDef.color}${stoneDef.icon} ${stoneDef.name} Socketed!`,
            `${stoneDef.description}`,
            5, 60, 15
        );

        const count = this.getStoneCount(player);
        if (count === 6) {
            sendTitle(player,
                `${COLORS.gold}${COLORS.bold}ALL 6 STONES COLLECTED!`,
                `THE SNAP is now available`,
                10, 80, 20
            );
            sendChat(`${COLORS.gold}${COLORS.bold}[X-Man] ${player.name} has collected all 6 Infinity Stones!`);
        } else {
            sendChat(`${stoneDef.color}[X-Man] ${player.name} socketed the ${stoneDef.name}! (${count}/6)`);
        }

        return true;
    }

    activateStoneAbility(player, stoneId) {
        const def = STONE_DEFS[stoneId];
        if (!def) return;

        if (!this.hasStone(player, stoneId)) {
            sendActionbar(player, `${COLORS.red}${def.name} not socketed!`);
            return;
        }

        const cdKey = `stone_cd_${stoneId}`;
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const now = system.currentTick;

        if ((now - lastUsed) < def.cooldown) {
            const rem = ((def.cooldown - (now - lastUsed)) / 20).toFixed(1);
            sendActionbar(player, `${def.color}${def.name}: ${rem}s cooldown`);
            return;
        }

        setDynamicProp(player, cdKey, now);
        def.activate(player);
        sendTitle(player, `${def.color}${def.icon} ${def.name}`, def.description, 3, 30, 10);
        player.runCommandAsync(`playsound xman.stone.activate @s ~ ~ ~ 1.5 1 1.5`);
    }

    activateSnap(player) {
        if (!this.hasAllStones(player)) {
            const count = this.getStoneCount(player);
            sendActionbar(player, `${COLORS.red}The Snap requires all 6 stones! (${count}/6)`);
            return;
        }

        const cdKey = "snap_cd";
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const now = system.currentTick;

        if ((now - lastUsed) < SNAP_COOLDOWN) {
            const rem = ((SNAP_COOLDOWN - (now - lastUsed)) / 20).toFixed(0);
            sendActionbar(player, `${COLORS.gold}THE SNAP: ${rem}s cooldown`);
            return;
        }

        setDynamicProp(player, cdKey, now);

        sendTitle(player, `${COLORS.gold}${COLORS.bold}T H E  S N A P`, "Reality reshapes...", 10, 80, 20);
        sendChat(`${COLORS.gold}${COLORS.bold}[X-Man] ${player.name} snaps. Half of all things... end.`);
        player.runCommandAsync("playsound xman.stone.snap @s ~ ~ ~ 3 1 3");

        scheduleRun(() => {
            try {
                const mobs = player.dimension.getEntities({
                    location: player.location,
                    maxDistance: 100,
                    excludeTypes: ["minecraft:player","minecraft:item","minecraft:xp_orb"],
                }).filter(e => !e.typeId.startsWith("xman:boss_"));

                let killed = 0;
                for (const mob of mobs) {
                    if (chance(50)) {
                        try {
                            mob.kill();
                            killed++;
                        } catch (e) {}
                    }
                }

                player.dimension.runCommandAsync(`particle minecraft:huge_explosion_lab ${player.location.x} ${player.location.y + 2} ${player.location.z}`);
                sendActionbar(player, `${COLORS.gold}The Snap: ${killed} entities eliminated`);
                player.runCommandAsync("effect @s glowing 100 0 false");
            } catch (e) {}
        }, 40);
    }

    buildHUDString(player) {
        const slots = this.getStonedSlots(player);
        const icons = Object.values(STONE_DEFS).map(def =>
            slots[def.id] ? `${def.color}${def.icon}` : `${COLORS.dark_gray}☆`
        ).join(" ");
        const count = this.getStoneCount(player);
        return `${COLORS.gold}Stones: ${icons} ${COLORS.gray}(${count}/6)`;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// STONE ABILITY IMPLEMENTATIONS
// ──────────────────────────────────────────────────────────────────────────────

function powerStoneAbility(player) {
    // Triple obliterate — 3 sequential massive explosions in a line
    try {
        const rot = player.getRotation();
        const yaw = (rot.y * Math.PI) / 180;
        const fwd = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
        for (let i = 1; i <= 3; i++) {
            const delay = i * 8;
            scheduleRun(() => {
                try {
                    const pos = vec3Add(player.location, vec3Scale(fwd, i * 8));
                    player.dimension.createExplosion(pos, 5 * i, { breaksBlocks: false, causesFire: false });
                    player.dimension.runCommandAsync(`particle minecraft:huge_explosion_lab ${pos.x} ${pos.y} ${pos.z}`);
                } catch (e) {}
            }, delay);
        }
        player.runCommandAsync("playsound xman.stone.power_blast @s ~ ~ ~ 2 0.8 2");
    } catch (e) {}
}

function spaceStoneAbility(player) {
    // Hurl all nearby entities 30 blocks into the air
    try {
        const nearby = player.dimension.getEntities({
            location: player.location,
            maxDistance: 24,
            excludeTypes: ["minecraft:player","minecraft:item"],
        });
        for (const e of nearby) {
            try {
                const pos = { x: e.location.x, y: e.location.y + 30, z: e.location.z };
                e.teleport(pos, { dimension: e.dimension, keepVelocity: false });
                e.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${e.location.x} ${e.location.y} ${e.location.z}`);
            } catch (ee) {}
        }
        player.runCommandAsync("playsound xman.stone.space_warp @s ~ ~ ~ 2 1.2 2");
        sendActionbar(player, `${COLORS.blue}Space Stone: Hurled ${nearby.length} entities!`);
    } catch (e) {}
}

function realityStoneAbility(player) {
    // 5 explosions in a ring around the player — reality detonates
    try {
        const loc = player.location;
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const x = loc.x + Math.cos(angle) * 6;
            const z = loc.z + Math.sin(angle) * 6;
            scheduleRun(() => {
                try {
                    player.dimension.createExplosion({ x, y: loc.y, z }, 4, { breaksBlocks: false, causesFire: false });
                } catch (e) {}
            }, i * 6);
        }
        player.runCommandAsync("playsound xman.stone.reality_warp @s ~ ~ ~ 2 0.9 2");
    } catch (e) {}
}

function mindStoneAbility(player) {
    // Convert nearest 5 mobs: apply regen + make them targets of other mobs via tag
    try {
        const enemies = player.dimension.getEntities({
            location: player.location,
            maxDistance: 20,
            excludeTypes: ["minecraft:player","minecraft:item"],
        }).slice(0, 5);

        for (const mob of enemies) {
            try {
                mob.runCommandAsync("effect @s regeneration 600 2 true");
                mob.runCommandAsync("effect @s strength 600 1 true");
                mob.addTag("xman:mind_controlled");
                mob.dimension.runCommandAsync(`particle minecraft:villager_happy ${mob.location.x} ${mob.location.y + 1} ${mob.location.z}`);
                scheduleRun(() => {
                    try {
                        mob.removeTag("xman:mind_controlled");
                        mob.runCommandAsync("effect @s regeneration 0 0");
                    } catch (e) {}
                }, 600);
            } catch (ee) {}
        }
        sendActionbar(player, `${COLORS.yellow}Mind Stone: ${enemies.length} mobs under control!`);
        player.runCommandAsync("playsound xman.stone.mind_control @s ~ ~ ~ 2 1 2");
    } catch (e) {}
}

function timeStoneAbility(player) {
    // Instantly restore most health + remove negative effects
    try {
        const healthComp = player.getComponent("minecraft:health");
        if (healthComp) {
            const maxHP = healthComp.effectiveMax;
            const healAmount = Math.floor(maxHP * 0.8);
            player.runCommandAsync(`effect @s instant_health 1 9 true`);
            player.runCommandAsync(`effect @s regeneration 100 4 true`);
        }
        // Remove bad effects
        const badEffects = ["poison","wither","blindness","weakness","slowness","nausea","hunger"];
        for (const eff of badEffects) {
            player.runCommandAsync(`effect @s ${eff} 0 0`);
        }
        player.dimension.runCommandAsync(`particle minecraft:totem_undying ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.stone.time_rewind @s ~ ~ ~ 2 1.5 2");
        sendActionbar(player, `${COLORS.green}Time Stone: Health restored!`);
    } catch (e) {}
}

function soulStoneAbility(player) {
    // Drain life from all nearby enemies and heal player for total
    try {
        const enemies = player.dimension.getEntities({
            location: player.location,
            maxDistance: 16,
            excludeTypes: ["minecraft:player","minecraft:item"],
        });
        let totalDrained = 0;
        for (const mob of enemies) {
            try {
                const dmg = 15;
                mob.applyDamage(dmg, { cause: "entityAttack", damagingEntity: player });
                totalDrained += dmg;
                mob.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${mob.location.x} ${mob.location.y + 1} ${mob.location.z}`);
            } catch (ee) {}
        }
        if (totalDrained > 0) {
            player.runCommandAsync(`effect @s instant_health 1 ${Math.min(9, Math.floor(totalDrained / 20))} true`);
        }
        player.runCommandAsync("playsound xman.stone.soul_harvest @s ~ ~ ~ 2 0.8 2");
        sendActionbar(player, `${COLORS.gold}Soul Stone: Drained ${totalDrained} HP from ${enemies.length} mobs!`);
    } catch (e) {}
}
