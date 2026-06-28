import { world, system } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { getPhaseResponse } from "./verity_dialogue.js";

const VOICE_PHRASES = [
  { label: "§aHello Verity!", msg: "hello" },
  { label: "§eWhere are diamonds?", msg: "where are diamonds" },
  { label: "§bI need help", msg: "help me" },
  { label: "§dWho are you?", msg: "who are you" },
  { label: "§6Tell me a joke", msg: "tell me something funny" },
  { label: "§cWhat's coming?", msg: "what is coming" },
  { label: "§4Leave me alone", msg: "go away" },
];

export function registerVerityVoice() {
  system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent("knws:verity_mic_use", {
      onUse: async (event) => {
        const player = event.source;
        if (!player || player.typeId !== "minecraft:player") return;
        await openVoiceMenu(player);
      },
    });
  });

  // Fast voice-style chat: "v hello" or "mic hello" shortcuts
  world.beforeEvents.chatSend.subscribe((event) => {
    const lower = event.message.toLowerCase().trim();
    if (lower.startsWith("v ") || lower.startsWith("mic ")) {
      const msg = lower.replace(/^(v|mic)\s+/, "");
      respondToVerity(event.sender, msg || "hello", true);
      event.cancel = true;
    }
  });

  console.warn("[KNOWWS] Verity voice mic system active. Open verity-voice.html for real microphone.");
}

async function openVoiceMenu(player) {
  const phase = world.getDynamicProperty("knws:verity_phase") ?? 0;
  const form = new ActionFormData()
    .title("§e§lVerity Microphone")
    .body(
      `§7Phase: §f${["Nice", "Zesty", "Weird", "Scary", "Entity"][phase]}\n\n` +
      "§7Choose a phrase to say to Verity.\n" +
      "§8For real mic: open §everity-voice.html §8on your PC."
    );

  for (const p of VOICE_PHRASES) form.button(p.label);

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) return;
    const phrase = VOICE_PHRASES[res.selection];
    if (!phrase) return;

    player.playSound("random.pop", { volume: 0.8, pitch: 1.0 });
    player.onScreenDisplay.setActionBar(`§7You said: §f"${phrase.msg}"`);
    respondToVerity(player, phrase.msg, true);
  } catch (_) {
    player.sendMessage("§c[Enable Beta APIs for voice menu]");
  }
}

export function respondToVerity(player, message, playVoiceSound = false) {
  if (!world.getDynamicProperty("knws:verity_spawned")) {
    player.sendMessage("§7§o[Break the mystery box first to meet Verity.]");
    return;
  }

  const phase = world.getDynamicProperty("knws:verity_phase") ?? 0;
  if (phase >= 4) {
    player.sendMessage("§4§o*static* ...§4§lRUN");
    player.playSound("mob.wither.ambient", { volume: 0.7, pitch: 0.4 });
    return;
  }

  const ctx = {
    playerX: player.location.x,
    playerZ: player.location.z,
    days: world.getDynamicProperty("knws:verity_days") ?? 0,
  };

  const response = getPhaseResponse(phase, message, ctx);
  player.sendMessage(response);

  if (playVoiceSound) {
    const pitches = [1.2, 1.1, 0.9, 0.7, 0.5];
    player.playSound("mob.villager.idle", { volume: 0.9, pitch: pitches[phase] ?? 1.0 });
    system.runTimeout(() => {
      if (phase >= 2) player.playSound("ambient.cave", { volume: 0.3, pitch: 0.5 });
    }, 8);
  }

  const verity = player.dimension.getEntities({ type: "knws:verity" })[0];
  if (verity?.isValid()) {
    player.dimension.spawnParticle("minecraft:end_rod", {
      x: verity.location.x,
      y: verity.location.y + 0.8,
      z: verity.location.z,
    });
  }
}
