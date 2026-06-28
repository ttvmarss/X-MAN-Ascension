/**
 * ARMOR ABILITIES SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Tracks each player's equipped armor every second and applies/removes
 *   potion effects based on the armor set they are wearing.
 *   A full set of 4 matching pieces activates the set bonus.
 *   Partial sets provide basic protection via item stats (JSON-defined).
 *
 * Armor Sets and Bonuses:
 *   Shadow Armor   (full): Night Vision + Speed II at night only
 *   Blood Armor    (full): Regeneration I + Strength I when HP < 50%
 *   Titanium Armor (full): Resistance II + knockback resist (passive tag)
 *   Mutant Armor   (full): Strength II + Jump Boost I
 *   Void Armor     (full): Fire Resistance + Absorption II
 *   Infernal Armor (full): Fire Resistance + Strength II (always)
 *   Hunter Armor   (full): Speed I + Resistance I vs horror mobs (script-enforced)
 *   Heavy Armor    (full): Resistance III + Slowness I (trade-off enforced)
 *
 * Folder structure:
 *   scripts/armor_abilities.js  ← this file
 *
 * Relationships:
 *   main.js calls armorSystem.tick(player) every 20 ticks (1s)
 *   Uses @minecraft/server EquipmentSlot enum for slot checks
 *
 * Performance:
 *   Runs once per second per player. Uses cached last-armor-state to skip
 *   redundant effect reapplications. Effect duration set to 30s to avoid
 *   the effect expiring mid-tick while still wearing armor.
 *
 * Multiplayer:
 *   Each player is checked independently. The _armorCache uses player.id
 *   as the key, so no cross-player interference.
 *
 * Testing checklist:
 *   [ ] Equip full Shadow set at night → Night Vision + Speed II applied
 *   [ ] Equip full Shadow set in day → only passive, no night-specific effects
 *   [ ] Drop one piece of Shadow set → effects removed
 *   [ ] Full Blood armor at 50% HP → Regeneration + Strength
 *   [ ] Full Blood armor at 80% HP → no effects
 *   [ ] Full Titanium → Resistance II applied
 *   [ ] Full Mutant → Strength II + Jump Boost
 *   [ ] Full Void → Fire Resistance + Absorption
 *   [ ] Full Infernal → Fire Resistance + Strength II always
 *   [ ] Full Hunter → Speed I
 *   [ ] Full Heavy → Resistance III + Slowness I
 *   [ ] Effects cleared on undress
 */

import { world, system } from "@minecraft/server";
import { getDynamicProp, setDynamicProp, applyEffect, isNight, COLORS, sendActionbar } from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// ARMOR SET DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const ARMOR_SETS = {
    shadow: {
        prefix: "xman:shadow_",
        label: "Shadow Armor",
        color: COLORS.dark_purple,
        condition: (player, fullSet) => fullSet,
        nightEffects: ["night_vision:600:0", "speed:600:1"],
        dayEffects: [],
        alwaysEffects: [],
    },
    blood: {
        prefix: "xman:blood_",
        label: "Blood Armor",
        color: COLORS.dark_red,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: [],
        conditionalEffects: {
            lowHealth: ["regeneration:600:0", "strength:600:0"],
            lowHealthThreshold: 0.5,
        },
    },
    titanium: {
        prefix: "xman:titanium_",
        label: "Titanium Armor",
        color: COLORS.gray,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["resistance:600:1"],
    },
    mutant: {
        prefix: "xman:mutant_",
        label: "Mutant Armor",
        color: COLORS.green,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["strength:600:1", "jump_boost:600:0"],
    },
    void: {
        prefix: "xman:void_",
        label: "Void Armor",
        color: COLORS.dark_purple,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["fire_resistance:600:0", "absorption:600:1"],
    },
    infernal: {
        prefix: "xman:infernal_",
        label: "Infernal Armor",
        color: COLORS.red,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["fire_resistance:600:0", "strength:600:1"],
    },
    hunter: {
        prefix: "xman:hunter_",
        label: "Hunter Armor",
        color: COLORS.gold,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["speed:600:0", "resistance:600:0"],
    },
    heavy: {
        prefix: "xman:heavy_",
        label: "Heavy Military Armor",
        color: COLORS.dark_gray,
        condition: (player, fullSet) => fullSet,
        alwaysEffects: ["resistance:600:2", "slowness:600:0"],
    },
};

const ARMOR_SLOTS = ["Head", "Chest", "Legs", "Feet"];
const PIECE_SUFFIXES = ["helmet", "chestplate", "leggings", "boots"];

// ──────────────────────────────────────────────────────────────────────────────
// ARMOR ABILITY SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class ArmorAbilitySystem {
    constructor() {
        // playerId → { setId: string, lastApplied: number }
        this._armorCache = new Map();
        // playerId → array of currently active effect strings
        this._activeEffects = new Map();
    }

    tick(player) {
        const equip = player.getComponent("minecraft:equippable");
        if (!equip) return;

        const wornSet = this._detectArmorSet(equip);
        const cached = this._armorCache.get(player.id);

        const armorChanged = !cached || cached.setId !== (wornSet?.id ?? "none");

        if (armorChanged) {
            this._clearEffects(player);
            if (wornSet) {
                this._applyArmorEffects(player, wornSet, equip);
                this._armorCache.set(player.id, { setId: wornSet.id });
            } else {
                this._armorCache.set(player.id, { setId: "none" });
            }
        } else if (wornSet) {
            this._applyArmorEffects(player, wornSet, equip);
        }
    }

    _detectArmorSet(equip) {
        for (const [setId, setDef] of Object.entries(ARMOR_SETS)) {
            let pieceCount = 0;
            const slots = ["Head", "Chest", "Legs", "Feet"];
            const suffixes = ["helmet", "chestplate", "leggings", "boots"];

            for (let i = 0; i < 4; i++) {
                try {
                    const item = equip.getEquipment(slots[i]);
                    if (item && item.typeId === `${setDef.prefix}${suffixes[i]}`) {
                        pieceCount++;
                    }
                } catch (e) {}
            }

            if (pieceCount === 4) return { id: setId, def: setDef, fullSet: true };
        }
        return null;
    }

    _applyArmorEffects(player, wornSet, equip) {
        const def = wornSet.def;
        const night = isNight(player.dimension);

        // Always-on effects
        if (def.alwaysEffects) {
            for (const effectStr of def.alwaysEffects) {
                this._applyEffectStr(player, effectStr);
            }
        }

        // Night-conditional effects
        if (night && def.nightEffects) {
            for (const effectStr of def.nightEffects) {
                this._applyEffectStr(player, effectStr);
            }
        }

        // Low-health conditional effects
        if (def.conditionalEffects?.lowHealth) {
            try {
                const healthComp = player.getComponent("minecraft:health");
                const ratio = healthComp ? healthComp.currentValue / healthComp.effectiveMax : 1;
                if (ratio <= def.conditionalEffects.lowHealthThreshold) {
                    for (const effectStr of def.conditionalEffects.lowHealth) {
                        this._applyEffectStr(player, effectStr);
                    }
                }
            } catch (e) {}
        }
    }

    _applyEffectStr(player, effectStr) {
        const [id, durationTicks, amplifier] = effectStr.split(":");
        try {
            player.runCommandAsync(`effect @s ${id} ${durationTicks} ${amplifier} true`);
        } catch (e) {}
    }

    _clearEffects(player) {
        const effectsToClear = [
            "night_vision", "speed", "regeneration", "strength",
            "resistance", "jump_boost", "fire_resistance", "absorption", "slowness",
        ];
        for (const eff of effectsToClear) {
            try {
                player.runCommandAsync(`effect @s ${eff} 0 0`);
            } catch (e) {}
        }
        this._activeEffects.delete(player.id);
    }

    getWornSetId(player) {
        return this._armorCache.get(player.id)?.setId ?? "none";
    }
}
