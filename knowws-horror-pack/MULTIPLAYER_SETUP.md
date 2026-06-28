# Multiplayer & Installation Guide — KNOWWS Horror Pack

## How to add the pack to your EXISTING world (drag & drop)

### Step 1 — Import the pack (one time)
1. Download `KNOWWS_Horror_Pack.mcaddon`
2. **Double-click** it (Windows) or open it with Minecraft
3. Minecraft imports both Behavior Pack + Resource Pack automatically

### Step 2 — Attach to your current world
1. Open Minecraft → **Settings** → **Storage**
2. Find your world → tap **Manage** (pencil icon)
3. Scroll to **Behavior Packs** → find **KNOWWS Horror Pack BP** → tap **+**
4. Confirm **Resource Pack** also activated (should auto-link)
5. Enable experiments:
   - **Holiday Creator Features**
   - **Beta APIs**
   - **Custom Biomes**
6. **Re-enter your world**

That's it — same world, all new content in new chunks.

---

## Can my friend see everything WITHOUT installing on their laptop?

### Short answer: **No manual install needed, but they MUST download packs when joining YOU.**

Minecraft Bedrock works like this:

| Scenario | What happens |
|----------|--------------|
| **You host, friend joins your world** | Friend gets a popup: *"Download packs to join?"* — they tap **Download**. Packs sync automatically from YOUR world. |
| **Friend skips download** | They see broken textures, missing mobs, can't use custom items. **Won't work.** |
| **Friend installs .mcaddon themselves AND joins your world** | Also works — both methods are fine. |
| **Friend hosts their own world without packs** | They won't see any custom content. |

### What YOU need to do (host on PC):
1. Apply packs to **your** world (steps above)
2. Open world to **LAN** or invite friend via Xbox Friends
3. Tell friend: **"When you join, tap DOWNLOAD on the pack prompt"**
4. Friend does NOT need to find the file — Minecraft sends it from your world

### For Xbox / PlayStation / Switch friends:
- Same rule: they must **accept pack download** when joining
- Console players cannot drag `.mcaddon` files easily — joining YOUR world with pack download is the easiest way

### For Realms:
1. You upload packs to the Realm in Realm settings
2. All members get packs automatically

---

## Off-hand torch (the "glow in off-hand" feature)

1. Craft **Glow Torch**: torch + glowstone dust (4 torches)
2. Open inventory → move Glow Torch to **off-hand slot** (shield slot)
3. Real light blocks appear around you in caves
4. Works with vanilla torch, soul torch, Cave Lantern too

---

## Talk to Verity with your microphone

### In-game (works inside Minecraft):
- Craft **Verity Microphone** (iron + redstone + horror crystal)
- **Right-click** to open voice phrase menu — instant responses
- Or type: `v hello` or `mic where are diamonds` in chat

### Real PC microphone (best experience):
1. Open **`verity-voice.html`** in Chrome or Edge (same folder as download)
2. Click **🎤 Hold to Talk**
3. Speak — Verity hears you and **talks back with voice**
4. Keep Minecraft open on the other monitor — responses also show in-game if you type `v <what you said>`

> **Why two methods?** Minecraft Bedrock addons cannot access your PC microphone directly (Mojang limitation). The voice webpage uses your browser's mic and speaks Verity's replies aloud.

---

## New custom ores (mine underground)

| Ore | Y Level | Smelts to | Used for |
|-----|---------|-----------|----------|
| Blood Ore | -64 to 32 | Blood Ingot | Guns, horror gear |
| Silver Ore | -48 to 48 | Silver Ingot | Armor, ammo |
| Cursed Ore | -32 to 16 | Cursed Ingot | Cursed Blade & armor |
| Nightmare Ore | -64 to 0 | Nightmare Shard | Nightmare Scythe |
| Plague Ore | 0 to 48 | Plague Ingot | Plague Cannon |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Friend sees vanilla mobs only | They didn't download packs — rejoin and tap Download |
| Guns don't work | Enable Beta APIs |
| No custom ores | Enable Holiday Creator Features, explore NEW chunks |
| Verity voice menu won't open | Enable Beta APIs |
| Mic webpage doesn't hear me | Use Chrome/Edge, allow microphone permission |
