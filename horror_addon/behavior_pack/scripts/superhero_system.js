/**
 * SUPERHERO SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Five legendary hero identities unlocked by defeating bosses and collecting
 *   their power relics. Each hero grants passive perks plus 2 active abilities.
 *   Abilities are triggered by right-clicking with the hero's signature item.
 *
 * Heroes:
 *   CRIMSON AVENGER (Iron Man inspired)
 *     Suit: xman:crimson_avenger_suit (chestplate)
 *     Passive: Slow fall, Speed I, Resistance I
 *     Ability 1: Repulsor Blast — hitscan beam (60 dmg, 48 blocks)
 *     Ability 2: Rocket Burst — propels player upward + forward 20 blocks
 *     Unlock: Power Stone + Titanium set + Affinity Core
 *
 *   SHADOW KNIGHT (Batman inspired)
 *     Suit: xman:shadow_knight_suit (chestplate)
 *     Passive: Invisibility when sneaking, Night Vision, Speed II
 *     Ability 1: Grapple — teleports player to target entity/block (20 blocks)
 *     Ability 2: Shadow Storm — blinds all nearby enemies for 10s
 *     Unlock: Mind Stone + Shadow set + Shadow Crown
 *
 *   THUNDER GOD (Thor inspired)
 *     Weapon: xman:thunder_hammer
 *     Passive: Storm Aura — occasional lightning strikes nearby enemies
 *     Ability 1: Mjolnir Throw — projectile that calls lightning at landing
 *     Ability 2: Thunder Clap — knockback + lightning all in 8 blocks
 *     Unlock: Time Stone + Lightning Blade + Void Ingot ×4
 *
 *   SPEED DEVIL (Flash inspired)
 *     Boots: xman:speed_boots
 *     Passive: Speed V for 3s on sprint start, lightning particle trail
 *     Ability 1: Blitz Rush — teleport 30 blocks in look direction instantly
 *     Ability 2: Vortex — spin rapidly, knock back all entities in 5 blocks
 *     Unlock: Space Stone + Void Boots + Purified Toxin ×8
 *
 *   BIO-RAGE (Hulk inspired)
 *     Item: xman:bio_rage_serum (consumable)
 *     Effect: 30s transformation — Strength V + Resistance IV + Speed II + Regeneration II
 *     Rage Smash: While in rage, hitting ground deals area damage
 *     Unlock: Soul Stone + Mutant Crystal ×6 + Boss Trophy ×2
 *
 * Testing checklist:
 *   [ ] Crimson suit triggers slow fall when worn
 *   [ ] Repulsor blast deals 60 damage at 48 blocks
 *   [ ] Shadow Knight turns invisible while sneaking
 *   [ ] Grapple moves player to target
 *   [ ] Thunder hammer storm aura fires occasionally
 *   [ ] Speed Devil speed burst on sprint
 *   [ ] Blitz Rush moves 30 blocks forward
 *   [ ] Bio-Rage serum applies all effects for 30s
 *   [ ] All cooldowns respected
 */

import { world, system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendActionbar, sendTitle, scheduleRun,
    getPlayersInRadius, vec3Add, vec3Scale, vec3Norm, vec3Sub, vec3Dist,
    spawnParticle, applyEffect, COLORS, chance, randomInt, randomFloat
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// HERO DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const HERO_SUITS = {
    "xman:crimson_avenger_suit": {
        name: "Crimson Avenger",
        color: COLORS.red,
        icon: "🔴",
        passive: crimsonPassive,
        ability1: { name: "Repulsor Blast", cooldown: 20, fn: repulsorBlast },
        ability2: { name: "Rocket Burst", cooldown: 60, fn: rocketBurst },
    },
    "xman:shadow_knight_suit": {
        name: "Shadow Knight",
        color: COLORS.dark_purple,
        icon: "🖤",
        passive: shadowKnightPassive,
        ability1: { name: "Grapple", cooldown: 40, fn: grapple },
        ability2: { name: "Shadow Storm", cooldown: 120, fn: shadowStorm },
    },
};

const HERO_WEAPONS = {
    "xman:thunder_hammer": {
        name: "Thunder God",
        color: COLORS.yellow,
        icon: "⚡",
        passive: thunderPassive,
        ability1: { name: "Mjolnir Throw", cooldown: 30, fn: mjolnirThrow },
        ability2: { name: "Thunder Clap", cooldown: 80, fn: thunderClap },
    },
};

const HERO_BOOTS = {
    "xman:speed_boots": {
        name: "Speed Devil",
        color: COLORS.yellow,
        icon: "⚡",
        passive: speedPassive,
        ability1: { name: "Blitz Rush", cooldown: 20, fn: blitzRush },
        ability2: { name: "Vortex", cooldown: 100, fn: vortex },
    },
};

const SERUMS = {
    "xman:bio_rage_serum": {
        name: "Bio-Rage",
        color: COLORS.green,
        icon: "💪",
        fn: bioRage,
    },
};

// ──────────────────────────────────────────────────────────────────────────────
// SUPERHERO SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class SuperheroSystem {
    constructor() {
        this._sprintTracker = new Map(); // playerId → wasSprinting
        this._thunderTimer = new Map();  // playerId → lastStrikeT
        this._ragePlayers = new Set();
    }

    // Called from main.js every 10 ticks
    tick(player) {
        this._checkSuitPassives(player);
        this._checkWeaponPassives(player);
        this._checkBootsPassives(player);
    }

    // Called from main.js on itemUse
    onItemUse(player, itemStack, isSneaking) {
        const typeId = itemStack.typeId;

        // Serum
        if (SERUMS[typeId]) {
            this._useSerum(player, SERUMS[typeId]);
            return true;
        }

        // Hero weapon ability
        if (HERO_WEAPONS[typeId]) {
            const hero = HERO_WEAPONS[typeId];
            if (isSneaking) {
                this._fireAbility(player, hero.ability2, "hero_weapon_ab2");
            } else {
                this._fireAbility(player, hero.ability1, "hero_weapon_ab1");
            }
            return true;
        }

        return false;
    }

    _checkSuitPassives(player) {
        const suit = this._getEquipped(player, "Chest");
        if (!suit) {
            this._clearHeroEffects(player);
            return;
        }

        const hero = HERO_SUITS[suit.typeId];
        if (!hero) return;
        hero.passive(player, this);
    }

    _checkWeaponPassives(player) {
        const weapon = this._getEquipped(player, "Mainhand");
        if (!weapon) return;

        const hero = HERO_WEAPONS[weapon.typeId];
        if (!hero) return;
        hero.passive(player, this);
    }

    _checkBootsPassives(player) {
        const boots = this._getEquipped(player, "Feet");
        if (!boots) return;

        const hero = HERO_BOOTS[boots.typeId];
        if (!hero) return;
        hero.passive(player, this);
    }

    _fireAbility(player, ability, cdKey) {
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const now = system.currentTick;

        if ((now - lastUsed) < ability.cooldown) {
            const rem = ((ability.cooldown - (now - lastUsed)) / 20).toFixed(1);
            sendActionbar(player, `${COLORS.red}${ability.name}: ${rem}s cooldown`);
            return;
        }

        setDynamicProp(player, cdKey, now);
        try { ability.fn(player); } catch (e) {}
        sendActionbar(player, `${COLORS.yellow}${ability.name}!`);
    }

    _useSerum(player, serum) {
        const cdKey = `serum_cd_${serum.name}`;
        const lastUsed = getDynamicProp(player, cdKey, 0);
        const now = system.currentTick;

        if ((now - lastUsed) < 1200) {
            const rem = (((1200) - (now - lastUsed)) / 20).toFixed(0);
            sendActionbar(player, `${COLORS.red}${serum.name}: ${rem}s cooldown`);
            return;
        }

        setDynamicProp(player, cdKey, now);
        serum.fn(player, this);
    }

    _clearHeroEffects(player) {
        // Only clear if we were actively applying them
        // (Don't strip vanilla effects accidentally)
    }

    _getEquipped(player, slot) {
        try {
            return player.getComponent("minecraft:equippable")?.getEquipment(slot) ?? null;
        } catch (e) { return null; }
    }

    setRaging(playerId, value) {
        if (value) this._ragePlayers.add(playerId);
        else this._ragePlayers.delete(playerId);
    }

    isRaging(playerId) {
        return this._ragePlayers.has(playerId);
    }

    getThunderTimer(playerId) {
        return this._thunderTimer.get(playerId) ?? 0;
    }

    setThunderTimer(playerId, t) {
        this._thunderTimer.set(playerId, t);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// PASSIVE IMPLEMENTATIONS
// ──────────────────────────────────────────────────────────────────────────────

function crimsonPassive(player, sys) {
    try {
        player.runCommandAsync("effect @s slow_falling 25 0 true");
        player.runCommandAsync("effect @s speed 25 0 true");
        player.runCommandAsync("effect @s resistance 25 0 true");
    } catch (e) {}
}

function shadowKnightPassive(player, sys) {
    try {
        player.runCommandAsync("effect @s night_vision 25 0 true");
        player.runCommandAsync("effect @s speed 25 1 true");
        if (player.isSneaking) {
            player.runCommandAsync("effect @s invisibility 25 0 true");
        }
    } catch (e) {}
}

function thunderPassive(player, sys) {
    try {
        const now = system.currentTick;
        const last = sys.getThunderTimer(player.id);
        // Storm aura: random lightning every 5-10s
        if ((now - last) > randomInt(100, 200)) {
            sys.setThunderTimer(player.id, now);
            const enemies = player.dimension.getEntities({
                location: player.location,
                maxDistance: 12,
                excludeTypes: ["minecraft:player","minecraft:item"],
            });
            if (enemies.length > 0) {
                const target = enemies[randomInt(0, enemies.length - 1)];
                try {
                    const loc = target.location;
                    player.dimension.runCommandAsync(`summon lightning_bolt ${loc.x} ${loc.y} ${loc.z}`);
                } catch (e) {}
            }
        }
        player.runCommandAsync("effect @s strength 25 1 true");
    } catch (e) {}
}

function speedPassive(player, sys) {
    try {
        player.runCommandAsync("effect @s speed 25 2 true");
        // Lightning trail
        if (system.currentTick % 4 === 0) {
            const pos = player.location;
            player.dimension.runCommandAsync(`particle minecraft:lightning_impact ${pos.x} ${pos.y} ${pos.z}`);
        }
    } catch (e) {}
}

// ──────────────────────────────────────────────────────────────────────────────
// ABILITY IMPLEMENTATIONS
// ──────────────────────────────────────────────────────────────────────────────

function repulsorBlast(player) {
    try {
        const hits = player.getEntitiesFromViewDirection({ maxDistance: 48 });
        if (hits && hits.length > 0) {
            const target = hits[0].entity;
            if (target) {
                target.applyDamage(60, { cause: "entityAttack", damagingEntity: player });
                const loc = target.location;
                player.dimension.runCommandAsync(`particle minecraft:large_explosion ${loc.x} ${loc.y + 1} ${loc.z}`);
                target.runCommandAsync("effect @s slowness 60 3 true");
            }
        }
        player.runCommandAsync("playsound xman.hero.repulsor @s ~ ~ ~ 1.5 1 1.5");
    } catch (e) {}
}

function rocketBurst(player) {
    try {
        const rot = player.getRotation();
        const yaw = (rot.y * Math.PI) / 180;
        const pitch = Math.max(-80, rot.x) * Math.PI / 180;
        const fwd = {
            x: -Math.sin(yaw) * 20,
            y: Math.max(5, -Math.sin(pitch) * 15),
            z: Math.cos(yaw) * 20,
        };
        const dest = vec3Add(player.location, fwd);
        const from = player.location;
        player.dimension.runCommandAsync(`particle minecraft:large_explosion ${from.x} ${from.y} ${from.z}`);
        player.teleport({ x: dest.x, y: dest.y, z: dest.z }, { dimension: player.dimension, keepVelocity: false });
        player.dimension.runCommandAsync(`particle minecraft:large_explosion ${dest.x} ${dest.y} ${dest.z}`);
        player.runCommandAsync("effect @s slow_falling 40 0 true");
        player.runCommandAsync("playsound xman.hero.rocket @s ~ ~ ~ 2 1.2 2");
    } catch (e) {}
}

function grapple(player) {
    try {
        const hits = player.getEntitiesFromViewDirection({ maxDistance: 20, ignoreBlockCollision: false });
        let targetPos;
        if (hits && hits.length > 0) {
            targetPos = hits[0].entity?.location ?? hits[0].location;
        }
        if (!targetPos) {
            const rot = player.getRotation();
            const yaw = (rot.y * Math.PI) / 180;
            const pitch = (rot.x * Math.PI) / 180;
            targetPos = vec3Add(player.location, {
                x: -Math.sin(yaw) * 20,
                y: -Math.sin(pitch) * 20,
                z: Math.cos(yaw) * 20,
            });
        }
        player.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.teleport({ x: targetPos.x, y: targetPos.y + 1, z: targetPos.z }, { dimension: player.dimension });
        player.runCommandAsync("playsound xman.hero.grapple @s ~ ~ ~ 1.5 1 1.5");
    } catch (e) {}
}

function shadowStorm(player) {
    try {
        player.dimension.runCommandAsync(`effect @e[r=16,type=!minecraft:player] blindness 200 2 true`);
        player.dimension.runCommandAsync(`effect @e[r=16,type=!minecraft:player] slowness 200 2 true`);
        player.dimension.runCommandAsync(`particle minecraft:enderman_teleport ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.hero.shadow_storm @s ~ ~ ~ 2 0.8 2");
    } catch (e) {}
}

function mjolnirThrow(player) {
    try {
        const hits = player.getEntitiesFromViewDirection({ maxDistance: 40 });
        let impact;
        if (hits && hits.length > 0) {
            const e = hits[0].entity;
            if (e) {
                e.applyDamage(35, { cause: "entityAttack", damagingEntity: player });
                impact = e.location;
            }
        }
        if (!impact) {
            const rot = player.getRotation();
            const yaw = (rot.y * Math.PI) / 180;
            impact = vec3Add(player.location, { x: -Math.sin(yaw) * 20, y: 0, z: Math.cos(yaw) * 20 });
        }
        // Call 3 lightning bolts at impact
        for (let i = 0; i < 3; i++) {
            const ox = (Math.random() - 0.5) * 4;
            const oz = (Math.random() - 0.5) * 4;
            player.dimension.runCommandAsync(`summon lightning_bolt ${impact.x + ox} ${impact.y} ${impact.z + oz}`);
        }
        player.runCommandAsync("playsound xman.hero.mjolnir @s ~ ~ ~ 2 1 2");
    } catch (e) {}
}

function thunderClap(player) {
    try {
        const loc = player.location;
        const nearby = player.dimension.getEntities({ location: loc, maxDistance: 8, excludeTypes: ["minecraft:player","minecraft:item"] });
        for (const e of nearby) {
            try {
                e.applyDamage(20, { cause: "entityAttack", damagingEntity: player });
                const loc2 = e.location;
                player.dimension.runCommandAsync(`summon lightning_bolt ${loc2.x} ${loc2.y} ${loc2.z}`);
            } catch (ee) {}
        }
        player.dimension.runCommandAsync(`particle minecraft:huge_explosion_lab ${loc.x} ${loc.y + 1} ${loc.z}`);
        player.runCommandAsync("playsound xman.hero.thunder_clap @s ~ ~ ~ 2.5 0.8 2.5");
    } catch (e) {}
}

function blitzRush(player) {
    try {
        const rot = player.getRotation();
        const yaw = (rot.y * Math.PI) / 180;
        const to = vec3Add(player.location, { x: -Math.sin(yaw) * 30, y: 0, z: Math.cos(yaw) * 30 });
        const from = player.location;
        // Leave lightning trail
        for (let i = 0; i < 5; i++) {
            const t = i / 5;
            const pos = { x: from.x + (to.x - from.x) * t, y: from.y, z: from.z + (to.z - from.z) * t };
            scheduleRun(() => {
                try { player.dimension.runCommandAsync(`particle minecraft:lightning_impact ${pos.x} ${pos.y} ${pos.z}`); } catch (e) {}
            }, i * 2);
        }
        player.teleport({ x: to.x, y: to.y, z: to.z }, { dimension: player.dimension, keepVelocity: false });
        player.runCommandAsync("playsound xman.hero.blitz @s ~ ~ ~ 2 1.5 2");
    } catch (e) {}
}

function vortex(player) {
    try {
        const loc = player.location;
        const nearby = player.dimension.getEntities({ location: loc, maxDistance: 5, excludeTypes: ["minecraft:player","minecraft:item"] });
        for (const e of nearby) {
            try {
                const dir = vec3Norm(vec3Sub(e.location, loc));
                const flung = vec3Add(e.location, vec3Scale(dir, 10));
                flung.y += 5;
                e.teleport(flung, { dimension: e.dimension, keepVelocity: false });
                e.applyDamage(12, { cause: "entityAttack", damagingEntity: player });
            } catch (ee) {}
        }
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            player.dimension.runCommandAsync(`particle minecraft:lightning_impact ${loc.x + Math.cos(angle) * 3} ${loc.y + 1} ${loc.z + Math.sin(angle) * 3}`);
        }
        player.runCommandAsync("playsound xman.hero.vortex @s ~ ~ ~ 2 1 2");
    } catch (e) {}
}

function bioRage(player, sys) {
    try {
        sys.setRaging(player.id, true);
        player.runCommandAsync("effect @s strength 600 4 true");
        player.runCommandAsync("effect @s resistance 600 3 true");
        player.runCommandAsync("effect @s speed 600 1 true");
        player.runCommandAsync("effect @s regeneration 600 1 true");
        player.runCommandAsync("effect @s jump_boost 600 2 true");
        player.dimension.runCommandAsync(`particle minecraft:large_explosion ${player.location.x} ${player.location.y + 1} ${player.location.z}`);
        player.runCommandAsync("playsound xman.hero.rage @s ~ ~ ~ 2 0.7 2");

        sendTitle(player, `${COLORS.green}${COLORS.bold}BIO-RAGE!`, "UNSTOPPABLE for 30s", 5, 60, 20);

        scheduleRun(() => {
            try {
                sys.setRaging(player.id, false);
                player.runCommandAsync("effect @s strength 0 0");
                player.runCommandAsync("effect @s resistance 0 0");
                sendActionbar(player, `${COLORS.dark_green}Bio-Rage faded.`);
            } catch (e) {}
        }, 600);
    } catch (e) {}
}
