import { world, system, ItemStack } from "@minecraft/server";
import { registerWeapons } from "./weapons.js";
import { registerHorrorSystem } from "./horror_system.js";

system.beforeEvents.startup.subscribe((event) => {
  registerWeapons(event.itemComponentRegistry);
});

system.runInterval(() => {
  if (system.currentTick % 40 === 0) {
    horrorTick();
  }
}, 1);

function horrorTick() {
  for (const player of world.getPlayers()) {
    const time = world.getTimeOfDay();
    const isNight = time > 13000 && time < 23000;
    const dim = player.dimension.id;

    if (isNight && dim === "minecraft:overworld") {
      const light = player.getBlockFromViewDirection({ maxDistance: 8 });
      if (!light || light.block?.typeId.includes("light")) {
        if (Math.random() < 0.02) {
          player.onScreenDisplay.setActionBar("§8§o...did you hear that?");
        }
        if (Math.random() < 0.005) {
          player.playSound("ambient.cave", { volume: 0.8, pitch: 0.5 });
        }
      }
    }
  }
}

registerHorrorSystem();

console.warn("[KNOWWS Horror Pack] Loaded! Survive the night...");
