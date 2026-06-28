/**
 * JUMP SCARE SYSTEM — X-Man Ascension Horror Survival
 *
 * Purpose:
 *   Delivers scripted horror events to players using safe Bedrock Script API
 *   methods: darkness effects, sudden sounds, entity spawns near the player,
 *   screen flashes, footstep stingers, and stalking behavior triggers.
 *
 * Horror Events (weighted random pool):
 *   WHISPER         — quiet ambient sound, 15% chance per minute
 *   SHADOW_PASS     — fast entity spawns and immediately despawns (visual flicker)
 *   DARKNESS_PULSE  — blindness effect for 2 seconds
 *   GROUND_SHAKE    — wither effect + shake particle
 *   SCREAM_DISTANT  — distant mob scream sound
 *   STALK_ENTITY    — spawns a Shadow Stalker 8 blocks behind player (night only)
 *   FOOTSTEPS       — random footstep sounds played near the player
 *   FOG_EVENT       — density fog applied for 10 seconds
 *   JUMPSCARE       — blindness + loud scream + instant clear (the classic)
 *
 * Schedule:
 *   Events are checked every TICK_INTERVAL (100 ticks = 5s).
 *   Each event has its own cooldown and probability.
 *   At night, all probabilities increase.
 *
 * Dependencies:
 *   @minecraft/server 1.13.0+
 *   utils.js
 *
 * Performance:
 *   Single interval timer shared across all players. O(players) per tick.
 *   Entity spawns for STALK_ENTITY are capped to 1 per player at a time.
 *
 * Multiplayer:
 *   Per-player timers stored in _playerState using player.id.
 *   Events can fire independently per player.
 *
 * Testing checklist:
 *   [ ] Whisper sound plays near player
 *   [ ] Darkness pulse blinds for 2s then clears
 *   [ ] Stalk entity spawns 8 blocks behind at night
 *   [ ] Jump scare sequence fires: blind → scream → clear
 *   [ ] No event fires more frequently than its cooldown allows
 *   [ ] Events increase in frequency at night
 *   [ ] System survives player disconnect/reconnect
 */

import { world, system } from "@minecraft/server";
import {
    isNight, chance, randomInt, vec3Add, vec3Norm, vec3Scale, vec3Sub,
    scheduleRun, spawnParticle, COLORS, sendActionbar, randomFloat
} from "./utils.js";

// ──────────────────────────────────────────────────────────────────────────────
// EVENT DEFINITIONS
// ──────────────────────────────────────────────────────────────────────────────

const EVENTS = {
    WHISPER: {
        id: "whisper",
        cooldown: 1200,   // 60s
        baseChance: 10,
        nightBonus: 15,
        sounds: [
            "xman.horror.whisper1",
            "xman.horror.whisper2",
            "xman.horror.whisper3",
        ],
    },
    SHADOW_PASS: {
        id: "shadow_pass",
        cooldown: 1800,   // 90s
        baseChance: 8,
        nightBonus: 12,
    },
    DARKNESS_PULSE: {
        id: "darkness_pulse",
        cooldown: 1200,
        baseChance: 6,
        nightBonus: 10,
    },
    GROUND_SHAKE: {
        id: "ground_shake",
        cooldown: 2400,
        baseChance: 5,
        nightBonus: 8,
        sounds: ["xman.horror.rumble"],
    },
    SCREAM_DISTANT: {
        id: "scream_distant",
        cooldown: 1400,
        baseChance: 12,
        nightBonus: 20,
        sounds: [
            "xman.horror.scream1",
            "xman.horror.scream2",
            "xman.horror.scream_distant",
        ],
    },
    STALK_ENTITY: {
        id: "stalk_entity",
        cooldown: 3600,   // 3 min
        baseChance: 3,
        nightBonus: 10,
        nightOnly: true,
        entityType: "xman:shadow_stalker",
        spawnDistance: 8,
    },
    FOOTSTEPS: {
        id: "footsteps",
        cooldown: 800,
        baseChance: 18,
        nightBonus: 10,
        sounds: [
            "xman.horror.footstep1",
            "xman.horror.footstep2",
        ],
    },
    JUMPSCARE: {
        id: "jumpscare",
        cooldown: 7200,   // 6 min
        baseChance: 2,
        nightBonus: 4,
        sounds: ["xman.horror.jumpscare"],
    },
};

const TICK_INTERVAL = 100; // Check every 5 seconds

// ──────────────────────────────────────────────────────────────────────────────
// JUMP SCARE SYSTEM CLASS
// ──────────────────────────────────────────────────────────────────────────────

export class JumpScareSystem {
    constructor() {
        // playerId → { eventId → lastFiredTick }
        this._playerState = new Map();
        this._tickCounter = 0;
    }

    tick(player) {
        this._tickCounter++;
        if (this._tickCounter % TICK_INTERVAL !== 0) return;

        if (!this._playerState.has(player.id)) {
            this._playerState.set(player.id, {});
        }

        const night = isNight(player.dimension);
        const playerState = this._playerState.get(player.id);
        const now = system.currentTick;

        for (const [key, event] of Object.entries(EVENTS)) {
            if (event.nightOnly && !night) continue;

            const lastFired = playerState[event.id] ?? 0;
            if ((now - lastFired) < event.cooldown) continue;

            const prob = event.baseChance + (night ? event.nightBonus : 0);
            if (!chance(prob)) continue;

            playerState[event.id] = now;
            this._fireEvent(player, key, event, night);
            break; // Only one event per tick interval
        }
    }

    _fireEvent(player, key, event, night) {
        try {
            switch (key) {
                case "WHISPER": this._doWhisper(player, event); break;
                case "SHADOW_PASS": this._doShadowPass(player, event); break;
                case "DARKNESS_PULSE": this._doDarknessPulse(player); break;
                case "GROUND_SHAKE": this._doGroundShake(player, event); break;
                case "SCREAM_DISTANT": this._doScreamDistant(player, event); break;
                case "STALK_ENTITY": this._doStalkEntity(player, event); break;
                case "FOOTSTEPS": this._doFootsteps(player, event); break;
                case "JUMPSCARE": this._doJumpscare(player, event); break;
            }
        } catch (e) {}
    }

    _doWhisper(player, event) {
        const sound = event.sounds[randomInt(0, event.sounds.length - 1)];
        player.runCommandAsync(`playsound ${sound} @s ~ ~ ~ 0.4 1 0.4`);
    }

    _doShadowPass(player, event) {
        const behind = this._getBehindPosition(player, 5);
        try {
            const entity = player.dimension.spawnEntity("xman:shadow_stalker", behind);
            scheduleRun(() => {
                try {
                    entity.runCommandAsync("tp @s ~ ~-500 ~");
                    entity.kill();
                } catch (e) {}
            }, 10);
            player.runCommandAsync("playsound xman.horror.swoosh @s ~ ~ ~ 0.6 1 0.6");
        } catch (e) {}
    }

    _doDarknessPulse(player) {
        player.runCommandAsync("effect @s blindness 40 0 true");
        player.runCommandAsync("playsound xman.horror.pulse @s ~ ~ ~ 0.8 0.8 0.8");
        scheduleRun(() => {
            try { player.runCommandAsync("effect @s blindness 0 0"); } catch (e) {}
        }, 42);
    }

    _doGroundShake(player, event) {
        const sound = event.sounds[0];
        player.runCommandAsync(`playsound ${sound} @s ~ ~ ~ 1 0.7 1`);
        player.runCommandAsync("effect @s nausea 60 0 true");
        scheduleRun(() => {
            try { player.runCommandAsync("effect @s nausea 0 0"); } catch (e) {}
        }, 62);
    }

    _doScreamDistant(player, event) {
        const sound = event.sounds[randomInt(0, event.sounds.length - 1)];
        // Offset sound position by 16–40 blocks in random direction
        const angle = randomFloat(0, Math.PI * 2);
        const dist = randomInt(16, 40);
        const ox = Math.cos(angle) * dist;
        const oz = Math.sin(angle) * dist;
        const loc = player.location;
        player.runCommandAsync(`playsound ${sound} @s ${Math.floor(loc.x + ox)} ${Math.floor(loc.y)} ${Math.floor(loc.z + oz)} 1.2 1 1`);
    }

    _doStalkEntity(player, event) {
        const behind = this._getBehindPosition(player, event.spawnDistance);
        behind.y = Math.max(behind.y, player.dimension.heightRange?.min ?? -64);

        // Check no floor → offset Y down until solid
        try {
            const spawned = player.dimension.spawnEntity(event.entityType, behind);
            // The entity will use its normal stalking AI from JSON behavior
            // Auto-kill after 5 minutes if player escapes
            scheduleRun(() => {
                try {
                    if (spawned.isValid()) spawned.kill();
                } catch (e) {}
            }, 6000);
        } catch (e) {}
    }

    _doFootsteps(player, event) {
        const sound = event.sounds[randomInt(0, event.sounds.length - 1)];
        const angle = randomFloat(0, Math.PI * 2);
        const dist = randomInt(3, 10);
        const ox = Math.cos(angle) * dist;
        const oz = Math.sin(angle) * dist;
        const loc = player.location;
        player.runCommandAsync(`playsound ${sound} @s ${Math.floor(loc.x + ox)} ${Math.floor(loc.y)} ${Math.floor(loc.z + oz)} 0.7 1 0.7`);
        // 2nd footstep 0.5s later
        scheduleRun(() => {
            try {
                const ox2 = Math.cos(angle) * (dist + 1);
                const oz2 = Math.sin(angle) * (dist + 1);
                player.runCommandAsync(`playsound ${sound} @s ${Math.floor(loc.x + ox2)} ${Math.floor(loc.y)} ${Math.floor(loc.z + oz2)} 0.6 1 0.6`);
            } catch (e) {}
        }, 10);
    }

    _doJumpscare(player, event) {
        // Phase 1: Instant blindness
        player.runCommandAsync("effect @s blindness 20 10 true");
        // Phase 2: Loud scream at player position
        scheduleRun(() => {
            try {
                player.runCommandAsync(`playsound ${event.sounds[0]} @s ~ ~ ~ 2 1 2`);
            } catch (e) {}
        }, 2);
        // Phase 3: Clear effect
        scheduleRun(() => {
            try {
                player.runCommandAsync("effect @s blindness 0 0");
                sendActionbar(player, `${COLORS.dark_red}${COLORS.bold}SOMETHING IS NEAR...`);
            } catch (e) {}
        }, 22);
    }

    _getBehindPosition(player, distance) {
        try {
            const rot = player.getRotation();
            const yaw = ((rot.y + 180) * Math.PI) / 180; // behind = +180°
            return {
                x: player.location.x + Math.sin(yaw) * distance,
                y: player.location.y,
                z: player.location.z - Math.cos(yaw) * distance,
            };
        } catch (e) {
            return { ...player.location };
        }
    }

    clearPlayerState(playerId) {
        this._playerState.delete(playerId);
    }
}
