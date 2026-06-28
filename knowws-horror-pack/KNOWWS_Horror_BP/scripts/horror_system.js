import { world, system } from "@minecraft/server";

const HORROR_MOBS = [
  "knws:knocker",
  "knws:shadow_stalker",
  "knws:wendigo",
  "knws:crawler",
  "knws:blood_hound",
  "knws:phantom_doll",
  "knws:screamer",
  "knws:the_watcher",
];

const SANITY_MESSAGES = [
  "§8§oSomething is watching you...",
  "§4§oDon't look behind you.",
  "§8§oThe walls are closing in.",
  "§4§oYou shouldn't be here.",
  "§8§oCan you hear them knocking?",
  "§4§oRun. Now.",
  "§8§oYour flashlight flickers...",
  "§4§oThey're getting closer.",
];

export function registerHorrorSystem() {
  world.afterEvents.entitySpawn.subscribe((event) => {
    const entity = event.entity;
    if (HORROR_MOBS.includes(entity.typeId)) {
      entity.nameTag = getHorrorName(entity.typeId);
    }
  });

  world.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) {
      event.player.sendMessage("§4§lKNOWWS HORROR PACK§r §7loaded. Good luck surviving the night...");
      event.player.sendMessage("§eTip: §7Put a §eGlow Torch§7 in your §foff-hand§7 for real dynamic lighting in caves!");
    }
  });

  system.runInterval(() => {
    sanitySystem();
  }, 100);
}

function getHorrorName(typeId) {
  const names = {
    "knws:knocker": "§4The Knocker",
    "knws:shadow_stalker": "§8Shadow Stalker",
    "knws:wendigo": "§fWendigo",
    "knws:crawler": "§2Crawler",
    "knws:blood_hound": "§cBlood Hound",
    "knws:phantom_doll": "§dPhantom Doll",
    "knws:screamer": "§fScreamer",
    "knws:the_watcher": "§eThe Watcher",
  };
  return names[typeId] ?? "§4???";
}

function sanitySystem() {
  const time = world.getTimeOfDay();
  const isNight = time > 13000 && time < 23000;
  if (!isNight) return;

  for (const player of world.getPlayers()) {
    if (player.dimension.id !== "minecraft:overworld") continue;
    const nearby = player.dimension.getEntities({
      location: player.location,
      maxDistance: 32,
      families: ["knws_horror"],
    });

    if (nearby.length > 0) {
      const msg = SANITY_MESSAGES[Math.floor(Math.random() * SANITY_MESSAGES.length)];
      player.onScreenDisplay.setActionBar(msg);
      if (Math.random() < 0.1) {
        player.playSound("mob.endermen.stare", { volume: 0.3, pitch: 0.5 });
      }
    }

    if (nearby.length >= 3 && Math.random() < 0.05) {
      tryJumpscare(player);
    }
  }
}

function tryJumpscare(player) {
  player.playSound("mob.wither.spawn", { volume: 0.4, pitch: 1.8 });
  player.onScreenDisplay.setTitle("§4§lBEHIND YOU");
  system.runTimeout(() => {
    player.onScreenDisplay.setTitle("");
  }, 20);
}
