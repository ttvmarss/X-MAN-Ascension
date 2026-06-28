import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const PACK_VERSION = "6.0.0";
const DOWNLOAD_URL = "https://github.com/ttvmarss/X-MAN-Ascension/releases/latest/download/KNOWWS_Horror_Pack.mcaddon";

const verifiedPlayers = new Set();

export function registerMultiplayerSync() {
  world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    system.runTimeout(() => {
      showPackWelcome(player);
    }, 60);
  });

  world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message.trim().toLowerCase();
    if (msg === "!pack" || msg === "!download") {
      event.cancel = true;
      sendDownloadHelp(event.sender);
    }
    if (msg === "!packok") {
      event.cancel = true;
      verifiedPlayers.add(event.sender.id);
      event.sender.sendMessage("§a[KNOWWS] Pack confirmed! You're good to play.");
    }
  });

  system.runInterval(() => {
    if (system.currentTick % 600 === 0) {
      remindMultiplayerPlayers();
    }
  }, 20);
}

function sendDownloadHelp(player) {
  player.sendMessage("§4§l━━━ KNOWWS Horror Pack ━━━");
  player.sendMessage(`§fVersion: §e${PACK_VERSION}`);
  player.sendMessage("§6Download (install on BOTH PCs):");
  player.sendMessage(`§b${DOWNLOAD_URL}`);
  player.sendMessage("§71. Download & open the .mcaddon on your laptop");
  player.sendMessage("§72. Join host's world → tap §eDownload packs§7 when asked");
  player.sendMessage("§73. Type §e!packok§7 once textures look correct");
}

async function showPackWelcome(player) {
  const players = world.getPlayers();
  const isMultiplayer = players.length > 1;

  player.onScreenDisplay.setTitle({
    title: "§4KNOWWS Horror",
    subtitle: `§7v${PACK_VERSION} loaded`,
    stayDuration: 40,
    fadeInDuration: 5,
    fadeOutDuration: 10,
  });

  player.sendMessage("§4§lKNOWWS HORROR PACK§r §7— textures, mobs, Verity & guns active!");
  player.sendMessage("§eTip: §7Right-click a §eGlow Torch§7 to auto-equip to §foff-hand§7 — or type §e!offhand");

  if (isMultiplayer) {
    player.sendMessage("§6§l[MULTIPLAYER]§r §fPlaying with a friend!");
    player.sendMessage("§cIMPORTANT: §7Both players need the pack for horror mobs & guns to show correctly.");
    player.sendMessage("§7→ Friend on laptop: install the .mcaddon §lbefore§r joining, then tap §eDownload§7 when prompted.");
    player.sendMessage("§7→ Type §e!pack§7 anytime for the download link.");
  }

  if (verifiedPlayers.has(player.id)) return;

  try {
    const form = new ActionFormData()
      .title("KNOWWS Horror Pack")
      .body(
        isMultiplayer
          ? "Multiplayer detected!\n\nFor everything to look correct:\n\n" +
            "HOST (you): packs already on this world.\n" +
            "FRIEND: must install the .mcaddon on their laptop AND tap Download when joining.\n\n" +
            "See purple/black broken textures? The pack is missing — use the download link in chat (!pack)."
          : "Welcome to KNOWWS Horror Pack!\n\nIf custom mobs, guns, or ores look like missing textures, reinstall the .mcaddon.\n\nType !pack for the download link."
      )
      .button("Looks good — let's play!")
      .button("Show download link")
      .button("Multiplayer help");

    const response = await form.show(player);
    if (response.canceled) return;

    if (response.selection === 0) {
      verifiedPlayers.add(player.id);
      player.sendMessage("§a[KNOWWS] Have fun surviving the night!");
    } else if (response.selection === 1) {
      sendDownloadHelp(player);
    } else if (response.selection === 2) {
      player.sendMessage("§6§lMultiplayer setup (PC host + laptop friend):");
      player.sendMessage("§71. §fYou§7: packs on world (done if you see this message)");
      player.sendMessage("§72. §fFriend§7: download .mcaddon on their laptop first");
      player.sendMessage("§73. Friend joins your world → taps §eDownload packs§7");
      player.sendMessage("§74. Both enable §eBeta APIs§7 + §eCustom Biomes§7 in world settings");
      player.sendMessage(`§75. Download: §b${DOWNLOAD_URL}`);
    }
  } catch {
    sendDownloadHelp(player);
  }
}

function remindMultiplayerPlayers() {
  if (world.getPlayers().length < 2) return;
  for (const player of world.getPlayers()) {
    if (!verifiedPlayers.has(player.id)) {
      player.onScreenDisplay.setActionBar("§e⚠ Install KNOWWS pack on your device — type §f!pack §efor link");
    }
  }
}
