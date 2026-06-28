import { world, system } from "@minecraft/server";
import {
  PHASES,
  PHASE_NAMES,
  getPhaseResponse,
  PHASE_AMBIENT,
  TRANSFORM_LINES,
} from "./verity_dialogue.js";

const PROP_PHASE = "knws:verity_phase";
const PROP_DAYS = "knws:verity_days";
const PROP_OWNER = "knws:verity_owner";
const PROP_SPAWNED = "knws:verity_spawned";
const PROP_ANGER = "knws:verity_anger";
const PROP_LAST_DAY = "knws:verity_last_day";
const PROP_TRANSFORMED = "knws:verity_transformed";

const TICKS_PER_DAY = 24000;
const PHASE_DAY_THRESHOLDS = [0, 2, 4, 6, 9];

let verityEntityId = null;

export function registerVeritySystem() {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    const player = event.player;
    system.runTimeout(() => spawnMysteryBox(player), 40);
    if (!world.getDynamicProperty(PROP_SPAWNED)) {
      player.sendMessage("§8§o[A strange box appeared nearby...]");
      player.sendMessage("§7Break the §6mystery box §7to meet your new companion.");
    }
  });

  world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message;
    const lower = msg.toLowerCase();
    if (!lower.startsWith("verity") && !lower.startsWith("hey verity")) return;

    const player = event.sender;
    const question = lower.replace(/^hey\s+verity\s*/i, "").replace(/^verity\s*/i, "").trim();
    handleVerityChat(player, question || "hello");
    event.cancel = true;
  });

  world.afterEvents.entityHitEntity.subscribe((event) => {
    if (event.hitEntity.typeId === "knws:verity") {
      addAnger(15);
      const owner = getOwnerPlayer();
      if (owner) {
        owner.sendMessage("§cVerity §7» §4That hurt... why would you do that?");
        owner.playSound("mob.endermen.scream", { volume: 0.5, pitch: 0.6 });
      }
    }
  });

  world.afterEvents.playerBreakBlock.subscribe((event) => {
    if (event.brokenBlockPermutation.type.id === "knws:verity_box") {
      releaseVerity(event.player);
    }
  });

  system.runInterval(() => tickVerity(), 20);
  system.runInterval(() => tickDayProgression(), 100);
  system.runInterval(() => tickAmbient(), 200);

  console.warn("[KNOWWS] Verity companion system loaded (5-phase horror).");
}

function getPhase() {
  return world.getDynamicProperty(PROP_PHASE) ?? 0;
}

function setPhase(phase) {
  world.setDynamicProperty(PROP_PHASE, phase);
  const verity = getVerityEntity();
  if (verity?.isValid()) {
    try {
      verity.setProperty("knws:phase", Math.min(phase, 3));
      verity.triggerEvent(`knws:phase_${Math.min(phase, 3)}`);
      updateVerityName(verity, phase);
    } catch (_) {}
  }
}

function updateVerityName(entity, phase) {
  const names = [
    "§e§lVerity §7» §fYour Helper :)",
    "§6§lVerity §7» §eYour Bestie!",
    "§d§lVerity §7» §8...",
    "§4§lVerity §7» §c:) §4",
  ];
  entity.nameTag = names[Math.min(phase, 3)] ?? names[0];
}

function getOwnerPlayer() {
  const ownerId = world.getDynamicProperty(PROP_OWNER);
  if (!ownerId) return world.getPlayers()[0];
  return world.getPlayers().find((p) => p.id === ownerId);
}

function getVerityEntity() {
  if (verityEntityId) {
    const entities = world.getDimension("overworld").getEntities({ type: "knws:verity" });
    return entities.find((e) => e.id === verityEntityId) ?? entities[0];
  }
  return world.getDimension("overworld").getEntities({ type: "knws:verity" })[0];
}

function spawnMysteryBox(player) {
  if (world.getDynamicProperty(PROP_SPAWNED)) return;
  const loc = player.location;
  const dim = player.dimension;
  const boxPos = { x: Math.floor(loc.x) + 2, y: Math.floor(loc.y), z: Math.floor(loc.z) + 1 };
  try {
    dim.setBlockType(boxPos, "knws:verity_box");
    dim.spawnParticle("minecraft:end_rod", { x: boxPos.x + 0.5, y: boxPos.y + 1.2, z: boxPos.z + 0.5 });
  } catch (_) {}
}

function releaseVerity(player) {
  if (world.getDynamicProperty(PROP_SPAWNED)) return;
  world.setDynamicProperty(PROP_SPAWNED, true);
  world.setDynamicProperty(PROP_OWNER, player.id);
  world.setDynamicProperty(PROP_PHASE, 0);
  world.setDynamicProperty(PROP_DAYS, 0);
  world.setDynamicProperty(PROP_ANGER, 0);

  const loc = player.location;
  try {
    const verity = player.dimension.spawnEntity("knws:verity", {
      x: loc.x + 1,
      y: loc.y + 1,
      z: loc.z,
    });
    verityEntityId = verity.id;
    updateVerityName(verity, 0);
    verity.addTag("knws_verity_main");

    try {
      const tameable = verity.getComponent("minecraft:tameable");
      if (tameable) tameable.tame(player);
    } catch (_) {}

    player.sendMessage("");
    player.sendMessage("§e§l══════════════════════════");
    player.sendMessage("§e§l    VERITY HAS AWAKENED");
    player.sendMessage("§e§l══════════════════════════");
    player.sendMessage("§fVerity §7» §fHelloooo! I'm Verity, your personal helper friend!");
    player.sendMessage("§fVerity §7» §fAsk me anything — I know everything! §e:)");
    player.sendMessage("§7Type §eVerity <message> §7in chat to talk to me.");
    player.sendMessage("§8§o[Phase: HELPER — He seems friendly... for now.]");
    player.playSound("random.orb", { volume: 1.0, pitch: 1.2 });
    player.dimension.spawnParticle("minecraft:villager_happy", { x: loc.x + 1, y: loc.y + 1.5, z: loc.z });
  } catch (e) {
    player.sendMessage("§c[Verity spawn error — enable Beta APIs]");
  }
}

function handleVerityChat(player, message) {
  if (!world.getDynamicProperty(PROP_SPAWNED)) {
    player.sendMessage("§7§o[Find and break the mystery box first...]");
    return;
  }

  const phase = getPhase();
  if (phase >= 4) {
    player.sendMessage("§4§o*static* ...§4§lRUN");
    player.playSound("mob.wither.ambient", { volume: 0.6, pitch: 0.4 });
    return;
  }

  const ctx = {
    playerX: player.location.x,
    playerZ: player.location.z,
    days: world.getDynamicProperty(PROP_DAYS) ?? 0,
  };

  const response = getPhaseResponse(phase, message, ctx);
  player.sendMessage(response);

  const verity = getVerityEntity();
  if (verity?.isValid()) {
    player.dimension.spawnParticle("minecraft:end_rod", {
      x: verity.location.x,
      y: verity.location.y + 0.8,
      z: verity.location.z,
    });
  }
}

function addAnger(amount) {
  const anger = (world.getDynamicProperty(PROP_ANGER) ?? 0) + amount;
  world.setDynamicProperty(PROP_ANGER, anger);
  if (anger >= 30) advancePhase("anger");
}

function tickDayProgression() {
  if (!world.getDynamicProperty(PROP_SPAWNED)) return;
  const currentDay = Math.floor(world.getAbsoluteTime() / TICKS_PER_DAY);
  const lastDay = world.getDynamicProperty(PROP_LAST_DAY) ?? currentDay;
  if (currentDay > lastDay) {
    world.setDynamicProperty(PROP_LAST_DAY, currentDay);
    const days = (world.getDynamicProperty(PROP_DAYS) ?? 0) + 1;
    world.setDynamicProperty(PROP_DAYS, days);

    const owner = getOwnerPlayer();
    if (owner) {
      const phase = getPhase();
      if (days === 3 && phase < 2) {
        owner.sendMessage("§dVerity §7» §oDo you live alone? ...Just wondering.");
      }
      if (days === 6 && phase < 3) {
        owner.sendMessage("§cVerity §7» §c§oSomething is coming in three days.");
      }
      checkPhaseByDays(days);
    }
  }
}

function checkPhaseByDays(days) {
  const phase = getPhase();
  for (let p = PHASE_DAY_THRESHOLDS.length - 1; p >= 0; p--) {
    if (days >= PHASE_DAY_THRESHOLDS[p] && phase < p) {
      advancePhase("time", p);
      return;
    }
  }
}

function advancePhase(reason, targetPhase = null) {
  const current = getPhase();
  if (current >= 4) return;
  const next = targetPhase ?? current + 1;
  if (next <= current) return;

  setPhase(next);
  const owner = getOwnerPlayer();
  if (!owner) return;

  const phaseName = PHASE_NAMES[next] ?? "???";
  owner.sendMessage("");
  owner.sendMessage("§8§o[Verity's personality shifted: " + phaseName + "§8§o]");

  if (TRANSFORM_LINES[next]) owner.sendMessage(TRANSFORM_LINES[next]);

  if (next === 1) {
    owner.sendMessage("§6Verity §7» §eI'm your BEST friend now! Nobody else matters! §6lol");
  } else if (next === 2) {
    owner.sendMessage("§dVerity §7» §8§o...you've been gone a while. I counted every second.");
    owner.playSound("mob.endermen.stare", { volume: 0.5, pitch: 0.5 });
  } else if (next === 3) {
    owner.sendMessage("§4Verity §7» §c§lSomething is coming. §cYes, it's dangerous.");
    owner.onScreenDisplay.setTitle("§4§lSOMETHING IS COMING");
    owner.playSound("ambient.cave", { volume: 1.0, pitch: 0.3 });
  } else if (next === 4) {
    transformToMonster(owner);
  }
}

function transformToMonster(player) {
  if (world.getDynamicProperty(PROP_TRANSFORMED)) return;
  world.setDynamicProperty(PROP_TRANSFORMED, true);

  const verity = getVerityEntity();
  const loc = verity?.location ?? player.location;
  const dim = player.dimension;

  if (verity?.isValid()) {
    try { verity.remove(); } catch (_) {}
  }

  player.sendMessage("");
  player.sendMessage("§4§l══════════════════════════");
  player.sendMessage("§4§l   VERITY HAS TRANSFORMED");
  player.sendMessage("§4§l══════════════════════════");
  player.playSound("mob.wither.spawn", { volume: 1.0, pitch: 0.5 });
  player.onScreenDisplay.setTitle("§4§lRUN");

  system.runTimeout(() => {
    try {
      const monster = dim.spawnEntity("knws:verity_monster", {
        x: loc.x,
        y: loc.y,
        z: loc.z,
      });
      monster.nameTag = "§4§lVERITY";
      monster.addTag("knws_verity_monster");
      verityEntityId = monster.id;
      dim.spawnParticle("minecraft:huge_explosion_emitter", loc);
    } catch (_) {}
  }, 40);
}

function tickVerity() {
  if (!world.getDynamicProperty(PROP_SPAWNED)) return;
  const phase = getPhase();
  if (phase >= 4) return tickMonsterHunt();

  const owner = getOwnerPlayer();
  const verity = getVerityEntity();
  if (!owner || !verity?.isValid()) return;

  const dist = distance(verity.location, owner.location);
  if (dist > 48) {
    addAnger(1);
    if (dist > 64 && system.currentTick % 100 === 0) {
      owner.sendMessage("§7§o[Verity feels abandoned...]");
    }
  }

  if (phase >= 2 && dist < 4 && system.currentTick % 80 === 0) {
    owner.onScreenDisplay.setActionBar("§8§oVerity is staring at you.");
  }
}

function tickMonsterHunt() {
  const owner = getOwnerPlayer();
  if (!owner) return;
  const monsters = owner.dimension.getEntities({ type: "knws:verity_monster", maxDistance: 80 });
  if (monsters.length === 0) return;

  const monster = monsters[0];
  const dist = distance(monster.location, owner.location);

  if (dist < 16 && system.currentTick % 60 === 0) {
    owner.playSound("mob.endermen.stare", { volume: 0.8, pitch: 0.3 });
    if (dist < 8) {
      owner.onScreenDisplay.setActionBar("§4§lIT'S RIGHT BEHIND YOU");
    }
  }

  if (dist < 3 && system.currentTick % 40 === 0) {
    owner.onScreenDisplay.setTitle("§4§lBEHIND YOU");
    owner.playSound("mob.wither.hurt", { volume: 0.6, pitch: 0.5 });
    try {
      owner.applyDamage(4);
    } catch (_) {}
  }
}

function tickAmbient() {
  if (!world.getDynamicProperty(PROP_SPAWNED)) return;
  const phase = getPhase();
  if (phase >= 4) return;
  const owner = getOwnerPlayer();
  if (!owner || system.currentTick % 400 !== 0) return;

  const lines = PHASE_AMBIENT[phase];
  if (lines && Math.random() < 0.3) {
    owner.sendMessage(lines[Math.floor(Math.random() * lines.length)]);
  }
}

function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Commands via chat
world.beforeEvents.chatSend.subscribe((event) => {
  const msg = event.message.toLowerCase().trim();
  const player = event.sender;
  if (msg === "!verity reset") {
    world.setDynamicProperty(PROP_SPAWNED, undefined);
    world.setDynamicProperty(PROP_PHASE, undefined);
    world.setDynamicProperty(PROP_DAYS, undefined);
    world.setDynamicProperty(PROP_ANGER, undefined);
    world.setDynamicProperty(PROP_TRANSFORMED, undefined);
    world.getDimension("overworld").getEntities({ families: ["knws_verity"] }).forEach((e) => e.remove());
    player.sendMessage("§a[Verity reset. Rejoin to spawn a new box.]");
    event.cancel = true;
  }
  if (msg === "!spawnbox") {
    spawnMysteryBox(player);
    player.sendMessage("§a[Mystery box spawned nearby.]");
    event.cancel = true;
  }
  if (msg === "!verity phase2") { advancePhase("debug", 1); event.cancel = true; }
  if (msg === "!verity phase3") { advancePhase("debug", 2); event.cancel = true; }
  if (msg === "!verity phase4") { advancePhase("debug", 3); event.cancel = true; }
  if (msg === "!verity transform") { advancePhase("debug", 4); event.cancel = true; }
});
