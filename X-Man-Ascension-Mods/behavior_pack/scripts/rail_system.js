import { world, system, EntityRideable } from "@minecraft/server";

const RAIL_CARTS = new Map(); // entity.id -> { type, speed, passengers }
const RAIL_OPERATORS = new Map(); // player.id -> controlledCart

export function initRailSystem() {
    // Create minecart on block place
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
        if (event.block.typeId === "xman:powered_rail") {
            event.block.setPermutation(
                event.block.permutation
                    .withState("rail_direction", 0)
                    .withState("rail_signal_state", 0)
            );
        }
    });

    // Rail Conductor Staff controls carts
    world.beforeEvents.itemUse.subscribe((event) => {
        if (event.itemStack.typeId === "xman:rail_conductor_staff") {
            const player = event.source;
            controlNearbyCart(player);
        }
    });

    // Speed Minecart - fast travel
    world.beforeEvents.itemUse.subscribe((event) => {
        if (event.itemStack.typeId === "xman:rail_cart_fast") {
            const player = event.source;
            createSpeedCart(player);
        }
    });

    // Luxury Minecart - comfortable travel
    world.beforeEvents.itemUse.subscribe((event) => {
        if (event.itemStack.typeId === "xman:rail_cart_luxury") {
            const player = event.source;
            createLuxuryCart(player);
        }
    });

    // Cart movement and acceleration
    system.runInterval(() => {
        updateCarts();
    }, 1);

    // Player input for controlled carts
    system.runInterval(() => {
        for (const [playerId, cartId] of RAIL_OPERATORS.entries()) {
            try {
                const player = world.getAllPlayers().find(p => p.id === playerId);
                const cart = world.getEntity(cartId);

                if (!player || !cart) {
                    RAIL_OPERATORS.delete(playerId);
                    continue;
                }

                // WASD controls
                const speed = 1.5;
                const direction = player.getViewDirection();

                // Forward/backward
                if (player.inputPermissions.movementW) {
                    cart.applyKnockback(
                        direction.x * speed,
                        0,
                        direction.z * speed,
                        0,
                        0
                    );
                }

                // Left/right
                const rightDir = {
                    x: -direction.z,
                    y: 0,
                    z: direction.x
                };

                if (player.inputPermissions.movementA) {
                    cart.applyKnockback(
                        -rightDir.x * speed * 0.7,
                        0,
                        -rightDir.z * speed * 0.7,
                        0,
                        0
                    );
                }

                if (player.inputPermissions.movementD) {
                    cart.applyKnockback(
                        rightDir.x * speed * 0.7,
                        0,
                        rightDir.z * speed * 0.7,
                        0,
                        0
                    );
                }
            } catch (e) {
                RAIL_OPERATORS.delete(playerId);
            }
        }
    }, 2);
}

function createSpeedCart(player) {
    try {
        const pos = player.location;
        const cart = player.dimension.spawnEntity(
            "minecraft:minecart",
            { x: pos.x, y: pos.y + 1, z: pos.z }
        );

        if (cart) {
            RAIL_CARTS.set(cart.id, {
                type: "speed",
                speed: 2.5,
                maxSpeed: 4.0
            });

            player.sendMessage("§a⚡ Speed Minecart created!");
            player.sendMessage("§7Use Rail Conductor Staff to control it");
        }
    } catch (e) {
        player.sendMessage("§cFailed to create cart");
    }
}

function createLuxuryCart(player) {
    try {
        const pos = player.location;
        const cart = player.dimension.spawnEntity(
            "minecraft:minecart_with_chest",
            { x: pos.x, y: pos.y + 1, z: pos.z }
        );

        if (cart) {
            RAIL_CARTS.set(cart.id, {
                type: "luxury",
                speed: 1.8,
                maxSpeed: 3.0,
                capacity: 10 // Can carry more items
            });

            player.sendMessage("§b🚂 Luxury Minecart created!");
            player.sendMessage("§7Travel in style with storage!");
        }
    } catch (e) {
        player.sendMessage("§cFailed to create cart");
    }
}

function controlNearbyCart(player) {
    const pos = player.location;
    const dimension = player.dimension;

    try {
        // Find nearest minecart within 10 blocks
        const entities = dimension.getEntities({
            location: pos,
            maxDistance: 10,
            type: "minecraft:minecart"
        });

        if (entities.length > 0) {
            const cart = entities[0];
            RAIL_OPERATORS.set(player.id, cart.id);

            player.sendMessage("§6🎮 Controlling cart!");
            player.sendMessage("§7Use WASD to move, Sneak to exit");

            // Exit control with sneak
            const checkExit = system.runInterval(() => {
                if (player.isSneaking) {
                    RAIL_OPERATORS.delete(player.id);
                    player.sendMessage("§cCart control released");
                    system.clearRun(checkExit);
                }
            }, 5);
        } else {
            player.sendMessage("§cNo minecart nearby!");
        }
    } catch (e) {
        player.sendMessage("§cError controlling cart");
    }
}

function updateCarts() {
    for (const [cartId, cartData] of RAIL_CARTS.entries()) {
        try {
            const cart = world.getEntity(cartId);
            if (!cart) {
                RAIL_CARTS.delete(cartId);
                continue;
            }

            // Apply speed boost based on cart type
            if (cartData.type === "speed") {
                const vel = cart.getVelocity();
                const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

                if (speed < cartData.maxSpeed) {
                    cart.applyKnockback(
                        vel.x * 0.02,
                        0,
                        vel.z * 0.02,
                        0,
                        0
                    );
                }
            }

            // Particles for moving carts
            if (cart.getVelocity().length > 0.1) {
                cart.dimension.spawnParticle(
                    "minecraft:redstone",
                    cart.location,
                    { velocity: { x: 0, y: 0.05, z: 0 } }
                );
            }
        } catch (e) {
            RAIL_CARTS.delete(cartId);
        }
    }
}
