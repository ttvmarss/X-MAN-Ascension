import { world, system } from "@minecraft/server";

/** Variety-style ambient life: glow beetles, biome particles, passive mob sparkles. */
const PASSIVE_MOBS = new Set([
  "knws:glow_beetle",
  "knws:variety_deer",
  "knws:crystal_sprite",
]);

const BIOME_PARTICLES = {
  "knws:cursed_forest": "minecraft:spore_blossom_shower_particle",
  "knws:blood_marsh": "minecraft:dripping_dripstone_water_particle",
  "knws:horror_wastes": "minecraft:basic_smoke_particle",
  "knws:crystal_caverns": "minecraft:villager_happy",
};

export function registerVarietySystem() {
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      tickVarietyAmbience(player);
    }
  }, 30);

  world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (PASSIVE_MOBS.has(entity.typeId)) {
      const names = {
        "knws:glow_beetle": "§eGlow Beetle",
        "knws:variety_deer": "§2Variety Deer",
        "knws:crystal_sprite": "§bCrystal Sprite",
      };
      entity.nameTag = names[entity.typeId] ?? entity.nameTag;
    }
  });
}

function tickVarietyAmbience(player) {
  if (player.dimension.id !== "minecraft:overworld") return;

  const loc = player.location;

  for (const entity of player.dimension.getEntities({ location: loc, maxDistance: 24, families: ["knws_passive"] })) {
    if (system.currentTick % 60 === 0) {
      try {
        entity.dimension.spawnParticle("minecraft:end_rod", {
          x: entity.location.x,
          y: entity.location.y + 0.6,
          z: entity.location.z,
        });
      } catch (_) {}
    }
  }

  if (system.currentTick % 45 !== 0) return;

  try {
    const biome = player.dimension.getBiome?.(loc);
    const biomeId = biome?.id ?? "";
    for (const [tag, particle] of Object.entries(BIOME_PARTICLES)) {
      if (biomeId.includes(tag.split(":")[1])) {
        player.dimension.spawnParticle(particle, {
          x: loc.x + (Math.random() - 0.5) * 6,
          y: loc.y + 2,
          z: loc.z + (Math.random() - 0.5) * 6,
        });
        break;
      }
    }
  } catch (_) {}
}
