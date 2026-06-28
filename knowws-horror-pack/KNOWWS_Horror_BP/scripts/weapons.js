import { world, system } from "@minecraft/server";

const WEAPON_CONFIG = {
  "knws:pistol": { damage: 8, cooldown: 8, ammo: "knws:pistol_ammo", sound: "random.bow", spread: 0.02, projectile: "minecraft:arrow" },
  "knws:shotgun": { damage: 14, cooldown: 20, ammo: "knws:shotgun_shells", sound: "random.explode", spread: 0.15, pellets: 5, projectile: "minecraft:arrow" },
  "knws:assault_rifle": { damage: 6, cooldown: 4, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0.05, projectile: "minecraft:arrow" },
  "knws:sniper_rifle": { damage: 25, cooldown: 30, ammo: "knws:rifle_ammo", sound: "random.bow", spread: 0.0, projectile: "minecraft:arrow" },
  "knws:flamethrower": { damage: 4, cooldown: 2, ammo: "knws:rifle_ammo", sound: "fire.fire", spread: 0.2, projectile: "minecraft:small_fireball" },
};

const MELEE_CONFIG = {
  "knws:silver_sword": { damage: 10, cooldown: 10 },
  "knws:holy_mace": { damage: 14, cooldown: 15 },
  "knws:chainsaw": { damage: 8, cooldown: 5 },
  "knws:combat_knife": { damage: 6, cooldown: 6 },
};

const cooldowns = new Map();

export function registerWeapons(registry) {
  for (const [id, cfg] of Object.entries(WEAPON_CONFIG)) {
    registry.registerCustomComponent(`knws:${id.split(":")[1]}_fire`, {
      onUse: (event) => handleGunUse(event, id, cfg),
    });
  }
  for (const [id, cfg] of Object.entries(MELEE_CONFIG)) {
    registry.registerCustomComponent(`knws:${id.split(":")[1]}_melee`, {
      onUse: (event) => handleMeleeUse(event, id, cfg),
      onHitEntity: (event) => handleMeleeHit(event, id, cfg),
    });
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

function fireProjectile(player, cfg) {
  const view = player.getViewDirection();
  const loc = player.location;
  const dim = player.dimension;
  const spread = cfg.spread ?? 0;
  const pellets = cfg.pellets ?? 1;

  for (let p = 0; p < pellets; p++) {
    const sx = (Math.random() - 0.5) * spread;
    const sy = (Math.random() - 0.5) * spread;
    const sz = (Math.random() - 0.5) * spread;
    const vel = {
      x: (view.x + sx) * 3,
      y: (view.y + sy) * 3,
      z: (view.z + sz) * 3,
    };
    try {
      const proj = dim.spawnEntity(cfg.projectile, {
        x: loc.x + view.x,
        y: loc.y + 1.6 + view.y,
        z: loc.z + view.z,
      });
      const projectile = proj.getComponent("minecraft:projectile");
      if (projectile) {
        projectile.owner = player;
        projectile.shoot(vel);
      }
      proj.applyDamage?.(cfg.damage);
    } catch (_) {
      // fallback particle burst
      dim.spawnParticle("minecraft:crit_particle", {
        x: loc.x + view.x * 2,
        y: loc.y + 1.6,
        z: loc.z + view.z * 2,
      });
    }
  }
  player.playSound(cfg.sound, { volume: 1.0, pitch: 0.8 + Math.random() * 0.4 });
}

function handleGunUse(event, itemId, cfg) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player") return;
  if (isOnCooldown(player, itemId, cfg.cooldown)) return;
  if (!consumeAmmo(player, cfg.ammo)) {
    player.onScreenDisplay.setActionBar("§cOut of ammo!");
    player.playSound("random.break", { volume: 0.5 });
    return;
  }
  fireProjectile(player, cfg);
}

function handleMeleeUse(event, itemId, cfg) {
  const player = event.source;
  if (!player || player.typeId !== "minecraft:player") return;
  if (isOnCooldown(player, itemId, cfg.cooldown)) return;
  player.playSound("item.trident.riptide_1", { volume: 0.6, pitch: 1.2 });
}

function handleMeleeHit(event, itemId, cfg) {
  const player = event.attackingEntity;
  const target = event.hitEntity;
  if (!player || !target) return;
  try {
    target.applyDamage(cfg.damage, { cause: "entityAttack", damagingEntity: player });
    if (itemId === "knws:silver_sword" || itemId === "knws:holy_mace") {
      target.setOnFire(3);
      target.dimension.spawnParticle("minecraft:witch_spell_particle", target.location);
    }
    if (itemId === "knws:chainsaw") {
      target.applyDamage(4, { cause: "entityAttack", damagingEntity: player });
      player.playSound("mob.zombie.woodbreak", { volume: 0.8 });
    }
  } catch (_) {}
}
