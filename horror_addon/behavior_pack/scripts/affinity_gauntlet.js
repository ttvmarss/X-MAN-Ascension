/**
 * AFFINITY GAUNTLET — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   The Affinity Gauntlet is the mod's ultimate legendary weapon, an original
 *   artifact inspired by SSundee's iconic Minecraft content. It grants the
 *   wearer 8 distinct powers that cycle via sneak+use and activate with right-click.
 *
 * Powers (cycle with Sneak + Use, activate with Use):
 *   1. POWER_BLAST    — Fires a devastating energy projectile (xman:affinity_blast)
 *   2. TIME_SLOW      — Applies slowness IV to all nearby enemies for 8s
 *   3. MOB_PULL       — Pulls all entities in 20 block radius toward player
 *   4. LIGHTNING_CALL — Strikes 5 lightning bolts on nearby enemies
 *   5. ENERGY_SHIELD  — Absorbs next 40 damage (Absorption X for 10s)
 *   6. VOID_DASH      — Teleports player 15 blocks forward instantly
 *   7. REALITY_BURST  — Area explosion (no block damage) centered on target
 *   8. BOSS_BANE      — Next hit on a boss deals 10× damage (15s window)
 *
 * Crafting:
 *   Requires: 1 void_core + 1 shadow_crown + 1 affinity_core + 4 ancient_steel_ingot
 *   Crafted at: xman:weapon_bench
 *
 * Cooldowns per power (in ticks):
 *   POWER_BLAST: 40   TIME_SLOW: 200   MOB_PULL: 100   LIGHTNING_CALL: 120
 *   ENERGY_SHIELD: 400  VOID_DASH: 60  REALITY_BURST: 300  BOSS_BANE: 600
 *
 * Architecture:
 *   - Power index stored per-player via Dynamic Property "gauntlet_power"
 *   - Cooldowns stored per-player via Dynamic Property "gauntlet_cd_{power}"
 *   - Activation: sneak+use cycles power; use alone activates current power
 *   - Boss Bane state: Dynamic Property "gauntlet_boss_bane" (tick expiry)
 *
 * Resource Pack Required:
 *   textures/items/special/affinity_gauntlet.png  — final art needed
 *   sounds: xman.gauntlet.activate, xman.gauntlet.cycle, xman.gauntlet.blast,
 *           xman.gauntlet.slow, xman.gauntlet.pull, xman.gauntlet.lightning,
 *           xman.gauntlet.shield, xman.gauntlet.dash, xman.gauntlet.burst,
 *           xman.gauntlet.bane
 *
 * Testing checklist:
 *   [ ] Gauntlet equips and shows current power in action bar
 *   [ ] Sneak+use cycles through all 8 powers
 *   [ ] Power Blast fires projectile entity
 *   [ ] Time Slow applies slowness to nearby mobs
 *   [ ] Mob Pull draws entities toward player
 *   [ ] Lightning Call strikes 5 targets
 *   [ ] Energy Shield applies absorption
 *   [ ] Void Dash teleports forward 15 blocks
 *   [ ] Reality Burst creates explosion (no block damage)
 *   [ ] Boss Bane multiplies next boss hit ×10
 *   [ ] Each power respects its cooldown
 *   [ ] HUD shows power name, cooldown bar, charge count
 */

import { world, system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendActionbar, scheduleRun,
    vec3Add, vec3Norm, vec3Scale, vec3Sub, vec3Dist,
    COLORS, sendTitle, chance, randomInt
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// POWER DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const POWERS = [
    {
        id: "power_blast",
        name: "Power Blast",
        icon: "⚡",
        color: COLORS.yellow,
        cooldown: 40,
        description: "Fire an energy blast",
        activate: powerBlast,
    },
    {
        id: "time_slow",
        name: "Time Slow",
        icon: "⏳",
        color: COLORS.aqua,
        cooldown: 200,
        description: "Slow all nearby enemies",
        activate: timeSlow,
    },
    {
        id: "mob_pull",
        name: "Mob Pull",
        icon: "🌀",
        color: COLORS.light_purple,
        cooldown: 100,
        description: "Pull all entities toward you",
        activate: mobPull,
    },
    {
        id: "lightning_call",
        name: "Lightning Call",
        icon: "⛈",
        color: COLORS.yellow,
        cooldown: 120,
        description: "Strike 5 enemies with lightning",
        activate: lightningCall,
    },
    {
        id: "energy_shield",
        name: "Energy Shield",
        icon: "🛡",
        color: COLORS.blue,
        cooldown: 400,
        description: "Absorb incoming damage",
        activate: energyShield,
    },
    {
        id: "void_dash",
        name: "Void Dash",
        icon: "🔮",
        color: COLORS.dark_purple,
        cooldown: 60,
        description: "Teleport forward 15 blocks",
        activate: voidDash,
    },
    {
        id: "reality_burst",
        name: "Reality Burst",
        icon: "💥",
        color: COLORS.red,
        cooldown: 300,
        description: "Massive area explosion",
        activate: realityBurst,
    },
    {
        id: "boss_bane",
        name: "Boss Bane",
        icon: "👑",
        color: COLORS.gold,
        cooldown: 600,
        description: "Next boss hit deals ×10 damage",
        activate: bossBane,
    },
];

const POWER_COUNT = POWERS.length;
const GAUNTLET_ITEM_ID = "xman:affinity_gauntlet";

// ──────────────────────────────────────────────────────────────────────────────
// AFFINITY GAUNTLET CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class AffinityGauntlet {
    constructor() {
        // playerId → last use tick (to detect sneak toggle)
        this._lastSneakUse = new Map();
    }

    activate(player, itemStack, isSneaking) {
        if (isSneaking) {
            this._cyclePower(player);
            return;
        }
        this._activatePower(player);
    }

    _cyclePower(player) {
        const current = getDynamicProp(player, "gauntlet_power", 0);
        const next = (current + 1) % POWER_COUNT;
        setDynamicProp(player, "gauntlet_power", next);

        const power = POWERS[next];
        player.runCommandAsync("playsound xman.gauntlet.cycle @s ~ ~ ~ 1 1 1");
        sendActionbar(player, `${power.color}${COLORS.bold}[Affinity Gauntlet] ${power.name} ${power.icon}`);
    }

    _activatePower(player) {
        const idx = getDynamicProp(player, "gauntlet_power", 0);
        const power = POWERS[idx];

        const cdKey = `gauntlet_cd_${power.id}`;
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const now = system.currentTick;

        if ((now - lastUsed) < power.cooldown) {
            const remaining = ((power.cooldown - (now - lastUsed)) / 20).toFixed(1);
            sendActionbar(player, `${COLORS.red}${power.name} on cooldown: ${remaining}s`);
            return;
        }

        setDynamicProp(player, cdKey, now);
        player.runCommandAsync("playsound xman.gauntlet.activate @s ~ ~ ~ 1.2 1 1.2");
        sendTitle(player, `${power.color}${power.name}`, power.description, 2, 20, 10);

        try {
            power.activate(player);
        } catch (e) {}

        this.showHUD(player);
    }

    showHUD(player) {
        const idx = getDynamicProp(player, "gauntlet_power", 0);
        const power = POWERS[idx];
        const cdKey = `gauntlet_cd_${power.id}`;
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const elapsed = system.currentTick - lastUsed;
        const cdRatio = Math.min(1, elapsed / power.cooldown);
        const bar = _cdBar(cdRatio);

        sendActionbar(player,
            `${power.color}${power.icon} ${power.name}  ${bar}  ${COLORS.gray}[Sneak+Use to switch]`
        );
    }

    onBossHit(player, boss, baseDamage) {
        const baneExpiry = getDynamicProp(player, "gauntlet_boss_bane", 0);
        if (system.currentTick < baneExpiry) {
            // Clear the bane state
            setDynamicProp(player, "gauntlet_boss_bane", 0);
            const bonusDmg = baseDamage * 9; // Total ×10
            try {
                boss.applyDamage(bonusDmg, { cause: "entityAttack", damagingEntity: player });
                boss.dimension.runCommandAsync(`particle minecraft:lightning_impact ${boss.location.x} ${boss.location.y + 2} ${boss.location.z}`);
                sendTitle(player, `${COLORS.gold}BOSS BANE!`, `×10 damage!`, 2, 30, 10);
                player.runCommandAsync("playsound xman.gauntlet.bane @s ~ ~ ~ 2 1 2");
            } catch (e) {}
            return true;
        }
        return false;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// POWER IMPLEMENTATIONS
// ──────────────────────────────────────────────────────────────────────────────

function powerBlast(player) {
    try {
        // Spawn projectile entity in front of player
        const rot = player.getRotation();
        const yaw = (rot.y * Math.PI) / 180;
        const pitch = (rot.x * Math.PI) / 180;
        const fwd = {
            x: -Math.sin(yaw) * Math.cos(pitch),
            y: -Math.sin(pitch),
            z: Math.cos(yaw) * Math.cos(pitch),
        };
        const spawnPos = vec3Add(
            { x: player.location.x, y: player.location.y + 1.6, z: player.location.z },
            vec3Scale(fwd, 1.5)
        );
        const blast = player.dimension.spawnEntity("xman:affinity_blast", spawnPos);
        // The projectile entity has script-driven movement in its tick
        // Use temporary property to set velocity direction
        try {
            blast.setDynamicProperty("xman:vel_x", fwd.x * 2);
            blast.setDynamicProperty("xman:vel_y", fwd.y * 2);
            blast.setDynamicProperty("xman:vel_z", fwd.z * 2);
            blast.setDynamicProperty("xman:owner", player.id);
        } catch (e) {}
        player.runCommandAsync("playsound xman.gauntlet.blast @s ~ ~ ~ 1.5 1 1.5");
    } catch (e) {}
}

function timeSlow(player) {
    try {
        player.dimension.runCommandAsync(`effect @e[r=16,type=!minecraft:player] slowness 160 3 false`);
        player.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.gauntlet.slow @s ~ ~ ~ 1.2 0.7 1.2");
    } catch (e) {}
}

function mobPull(player) {
    try {
        const loc = player.location;
        const nearby = player.dimension.getEntities({
            location: loc,
            maxDistance: 20,
            excludeTypes: ["minecraft:player", "minecraft:item"],
        });
        for (const entity of nearby) {
            const diff = vec3Sub(loc, entity.location);
            const dist = vec3Dist(loc, entity.location);
            if (dist < 0.5) continue;
            const dir = vec3Norm(diff);
            const pullStrength = Math.min(3, 20 / dist);
            const target = vec3Add(entity.location, vec3Scale(dir, pullStrength));
            try {
                entity.teleport(target, { dimension: entity.dimension, keepVelocity: false });
            } catch (e) {}
        }
        player.runCommandAsync(`particle minecraft:large_explosion ${loc.x} ${loc.y + 1} ${loc.z}`);
        player.runCommandAsync("playsound xman.gauntlet.pull @s ~ ~ ~ 1.5 1 1.5");
    } catch (e) {}
}

function lightningCall(player) {
    try {
        const enemies = player.dimension.getEntities({
            location: player.location,
            maxDistance: 24,
            excludeTypes: ["minecraft:player", "minecraft:item"],
        });
        let struck = 0;
        for (const e of enemies) {
            if (struck >= 5) break;
            const loc = e.location;
            player.dimension.runCommandAsync(`summon lightning_bolt ${loc.x} ${loc.y} ${loc.z}`);
            struck++;
        }
        player.runCommandAsync("playsound xman.gauntlet.lightning @s ~ ~ ~ 2 1 2");
    } catch (e) {}
}

function energyShield(player) {
    try {
        player.runCommandAsync("effect @s absorption 200 9 false");
        player.runCommandAsync("effect @s resistance 100 1 true");
        player.dimension.runCommandAsync(`particle minecraft:shulker_bullet ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.gauntlet.shield @s ~ ~ ~ 1.2 1 1.2");
    } catch (e) {}
}

function voidDash(player) {
    try {
        const rot = player.getRotation();
        const yaw = (rot.y * Math.PI) / 180;
        const fwd = {
            x: -Math.sin(yaw) * 15,
            y: 0,
            z: Math.cos(yaw) * 15,
        };
        const from = player.location;
        const to = vec3Add(from, fwd);

        player.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${from.x} ${from.y + 1} ${from.z}`);
        player.teleport({ x: to.x, y: to.y, z: to.z }, {
            dimension: player.dimension,
            keepVelocity: false,
        });
        player.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${to.x} ${to.y + 1} ${to.z}`);
        player.runCommandAsync("playsound xman.gauntlet.dash @s ~ ~ ~ 1.5 1.2 1.5");
    } catch (e) {}
}

function realityBurst(player) {
    try {
        const hits = player.getEntitiesFromViewDirection({ maxDistance: 48, ignoreBlockCollision: false });
        let targetPos = vec3Add(player.location, { x: 0, y: 0, z: 0 });

        if (hits && hits.length > 0) {
            targetPos = hits[0].entity?.location ?? hits[0].location ?? targetPos;
        }

        player.dimension.createExplosion(targetPos, 6, {
            breaksBlocks: false,
            causesFire: false,
            allowUnderwater: false,
        });
        player.dimension.runCommandAsync(`particle minecraft:huge_explosion_lab ${targetPos.x} ${targetPos.y} ${targetPos.z}`);
        player.runCommandAsync("playsound xman.gauntlet.burst @s ~ ~ ~ 2 1 2");
    } catch (e) {}
}

function bossBane(player) {
    try {
        // Set expiry 15s from now
        const expiry = system.currentTick + 300;
        setDynamicProp(player, "gauntlet_boss_bane", expiry);
        player.runCommandAsync("effect @s strength 300 9 true");
        player.dimension.runCommandAsync(`particle minecraft:totem_undying ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.gauntlet.bane @s ~ ~ ~ 1.5 1.5 1.5");
        sendTitle(player, `${COLORS.gold}BOSS BANE`, "Next boss hit: ×10 damage!", 5, 40, 10);
    } catch (e) {}
}

// ──────────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function _cdBar(ratio) {
    const filled = Math.round(ratio * 10);
    const empty = 10 - filled;
    const color = ratio >= 1 ? COLORS.green : ratio > 0.5 ? COLORS.yellow : COLORS.red;
    return `${color}[${"█".repeat(filled)}${COLORS.dark_gray}${"░".repeat(empty)}${color}]${COLORS.reset}`;
}
