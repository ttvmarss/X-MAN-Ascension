import { world, system } from "@minecraft/server";

/** Improves cave visibility with ambient light + subtle night vision underground. */
const AMBIENT_LIGHT_LEVEL = 9;
const playerAmbientLights = new Map();

function isUnderground(player) {
  const loc = player.location;
  if (loc.y > 62) return false;

  const dim = player.dimension;
  for (let dy = 1; dy <= 6; dy++) {
    try {
      const above = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) + dy, z: Math.floor(loc.z) });
      if (!above) continue;
      if (above.typeId === "minecraft:air" || above.typeId === "minecraft:cave_air") {
        return false;
      }
    } catch (_) {
      return false;
    }
  }
  return loc.y < 58;
}

function getSurroundingLightLevel(player) {
  const dim = player.dimension;
  const loc = player.location;
  let darkest = 15;

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        try {
          const block = dim.getBlock({
            x: Math.floor(loc.x) + dx,
            y: Math.floor(loc.y) + dy,
            z: Math.floor(loc.z) + dz,
          });
          if (block) {
            const light = block.getLightLevel?.() ?? 0;
            if (light < darkest) darkest = light;
          }
        } catch (_) {}
      }
    }
  }
  return darkest;
}

function clearAmbientLight(playerId) {
  const stored = playerAmbientLights.get(playerId);
  if (!stored) return;
  try {
    const block = stored.dimension.getBlock(stored.pos);
    if (block?.typeId.startsWith("minecraft:light_block")) {
      block.setType("minecraft:air");
    }
  } catch (_) {}
  playerAmbientLights.delete(playerId);
}

function applyCaveBrightness(player) {
  if (player.dimension.id !== "minecraft:overworld") {
    clearAmbientLight(player.id);
    return;
  }

  if (!isUnderground(player)) {
    clearAmbientLight(player.id);
    return;
  }

  const lightLevel = getSurroundingLightLevel(player);

  if (lightLevel <= 5) {
    try {
      player.addEffect("night_vision", 12, { amplifier: 0, showParticles: false });
    } catch (_) {}
  }

  if (lightLevel <= 3) {
    const loc = player.location;
    const pos = {
      x: Math.floor(loc.x),
      y: Math.floor(loc.y) + 1,
      z: Math.floor(loc.z),
    };
    clearAmbientLight(player.id);
    try {
      const block = player.dimension.getBlock(pos);
      if (block && (block.typeId === "minecraft:air" || block.typeId.startsWith("minecraft:light_block"))) {
        player.dimension.setBlockType(pos, `minecraft:light_block_${AMBIENT_LIGHT_LEVEL}`);
        playerAmbientLights.set(player.id, { dimension: player.dimension, pos });
      }
    } catch (_) {}
  } else {
    clearAmbientLight(player.id);
  }
}

export function registerCaveBrightness() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      applyCaveBrightness(player);
    }
  }, 15);

  world.afterEvents.playerLeave.subscribe((event) => {
    clearAmbientLight(event.playerId);
  });

  console.warn("[KNOWWS] Enhanced cave brightness active.");
}
