import { world, system, Player } from "@minecraft/server";

export function vec3Add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v, s) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Len(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Dist(a, b) {
    return vec3Len(vec3Sub(a, b));
}

export function vec3Norm(v) {
    const len = vec3Len(v);
    if (len === 0) return { x: 0, y: 0, z: 0 };
    return vec3Scale(v, 1 / len);
}

export function getAllPlayers() {
    return world.getAllPlayers();
}

export function getNearestPlayer(pos, dimension) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const player of world.getAllPlayers()) {
        if (player.dimension.id !== dimension.id) continue;
        const d = vec3Dist(pos, player.location);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = player;
        }
    }
    return { player: nearest, dist: nearestDist };
}

export function getPlayersInRadius(pos, radius, dimension) {
    return world.getAllPlayers().filter(p =>
        p.dimension.id === dimension.id && vec3Dist(pos, p.location) <= radius
    );
}

export function playSound(entity, soundId, volume = 1.0, pitch = 1.0) {
    try {
        entity.runCommandAsync(`playsound ${soundId} @s ~ ~ ~ ${volume} ${pitch}`);
    } catch (e) {}
}

export function playSoundAt(dimension, pos, soundId, volume = 1.0, pitch = 1.0) {
    try {
        dimension.runCommandAsync(`playsound ${soundId} @a[r=${Math.ceil(volume * 16)}] ${pos.x} ${pos.y} ${pos.z} ${volume} ${pitch}`);
    } catch (e) {}
}

export function spawnParticle(dimension, pos, particleId) {
    try {
        dimension.spawnParticle(particleId, pos);
    } catch (e) {}
}

export function applyEffect(entity, effectId, duration, amplifier = 0, showParticles = false) {
    try {
        entity.runCommandAsync(`effect @s ${effectId} ${duration} ${amplifier} ${showParticles ? "false" : "true"}`);
    } catch (e) {}
}

export function removeEffect(entity, effectId) {
    try {
        entity.runCommandAsync(`effect @s ${effectId} 0 0`);
    } catch (e) {}
}

export function getInventory(player) {
    return player.getComponent("minecraft:inventory")?.container;
}

export function countItemInInventory(player, typeId) {
    const inv = getInventory(player);
    if (!inv) return 0;
    let count = 0;
    for (let i = 0; i < inv.size; i++) {
        const item = inv.getItem(i);
        if (item && item.typeId === typeId) count += item.amount;
    }
    return count;
}

export function removeItemFromInventory(player, typeId, amount) {
    const inv = getInventory(player);
    if (!inv) return false;
    let remaining = amount;
    for (let i = 0; i < inv.size && remaining > 0; i++) {
        const item = inv.getItem(i);
        if (!item || item.typeId !== typeId) continue;
        if (item.amount <= remaining) {
            remaining -= item.amount;
            inv.setItem(i, undefined);
        } else {
            item.amount -= remaining;
            inv.setItem(i, item);
            remaining = 0;
        }
    }
    return remaining === 0;
}

export function giveItem(player, typeId, amount = 1) {
    try {
        player.runCommandAsync(`give @s ${typeId} ${amount}`);
    } catch (e) {}
}

export function getDynamicProp(entity, key, defaultVal = 0) {
    try {
        const v = entity.getDynamicProperty(`xman:${key}`);
        return v !== undefined ? v : defaultVal;
    } catch (e) { return defaultVal; }
}

export function setDynamicProp(entity, key, value) {
    try {
        entity.setDynamicProperty(`xman:${key}`, value);
    } catch (e) {}
}

export function sendTitle(player, title, subtitle = "", fadeIn = 10, stay = 40, fadeOut = 10) {
    try {
        player.runCommandAsync(`titleraw @s times ${fadeIn} ${stay} ${fadeOut}`);
        player.runCommandAsync(`titleraw @s subtitle {"rawtext":[{"text":"${subtitle}"}]}`);
        player.runCommandAsync(`titleraw @s title {"rawtext":[{"text":"${title}"}]}`);
    } catch (e) {}
}

export function sendActionbar(player, message) {
    try {
        player.onScreenDisplay.setActionBar(message);
    } catch (e) {}
}

export function sendChat(message) {
    world.sendMessage(message);
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
}

export function chance(percent) {
    return Math.random() * 100 < percent;
}

export function scheduleRun(callback, ticks) {
    return system.runTimeout(callback, ticks);
}

export function scheduleRepeat(callback, ticks) {
    return system.runInterval(callback, ticks);
}

export function getEquipment(player) {
    return player.getComponent("minecraft:equippable");
}

export function getHeldItem(player) {
    try {
        const eq = getEquipment(player);
        return eq?.getEquipment("Mainhand");
    } catch (e) { return null; }
}

export function getArmorItem(player, slot) {
    try {
        const eq = getEquipment(player);
        return eq?.getEquipment(slot);
    } catch (e) { return null; }
}

export function isNight(dimension) {
    try {
        const time = (world.getTimeOfDay()) % 24000;
        return time >= 13000 && time <= 23000;
    } catch (e) { return false; }
}

export function formatNumber(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
}

export const XMAN_NS = "xman";

export const COLORS = {
    red: "§c",
    dark_red: "§4",
    gold: "§6",
    yellow: "§e",
    green: "§a",
    dark_green: "§2",
    aqua: "§b",
    dark_aqua: "§3",
    blue: "§9",
    dark_blue: "§1",
    light_purple: "§d",
    dark_purple: "§5",
    white: "§f",
    gray: "§7",
    dark_gray: "§8",
    black: "§0",
    reset: "§r",
    bold: "§l",
    italic: "§o",
};
