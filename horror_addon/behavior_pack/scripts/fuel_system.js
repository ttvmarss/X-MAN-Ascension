/**
 * FUEL SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Manages the full fuel lifecycle: oil extraction, refining, gas can filling,
 *   fuel tank crafting, and the fuel refinery block interaction.
 *
 * Fuel Chain:
 *   Oil Shale block (mined) → xman:oil_resource (raw item)
 *   4× oil_resource + fuel_refinery → xman:refined_fuel (1 unit)
 *   refined_fuel + gas_can_empty → xman:gas_can (filled, 25 fuel units)
 *   gas_can → right-click vehicle → refuel 25 units
 *
 * Blocks:
 *   xman:fuel_refinery  — custom block; refines oil → fuel when player interacts
 *   xman:fuel_pump      — gas station pump; right-click to refuel from world gas
 *
 * Items:
 *   xman:oil_resource   — raw material from oil_shale mining
 *   xman:refined_fuel   — usable vehicle fuel (stackable)
 *   xman:gas_can        — filled can (25 units), consumed on use
 *   xman:gas_can_empty  — empty can, refillable
 *   xman:fuel_tank      — large reserve (100 units), placed in world
 *
 * Script API events handled:
 *   - playerInteractWithBlock → fuel_refinery, fuel_pump
 *   - itemUse → gas_can (refuels nearest mounted vehicle)
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js, vehicle_system.js
 *
 * Testing checklist:
 *   [ ] Mining oil_shale drops oil_resource
 *   [ ] Right-click fuel_refinery with 4+ oil_resource → get refined_fuel
 *   [ ] Right-click fuel_pump → refuel vehicle if riding one
 *   [ ] gas_can refuels mounted vehicle by 25 units
 *   [ ] Empty gas_can returned after use
 *   [ ] fuel_tank placed and consumed to refuel vehicle
 */

import { world, system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendActionbar, removeItemFromInventory,
    countItemInInventory, giveItem, scheduleRun, COLORS, sendTitle
} from "./utils.js";
import { VEHICLE_DATA } from "./vehicle_system.js";

// ──────────────────────────────────────────────────────────────────────────────
// FUEL CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const OIL_ITEM = "xman:oil_resource";
const FUEL_ITEM = "xman:refined_fuel";
const GAS_CAN = "xman:gas_can";
const GAS_CAN_EMPTY = "xman:gas_can_empty";
const FUEL_TANK = "xman:fuel_tank";

const REFINERY_BLOCK = "xman:fuel_refinery";
const FUEL_PUMP_BLOCK = "xman:fuel_pump";

const OIL_PER_FUEL = 4;     // 4 oil → 1 refined_fuel
const GAS_CAN_FUEL = 25;    // 1 gas_can → 25 fuel units
const FUEL_TANK_FUEL = 100; // 1 fuel_tank item → 100 fuel units
const PUMP_FUEL = 50;       // gas station pump gives 50 units (world resource)

// ──────────────────────────────────────────────────────────────────────────────
// FUEL SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class FuelSystem {
    constructor(vehicleSystem) {
        this._vehicleSystem = vehicleSystem;
    }

    // Called from main.js on playerInteractWithBlock
    onBlockInteract(player, block) {
        const blockType = block.typeId;

        if (blockType === REFINERY_BLOCK) {
            this._refineOil(player);
            return true;
        }
        if (blockType === FUEL_PUMP_BLOCK) {
            this._refuelFromPump(player);
            return true;
        }
        return false;
    }

    // Called from main.js on itemUse (gas_can or fuel_tank)
    onItemUse(player, itemStack) {
        const typeId = itemStack.typeId;

        if (typeId === GAS_CAN) {
            return this._useGasCan(player);
        }
        if (typeId === FUEL_TANK) {
            return this._useFuelTank(player);
        }
        return false;
    }

    // ── REFINERY ──────────────────────────────────────────────────────────────

    _refineOil(player) {
        const oilCount = countItemInInventory(player, OIL_ITEM);
        if (oilCount < OIL_PER_FUEL) {
            sendActionbar(player,
                `${COLORS.red}Need ${OIL_PER_FUEL} Oil Resource to refine. Have: ${oilCount}`
            );
            return;
        }

        const batchSize = Math.floor(oilCount / OIL_PER_FUEL);
        removeItemFromInventory(player, OIL_ITEM, batchSize * OIL_PER_FUEL);
        giveItem(player, FUEL_ITEM, batchSize);

        player.runCommandAsync("playsound xman.refinery.refine @s ~ ~ ~ 1 1 1");
        sendActionbar(player,
            `${COLORS.yellow}Refinery: ${batchSize * OIL_PER_FUEL} oil → ${COLORS.gold}${batchSize} Refined Fuel`
        );
    }

    // ── GAS STATION PUMP ──────────────────────────────────────────────────────

    _refuelFromPump(player) {
        const vehicle = this._getRiddenVehicle(player);
        if (!vehicle) {
            // No vehicle → give fuel cans
            giveItem(player, FUEL_ITEM, 5);
            sendActionbar(player, `${COLORS.gold}Gas Station: Received 5 Refined Fuel`);
            player.runCommandAsync("playsound xman.pump.dispense @s ~ ~ ~ 1 1 1");
            return;
        }

        this._vehicleSystem.refuelVehicle(vehicle.id, PUMP_FUEL);
        player.runCommandAsync("playsound xman.pump.dispense @s ~ ~ ~ 1 1 1");
        sendActionbar(player, `${COLORS.gold}Gas Station: +${PUMP_FUEL} fuel added`);
    }

    // ── GAS CAN ───────────────────────────────────────────────────────────────

    _useGasCan(player) {
        const vehicle = this._getRiddenVehicle(player);
        if (!vehicle) {
            sendActionbar(player, `${COLORS.red}Must be riding a vehicle to use Gas Can`);
            return false;
        }

        removeItemFromInventory(player, GAS_CAN, 1);
        giveItem(player, GAS_CAN_EMPTY, 1);
        this._vehicleSystem.refuelVehicle(vehicle.id, GAS_CAN_FUEL);
        player.runCommandAsync("playsound xman.gasCan.use @s ~ ~ ~ 1 1 1");
        sendActionbar(player, `${COLORS.yellow}Gas Can used: +${GAS_CAN_FUEL} fuel`);
        return true;
    }

    // ── FUEL TANK ─────────────────────────────────────────────────────────────

    _useFuelTank(player) {
        const vehicle = this._getRiddenVehicle(player);
        if (!vehicle) {
            sendActionbar(player, `${COLORS.red}Must be riding a vehicle to use Fuel Tank`);
            return false;
        }

        removeItemFromInventory(player, FUEL_TANK, 1);
        this._vehicleSystem.refuelVehicle(vehicle.id, FUEL_TANK_FUEL);
        player.runCommandAsync("playsound xman.fuelTank.use @s ~ ~ ~ 1 1 1");
        sendActionbar(player, `${COLORS.gold}Fuel Tank used: +${FUEL_TANK_FUEL} fuel`);
        return true;
    }

    // ── HELPERS ───────────────────────────────────────────────────────────────

    _getRiddenVehicle(player) {
        try {
            const nearby = player.dimension.getEntities({
                location: player.location,
                maxDistance: 4,
            });
            for (const e of nearby) {
                if (Object.prototype.hasOwnProperty.call(VEHICLE_DATA, e.typeId)) {
                    return e;
                }
            }
        } catch (e) {}
        return null;
    }
}
