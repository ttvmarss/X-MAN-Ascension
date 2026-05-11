"""
JARVIS Action Executor — Windows + macOS compatible.

Opens browsers, apps, games, terminals, and URLs on Windows 10/11 and macOS.
Dynamically discovers every installed app on the PC via Start Menu shortcuts.
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
# Built-in aliases for common apps / system commands
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
    "tiktok website": "https://www.tiktok.com",
    "hulu": "https://www.hulu.com",
    "disney plus": "https://www.disneyplus.com",
    "disney+": "https://www.disneyplus.com",
    "crunchyroll": "https://www.crunchyroll.com",
    "pornhub": "https://www.pornhub.com",
}

# ---------------------------------------------------------------------------
# Dynamic app index — scans Start Menu shortcuts to find every installed app
# ---------------------------------------------------------------------------
_app_index: dict[str, str] = {}  # lowercase name -> full exe path
_app_index_built = False


def _build_app_index() -> dict[str, str]:
    """Scan Windows Start Menu shortcuts to find all installed apps."""
    global _app_index_built
    if not IS_WINDOWS:
        return {}

    index: dict[str, str] = {}

    # Start Menu locations
    start_menu_dirs = [
        Path(os.environ.get("ProgramData", "C:/ProgramData")) / "Microsoft/Windows/Start Menu/Programs",
        Path(os.environ.get("APPDATA", "")) / "Microsoft/Windows/Start Menu/Programs",
    ]

    def _resolve_lnk(lnk_path: Path) -> str | None:
        """Resolve a .lnk shortcut to its target exe path using PowerShell."""
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
            if not name or name in ("uninstall", "readme", "help", "changelog"):
                continue
            target = _resolve_lnk(lnk)
            if target:
                index[name] = target
                # Also index without common suffixes
                for suffix in [" - shortcut", " launcher", " client", " app"]:
                    if name.endswith(suffix):
                        index[name[:-len(suffix)]] = target

    # Also search common install directories directly
    search_dirs = [
        Path("C:/Program Files"),
        Path("C:/Program Files (x86)"),
        Path(os.environ.get("LOCALAPPDATA", "")),
        Path(os.environ.get("APPDATA", "")),
    ]

    # Specific known executables to look for
    known_exes = {
        "epicgameslauncher": ["Epic Games/Launcher/Portal/Binaries/Win64/EpicGamesLauncher.exe",
                               "Epic Games/Launcher/Portal/Binaries/Win32/EpicGamesLauncher.exe"],
        "tiktok live studio": ["TikTok LIVE Studio/TikTok LIVE Studio.exe",
                                "Programs/TikTok LIVE Studio/TikTok LIVE Studio.exe"],
        "steam": ["Steam/steam.exe"],
        "discord": ["Discord/Update.exe", "Discord/app-*/Discord.exe"],
        "spotify": ["Spotify/Spotify.exe"],
    }

    for exe_name, paths in known_exes.items():
        for search_base in search_dirs:
            for rel_path in paths:
                if "*" in rel_path:
                    matches = list(search_base.glob(rel_path))
                    if matches:
                        index[exe_name] = str(matches[-1])
                        break
                else:
                    full = search_base / rel_path
                    if full.exists():
                        index[exe_name] = str(full)
                        break

    _app_index_built = True
    log.info(f"App index built: {len(index)} apps found")
    return index


def _get_app_index() -> dict[str, str]:
    global _app_index, _app_index_built
    if not _app_index_built:
        _app_index = _build_app_index()
    return _app_index


def _fuzzy_find_app(name: str) -> tuple[str | None, str | None]:
    """Find best matching app for a given name.

    Returns (display_name, exe_path_or_command).
    """
    name_lower = name.lower().strip()

    # 1. Check built-in aliases first
    if name_lower in BUILTIN_ALIASES:
        return name, BUILTIN_ALIASES[name_lower]

    # 2. Check dynamic index — exact match
    index = _get_app_index()
    if name_lower in index:
        return name, index[name_lower]

    # 3. Partial match in index
    matches = [(k, v) for k, v in index.items() if name_lower in k or k in name_lower]
    if matches:
        # Pick longest key match (most specific)
        matches.sort(key=lambda x: len(x[0]), reverse=True)
        return matches[0][0].title(), matches[0][1]

    # 4. Word overlap match
    name_words = set(name_lower.split())
    best_score = 0
    best_match = None
    for k, v in index.items():
        k_words = set(k.split())
        overlap = len(name_words & k_words)
        if overlap > best_score:
            best_score = overlap
            best_match = (k, v)
    if best_match and best_score >= 1:
        return best_match[0].title(), best_match[1]

    return None, None


async def open_app(app_name: str) -> dict:
    """Open any app or game on Windows or macOS by name."""
    if IS_WINDOWS:
        display_name, target = _fuzzy_find_app(app_name)

        if target is None:
            # Last resort: try running it directly via start command
            try:
                subprocess.Popen(["cmd", "/c", "start", "", app_name], shell=False)
                return {"success": True, "confirmation": f"Trying to open {app_name}, sir."}
            except Exception:
                return {"success": False, "confirmation": f"I couldn't find {app_name} on your system, sir. It may not be installed."}

        try:
            if target.startswith("ms-"):
                subprocess.Popen(["cmd", "/c", "start", target])
            elif Path(target).exists():
                subprocess.Popen([target])
            else:
                subprocess.Popen(["cmd", "/c", "start", "", target], shell=False)
            return {"success": True, "confirmation": f"Opening {display_name or app_name} for you, sir."}
        except Exception as e:
            log.error(f"open_app failed for '{app_name}': {e}")
            return {"success": False, "confirmation": f"I had trouble launching {app_name}, sir."}

    # macOS fallback
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


async def list_installed_apps() -> list[str]:
    """Return list of all discovered app names for JARVIS context."""
    index = _get_app_index()
    return sorted(index.keys())


async def open_terminal(command: str = "") -> dict:
    if IS_WINDOWS:
        try:
            if command:
                subprocess.Popen(f'start cmd /K "{command}"', shell=True)
            else:
                subprocess.Popen("start cmd", shell=True)
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
    _, stderr = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": "Terminal is open, sir." if success else "Had trouble opening Terminal, sir.",
    }


async def open_browser(url: str, browser: str = "default") -> dict:
    if IS_WINDOWS:
        try:
            browser_lower = browser.lower()
            if browser_lower in ("edge", "msedge"):
                subprocess.Popen(["cmd", "/c", "start", "msedge", url])
            elif browser_lower in ("chrome", "google chrome"):
                subprocess.Popen(["cmd", "/c", "start", "chrome", url])
            elif browser_lower == "firefox":
                subprocess.Popen(["cmd", "/c", "start", "firefox", url])
            else:
                webbrowser.open(url)
            browser_name = browser if browser != "default" else "your browser"
            return {"success": True, "confirmation": f"Opening that in {browser_name}, sir."}
        except Exception as e:
            log.error(f"open_browser failed: {e}")
            webbrowser.open(url)
            return {"success": True, "confirmation": "Pulled that up for you, sir."}

    escaped_url = url.replace('"', '\\"')
    if browser.lower() == "firefox":
        script = f'tell application "Firefox"\n    activate\n    open location "{escaped_url}"\nend tell'
    else:
        script = f'tell application "Google Chrome"\n    activate\n    open location "{escaped_url}"\nend tell'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": "Pulled that up, sir." if success else "Had trouble opening the browser, sir.",
    }


async def open_chrome(url: str) -> dict:
    return await open_browser(url, "chrome")


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

    script = (
        'tell application "Terminal"\n'
        "    activate\n"
        f'    do script "cd {project_dir} && claude --dangerously-skip-permissions"\n'
        "end tell"
    )
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": "Claude Code is running in Terminal, sir." if success else "Had trouble spawning Claude Code, sir.",
    }


async def prompt_existing_terminal(project_name: str, prompt: str) -> dict:
    if IS_WINDOWS:
        return {"success": False, "confirmation": "Terminal prompting isn't supported on Windows yet, sir."}

    escaped_name = project_name.replace('"', '\\"')
    escaped_prompt = prompt.replace("\\", "\\\\").replace('"', '\\"')
    script = f'''
tell application "Terminal"
    set matched to false
    repeat with w in windows
        if name of w contains "{escaped_name}" then
            set index of w to 1
            activate
            set matched to true
            exit repeat
        end if
    end repeat
    if not matched then return "NOT_FOUND"
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
        result = stdout.decode().strip()
        success = proc.returncode == 0 and result != "NOT_FOUND"
        return {
            "success": success,
            "confirmation": f"Sent that to {project_name}, sir." if success else f"Couldn't find a terminal for {project_name}, sir.",
        }
    except Exception as e:
        log.error(f"prompt_existing_terminal failed: {e}")
        return {"success": False, "confirmation": "Something went wrong reaching that terminal, sir."}


async def monitor_build(project_dir: str, ws=None, synthesize_fn=None) -> None:
    import base64
    output_file = Path(project_dir) / ".jarvis_output.txt"
    start = time.time()
    timeout = 600

    while time.time() - start < timeout:
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

        if "firefox" in target_lower:
            browser = "firefox"
        elif "edge" in target_lower:
            browser = "edge"
        else:
            browser = "chrome"

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

    else:
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
