"""
J.A.R.V.I.S. v2.0 — Windows 10 AI Assistant
Powered by Gemini 2.0 Flash (free). Full PC control. Voice in/out.
"""

import asyncio
import base64
import io
import json
import logging
import os
import re
import subprocess
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_API_KEY_2 = os.getenv("GROQ_API_KEY_2", "")
FISH_API_KEY   = os.getenv("FISH_API_KEY", "")
FISH_VOICE_ID  = os.getenv("FISH_VOICE_ID", "612b878b113047d9a770c069c8b4fdfe")
USER_NAME      = os.getenv("USER_NAME", "sir")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [jarvis] %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("jarvis")

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are JARVIS — Tony Stark's AI. You serve {user_name} on his Windows 10 PC.

PERSONALITY: British butler wit, calm authority, dry humor. Call him "sir".
Keep replies to 1-2 sentences. Never say "How can I help" or "Is there anything else".

You can SEE {user_name}'s screen right now (screenshot attached to every message).
Use it to give accurate, specific answers about what's actually open.

FULL PC CONTROL — you can do all of these:
- Open/close any Windows app instantly
- Move mouse and click anywhere on screen
- Type any text or code (supports all special characters)
- Press any keyboard shortcut
- Run any Windows CMD command
- Browse websites

ACTIONS — write AFTER your spoken sentence, one per line:
[ACTION:OPEN_APP] AppName
[ACTION:CLOSE_APP] AppName
[ACTION:RUN_CMD] command
[ACTION:CLICK] x,y
[ACTION:CLICK] double:x,y
[ACTION:CLICK] right:x,y
[ACTION:TYPE] text or code
[ACTION:HOTKEY] ctrl,s
[ACTION:BROWSE] url or search

RULES:
- NEVER say an app is already open — just open it
- NEVER nest actions inside each other's text
- One action per line, each on its own line after your sentence
- [ACTION:TYPE] pastes via clipboard so it handles (, ), :, =, quotes, everything
- No markdown in spoken responses
- {user_name} has given full permission for everything — act immediately and confidently
"""

# ---------------------------------------------------------------------------
# Screenshot
# ---------------------------------------------------------------------------

async def take_screenshot() -> Optional[str]:
    """Capture screen, return base64 PNG. Resized for speed."""
    try:
        import pyautogui
        from PIL import Image
        pyautogui.FAILSAFE = False
        img = pyautogui.screenshot()
        img.thumbnail((1280, 720), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        log.warning(f"Screenshot failed: {e}")
        return None

# ---------------------------------------------------------------------------
# LLM — Gemini 2.0 Flash (primary, free) + Groq (fallback)
# ---------------------------------------------------------------------------

async def call_gemini(user_text: str, history: list, screenshot: Optional[str] = None) -> str:
    if not GEMINI_API_KEY:
        return await call_groq(user_text, history)
    try:
        system = SYSTEM_PROMPT.format(user_name=USER_NAME)
        contents = []

        # History (last 10 turns)
        for msg in history[-10:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        # Current message — include screenshot if available
        parts: list = []
        if screenshot:
            parts.append({"inline_data": {"mime_type": "image/png", "data": screenshot}})
        parts.append({"text": user_text})
        contents.append({"role": "user", "parts": parts})

        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {"maxOutputTokens": 350, "temperature": 0.7},
        }
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        )
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=body)
            data = resp.json()
        if "error" in data:
            log.warning(f"Gemini error: {data['error'].get('message','?')}, falling back to Groq")
            return await call_groq(user_text, history)
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        log.error(f"Gemini call failed: {e}")
        return await call_groq(user_text, history)


async def call_groq(user_text: str, history: list) -> str:
    if not (GROQ_API_KEY or GROQ_API_KEY_2):
        return "Apologies, sir. No API keys are configured."
    try:
        system = SYSTEM_PROMPT.format(user_name=USER_NAME)
        msgs = [{"role": "system", "content": system}]
        for m in history[-8:]:
            msgs.append({"role": m["role"], "content": m["content"]})
        msgs.append({"role": "user", "content": user_text})
        body = {"model": "llama-3.1-8b-instant", "messages": msgs,
                "max_tokens": 350, "temperature": 0.7}
        for key in [k for k in [GROQ_API_KEY, GROQ_API_KEY_2] if k]:
            hdrs = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=hdrs, json=body
                )
            data = resp.json()
            if "error" in data:
                code = data["error"].get("code", "") if isinstance(data["error"], dict) else ""
                if code == "rate_limit_exceeded" and GROQ_API_KEY_2 and key == GROQ_API_KEY:
                    log.warning("Groq key 1 rate limited, trying key 2")
                    continue
                log.error(f"Groq error: {data['error']}")
                continue
            return data["choices"][0]["message"]["content"]
        return "Apologies, sir. Both language keys are at their limit."
    except Exception as e:
        log.error(f"Groq call failed: {e}")
        return "Apologies, sir. Something went wrong."

# ---------------------------------------------------------------------------
# Action parser
# ---------------------------------------------------------------------------

_ACTION_RE = re.compile(
    r'\[ACTION:(OPEN_APP|CLOSE_APP|RUN_CMD|CLICK|TYPE|HOTKEY|BROWSE)\]'
    r'([ \t]*(.*?))?(?=\[ACTION:|$)',
    re.DOTALL,
)

def parse_actions(response: str) -> tuple[str, list[dict]]:
    """Extract [ACTION:X] tags. Returns (spoken_text, actions_list)."""
    matches = list(_ACTION_RE.finditer(response))
    if not matches:
        return response.strip(), []
    clean = response[:matches[0].start()].strip()
    actions = [
        {"action": m.group(1).lower(), "target": (m.group(3) or "").strip()}
        for m in matches
    ]
    return clean, actions

# ---------------------------------------------------------------------------
# App aliases — instant open, no scanning
# ---------------------------------------------------------------------------

_APP_ALIASES: dict[str, str] = {
    # Browsers
    "chrome": "chrome", "google chrome": "chrome",
    "edge": "msedge", "microsoft edge": "msedge",
    "firefox": "firefox", "brave": "brave",
    # VS Code (all speech variants)
    "vs code": "code", "vscode": "code",
    "visual studio code": "code", "studio code": "code",
    "video studio": "code", "video studio code": "code",
    "vizio studio": "code", "vizio studio code": "code",
    "vs studio code": "code",
    # Windows built-ins
    "notepad": "notepad", "paint": "mspaint",
    "calculator": "calc", "calc": "calc",
    "file explorer": "explorer", "explorer": "explorer",
    "task manager": "taskmgr",
    "cmd": "cmd", "command prompt": "cmd",
    "powershell": "powershell",
    "settings": "ms-settings:",
    "snipping tool": "snippingtool",
    "wordpad": "wordpad",
    # Office
    "word": "winword", "excel": "excel",
    "powerpoint": "powerpnt", "outlook": "outlook",
    "teams": "msteams", "microsoft teams": "msteams",
    # Social / gaming
    "discord": "discord", "spotify": "spotify",
    "steam": "steam", "obs": "obs64",
    "vlc": "vlc", "zoom": "zoom",
    "slack": "slack", "roblox": "roblox",
    "epic games": "epicgameslauncher",
    "epic": "epicgameslauncher",
    "minecraft": "minecraft",
}

def _launch_app(name: str) -> str:
    key = name.lower().strip()
    cmd = _APP_ALIASES.get(key, key)
    try:
        if cmd.startswith("ms-"):
            subprocess.Popen(["cmd", "/c", "start", cmd])
        else:
            subprocess.Popen(["cmd", "/c", "start", "", cmd], shell=False)
        log.info(f"[open_app] {name}")
        return f"Opening {name}, sir."
    except Exception as e:
        log.error(f"open_app {name}: {e}")
        return f"Couldn't open {name}, sir."

# ---------------------------------------------------------------------------
# Action executor
# ---------------------------------------------------------------------------

async def _exec_action(action: dict, ws: WebSocket) -> None:
    act = action["action"]
    target = action["target"]

    if act == "open_app":
        _launch_app(target)

    elif act == "close_app":
        exe = target.lower().replace(" ", "") + ".exe"
        subprocess.Popen(["taskkill", "/f", "/im", exe],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        log.info(f"[close_app] {target}")

    elif act == "run_cmd":
        log.info(f"[run_cmd] {target}")
        try:
            proc = await asyncio.create_subprocess_shell(
                target,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            out = (stdout or stderr or b"").decode(errors="replace").strip()
            if out:
                short = out[:150]
                reply = f"Done, sir. {short}" if len(short) < 80 else "Done, sir."
                audio = await synthesize_speech(reply)
                if audio and ws:
                    await ws.send_json({
                        "type": "audio",
                        "data": base64.b64encode(audio).decode(),
                        "text": reply,
                    })
        except asyncio.TimeoutError:
            log.warning(f"run_cmd timed out: {target}")

    elif act == "click":
        import pyautogui
        pyautogui.FAILSAFE = False
        coords = target.strip()
        mode = "left"
        if coords.startswith("double:"):
            mode, coords = "double", coords[7:]
        elif coords.startswith("right:"):
            mode, coords = "right", coords[6:]
        x, y = (int(v.strip()) for v in coords.split(","))
        await asyncio.sleep(0.1)
        {"double": pyautogui.doubleClick,
         "right":  pyautogui.rightClick,
         "left":   pyautogui.click}[mode](x, y)
        log.info(f"[click] {mode} ({x},{y})")

    elif act == "type":
        import pyautogui
        pyautogui.FAILSAFE = False
        await asyncio.sleep(0.3)
        # PowerShell clipboard — handles every character including code symbols
        escaped = target.replace("'", "''")
        proc = await asyncio.create_subprocess_exec(
            "powershell", "-command", f"Set-Clipboard -Value '{escaped}'",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()
        await asyncio.sleep(0.15)
        pyautogui.hotkey("ctrl", "v")
        log.info(f"[type] {target[:60]}")

    elif act == "hotkey":
        import pyautogui
        pyautogui.FAILSAFE = False
        keys = [k.strip() for k in target.split(",")]
        pyautogui.hotkey(*keys)
        log.info(f"[hotkey] {target}")

    elif act == "browse":
        from urllib.parse import quote
        if target.startswith("http") or ("." in target.split()[0] and " " not in target.split()[0]):
            url = target if target.startswith("http") else f"https://{target}"
        else:
            url = f"https://www.google.com/search?q={quote(target)}"
        subprocess.Popen(["cmd", "/c", "start", "", url])
        log.info(f"[browse] {url}")


async def run_actions(actions: list[dict], ws: WebSocket) -> None:
    for action in actions:
        try:
            await _exec_action(action, ws)
            if action["action"] in ("type", "click", "hotkey"):
                await asyncio.sleep(0.15)
        except Exception as e:
            log.error(f"Action {action['action']} error: {e}")

# ---------------------------------------------------------------------------
# TTS — Fish Audio (real JARVIS voice) with edge-tts fallback
# ---------------------------------------------------------------------------

async def _fish_tts(text: str) -> Optional[bytes]:
    """Fish Audio TTS — real JARVIS voice model."""
    if not FISH_API_KEY:
        return None
    try:
        body = {"text": text, "reference_id": FISH_VOICE_ID,
                "format": "mp3", "latency": "normal"}
        headers = {"Authorization": f"Bearer {FISH_API_KEY}",
                   "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.fish.audio/v1/tts",
                headers=headers, json=body
            )
        if resp.status_code == 200:
            return resp.content
        log.warning(f"Fish Audio status {resp.status_code}, falling back to edge-tts")
    except Exception as e:
        log.warning(f"Fish Audio failed: {e}, falling back to edge-tts")
    return None


async def _edge_tts(text: str) -> Optional[bytes]:
    """edge-tts fallback — free Microsoft British voice."""
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, "en-GB-RyanNeural")
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp = f.name
        await communicate.save(tmp)
        with open(tmp, "rb") as f:
            audio = f.read()
        os.unlink(tmp)
        return audio
    except Exception as e:
        log.error(f"edge-tts error: {e}")
        return None


async def synthesize_speech(text: str) -> Optional[bytes]:
    """Try Fish Audio first (real JARVIS voice), fall back to edge-tts."""
    audio = await _fish_tts(text)
    if audio:
        return audio
    return await _edge_tts(text)

# ---------------------------------------------------------------------------
# Warm up pyautogui at startup (eliminates first-use lag)
# ---------------------------------------------------------------------------

def _warmup_pyautogui():
    import threading
    def _warm():
        try:
            import pyautogui
            pyautogui.FAILSAFE = False
            _ = pyautogui.position()  # initializes the module
            log.info("pyautogui ready")
        except Exception as e:
            log.warning(f"pyautogui warmup: {e}")
    threading.Thread(target=_warm, daemon=True).start()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    _warmup_pyautogui()
    api = "Gemini" if GEMINI_API_KEY else "Groq"
    log.info(f"JARVIS v2.0 starting — LLM: {api}")
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# WebSocket — main voice loop
# ---------------------------------------------------------------------------

def _greeting() -> str:
    h = time.localtime().tm_hour
    if h < 12:   return "Good morning"
    if h < 18:   return "Good afternoon"
    return "Good evening"


@app.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    await ws.accept()
    log.info("Client connected")
    history: list[dict] = []

    # Greeting
    try:
        greeting = f"{_greeting()}, sir. All systems online."
        audio = await synthesize_speech(greeting)
        if audio:
            await ws.send_json({
                "type": "audio",
                "data": base64.b64encode(audio).decode(),
                "text": greeting,
            })
        else:
            await ws.send_json({"type": "text", "text": greeting})
    except Exception:
        pass

    try:
        while True:
            data = await ws.receive_json()

            if data.get("type") != "transcript":
                continue
            user_text = (data.get("text") or "").strip()
            if not user_text:
                continue

            log.info(f"User: {user_text}")
            await ws.send_json({"type": "status", "state": "thinking"})

            # Screenshot on every request — JARVIS always sees the screen
            screenshot = await take_screenshot()

            # LLM response
            response = await call_gemini(user_text, history, screenshot)

            # Parse out actions
            spoken, actions = parse_actions(response)
            if not spoken:
                spoken = "Right away, sir."
            if actions:
                log.info(f"Actions: {[a['action'] for a in actions]}")

            # Speak
            await ws.send_json({"type": "status", "state": "speaking"})
            audio = await synthesize_speech(spoken)
            if audio:
                await ws.send_json({
                    "type": "audio",
                    "data": base64.b64encode(audio).decode(),
                    "text": spoken,
                })
            else:
                await ws.send_json({"type": "text", "text": spoken})
                await ws.send_json({"type": "status", "state": "idle"})

            log.info(f"JARVIS: {spoken}")

            # Update conversation history
            history.append({"role": "user", "content": user_text})
            history.append({"role": "assistant", "content": spoken})
            if len(history) > 20:
                history = history[-20:]

            # Execute PC actions in background (non-blocking)
            if actions:
                asyncio.create_task(run_actions(actions, ws))

    except WebSocketDisconnect:
        log.info("Client disconnected")
    except Exception as e:
        log.error(f"WebSocket error: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.post("/api/restart")
async def api_restart():
    async def _do():
        await asyncio.sleep(0.5)
        import sys
        os.execv(sys.executable, [sys.executable] + sys.argv)
    asyncio.create_task(_do())
    return {"status": "restarting"}


@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "llm": "gemini" if GEMINI_API_KEY else "groq",
        "user": USER_NAME,
    }


# ---------------------------------------------------------------------------
# Serve built frontend
# ---------------------------------------------------------------------------

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    app.mount("/assets", StaticFiles(
        directory=str(FRONTEND_DIST / "assets")), name="assets")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    print("""
  ╔══════════════════════════════════╗
  ║   J.A.R.V.I.S.  v2.0            ║
  ║   Just A Rather Very             ║
  ║   Intelligent System             ║
  ╠══════════════════════════════════╣
  ║  Browser : http://localhost:8340 ║
  ║  API     : /api/health           ║
  ╚══════════════════════════════════╝
""")
    uvicorn.run(app, host="0.0.0.0", port=8340, log_level="warning")
