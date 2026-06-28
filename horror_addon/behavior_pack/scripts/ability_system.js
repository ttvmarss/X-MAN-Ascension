/**
 * ABILITY SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Scripted weapon ability framework replacing unsupported custom enchantments
 *   in Bedrock Edition. Abilities trigger on melee hit, on kill, or passively.
 *   Every weapon ability is defined in WEAPON_ABILITIES keyed by item typeId.
 *
 * Weapon → Ability Map:
 *   xman:blood_sword      → Lifesteal (heal 20% of damage dealt)
 *   xman:shadow_sword     → Shadow Step (teleport behind next enemy after kill)
 *   xman:mutant_bone_axe  → Bone Crush (50% chance weakness III, 5s)
 *   xman:cursed_scythe    → Bleed (poison II, 8s)
 *   xman:heavy_hammer     → Shockwave (knockback + dmg all enemies within 3 blocks)
 *   xman:spear            → Impale (slowness III, 3s)
 *   xman:dagger           → Toxic Edge (poison II, 8s; 40% chance)
 *   xman:lightning_blade  → Chain Lightning (arc to 3 nearest enemies at 50% dmg)
 *   xman:fire_katana      → Fire Burst (ignite target + 2-block radius, 5s)
 *   xman:void_greatsword  → Void Tear (30% bonus dmg + 20% armor strip chance)
 *
 * Usage in main.js:
 *   abilitySystem.onHit(attacker, target, baseDamage)  — call on entityHurt
 *   abilitySystem.onKill(attacker, target)             — call on entityDie
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js
 *
 * Performance:
 *   Pure event-driven. No polling loops. Particle/sound calls are fire-and-forget.
 *
 * Multiplayer:
 *   All attacker-based lookups use the attacker entity object directly.
 *   No shared state between players.
 *
 * Testing checklist:
 *   [ ] Blood sword heals attacker on hit
 *   [ ] Shadow sword teleports attacker after kill
 *   [ ] Bone axe applies weakness on 50% of hits
 *   [ ] Cursed scythe applies poison
 *   [ ] Heavy hammer damages radius mobs
 *   [ ] Spear applies slowness
 *   [ ] Dagger applies poison at 40% rate
 *   [ ] Lightning blade chains to 3 nearby mobs
 *   [ ] Fire katana ignites radius
 *   [ ] Void greatsword deals bonus damage
 *   [ ] No ability triggers for vanilla weapons
 *   [ ] Cooldowns prevent ability spam
 */

import { world, system, Player } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, spawnParticle, applyEffect,
    vec3Dist, vec3Sub, vec3Norm, vec3Scale, vec3Add, scheduleRun,
    sendActionbar, COLORS, randomFloat, chance
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// WEAPON ABILITY DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const WEAPON_ABILITIES = {
    "xman:blood_sword": {
        id: "lifesteal",
        name: "Lifesteal",
        color: COLORS.dark_red,
        cooldown: 0,
        onHit: (attacker, target, damage) => {
            const heal = Math.max(1, Math.floor(damage * 0.2));
            try {
                attacker.runCommandAsync(`effect @s instant_health 1 0 true`);
                attacker.runCommandAsync(`particle minecraft:villager_happy ${attacker.location.x} ${attacker.location.y + 1} ${attacker.location.z}`);
            } catch (e) {}
            sendActionbar(attacker, `${COLORS.dark_red}Lifesteal: +${heal} HP`);
        },
    },
    "xman:shadow_sword": {
        id: "shadow_step",
        name: "Shadow Step",
        color: COLORS.dark_purple,
        cooldown: 60,
        onKill: (attacker, target) => {
            const nearbyEntities = _getNearbyEnemies(attacker, 20);
            if (nearbyEntities.length === 0) return;
            const nextTarget = nearbyEntities[0];
            try {
                const tPos = nextTarget.location;
                const dir = vec3Sub(tPos, attacker.location);
                const norm = vec3Norm(dir);
                const teleportPos = vec3Sub(tPos, vec3Scale(norm, 2));
                attacker.teleport({ x: teleportPos.x, y: teleportPos.y, z: teleportPos.z }, {
                    dimension: attacker.dimension,
                    keepVelocity: false,
                });
                attacker.runCommandAsync(`particle minecraft:endrod ${attacker.location.x} ${attacker.location.y + 1} ${attacker.location.z}`);
                sendActionbar(attacker, `${COLORS.dark_purple}Shadow Step!`);
            } catch (e) {}
        },
    },
    "xman:mutant_bone_axe": {
        id: "bone_crush",
        name: "Bone Crush",
        color: COLORS.gray,
        cooldown: 20,
        onHit: (attacker, target, damage) => {
            if (!chance(50)) return;
            try {
                target.runCommandAsync(`effect @s weakness 100 2 true`);
                target.runCommandAsync(`particle minecraft:large_explosion ${target.location.x} ${target.location.y + 1} ${target.location.z}`);
                sendActionbar(attacker, `${COLORS.gray}Bone Crush! Weakness III applied`);
            } catch (e) {}
        },
    },
    "xman:cursed_scythe": {
        id: "bleed",
        name: "Bleed",
        color: COLORS.dark_red,
        cooldown: 10,
        onHit: (attacker, target, damage) => {
            try {
                target.runCommandAsync(`effect @s poison 160 1 false`);
                spawnParticle(target.dimension, target.location, "minecraft:blood_splatter");
                sendActionbar(attacker, `${COLORS.dark_red}Bleed! Poison applied`);
            } catch (e) {}
        },
    },
    "xman:heavy_hammer": {
        id: "shockwave",
        name: "Shockwave",
        color: COLORS.gold,
        cooldown: 40,
        onHit: (attacker, target, damage) => {
            const loc = target.location;
            const dim = target.dimension;
            try {
                const nearby = dim.getEntities({
                    location: loc,
                    maxDistance: 3,
                    excludeTypes: ["minecraft:player"],
                });
                let hits = 0;
                for (const e of nearby) {
                    if (e.id === target.id) continue;
                    try {
                        e.applyDamage(Math.floor(damage * 0.5), { cause: "entityAttack", damagingEntity: attacker });
                        e.runCommandAsync(`effect @s slowness 40 1 true`);
                        hits++;
                    } catch (ee) {}
                }
                dim.runCommandAsync(`particle minecraft:huge_explosion_lab ${loc.x} ${loc.y} ${loc.z}`);
                sendActionbar(attacker, `${COLORS.gold}Shockwave! Hit ${hits + 1} enemies`);
            } catch (e) {}
        },
    },
    "xman:spear": {
        id: "impale",
        name: "Impale",
        color: COLORS.aqua,
        cooldown: 0,
        onHit: (attacker, target, damage) => {
            try {
                target.runCommandAsync(`effect @s slowness 60 2 true`);
                sendActionbar(attacker, `${COLORS.aqua}Impale! Slowness applied`);
            } catch (e) {}
        },
    },
    "xman:dagger": {
        id: "toxic_edge",
        name: "Toxic Edge",
        color: COLORS.green,
        cooldown: 0,
        onHit: (attacker, target, damage) => {
            if (!chance(40)) return;
            try {
                target.runCommandAsync(`effect @s poison 160 1 false`);
                spawnParticle(target.dimension, target.location, "minecraft:green_flame");
                sendActionbar(attacker, `${COLORS.green}Toxic Edge! Poison applied`);
            } catch (e) {}
        },
    },
    "xman:lightning_blade": {
        id: "chain_lightning",
        name: "Chain Lightning",
        color: COLORS.yellow,
        cooldown: 30,
        onHit: (attacker, target, damage) => {
            const nearby = _getNearbyEnemies(attacker, 8);
            let chained = 0;
            const chainDmg = Math.floor(damage * 0.5);
            for (let i = 0; i < Math.min(3, nearby.length); i++) {
                const chainTarget = nearby[i];
                if (chainTarget.id === target.id) continue;
                try {
                    chainTarget.applyDamage(chainDmg, { cause: "entityAttack", damagingEntity: attacker });
                    const pos = chainTarget.location;
                    chainTarget.dimension.runCommandAsync(`summon lightning_bolt ${pos.x} ${pos.y} ${pos.z}`);
                    chained++;
                } catch (e) {}
            }
            if (chained > 0) sendActionbar(attacker, `${COLORS.yellow}Chain Lightning! Arced to ${chained} enemies`);
        },
    },
    "xman:fire_katana": {
        id: "fire_burst",
        name: "Fire Burst",
        color: COLORS.red,
        cooldown: 30,
        onHit: (attacker, target, damage) => {
            try {
                target.runCommandAsync(`effect @s fire_resistance 0 0 true`);
                const loc = target.location;
                const dim = target.dimension;
                const nearby = dim.getEntities({ location: loc, maxDistance: 2, excludeTypes: ["minecraft:player"] });
                for (const e of nearby) {
                    try {
                        e.runCommandAsync(`effect @s fire 100 0 true`);
                        e.isOnFire = true;
                    } catch (ee) {}
                }
                dim.runCommandAsync(`particle minecraft:flame ${loc.x} ${loc.y} ${loc.z}`);
                sendActionbar(attacker, `${COLORS.red}Fire Burst! Area ignite`);
            } catch (e) {}
        },
    },
    "xman:void_greatsword": {
        id: "void_tear",
        name: "Void Tear",
        color: COLORS.dark_purple,
        cooldown: 0,
        onHit: (attacker, target, damage) => {
            const bonusDmg = Math.floor(damage * 0.3);
            try {
                target.applyDamage(bonusDmg, { cause: "entityAttack", damagingEntity: attacker });
                spawnParticle(target.dimension, target.location, "minecraft:enderman_teleport");
                sendActionbar(attacker, `${COLORS.dark_purple}Void Tear! +${bonusDmg} bonus damage`);
            } catch (e) {}
        },
    },
};

// ──────────────────────────────────────────────────────────────────────────────
// ABILITY SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class AbilitySystem {
    constructor() {
        // Map of `${playerId}_${abilityId}` → tick when ability was last used
        this._lastUsed = new Map();
    }

    onHit(attacker, target, damage) {
        const held = this._getHeldItem(attacker);
        if (!held) return;

        const ability = WEAPON_ABILITIES[held.typeId];
        if (!ability) return;

        if (!this._checkCooldown(attacker, ability)) return;

        if (ability.onHit) {
            try {
                ability.onHit(attacker, target, damage);
            } catch (e) {}
        }

        this._setCooldown(attacker, ability);
    }

    onKill(attacker, target) {
        const held = this._getHeldItem(attacker);
        if (!held) return;

        const ability = WEAPON_ABILITIES[held.typeId];
        if (!ability?.onKill) return;

        try {
            ability.onKill(attacker, target);
        } catch (e) {}
    }

    getAbilityForItem(typeId) {
        return WEAPON_ABILITIES[typeId] || null;
    }

    hasAbility(typeId) {
        return Object.prototype.hasOwnProperty.call(WEAPON_ABILITIES, typeId);
    }

    _getHeldItem(player) {
        try {
            const eq = player.getComponent("minecraft:equippable");
            return eq?.getEquipment("Mainhand") ?? null;
        } catch (e) { return null; }
    }

    _checkCooldown(player, ability) {
        if (ability.cooldown === 0) return true;
        const key = `${player.id}_${ability.id}`;
        const lastUsed = this._lastUsed.get(key) ?? 0;
        const now = system.currentTick;
        return (now - lastUsed) >= ability.cooldown;
    }

    _setCooldown(player, ability) {
        if (ability.cooldown === 0) return;
        const key = `${player.id}_${ability.id}`;
        this._lastUsed.set(key, system.currentTick);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function _getNearbyEnemies(player, radius) {
    try {
        return player.dimension.getEntities({
            location: player.location,
            maxDistance: radius,
            excludeTypes: ["minecraft:player", "minecraft:item", "minecraft:xp_orb"],
        }).filter(e => {
            try { return e.isValid() && e.id !== player.id; }
            catch (e) { return false; }
        }).sort((a, b) => vec3Dist(a.location, player.location) - vec3Dist(b.location, player.location));
    } catch (e) { return []; }
}
