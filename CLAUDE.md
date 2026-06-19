# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Two standalone self-contained HTML files — no build step, no package manager, no external dependencies:

- **`index.html`** — "Sky Flapper": a Flappy Bird-style canvas game optimized for mobile
- **`jarvis.html`** — "J.A.R.V.I.S": a voice-driven AI assistant PWA that calls the Anthropic Claude API directly from the browser

## Running / Developing

Open either file directly in a browser, or serve them with any static server:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

There is no build, transpilation, lint, or test step.

## Architecture: Sky Flapper (`index.html`)

All game code lives in a single IIFE inside a `<script>` tag at the bottom of the file.

**Virtual coordinate system**: The game renders to a fixed virtual canvas of 400×~700px, then scales it to fill any real screen. `VW = 400` is constant; `VH` adapts to the actual viewport aspect ratio. `scale` maps virtual units to real pixels. All physics constants (`GRAVITY`, `FLAP_V`, `PIPE_SPEED`, etc.) are in virtual-space units.

**State machine**: `state` is a string — `'menu'`, `'play'`, or `'over'`. The main `loop(t)` runs via `requestAnimationFrame` only during `'play'` and flash-fade; idle menu animation uses its own separate `idleFrame()` RAF loop.

**Rendering pipeline**: `render()` → `drawSky()` → clouds → pipes → `drawGround()` → `drawBird()`. Each draw call uses `ctx.save()`/`ctx.restore()` with the transform already set on entry.

**Persistence**: High score in `localStorage` under key `skyFlapperBest`.

**iOS input**: Buttons use a custom `bindBtn()` helper that arms on `pointerdown` and fires on `pointerup` — required because iOS Safari swallows `click` events on canvas-overlaid buttons.

## Architecture: Jarvis (`jarvis.html`)

All logic is a single IIFE. Settings are persisted in `localStorage` under keys `jarvis_key`, `jarvis_model`, `jarvis_wake`, and `jarvis_voice`.

**Command pipeline**: User input (voice or text) → wake-word stripping (if configured) → `processCommand()` → `tryLocal()` first, then `askClaude()` fallback if an API key is set.

**Speech recognition**: Uses `window.SpeechRecognition` / `window.webkitSpeechRecognition` with `continuous = false` and auto-restart on `onend` — this single-shot-with-restart pattern is required for iOS Safari reliability.

**Claude API calls**: Made directly from the browser to `https://api.anthropic.com/v1/messages` using the `anthropic-dangerous-direct-browser-access: true` header. The system prompt locks Jarvis to 1–3 short plain-spoken sentences (no markdown) so responses are TTS-friendly. The last 10 messages of `history[]` are sent on each call.

**Orb visual states**: The central orb cycles between CSS classes `listening` (cyan pulse), `thinking` (purple pulse), and `speaking` (golden wobble). `setOrb(mode)` removes all three and adds the requested one.

**Voice selection**: `pickVoice()` applies a ranked preference list (Daniel → Oliver → Arthur → en-GB enhanced → en-US) before falling back to whatever the browser provides — this targets the best available male English voice on iOS.

## Key Conventions

- Both files are fully self-contained — keep all CSS, JS, and markup in the single HTML file; do not split into separate assets.
- No external CDN links, no npm imports, no frameworks.
- Target browsers: modern mobile Safari (iOS 16+) and Chrome for Android; desktop Chrome/Firefox/Safari are secondary.
- Use `pointer*` events (not `mouse*`) for all interactive elements.
- Math evaluation in `tryLocal()` uses `new Function(...)` deliberately — this is intentional and the eslint suppression comment should remain.
