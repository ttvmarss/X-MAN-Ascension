import { world, system, Player } from "@minecraft/server";

const XRAY_ENABLED = new Map(); // player.id -> boolean
const ORE_TYPES = [
    "diamond_ore", "emerald_ore", "gold_ore", "iron_ore", "redstone_ore",
    "lapis_ore", "copper_ore", "ancient_debris", "deepslate_diamond_ore",
    "xman:shadow_ore", "xman:bloodstone_ore", "xman:titanium_ore",
    "xman:void_ore", "xman:infernal_ore", "xman:mutant_crystal_ore"
];

export function initXRaySystem() {
    // Toggle X-ray on item use
    world.beforeEvents.itemUse.subscribe((event) => {
        if (event.itemStack.typeId === "xman:xray_goggles") {
            const player = event.source;
            const playerId = player.id;
            const isEnabled = XRAY_ENABLED.get(playerId) || false;
            XRAY_ENABLED.set(playerId, !isEnabled);

            player.sendMessage(
                !isEnabled
                    ? "§6X-Ray ON §7- See ores through blocks!"
                    : "§6X-Ray OFF"
            );
        }
    });

    // Ore scanner shows nearby ores
    world.beforeEvents.itemUse.subscribe((event) => {
        if (event.itemStack.typeId === "xman:ore_scanner") {
            const player = event.source;
            scanNearbyOres(player);
        }
    });

    // Continuous highlighting for X-ray goggles
    system.runInterval(() => {
        for (const player of world.getAllPlayers()) {
            if (XRAY_ENABLED.get(player.id)) {
                highlightNearbyOres(player);
            }
        }
    }, 20);
}

function highlightNearbyOres(player) {
    const pos = player.location;
    const radius = 30;

    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                try {
                    const blockPos = { x: pos.x + x, y: pos.y + y, z: pos.z + z };
                    const block = player.dimension.getBlock(blockPos);

                    if (block && ORE_TYPES.includes(block.typeId)) {
                        // Particle effect on ore
                        player.dimension.spawnParticle("minecraft:redstone", blockPos, {
                            velocity: { x: 0, y: 0.1, z: 0 }
                        });
                    }
                } catch (e) {
                    // Block doesn't exist
                }
            }
        }
    }
}

function scanNearbyOres(player) {
    const pos = player.location;
    const radius = 50;
    const oreCount = {};

    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            for (let z = -radius; z <= radius; z++) {
                try {
                    const blockPos = { x: pos.x + x, y: pos.y + y, z: pos.z + z };
                    const block = player.dimension.getBlock(blockPos);

                    if (block && ORE_TYPES.includes(block.typeId)) {
                        oreCount[block.typeId] = (oreCount[block.typeId] || 0) + 1;
                    }
                } catch (e) {
                    // Block doesn't exist
                }
            }
        }
    }

    // Report scan results
    player.sendMessage("§6=== ORE SCAN RESULTS ===");
    let found = false;
    for (const [oreType, count] of Object.entries(oreCount)) {
        if (count > 0) {
            player.sendMessage(`§7${oreType}: §a${count} blocks`);
            found = true;
        }
    }
    if (!found) {
        player.sendMessage("§cNo ores found nearby");
    }
}
