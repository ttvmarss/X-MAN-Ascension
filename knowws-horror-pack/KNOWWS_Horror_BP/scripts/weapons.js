import { world, system } from "@minecraft/server";

const WEAPON_CONFIG = {
  "knws:pistol": { damage: 10, cooldown: 8, ammo: "knws:pistol_ammo", sound: "random.bow", spread: 0.03, range: 40, pellets: 1 },
  "knws:revolver": { damage: 14, cooldown: 12, ammo: "knws:pistol_ammo", sound: "random.bow", spread: 0.02, range: 35, pellets: 1 },
  "knws:shotgun": { damage: 8, cooldown: 18, ammo: "knws:shotgun_shells", sound: "random.explode", spread: 0.18, range: 18, pellets: 6 },
  "knws:assault_rifle": { damage: 7, cooldown: 3, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0.06, range: 55, pellets: 1 },
  "knws:smg": { damage: 5, cooldown: 2, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0.1, range: 30, pellets: 1 },
  "knws:sniper_rifle": { damage: 28, cooldown: 35, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0, range: 80, pellets: 1 },
  "knws:minigun": { damage: 4, cooldown: 1, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0.12, range: 45, pellets: 1 },
  "knws:flamethrower": { damage: 5, cooldown: 2, ammo: "knws:rifle_ammo", sound: "fire.fire", spread: 0.25, range: 12, pellets: 3, fire: true },
  "knws:rpg": { damage: 35, cooldown: 40, ammo: "knws:rocket", sound: "random.explode", spread: 0, range: 60, pellets: 1, explosive: true },
  "knws:plague_cannon": { damage: 20, cooldown: 22, ammo: "knws:rifle_ammo", sound: "random.explode", spread: 0.08, range: 35, pellets: 1, poison: true },
};

const MELEE_CONFIG = {
  "knws:silver_sword": { damage: 12, cooldown: 8, range: 3.5 },
  "knws:holy_mace": { damage: 16, cooldown: 14, range: 3, holy: true },
  "knws:chainsaw": { damage: 10, cooldown: 4, range: 2.5, multi: true },
  "knws:combat_knife": { damage: 8, cooldown: 5, range: 2.5 },
  "knws:cursed_blade": { damage: 14, cooldown: 7, range: 3.5, curse: true },
  "knws:nightmare_scythe": { damage: 18, cooldown: 10, range: 4, sweep: true },
  "knws:crossbow_silver": { damage: 11, cooldown: 15, range: 50, ammo: "knws:pistol_ammo" },
};

const cooldowns = new Map();
const GUN_IDS = new Set(Object.keys(WEAPON_CONFIG));

export function registerWeapons(registry) {
  for (const [id, cfg] of Object.entries(WEAPON_CONFIG)) {
    const short = id.split(":")[1];
    registry.registerCustomComponent(`knws:${short}_fire`, {
      onUse: (event) => handleGunUse(event, id, cfg),
    });
  }
  for (const [id, cfg] of Object.entries(MELEE_CONFIG)) {
    const short = id.split(":")[1];
    if (cfg.ammo) {
      registry.registerCustomComponent(`knws:${short}_fire`, {
        onUse: (event) => handleGunUse(event, id, cfg),
      });
    } else {
      registry.registerCustomComponent(`knws:${short}_melee`, {
        onUse: (event) => handleMeleeSwing(event, id, cfg),
        onHitEntity: (event) => handleMeleeHit(event, id, cfg),
      });
    }
  }
}

function getCooldownKey(player, itemId) {
  return `${player.id}:${itemId}`;
}

function isOnCooldown(player, itemId, ticks) {
  const key = getCooldownKey(player, itemId);
  const until = cooldowns.get(key) ?? 0;
  if (system.currentTick < until) return true;
  cooldowns.set(key, system.currentTick + ticks);
  return false;
}

function consumeAmmo(player, ammoId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return false;
  for (let i = 0; i < inv.size; i++) {
    const stack = inv.getItem(i);
    if (stack?.typeId === ammoId) {
      if (stack.amount > 1) {
        stack.amount -= 1;
        inv.setItem(i, stack);
      } else {
        inv.setItem(i, undefined);
      }
      return true;
    }
  }
  return false;
}

function getAimDirection(player, spread) {
  const v = player.getViewDirection();
  if (!spread) return v;
  return {
    x: v.x + (Math.random() - 0.5) * spread,
    y: v.y + (Math.random() - 0.5) * spread,
    z: v.z + (Math.random() - 0.5) * spread,
  };
}

function getHeadLocation(player) {
  const loc = player.location;
  return { x: loc.x, y: loc.y + 1.62, z: loc.z };
}

function hitscan(player, cfg) {
  const dim = player.dimension;
  const origin = getHeadLocation(player);
  const pellets = cfg.pellets ?? 1;
  let hitCount = 0;

  for (let p = 0; p < pellets; p++) {
    const dir = getAimDirection(player, cfg.spread);
    const maxDist = cfg.range ?? 50;

    try {
      const hits = dim.getEntitiesFromRay({
        position: origin,
        direction: dir,
        maxDistance: maxDist,
        excludeTypes: ["minecraft:item", "minecraft:xp_orb"],
      });

      for (const hit of hits) {
        const entity = hit.entity;
        if (!entity || entity.id === player.id) continue;
        if (entity.typeId === "minecraft:player") continue;

        entity.applyDamage(cfg.damage, { cause: "projectile", damagingEntity: player });
        hitCount++;

        if (cfg.fire) entity.setOnFire(4);
        if (cfg.poison) {
          try { entity.addEffect("poison", 80, { amplifier: 1 }); } catch (_) {}
        }
        if (cfg.explosive) {
          dim.spawnParticle("minecraft:huge_explosion_emitter", entity.location);
          try {
            dim.createExplosion(entity.location, 2, { breaksBlocks: false, causesFire: false, source: player });
          } catch (_) {}
        }

        dim.spawnParticle("minecraft:crit_particle", {
          x: entity.location.x,
          y: entity.location.y + 1,
          z: entity.location.z,
        });
        break;
      }

      const end = {
        x: origin.x + dir.x * maxDist,
        y: origin.y + dir.y * maxDist,
        z: origin.z + dir.z * maxDist,
      };
      dim.spawnParticle("minecraft:basic_smoke_particle", {
        x: origin.x + dir.x * 1.5,
        y: origin.y + dir.y * 1.5,
        z: origin.z + dir.z * 1.5,
      });
      dim.spawnParticle("minecraft:crit_particle", end);
    } catch (_) {
      // Fallback: damage nearest entity in cone
      const nearby = dim.getEntities({
        location: origin,
        maxDistance: maxDist,
        excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:player"],
      });
      for (const entity of nearby) {
        const dx = entity.location.x - origin.x;
        const dy = entity.location.y - origin.y;
        const dz = entity.location.z - origin.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1) continue;
        const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / dist;
        if (dot > 0.85) {
          entity.applyDamage(cfg.damage, { cause: "projectile", damagingEntity: player });
          hitCount++;
          break;
        }
      }
    }
  }

  return hitCount;
}

function handleGunUse(event, itemId, cfg) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player") return;
  if (isOnCooldown(player, itemId, cfg.cooldown)) return;

  const ammo = cfg.ammo ?? "knws:pistol_ammo";
  if (!consumeAmmo(player, ammo)) {
    player.onScreenDisplay.setActionBar("§c§lOUT OF AMMO! §7Craft ammo at a crafting table.");
    player.playSound("random.break", { volume: 0.8 });
    return;
  }

  const hits = hitscan(player, cfg);
  player.playSound(cfg.sound, { volume: 1.2, pitch: 0.75 + Math.random() * 0.5 });

  if (itemId === "knws:shotgun") {
    player.applyKnockback(player.getViewDirection().x * -0.2, player.getViewDirection().z * -0.2, 0.3);
  }

  player.onScreenDisplay.setActionBar(hits > 0 ? `§c§lHIT! §7(${hits} target${hits > 1 ? "s" : ""})` : "§8*shot fired*");
}

function handleMeleeSwing(event, itemId, cfg) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player") return;
  if (isOnCooldown(player, itemId, cfg.cooldown)) return;

  const dim = player.dimension;
  const loc = player.location;
  const range = cfg.range ?? 3;

  const targets = dim.getEntities({
    location: loc,
    maxDistance: range,
    excludeTypes: ["minecraft:item", "minecraft:xp_orb", "minecraft:player"],
  });

  let hit = 0;
  for (const entity of targets) {
    entity.applyDamage(cfg.damage, { cause: "entityAttack", damagingEntity: player });
    hit++;
    if (cfg.holy) { entity.setOnFire(3); dim.spawnParticle("minecraft:witch_spell_particle", entity.location); }
    if (cfg.curse) dim.spawnParticle("minecraft:dragon_breath_trail", entity.location);
    if (cfg.multi) entity.applyDamage(6, { cause: "entityAttack", damagingEntity: player });
    if (!cfg.sweep && hit >= 1) break;
  }

  player.playSound("item.trident.riptide_1", { volume: 0.8, pitch: 0.9 + Math.random() * 0.3 });
  if (itemId === "knws:chainsaw") player.playSound("mob.zombie.woodbreak", { volume: 1.0 });
}

function handleMeleeHit(event, itemId, cfg) {
  const player = event.attackingEntity;
  const target = event.hitEntity;
  if (!player || !target) return;
  try {
    target.applyDamage(cfg.damage, { cause: "entityAttack", damagingEntity: player });
    if (cfg.holy) target.setOnFire(3);
  } catch (_) {}
}
