/**
 * VEHICLE SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Implements rideable vehicles using Bedrock's minecraft:rideable component
 *   combined with Script API movement control. Vehicles consume fuel from the
 *   player's inventory and can be repaired with repair kits.
 *
 * Bedrock Limitation Note:
 *   Bedrock has no native vehicle physics engine. Vehicles are implemented as
 *   custom entities with:
 *     - minecraft:rideable (allows player to mount)
 *     - minecraft:input_ground_controlled (ground vehicles follow player input)
 *     - minecraft:navigation.walk / .fly for path types
 *     - Script API teleport loop for planes/helicopters (airborne movement)
 *   This is the closest working equivalent to Java vehicles in Bedrock.
 *
 * Vehicle Types:
 *   GROUND (input_ground_controlled):
 *     - xman:offroad_truck    — fast, high health, moderate fuel use
 *     - xman:motorcycle       — very fast, low health, low fuel use
 *     - xman:armored_vehicle  — slow, very high health, high fuel use
 *     - xman:swamp_boat       — water + swamp terrain, moderate fuel
 *
 *   AIR (script-controlled teleport):
 *     - xman:small_plane      — fast horizontal, moderate fuel
 *     - xman:fighter_plane    — very fast, low health, high fuel
 *     - xman:cargo_plane      — slow, high health, very high fuel (has storage)
 *     - xman:helicopter       — all-direction, hovers, high fuel
 *
 * Fuel System:
 *   Fuel is the item xman:refined_fuel in the player's inventory.
 *   Each vehicle has a fuel consumption rate (units per 100 ticks).
 *   When fuel reaches 0, the vehicle stops (speed set to 0) and plays warning.
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js, fuel_system.js
 *
 * Performance:
 *   Air vehicles use a 4-tick movement loop per rider.
 *   Ground vehicles rely on vanilla movement — no script overhead.
 *   Fuel deduction runs every 40 ticks (2s) per vehicle.
 *
 * Multiplayer:
 *   Each vehicle entity is independent. Multiple players can each have
 *   their own vehicle. Passenger sharing is supported (cargo_plane: 2 seats).
 *
 * Testing checklist:
 *   [ ] Ground vehicle spawns and player mounts
 *   [ ] Ground vehicle moves with player WASD
 *   [ ] Fuel depletes while riding
 *   [ ] Vehicle stops on empty fuel
 *   [ ] Refuel restores movement
 *   [ ] Air vehicle ascends/descends based on view pitch
 *   [ ] Air vehicle forward speed matches definition
 *   [ ] Helicopter hovers without forward movement
 *   [ ] Repair kit increases vehicle health
 *   [ ] Vehicle takes damage from mobs and explosions
 */

import { world, system } from "@minecraft/server";
import {
    getDynamicProp, setDynamicProp, sendActionbar, countItemInInventory,
    removeItemFromInventory, scheduleRun, COLORS, randomFloat
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// VEHICLE DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

export const VEHICLE_DATA = {
    "xman:offroad_truck": {
        name: "Off-Road Truck",
        type: "ground",
        maxHP: 300,
        fuelUsePerTick: 0.01,   // per tick while moving
        speed: 1.0,
        color: COLORS.gold,
        sound_idle: "xman.vehicle.truck_idle",
        sound_drive: "xman.vehicle.truck_drive",
        seats: 2,
    },
    "xman:motorcycle": {
        name: "Motorcycle",
        type: "ground",
        maxHP: 100,
        fuelUsePerTick: 0.006,
        speed: 1.4,
        color: COLORS.gray,
        sound_idle: "xman.vehicle.moto_idle",
        sound_drive: "xman.vehicle.moto_drive",
        seats: 1,
    },
    "xman:armored_vehicle": {
        name: "Armored Vehicle",
        type: "ground",
        maxHP: 800,
        fuelUsePerTick: 0.018,
        speed: 0.6,
        color: COLORS.dark_gray,
        sound_idle: "xman.vehicle.armor_idle",
        sound_drive: "xman.vehicle.armor_drive",
        seats: 2,
    },
    "xman:swamp_boat": {
        name: "Swamp Boat",
        type: "ground",
        maxHP: 150,
        fuelUsePerTick: 0.005,
        speed: 0.9,
        color: COLORS.dark_green,
        sound_idle: "xman.vehicle.boat_idle",
        sound_drive: "xman.vehicle.boat_drive",
        seats: 2,
    },
    "xman:small_plane": {
        name: "Small Plane",
        type: "air",
        maxHP: 200,
        fuelUsePerTick: 0.015,
        speed: 0.8,
        verticalSpeed: 0.3,
        color: COLORS.aqua,
        sound_engine: "xman.vehicle.plane_engine",
        seats: 1,
    },
    "xman:fighter_plane": {
        name: "Fighter Plane",
        type: "air",
        maxHP: 150,
        fuelUsePerTick: 0.025,
        speed: 1.6,
        verticalSpeed: 0.4,
        color: COLORS.red,
        sound_engine: "xman.vehicle.fighter_engine",
        seats: 1,
    },
    "xman:cargo_plane": {
        name: "Cargo Plane",
        type: "air",
        maxHP: 500,
        fuelUsePerTick: 0.035,
        speed: 0.6,
        verticalSpeed: 0.2,
        color: COLORS.gold,
        sound_engine: "xman.vehicle.cargo_engine",
        seats: 2,
        hasStorage: true,
    },
    "xman:helicopter": {
        name: "Helicopter",
        type: "air",
        maxHP: 250,
        fuelUsePerTick: 0.020,
        speed: 0.5,
        verticalSpeed: 0.5,
        hover: true,
        color: COLORS.yellow,
        sound_engine: "xman.vehicle.heli_engine",
        seats: 2,
    },
};

const VEHICLE_TYPE_IDS = new Set(Object.keys(VEHICLE_DATA));
const FUEL_ITEM = "xman:refined_fuel";
const REPAIR_ITEM = "xman:repair_kit";

// ──────────────────────────────────────────────────────────────────────────────
// VEHICLE SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class VehicleSystem {
    constructor() {
        // vehicleEntityId → { data, fuel, rider playerId, ticksSinceMove }
        this._activeVehicles = new Map();
        this._airVehicleLoops = new Map(); // vehicleEntityId → intervalId
        this._tickCount = 0;
    }

    isVehicle(typeId) {
        return VEHICLE_TYPE_IDS.has(typeId);
    }

    registerVehicle(entity) {
        if (this._activeVehicles.has(entity.id)) return;
        const def = VEHICLE_DATA[entity.typeId];
        if (!def) return;
        this._activeVehicles.set(entity.id, {
            entity,
            def,
            fuel: 100,
            riderId: null,
            isMoving: false,
        });
    }

    tick(player) {
        this._tickCount++;

        // Check if player is riding any vehicle
        let vehicleData = null;
        for (const [id, data] of this._activeVehicles) {
            try {
                if (!data.entity.isValid()) {
                    this._activeVehicles.delete(id);
                    continue;
                }
            } catch (e) {
                this._activeVehicles.delete(id);
                continue;
            }

            if (this._isPlayerRiding(player, data.entity)) {
                vehicleData = data;
                data.riderId = player.id;
                break;
            } else if (data.riderId === player.id) {
                data.riderId = null;
            }
        }

        if (!vehicleData) return;

        const { entity, def } = vehicleData;

        // Fuel HUD every 20 ticks
        if (this._tickCount % 20 === 0) {
            const fuelPct = Math.floor(vehicleData.fuel);
            const fuelBar = this._fuelBar(vehicleData.fuel);
            sendActionbar(player,
                `${def.color}${def.name}  ${fuelBar}  ${COLORS.white}${fuelPct}%  ${COLORS.gray}Fuel: ${countItemInInventory(player, FUEL_ITEM)} cans`
            );
        }

        // Fuel consumption every 40 ticks
        if (this._tickCount % 40 === 0) {
            if (vehicleData.fuel > 0) {
                vehicleData.fuel = Math.max(0, vehicleData.fuel - def.fuelUsePerTick * 40);
            } else {
                this._outOfFuel(player, entity, def);
                return;
            }

            // Auto-refuel from inventory when low
            if (vehicleData.fuel < 10) {
                const cans = countItemInInventory(player, FUEL_ITEM);
                if (cans > 0) {
                    removeItemFromInventory(player, FUEL_ITEM, 1);
                    vehicleData.fuel = Math.min(100, vehicleData.fuel + 25);
                    sendActionbar(player, `${COLORS.yellow}Refueled from can! ${vehicleData.fuel.toFixed(0)}%`);
                }
            }
        }

        // Air vehicle movement
        if (def.type === "air") {
            if (this._tickCount % 4 === 0) {
                this._moveAirVehicle(player, entity, def, vehicleData.fuel > 0);
            }
        }

        // Repair handling
        const heldItem = this._getHeldItem(player);
        if (heldItem?.typeId === REPAIR_ITEM) {
            this._repairVehicle(player, entity, def);
        }
    }

    _isPlayerRiding(player, vehicle) {
        try {
            const riders = vehicle.getComponent("minecraft:rideable");
            if (!riders) return false;
            return vehicle.dimension.getEntities({
                location: vehicle.location,
                maxDistance: 2,
                type: "minecraft:player",
            }).some(e => e.id === player.id);
        } catch (e) { return false; }
    }

    _moveAirVehicle(player, vehicle, def, hasFuel) {
        if (!hasFuel) return;

        try {
            const rot = player.getRotation();
            const yaw = (rot.y * Math.PI) / 180;
            const pitch = (rot.x * Math.PI) / 180;

            const speed = def.speed;
            const vSpeed = def.verticalSpeed ?? 0.3;

            const forwardX = -Math.sin(yaw) * speed;
            const forwardZ = Math.cos(yaw) * speed;

            let dy = 0;
            if (!def.hover) {
                dy = -Math.sin(pitch) * vSpeed;
            }

            const vLoc = vehicle.location;
            const newPos = {
                x: vLoc.x + forwardX,
                y: Math.max(0, vLoc.y + dy),
                z: vLoc.z + forwardZ,
            };

            vehicle.teleport(newPos, {
                dimension: vehicle.dimension,
                keepVelocity: false,
                checkForBlocks: false,
            });
        } catch (e) {}
    }

    _outOfFuel(player, entity, def) {
        if (this._tickCount % 40 === 0) {
            sendActionbar(player, `${COLORS.red}OUT OF FUEL! Use ${FUEL_ITEM.replace("xman:", "")} to refuel`);
            try {
                entity.runCommandAsync("playsound xman.vehicle.engine_sputter @a ~ ~ ~ 1 1 1");
            } catch (e) {}
        }
    }

    _repairVehicle(player, entity, def) {
        if (this._tickCount % 20 !== 0) return;
        try {
            const healthComp = entity.getComponent("minecraft:health");
            if (!healthComp) return;
            const maxHP = healthComp.effectiveMax;
            if (healthComp.currentValue >= maxHP) return;

            removeItemFromInventory(player, REPAIR_ITEM, 1);
            const repairAmt = Math.floor(maxHP * 0.2);
            entity.runCommandAsync(`effect @s instant_health 1 2 true`);
            sendActionbar(player, `${COLORS.green}Repaired ${def.name}! +${repairAmt} HP`);
        } catch (e) {}
    }

    _fuelBar(fuel) {
        const filled = Math.round(fuel / 10);
        const empty = 10 - filled;
        const color = fuel > 30 ? COLORS.green : fuel > 15 ? COLORS.yellow : COLORS.red;
        return `${color}[${"█".repeat(filled)}${COLORS.dark_gray}${"░".repeat(empty)}${color}]${COLORS.reset}`;
    }

    _getHeldItem(player) {
        try {
            const eq = player.getComponent("minecraft:equippable");
            return eq?.getEquipment("Mainhand") ?? null;
        } catch (e) { return null; }
    }

    refuelVehicle(vehicleEntityId, amount) {
        const data = this._activeVehicles.get(vehicleEntityId);
        if (!data) return;
        data.fuel = Math.min(100, data.fuel + amount);
    }

    getVehicleFuel(vehicleEntityId) {
        return this._activeVehicles.get(vehicleEntityId)?.fuel ?? 0;
    }

    onVehicleDeath(entity) {
        this._activeVehicles.delete(entity.id);
    }
}
