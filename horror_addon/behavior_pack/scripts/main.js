/**
 * MAIN ENTRY POINT — X-Man Ascension Horror Survival
 * Bedrock Edition 1.21.x | Script API 1.13.0
 *
 * Purpose:
 *   Bootstraps and connects all mod systems. Registers all event subscriptions,
 *   initializes system classes, and runs the global tick loop.
 *
 * System Initialization Order:
 *   1. Utils (no dependencies)
 *   2. GunSystem
 *   3. AbilitySystem
 *   4. ArmorAbilitySystem
 *   5. JumpScareSystem
 *   6. VehicleSystem
 *   7. FuelSystem (depends on VehicleSystem)
 *   8. BossSystem
 *   9. AffinityGauntlet
 *  10. ProgressionSystem
 *
 * Events Handled:
 *   beforeEvents.itemUse          — guns, gauntlet activation
 *   afterEvents.entityHurt        — melee abilities, boss bane
 *   afterEvents.entityDie         — progression kills, boss death handler
 *   afterEvents.entitySpawn       — boss registration, vehicle registration
 *   afterEvents.playerSpawn       — initial HUD, progression restore
 *   afterEvents.playerLeave       — cleanup
 *   afterEvents.blockBreak        — ore progression, vein mining tools
 *   beforeEvents.playerInteractWithBlock — fuel refinery, fuel pump
 *
 * Global Tick Loop (system.runInterval):
 *   Every 1 tick  — gun system HUD check (only if holding gun)
 *   Every 20 ticks — armor ability application
 *   Every 20 ticks — jump scare check
 *   Every 4 ticks  — air vehicle movement (per rider)
 *   Every 40 ticks — fuel consumption
 *   Every 10 ticks — boss phase check
 *
 * Performance Notes:
 *   All per-player loops are O(players). No entity queries inside tick
 *   unless necessary. Entity queries use maxDistance to limit scope.
 *   Gun/ability systems are purely reactive (event-driven).
 *
 * Multiplayer:
 *   All state stored per-player via Dynamic Properties. No global shared
 *   mutable state except the activeBosses Map in BossSystem (entity-keyed).
 */

import { world, system, Player } from "@minecraft/server";

import { GunSystem, GUN_DATA } from "./gun_system.js";
import { AbilitySystem } from "./ability_system.js";
import { ArmorAbilitySystem } from "./armor_abilities.js";
import { JumpScareSystem } from "./jump_scare_system.js";
import { BossSystem } from "./boss_system.js";
import { VehicleSystem } from "./vehicle_system.js";
import { FuelSystem } from "./fuel_system.js";
import { AffinityGauntlet } from "./affinity_gauntlet.js";
import { ProgressionSystem } from "./progression.js";
import { getDynamicProp, setDynamicProp, sendActionbar, sendChat, COLORS } from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM INSTANCES
// ──────────────────────────────────────────────────────────────────────────────

const gunSystem = new GunSystem();
const abilitySystem = new AbilitySystem();
const armorSystem = new ArmorAbilitySystem();
const jumpScareSystem = new JumpScareSystem();
const vehicleSystem = new VehicleSystem();
const fuelSystem = new FuelSystem(vehicleSystem);
const bossSystem = new BossSystem();
const affinityGauntlet = new AffinityGauntlet();
const progressionSystem = new ProgressionSystem();

// ──────────────────────────────────────────────────────────────────────────────
// DYNAMIC PROPERTY REGISTRATION
// ──────────────────────────────────────────────────────────────────────────────

// Register all dynamic properties the mod uses on world load
world.afterEvents.worldInitialize?.subscribe?.(() => {
    try {
        world.getDynamicPropertyTotalByteCount(); // probe that it's available
    } catch (e) {}
});

// ──────────────────────────────────────────────────────────────────────────────
// TICK LOOP
// ──────────────────────────────────────────────────────────────────────────────

let masterTick = 0;

system.runInterval(() => {
    masterTick++;

    const players = world.getAllPlayers();

    for (const player of players) {
        try {
            if (!player.isValid()) continue;
        } catch (e) { continue; }

        // Armor abilities: every 20 ticks (1s)
        if (masterTick % 20 === 0) {
            try { armorSystem.tick(player); } catch (e) {}
        }

        // Jump scares: checked inside the system on its own interval
        try { jumpScareSystem.tick(player); } catch (e) {}

        // Vehicle: every tick for air vehicles, fuel every 40
        try { vehicleSystem.tick(player); } catch (e) {}

        // Progression: tick-driven check
        try { progressionSystem.tick(player); } catch (e) {}

        // Gun HUD — show ammo if holding a gun
        if (masterTick % 5 === 0) {
            try {
                const eq = player.getComponent("minecraft:equippable");
                const held = eq?.getEquipment("Mainhand");
                if (held && gunSystem.isGun(held.typeId)) {
                    gunSystem.showHUDForPlayer(player, held.typeId);
                }
            } catch (e) {}
        }

        // Affinity Gauntlet HUD
        if (masterTick % 10 === 0) {
            try {
                const eq = player.getComponent("minecraft:equippable");
                const held = eq?.getEquipment("Mainhand");
                if (held?.typeId === "xman:affinity_gauntlet") {
                    affinityGauntlet.showHUD(player);
                }
            } catch (e) {}
        }
    }

    // Boss system: every 10 ticks
    if (masterTick % 10 === 0) {
        try { bossSystem.tick(); } catch (e) {}
    }

    // Affinity blast projectile movement (every 2 ticks)
    if (masterTick % 2 === 0) {
        try { _tickAffinityBlasts(); } catch (e) {}
    }

}, 1);

// ──────────────────────────────────────────────────────────────────────────────
// ITEM USE EVENT
// ──────────────────────────────────────────────────────────────────────────────

world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    if (!(player instanceof Player)) return;

    const itemStack = event.itemStack;
    const typeId = itemStack.typeId;

    // Guns
    if (gunSystem.isGun(typeId)) {
        event.cancel = true;
        system.run(() => {
            try { gunSystem.fire(player, itemStack); } catch (e) {}
        });
        return;
    }

    // Affinity Gauntlet
    if (typeId === "xman:affinity_gauntlet") {
        event.cancel = true;
        const isSneaking = player.isSneaking;
        system.run(() => {
            try { affinityGauntlet.activate(player, itemStack, isSneaking); } catch (e) {}
        });
        return;
    }

    // Gas can / fuel tank
    if (typeId === "xman:gas_can" || typeId === "xman:fuel_tank") {
        event.cancel = true;
        system.run(() => {
            try { fuelSystem.onItemUse(player, itemStack); } catch (e) {}
        });
        return;
    }

    // Guide book
    if (typeId === "xman:guide_book") {
        event.cancel = true;
        system.run(() => {
            try { _showGuideBook(player); } catch (e) {}
        });
        return;
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// ENTITY HURT EVENT
// ──────────────────────────────────────────────────────────────────────────────

world.afterEvents.entityHurt.subscribe((event) => {
    const { damageSource, hurtEntity, damage } = event;
    const attacker = damageSource?.damagingEntity;
    if (!(attacker instanceof Player)) return;
    if (!hurtEntity || !hurtEntity.isValid?.()) return;

    // Melee abilities
    try { abilitySystem.onHit(attacker, hurtEntity, damage); } catch (e) {}

    // Boss bane check
    if (bossSystem.isBoss(hurtEntity.typeId)) {
        try { affinityGauntlet.onBossHit(attacker, hurtEntity, damage); } catch (e) {}
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// ENTITY DEATH EVENT
// ──────────────────────────────────────────────────────────────────────────────

world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const killer = damageSource?.damagingEntity;

    // Boss death
    if (bossSystem.isBoss(deadEntity.typeId)) {
        try { bossSystem.onBossDeath(deadEntity); } catch (e) {}
    }

    // Vehicle death
    if (vehicleSystem.isVehicle(deadEntity.typeId)) {
        try { vehicleSystem.onVehicleDeath(deadEntity); } catch (e) {}
    }

    // Player killer progression
    if (killer instanceof Player) {
        try { progressionSystem.onKill(killer, deadEntity.typeId); } catch (e) {}
        try { abilitySystem.onKill(killer, deadEntity); } catch (e) {}
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// ENTITY SPAWN EVENT
// ──────────────────────────────────────────────────────────────────────────────

world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;

    if (bossSystem.isBoss(entity.typeId)) {
        try { bossSystem.registerBoss(entity); } catch (e) {}
    }

    if (vehicleSystem.isVehicle(entity.typeId)) {
        try { vehicleSystem.registerVehicle(entity); } catch (e) {}
    }
});

// ──────────────────────────────────────────────────────────────────────────────
// PLAYER SPAWN / LEAVE
// ──────────────────────────────────────────────────────────────────────────────

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    const stage = progressionSystem.getStage(player);
    const stageNames = ["New Survivor","First Blood","Into the Dark","Armed","Explorer",
                        "Driver","Iron Shell","Alpha Predator","Gunner","Road Warrior",
                        "Wanderer","Boss Slayer","Legendary","Power Incarnate","Champion"];
    const stageName = stageNames[stage] ?? "Unknown";

    system.runTimeout(() => {
        try {
            sendActionbar(player,
                `${COLORS.dark_red}${COLORS.bold}[X-Man Horror Survival] ${COLORS.reset}${COLORS.gray}Stage: ${stageName} | Use Guide Book for help`
            );
        } catch (e) {}
    }, 40);
});

world.afterEvents.playerLeave.subscribe((event) => {
    try { jumpScareSystem.clearPlayerState(event.playerId); } catch (e) {}
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCK BREAK EVENT (ore progression, vein mining)
// ──────────────────────────────────────────────────────────────────────────────

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, brokenBlockPermutation } = event;
    const blockTypeId = brokenBlockPermutation.type.id;

    // Ore progression
    try { progressionSystem.onOreMined(player, blockTypeId); } catch (e) {}

    // Vein mining (Shadow Pickaxe ability)
    try { _handleVeinMining(player, blockTypeId, event.block); } catch (e) {}

    // Ore detection (Titanium Pickaxe ability)
    try { _handleOreDetection(player, blockTypeId, event.block); } catch (e) {}
});

// ──────────────────────────────────────────────────────────────────────────────
// BLOCK INTERACT EVENT (refinery, pump)
// ──────────────────────────────────────────────────────────────────────────────

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const { player, block } = event;
    const handled = fuelSystem.onBlockInteract(player, block);
    if (handled) event.cancel = true;
});

// ──────────────────────────────────────────────────────────────────────────────
// VEIN MINING (Shadow Pickaxe)
// ──────────────────────────────────────────────────────────────────────────────

const ORE_BLOCKS = new Set([
    "xman:shadow_ore","xman:bloodstone_ore","xman:titanium_ore","xman:mutant_crystal_ore",
    "xman:void_ore","xman:infernal_ore","xman:toxic_ore","xman:ancient_steel_ore",
    "minecraft:coal_ore","minecraft:iron_ore","minecraft:gold_ore","minecraft:diamond_ore",
]);

function _handleVeinMining(player, blockTypeId, block) {
    if (!ORE_BLOCKS.has(blockTypeId)) return;
    const held = _getHeldItem(player);
    if (held?.typeId !== "xman:shadow_pickaxe") return;

    const dim = player.dimension;
    const { x, y, z } = block.location;
    const offsets = [
        [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    ];
    for (const [dx, dy, dz] of offsets) {
        try {
            const nb = dim.getBlock({ x: x+dx, y: y+dy, z: z+dz });
            if (nb && nb.typeId === blockTypeId) {
                nb.setType("minecraft:air");
                dim.spawnItem(
                    new (Object.getPrototypeOf(player).constructor.ItemStack ?? Object)(blockTypeId.replace("_ore","_shard"), 1),
                    { x: x+dx+0.5, y: y+dy+0.5, z: z+dz+0.5 }
                );
            }
        } catch (e) {}
    }
}

function _handleOreDetection(player, blockTypeId, block) {
    const held = _getHeldItem(player);
    if (held?.typeId !== "xman:titanium_pickaxe") return;

    const dim = player.dimension;
    const { x, y, z } = block.location;
    const range = 8;
    let found = 0;
    for (let dx = -range; dx <= range && found < 3; dx++) {
        for (let dy = -range; dy <= range && found < 3; dy++) {
            for (let dz = -range; dz <= range && found < 3; dz++) {
                try {
                    const nb = dim.getBlock({ x: x+dx, y: y+dy, z: z+dz });
                    if (nb && ORE_BLOCKS.has(nb.typeId)) {
                        dim.runCommandAsync(`particle minecraft:crop_growth_emitter ${x+dx+0.5} ${y+dy+0.5} ${z+dz+0.5}`);
                        found++;
                    }
                } catch (e) {}
            }
        }
    }
    if (found > 0) sendActionbar(player, `${COLORS.gold}Ore Detector: ${found} ore veins nearby!`);
}

// ──────────────────────────────────────────────────────────────────────────────
// AFFINITY BLAST PROJECTILE TICK
// ──────────────────────────────────────────────────────────────────────────────

function _tickAffinityBlasts() {
    for (const dim of ["minecraft:overworld","minecraft:nether","minecraft:the_end"].map(id => {
        try { return world.getDimension(id); } catch (e) { return null; }
    }).filter(Boolean)) {
        try {
            const blasts = dim.getEntities({ type: "xman:affinity_blast" });
            for (const blast of blasts) {
                try {
                    const vx = blast.getDynamicProperty("xman:vel_x") ?? 0;
                    const vy = blast.getDynamicProperty("xman:vel_y") ?? 0;
                    const vz = blast.getDynamicProperty("xman:vel_z") ?? 0;
                    const newPos = {
                        x: blast.location.x + vx,
                        y: blast.location.y + vy,
                        z: blast.location.z + vz,
                    };
                    blast.teleport(newPos, { dimension: dim, checkForBlocks: true });

                    // Damage check
                    const nearby = dim.getEntities({
                        location: blast.location,
                        maxDistance: 1.5,
                        excludeTypes: ["minecraft:player","minecraft:item","xman:affinity_blast"],
                    });
                    for (const e of nearby) {
                        try {
                            e.applyDamage(30, { cause: "entityAttack" });
                            dim.createExplosion(blast.location, 3, { breaksBlocks: false, causesFire: false });
                            blast.kill();
                            break;
                        } catch (ee) {}
                    }

                    // Lifetime tracking
                    const age = (blast.getDynamicProperty("xman:age") ?? 0) + 1;
                    blast.setDynamicProperty("xman:age", age);
                    if (age > 60) blast.kill(); // Despawn after 6s
                } catch (e) {}
            }
        } catch (e) {}
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// GUIDE BOOK
// ──────────────────────────────────────────────────────────────────────────────

function _showGuideBook(player) {
    const stage = progressionSystem.getStage(player);
    const summary = progressionSystem.getProgressSummary(player);
    const lines = [
        `${COLORS.dark_red}${COLORS.bold}=== X-Man Ascension Horror Survival ===`,
        `${COLORS.gold}Stage: ${summary.stageName} (${stage}/14)`,
        `${COLORS.gray}Kills: ${summary.kills}`,
        `${COLORS.yellow}Next Goal: ${summary.nextGoal}`,
        "",
        `${COLORS.white}TIPS:`,
        `${COLORS.gray}• Craft a Weapon Bench to make guns`,
        `${COLORS.gray}• Mine Shadow Ore to get started`,
        `${COLORS.gray}• Find abandoned structures for loot`,
        `${COLORS.gray}• Build vehicles for fast travel`,
        `${COLORS.gray}• Defeat bosses to craft the Affinity Gauntlet`,
        `${COLORS.gray}• The Final Horror awaits those who are ready`,
    ];
    for (const line of lines) {
        try { player.sendMessage(line); } catch (e) {}
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function _getHeldItem(player) {
    try {
        const eq = player.getComponent("minecraft:equippable");
        return eq?.getEquipment("Mainhand") ?? null;
    } catch (e) { return null; }
}

// ──────────────────────────────────────────────────────────────────────────────
// STARTUP MESSAGE
// ──────────────────────────────────────────────────────────────────────────────

system.runTimeout(() => {
    sendChat(`${COLORS.dark_red}${COLORS.bold}[X-Man Ascension] ${COLORS.reset}${COLORS.gray}Horror Survival v1.0.0 loaded. The darkness awaits...`);
}, 20);
