import { world, system, EquipmentSlot } from "@minecraft/server";

/** Real dynamic lighting — places invisible light blocks when holding a torch. */
const TORCH_ITEMS = new Set([
  "minecraft:torch",
  "minecraft:soul_torch",
  "knws:glow_torch",
  "knws:cave_lantern",
  "knws:soul_flame_torch",
]);

const LIGHT_LEVELS = {
  "minecraft:torch": 14,
  "minecraft:soul_torch": 10,
  "knws:glow_torch": 15,
  "knws:cave_lantern": 15,
  "knws:soul_flame_torch": 12,
};

const playerLights = new Map();

function lightBlockId(level) {
  const clamped = Math.max(0, Math.min(15, Math.floor(level)));
  return `minecraft:light_block_${clamped}`;
}

function getHeldTorch(player) {
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) return null;

  const offhand = equippable.getEquipment(EquipmentSlot.Offhand);
  if (offhand && TORCH_ITEMS.has(offhand.typeId)) {
    return { item: offhand.typeId, slot: "offhand" };
  }

  const mainhand = equippable.getEquipment(EquipmentSlot.Mainhand);
  if (mainhand && TORCH_ITEMS.has(mainhand.typeId)) {
    return { item: mainhand.typeId, slot: "mainhand" };
  }

  return null;
}

function clearPlayerLights(playerId) {
  const stored = playerLights.get(playerId);
  if (!stored) return;

  for (const entry of stored) {
    try {
      const block = entry.dimension.getBlock(entry.pos);
      if (block?.typeId.startsWith("minecraft:light_block")) {
        block.setType("minecraft:air");
      }
    } catch (_) {}
  }
  playerLights.delete(playerId);
}

function canPlaceLight(dimension, pos) {
  try {
    const block = dimension.getBlock(pos);
    if (!block) return false;
    const id = block.typeId;
    return id === "minecraft:air" || id.startsWith("minecraft:light_block");
  } catch (_) {
    return false;
  }
}

function placeLight(dimension, pos, level, placed) {
  if (!canPlaceLight(dimension, pos)) return;
  try {
    dimension.setBlockType(pos, lightBlockId(level));
    placed.push({ dimension, pos: { x: pos.x, y: pos.y, z: pos.z } });
  } catch (_) {}
}

function spawnTorchParticles(player, slot) {
  const loc = player.location;
  const view = player.getViewDirection();
  const particlePos = {
    x: loc.x + (slot === "offhand" ? -view.z * 0.4 : view.x * 0.5),
    y: loc.y + 1.2,
    z: loc.z + (slot === "offhand" ? view.x * 0.4 : view.z * 0.5),
  };

  try {
    player.dimension.spawnParticle("minecraft:basic_flame_particle", particlePos);
    if (slot === "offhand") {
      player.dimension.spawnParticle("minecraft:end_rod", {
        x: particlePos.x,
        y: particlePos.y + 0.15,
        z: particlePos.z,
      });
    }
  } catch (_) {}
}

function updatePlayerTorchLight(player) {
  const torch = getHeldTorch(player);
  clearPlayerLights(player.id);

  if (!torch) return;

  const level = LIGHT_LEVELS[torch.item] ?? 14;
  const dim = player.dimension;
  const loc = player.location;
  const view = player.getViewDirection();
  const placed = [];

  const offsets = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: Math.round(view.x), y: 1, z: Math.round(view.z) },
    { x: Math.round(-view.z * 0.5), y: 1, z: Math.round(view.x * 0.5) },
    { x: Math.round(view.z * 0.5), y: 1, z: Math.round(-view.x * 0.5) },
  ];

  if (torch.slot === "offhand") {
    offsets.push({ x: Math.round(-view.z), y: 1, z: Math.round(view.x) });
    offsets.push({ x: Math.round(-view.z), y: 2, z: Math.round(view.x) });
  }

  for (const off of offsets) {
    placeLight(dim, {
      x: Math.floor(loc.x) + off.x,
      y: Math.floor(loc.y) + off.y,
      z: Math.floor(loc.z) + off.z,
    }, level, placed);
  }

  playerLights.set(player.id, placed);
  spawnTorchParticles(player, torch.slot);
}

export function registerTorchLighting() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      updatePlayerTorchLight(player);
    }
  }, 5);

  world.afterEvents.playerLeave.subscribe((event) => {
    clearPlayerLights(event.playerId);
  });

  console.warn("[KNOWWS] Off-hand torch lighting active.");
}
