import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";

const TORCH_IDS = new Set([
  "minecraft:torch",
  "minecraft:soul_torch",
  "knws:glow_torch",
  "knws:cave_lantern",
  "knws:soul_flame_torch",
]);

export function registerTorchOffhand() {
  world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const stack = event.itemStack;
    if (!player || player.typeId !== "minecraft:player") return;
    if (!stack || !TORCH_IDS.has(stack.typeId)) return;

    system.run(() => equipTorchToOffhand(player, stack));
  });

  world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message.trim().toLowerCase();
    if (msg !== "!offhand" && msg !== "!torch") return;
    event.cancel = true;
    system.run(() => helpOffhand(event.sender));
  });

  console.warn("[KNOWWS] Off-hand torch equip system active — right-click torch or type !offhand");
}

function helpOffhand(player) {
  player.sendMessage("§6§l━━ Off-Hand Torch ━━");
  player.sendMessage("§eMethod 1: §7Hold torch → §fright-click§7 (equips to off-hand automatically)");
  player.sendMessage("§eMethod 2: §7Open inventory → move torch to the §fshield slot§7 (left of boots)");
  player.sendMessage("§eMethod 3: §7Vanilla §fminecraft:torch§7 also works in the shield slot");
  player.sendMessage("§cRequires Beta APIs enabled on your world!");
}

function equipTorchToOffhand(player, stack) {
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) {
    player.sendMessage("§cEnable §eBeta APIs§c in world settings for off-hand torches!");
    return;
  }

  const offhand = equippable.getEquipment(EquipmentSlot.Offhand);
  if (offhand && TORCH_IDS.has(offhand.typeId)) {
    player.onScreenDisplay.setActionBar("§eOff-hand torch active — cave lighting on!");
    return;
  }

  const one = new ItemStack(stack.typeId, 1);
  equippable.setEquipment(EquipmentSlot.Offhand, one);

  const main = equippable.getEquipment(EquipmentSlot.Mainhand);
  if (main?.typeId === stack.typeId) {
    if (main.amount > 1) {
      main.amount -= 1;
      equippable.setEquipment(EquipmentSlot.Mainhand, main);
    } else {
      equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
  } else {
    consumeFromInventory(player, stack.typeId);
  }

  player.playSound("armor.equip_iron", { volume: 0.6, pitch: 1.4 });
  player.onScreenDisplay.setActionBar("§a✦ Glow torch equipped to OFF-HAND — light follows you!");
  player.sendMessage("§aTorch moved to off-hand! §7Walk into caves — light blocks spawn around you.");
}

function consumeFromInventory(player, typeId) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (item?.typeId === typeId) {
      if (item.amount > 1) {
        item.amount -= 1;
        inv.setItem(i, item);
      } else {
        inv.setItem(i, undefined);
      }
      return;
    }
  }
}
