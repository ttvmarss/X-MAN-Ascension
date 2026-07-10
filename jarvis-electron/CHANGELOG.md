# Jarvis Changelog

## Phase 1 — Foundation (v1.0.0)

### Added
- Electron app shell with frameless, transparent window
- Orb animation (HTML5 Canvas) with 4 visually distinct states:
  - Idle: gentle breathing pulse, low energy, dim glow
  - Listening: brighter core, expanded membrane, faster rotation
  - Processing: blue-shifted color, increased rotation, energy shimmer
  - Speaking: strongest pulse timed to voice output, expanded membrane
- Orb visual layers: dual wireframe membrane rings with organic wobble,
  inner boundary ring, fibonacci-sphere core with 3D perspective projection,
  ambient dust particles
- Time-of-day color shift (cooler at night, warmer in daytime)
- Voice input via Web Speech API (SpeechRecognition)
- Voice output via Web Speech API (SpeechSynthesis), tuned calmer/slower
- Persistent local memory (encrypted JSON on disk via AES-256-CBC)
- Varied, non-repeating, time-aware greetings on launch
- Basic responses: time, date, name recall, calculations, temperature
  conversions, identity, help, farewell
- Mute/unmute microphone toggle
- Optional wake phrase support ("Hey Jarvis")
- Memory clear command
- Conversation history tracking
- electron-builder configuration for Windows portable .exe packaging
