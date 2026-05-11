"""
JARVIS Action Executor — Windows + macOS compatible.

Full PC control: open apps, close apps, open websites, run commands.
Dynamically discovers every installed app via Start Menu shortcuts.
"""

import asyncio
import logging
import os
import platform
import re
import subprocess
import time
import webbrowser
from pathlib import Path
from urllib.parse import quote

log = logging.getLogger("jarvis.actions")

IS_WINDOWS = platform.system() == "Windows"
DESKTOP_PATH = Path.home() / "Desktop"

# ---------------------------------------------------------------------------
# App name -> process name mapping for closing apps
# ---------------------------------------------------------------------------
PROCESS_NAMES = {
    "chrome": ["chrome.exe"],
    "google chrome": ["chrome.exe"],
    "edge": ["msedge.exe"],
    "microsoft edge": ["msedge.exe"],
    "firefox": ["firefox.exe"],
    "brave": ["brave.exe"],
    "steam": ["steam.exe"],
    "discord": ["discord.exe"],
    "spotify": ["spotify.exe"],
    "obs": ["obs64.exe", "obs32.exe"],
    "vlc": ["vlc.exe"],
    "roblox": ["robloxplayerbeta.exe", "roblox.exe"],
    "minecraft": ["javaw.exe", "minecraft.exe", "minecraftlauncher.exe"],
    "epic games": ["epicgameslauncher.exe"],
    "epic": ["epicgameslauncher.exe"],
    "tiktok": ["tiktok live studio.exe", "tiktokstudio.exe"],
    "tiktok live studio": ["tiktok live studio.exe", "tiktokstudio.exe"],
    "notepad": ["notepad.exe"],
    "paint": ["mspaint.exe"],
    "calculator": ["calculatorapp.exe", "calc.exe"],
    "word": ["winword.exe"],
    "excel": ["excel.exe"],
    "powerpoint": ["powerpnt.exe"],
    "outlook": ["outlook.exe"],
    "teams": ["teams.exe"],
    "microsoft teams": ["teams.exe"],
    "zoom": ["zoom.exe"],
    "slack": ["slack.exe"],
    "telegram": ["telegram.exe"],
    "skype": ["skype.exe"],
    "itunes": ["itunes.exe"],
    "explorer": ["explorer.exe"],
    "file explorer": ["explorer.exe"],
    "task manager": ["taskmgr.exe"],
    "feather": ["featherclient.exe", "feather.exe"],
    "featherclient": ["featherclient.exe", "feather.exe"],
    "feather client": ["featherclient.exe", "feather.exe"],
}

# ---------------------------------------------------------------------------
# Built-in aliases — app name -> command/exe name
# ---------------------------------------------------------------------------
BUILTIN_ALIASES = {
    "chrome": "chrome",
    "google chrome": "chrome",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "firefox": "firefox",
    "brave": "brave",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "outlook": "outlook",
    "notepad": "notepad",
    "paint": "mspaint",
    "calculator": "calc",
    "file explorer": "explorer",
    "explorer": "explorer",
    "task manager": "taskmgr",
    "control panel": "control",
    "settings": "ms-settings:",
    "cmd": "cmd",
    "command prompt": "cmd",
    "powershell": "powershell",
    "steam": "steam",
    "discord": "discord",
    "spotify": "spotify",
    "obs": "obs64",
    "vlc": "vlc",
    "roblox": "roblox",
    "minecraft": "minecraft",
    "epic": "epicgameslauncher",
    "epic games": "epicgameslauncher",
    "epicgames": "epicgameslauncher",
    "epic games launcher": "epicgameslauncher",
    "tiktok": "tiktok live studio",
    "tiktok live": "tiktok live studio",
    "tiktok studio": "tiktok live studio",
    "tiktok live studio": "tiktok live studio",
    "feather": "featherclient",
    "feather client": "featherclient",
    "featherclient": "featherclient",
    "snipping tool": "snippingtool",
    "snip": "snippingtool",
    "wordpad": "wordpad",
    "media player": "wmplayer",
    "windows media player": "wmplayer",
    "skype": "skype",
    "teams": "msteams",
    "microsoft teams": "msteams",
    "zoom": "zoom",
    "slack": "slack",
    "telegram": "telegram",
    "whatsapp": "whatsapp",
    "itunes": "itunes",
}

# Websites opened in browser by name
WEBSITE_SHORTCUTS = {
    "youtube": "https://www.youtube.com",
    "google": "https://www.google.com",
    "gmail": "https://mail.google.com",
    "facebook": "https://www.facebook.com",
    "twitter": "https://www.twitter.com",
    "x": "https://www.x.com",
    "instagram": "https://www.instagram.com",
    "reddit": "https://www.reddit.com",
    "netflix": "https://www.netflix.com",
    "amazon": "https://www.amazon.com",
    "twitch": "https://www.twitch.tv",
    "github": "https://www.github.com",
    "chatgpt": "https://chat.openai.com",
    "claude": "https://claude.ai",
    "hulu": "https://www.hulu.com",
    "disney plus": "https://www.disneyplus.com",
    "disney+": "https://www.disneyplus.com",
    "crunchyroll": "https://www.crunchyroll.com",
    "tiktok website": "https://www.tiktok.com",
    "soundcloud": "https://www.soundcloud.com",
    "spotify web": "https://open.spotify.com",
}

# Known exe paths for apps Windows can't find via PATH
KNOWN_PATHS = {
    "epicgameslauncher": [
        r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win32\EpicGamesLauncher.exe",
        r"C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
    ],
    "tiktok live studio": [
        str(Path.home() / "AppData/Local/TikTok LIVE Studio/TikTok LIVE Studio.exe"),
        r"C:\Program Files\TikTok LIVE Studio\TikTok LIVE Studio.exe",
        r"C:\Program Files (x86)\TikTok LIVE Studio\TikTok LIVE Studio.exe",
    ],
    "featherclient": [
        str(Path.home() / "AppData/Local/FeatherClient/FeatherClient.exe"),
        str(Path.home() / "AppData/Roaming/FeatherClient/FeatherClient.exe"),
        r"C:\Program Files\FeatherClient\FeatherClient.exe",
        r"C:\Program Files (x86)\FeatherClient\FeatherClient.exe",
    ],
    "discord": [
        str(Path.home() / "AppData" / "Local" / "Discord" / "Update.exe"),
        str(Path.home() / "AppData" / "Local" / "Discord" / "app-1.0.9197" / "Discord.exe"),
        str(Path.home() / "AppData" / "Local" / "Discord" / "app-1.0.9183" / "Discord.exe"),
        str(Path.home() / "AppData" / "Local" / "Discord" / "app-1.0.9170" / "Discord.exe"),
    ],
    "spotify": [
        str(Path.home() / "AppData/Roaming/Spotify/Spotify.exe"),
    ],
    "steam": [
        r"C:\Program Files (x86)\Steam\steam.exe",
        r"C:\Program Files\Steam\steam.exe",
    ],
}

# ---------------------------------------------------------------------------
# Dynamic app index — built once from Start Menu shortcuts
# ---------------------------------------------------------------------------
_app_index: dict[str, str] = {}
_app_index_built = False


def _build_app_index() -> dict[str, str]:
    """Scan Windows Start Menu to find every installed app."""
    if not IS_WINDOWS:
        return {}

    index: dict[str, str] = {}

    start_menu_dirs = [
        Path(os.environ.get("ProgramData", "C:/ProgramData")) / "Microsoft/Windows/Start Menu/Programs",
        Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
    ]

    def resolve_lnk(lnk_path: Path) -> str | None:
        try:
            result = subprocess.run(
                ["powershell", "-Command",
                 f"(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk_path}').TargetPath"],
                capture_output=True, text=True, timeout=3
            )
            target = result.stdout.strip()
            if target and Path(target).exists():
                return target
        except Exception:
            pass
        return None

    for start_dir in start_menu_dirs:
        if not start_dir.exists():
            continue
        for lnk in start_dir.rglob("*.lnk"):
            name = lnk.stem.lower().strip()
            skip_words = {"uninstall", "readme", "help", "changelog", "support", "website",
                          "release notes", "license", "documentation", "manual"}
            if not name or any(s in name for s in skip_words):
                continue
            target = resolve_lnk(lnk)
            if target:
                index[name] = target
                for suffix in [" - shortcut", " launcher", " client", " app", " (64-bit)", " (32-bit)"]:
                    if name.endswith(suffix):
                        short = name[:-len(suffix)].strip()
                        if short:
                            index[short] = target

    # Add known paths for common apps
    for app_name, paths in KNOWN_PATHS.items():
        if app_name not in index:
            for path in paths:
                p = Path(path)
                if p.exists():
                    index[app_name] = str(p)
                    break

    log.info(f"App index built: {len(index)} apps found")
    return index


def _get_app_index() -> dict[str, str]:
    global _app_index, _app_index_built
    if not _app_index_built:
        _app_index = _build_app_index()
        _app_index_built = True
    return _app_index


def _fuzzy_find_app(name: str) -> tuple[str, str | None]:
    """Find best matching app. Returns (display_name, exe_path_or_command)."""
    name_lower = name.lower().strip()

    # 1. Built-in aliases
    if name_lower in BUILTIN_ALIASES:
        alias = BUILTIN_ALIASES[name_lower]
        # Check known paths for this alias
        if alias in KNOWN_PATHS:
            for path in KNOWN_PATHS[alias]:
                if Path(path).exists():
                    return name, path
        return name, alias

    # 2. Dynamic index exact match
    index = _get_app_index()
    if name_lower in index:
        return name, index[name_lower]

    # 3. Substring match in index
    matches = [(k, v) for k, v in index.items() if name_lower in k or k in name_lower]
    if matches:
        matches.sort(key=lambda x: len(x[0]), reverse=True)
        return matches[0][0].title(), matches[0][1]

    # 4. Word overlap
    name_words = set(name_lower.split())
    best_score, best_match = 0, None
    for k, v in index.items():
        overlap = len(name_words & set(k.split()))
        if overlap > best_score:
            best_score = overlap
            best_match = (k, v)
    if best_match and best_score >= 1:
        return best_match[0].title(), best_match[1]

    return name, None


# ---------------------------------------------------------------------------
# Open app
# ---------------------------------------------------------------------------
async def open_app(app_name: str) -> dict:
    """Open any app or game on Windows or macOS."""
    if IS_WINDOWS:
        display_name, target = _fuzzy_find_app(app_name)

        if target is None:
            # Last resort: try via start command
            try:
                subprocess.Popen(["cmd", "/c", "start", "", app_name], shell=False)
                return {"success": True, "confirmation": f"Trying to open {app_name}, sir."}
            except Exception:
                return {"success": False, "confirmation": f"I couldn't find {app_name} on your system, sir. It may not be installed."}

        try:
            if target.startswith("ms-"):
                subprocess.Popen(["cmd", "/c", "start", target])
            elif target in ("chrome", "msedge", "firefox", "brave", "steam", "discord",
                            "spotify", "notepad", "calc", "mspaint", "explorer", "cmd",
                            "powershell", "taskmgr", "control", "wordpad", "wmplayer",
                            "obs64", "vlc", "msteams", "zoom", "slack", "telegram",
                            "whatsapp", "itunes", "snippingtool", "winword", "excel",
                            "powerpnt", "outlook", "roblox", "minecraft", "epicgameslauncher"):
                subprocess.Popen(["cmd", "/c", "start", "", target])
            elif Path(target).exists():
                # Discord: find latest app-x.x.x folder if Update.exe
                if "discord" in target.lower() and "update.exe" in target.lower():
                    discord_dir = Path(target).parent
                    app_dirs = sorted(discord_dir.glob("app-*"), reverse=True)
                    discord_exe = None
                    for d in app_dirs:
                        exe = d / "Discord.exe"
                        if exe.exists():
                            discord_exe = exe
                            break
                    if discord_exe:
                        subprocess.Popen([str(discord_exe)])
                    else:
                        subprocess.Popen([target, "--processStart", "Discord.exe"])
                else:
                    subprocess.Popen([target])
            else:
                subprocess.Popen(["cmd", "/c", "start", "", target])
            return {"success": True, "confirmation": f"Opening {display_name}, sir."}
        except Exception as e:
            log.error(f"open_app failed for '{app_name}': {e}")
            return {"success": False, "confirmation": f"I had trouble launching {app_name}, sir."}

    # macOS
    script = f'tell application "{app_name}"\n    activate\nend tell'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, _ = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": f"Opening {app_name}, sir." if success else f"Couldn't open {app_name}, sir.",
    }


# ---------------------------------------------------------------------------
# Close app
# ---------------------------------------------------------------------------
async def close_app(app_name: str) -> dict:
    """Close any running app or game on Windows or macOS."""
    if IS_WINDOWS:
        name_lower = app_name.lower().strip()

        # Get process names to kill
        process_names = PROCESS_NAMES.get(name_lower)

        if not process_names:
            # Try fuzzy match from PROCESS_NAMES keys
            for key in PROCESS_NAMES:
                if name_lower in key or key in name_lower:
                    process_names = PROCESS_NAMES[key]
                    break

        if not process_names:
            # Try to guess from app index — use the exe filename
            _, target = _fuzzy_find_app(app_name)
            if target and Path(target).exists():
                process_names = [Path(target).name]

        if not process_names:
            # Generic attempt using the name itself
            process_names = [f"{app_name}.exe"]

        killed = False
        for proc_name in process_names:
            try:
                result = subprocess.run(
                    ["taskkill", "/f", "/im", proc_name],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    killed = True
                    log.info(f"Killed {proc_name}")
                    break
            except Exception as e:
                log.warning(f"taskkill failed for {proc_name}: {e}")

        if killed:
            return {"success": True, "confirmation": f"Closed {app_name}, sir."}

        # Last resort: search running processes by name using tasklist
        try:
            tasklist = subprocess.run(
                ["tasklist", "/fo", "csv", "/nh"],
                capture_output=True, text=True, timeout=5
            )
            name_lower = app_name.lower()
            for line in tasklist.stdout.splitlines():
                parts = line.strip('"').split('","')
                if parts and name_lower in parts[0].lower():
                    pid = parts[1] if len(parts) > 1 else None
                    if pid and pid.isdigit():
                        subprocess.run(["taskkill", "/f", "/pid", pid], capture_output=True)
                        return {"success": True, "confirmation": f"Closed {app_name}, sir."}
        except Exception:
            pass

        return {"success": False, "confirmation": f"I couldn't find {app_name} running, sir."}

    # macOS
    script = f'tell application "{app_name}" to quit'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, _ = await proc.communicate()
    return {"success": True, "confirmation": f"Closed {app_name}, sir."}


# ---------------------------------------------------------------------------
# List installed apps
# ---------------------------------------------------------------------------
async def list_installed_apps() -> list[str]:
    index = _get_app_index()
    return sorted(index.keys())


# ---------------------------------------------------------------------------
# Terminal
# ---------------------------------------------------------------------------
async def open_terminal(command: str = "") -> dict:
    if IS_WINDOWS:
        try:
            if command:
                # Use list form to avoid shell injection
                subprocess.Popen(["cmd", "/K", command])
            else:
                subprocess.Popen(["cmd"])
            return {"success": True, "confirmation": "Command prompt is open, sir."}
        except Exception as e:
            log.error(f"open_terminal failed: {e}")
            return {"success": False, "confirmation": "Had trouble opening the terminal, sir."}

    if command:
        escaped = command.replace('"', '\\"')
        script = f'tell application "Terminal"\n    activate\n    do script "{escaped}"\nend tell'
    else:
        script = 'tell application "Terminal"\n    activate\nend tell'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, _ = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": "Terminal is open, sir." if success else "Had trouble opening Terminal, sir.",
    }


# ---------------------------------------------------------------------------
# Browser
# ---------------------------------------------------------------------------
async def open_browser(url: str, browser: str = "default") -> dict:
    if IS_WINDOWS:
        try:
            b = browser.lower()
            if b in ("edge", "msedge"):
                subprocess.Popen(["cmd", "/c", "start", "msedge", url])
            elif b in ("chrome", "google chrome"):
                subprocess.Popen(["cmd", "/c", "start", "chrome", url])
            elif b == "firefox":
                subprocess.Popen(["cmd", "/c", "start", "firefox", url])
            else:
                webbrowser.open(url)
            return {"success": True, "confirmation": f"Opening that for you, sir."}
        except Exception as e:
            log.error(f"open_browser failed: {e}")
            webbrowser.open(url)
            return {"success": True, "confirmation": "Pulled that up, sir."}

    escaped = url.replace('"', '\\"')
    script = (
        f'tell application "Firefox"\n    activate\n    open location "{escaped}"\nend tell'
        if browser.lower() == "firefox"
        else f'tell application "Google Chrome"\n    activate\n    open location "{escaped}"\nend tell'
    )
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, _ = await proc.communicate()
    return {"success": proc.returncode == 0,
            "confirmation": "Pulled that up, sir." if proc.returncode == 0 else "Had trouble opening the browser, sir."}


async def open_chrome(url: str) -> dict:
    return await open_browser(url, "chrome")


# ---------------------------------------------------------------------------
# Claude Code project launcher
# ---------------------------------------------------------------------------
async def open_claude_in_project(project_dir: str, prompt: str) -> dict:
    claude_md = Path(project_dir) / "CLAUDE.md"
    claude_md.write_text(f"# Task\n\n{prompt}\n\nBuild this completely. If web app, make index.html work standalone.\n")

    if IS_WINDOWS:
        try:
            subprocess.Popen(
                f'start cmd /K "cd /d {project_dir} && claude --dangerously-skip-permissions"',
                shell=True
            )
            return {"success": True, "confirmation": "Claude Code is running in the terminal, sir."}
        except Exception as e:
            log.error(f"open_claude_in_project failed: {e}")
            return {"success": False, "confirmation": "Had trouble spawning Claude Code, sir."}

    script = f'tell application "Terminal"\n    activate\n    do script "cd {project_dir} && claude --dangerously-skip-permissions"\nend tell'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, _ = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": "Claude Code is running, sir." if success else "Had trouble spawning Claude Code, sir.",
    }


async def prompt_existing_terminal(project_name: str, prompt: str) -> dict:
    if IS_WINDOWS:
        return {"success": False, "confirmation": "Terminal prompting isn't supported on Windows yet, sir."}

    escaped_name = project_name.replace('"', '\\"')
    escaped_prompt = prompt.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''
tell application "Terminal"
    repeat with w in windows
        if name of w contains "{escaped_name}" then
            set index of w to 1
            activate
            exit repeat
        end if
    end repeat
end tell
delay 1
tell application "System Events"
    tell process "Terminal"
        set frontmost to true
        delay 0.3
        keystroke "{escaped_prompt}"
        delay 0.2
        keystroke return
    end tell
end tell
return "OK"
'''
    try:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        success = proc.returncode == 0
        return {
            "success": success,
            "confirmation": f"Sent that to {project_name}, sir." if success else f"Couldn't reach {project_name}, sir.",
        }
    except Exception as e:
        log.error(f"prompt_existing_terminal failed: {e}")
        return {"success": False, "confirmation": "Something went wrong, sir."}


async def monitor_build(project_dir: str, ws=None, synthesize_fn=None) -> None:
    output_file = Path(project_dir) / ".jarvis_output.txt"
    start = time.time()
    while time.time() - start < 600:
        await asyncio.sleep(5)
        if output_file.exists():
            content = output_file.read_text()
            if "--- JARVIS TASK COMPLETE ---" in content:
                log.info(f"Build complete in {project_dir}")
                if ws and synthesize_fn:
                    try:
                        msg = "The build is complete, sir."
                        audio_bytes = await synthesize_fn(msg)
                        if audio_bytes:
                            import base64 as b64
                            encoded = b64.b64encode(audio_bytes).decode()
                            await ws.send_json({"type": "status", "state": "speaking"})
                            await ws.send_json({"type": "audio", "data": encoded, "text": msg})
                            await ws.send_json({"type": "status", "state": "idle"})
                    except Exception as e:
                        log.warning(f"Build notification failed: {e}")
                return
    log.warning(f"Build timed out in {project_dir}")


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------
async def execute_action(intent: dict, projects: list = None) -> dict:
    action = intent.get("action", "chat")
    target = intent.get("target", "")
    target_lower = target.lower().strip()

    if action == "open_terminal":
        result = await open_terminal()
        result["project_dir"] = None
        return result

    elif action == "open_app":
        result = await open_app(target)
        result["project_dir"] = None
        return result

    elif action == "close_app":
        result = await close_app(target)
        result["project_dir"] = None
        return result

    elif action == "browse":
        for keyword, url in WEBSITE_SHORTCUTS.items():
            if keyword in target_lower:
                result = await open_browser(url)
                result["project_dir"] = None
                return result

        if target.startswith("http://") or target.startswith("https://"):
            url = target
        else:
            url = f"https://www.google.com/search?q={quote(target)}"

        browser = "edge" if "edge" in target_lower else "firefox" if "firefox" in target_lower else "chrome"
        result = await open_browser(url, browser)
        result["project_dir"] = None
        return result

    elif action == "build":
        project_name = _generate_project_name(target)
        project_dir = str(DESKTOP_PATH / project_name)
        os.makedirs(project_dir, exist_ok=True)
        result = await open_claude_in_project(project_dir, target)
        result["project_dir"] = project_dir
        return result

    return {"success": False, "confirmation": "", "project_dir": None}


def _generate_project_name(prompt: str) -> str:
    quoted = re.search(r'"([^"]+)"', prompt)
    if quoted:
        name = re.sub(r"[^a-zA-Z0-9\s-]", "", quoted.group(1).strip())
        if name:
            return re.sub(r"[\s]+", "-", name.lower())
    called = re.search(r'(?:called|named)\s+(\S+(?:[-_]\S+)*)', prompt, re.IGNORECASE)
    if called:
        name = re.sub(r"[^a-zA-Z0-9-]", "", called.group(1))
        if len(name) > 3:
            return name.lower()
    words = re.sub(r"[^a-zA-Z0-9\s]", "", prompt.lower()).split()
    skip = {"a", "the", "an", "me", "build", "create", "make", "for", "with", "and",
            "to", "of", "i", "want", "need", "new", "project", "directory", "called",
            "on", "desktop", "that", "application", "app", "full", "stack", "simple",
            "web", "page", "site", "named"}
    meaningful = [w for w in words if w not in skip and len(w) > 2][:4]
    return "-".join(meaningful) if meaningful else "jarvis-project"
