"""
JARVIS Action Executor — Windows + macOS compatible.

Opens browsers, apps, games, terminals, and URLs on Windows 10/11 and macOS.
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
# Windows app name aliases — maps what the user says to what Windows knows
# ---------------------------------------------------------------------------
WINDOWS_APP_ALIASES = {
    # Browsers
    "chrome": "chrome",
    "google chrome": "chrome",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "firefox": "firefox",
    "brave": "brave",
    # Microsoft Office
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "outlook": "outlook",
    "notepad": "notepad",
    "paint": "mspaint",
    "calculator": "calc",
    # System
    "file explorer": "explorer",
    "explorer": "explorer",
    "task manager": "taskmgr",
    "control panel": "control",
    "settings": "ms-settings:",
    "cmd": "cmd",
    "command prompt": "cmd",
    "powershell": "powershell",
    # Games / launchers
    "steam": "steam",
    "epic games": "epicgameslauncher",
    "epic": "epicgameslauncher",
    "roblox": "roblox",
    "minecraft": "minecraft",
    "discord": "discord",
    "spotify": "spotify",
    "vlc": "vlc",
    "obs": "obs64",
}

# Common install paths for games/apps Windows can't find via PATH
WINDOWS_APP_PATHS = {
    "steam": [
        r"C:\Program Files (x86)\Steam\steam.exe",
        r"C:\Program Files\Steam\steam.exe",
    ],
    "epicgameslauncher": [
        r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win32\EpicGamesLauncher.exe",
        r"C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
    ],
    "discord": [
        str(Path.home() / "AppData" / "Local" / "Discord" / "Update.exe"),
    ],
    "spotify": [
        str(Path.home() / "AppData" / "Roaming" / "Spotify" / "Spotify.exe"),
    ],
    "roblox": [
        str(Path.home() / "AppData" / "Local" / "Roblox" / "Versions"),
    ],
}

# Websites triggered by name
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
}


def _find_windows_app(name: str) -> str | None:
    """Find executable path for a Windows app."""
    alias = WINDOWS_APP_ALIASES.get(name.lower(), name.lower())
    # Check known paths
    if alias in WINDOWS_APP_PATHS:
        for path in WINDOWS_APP_PATHS[alias]:
            p = Path(path)
            if p.exists():
                return str(p)
            # For folders (like Roblox), find exe inside
            if p.is_dir():
                exes = list(p.glob("*.exe"))
                if exes:
                    return str(exes[0])
    return alias  # fallback: hope it's in PATH


async def open_terminal(command: str = "") -> dict:
    """Open a terminal window on Windows or macOS."""
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

    # macOS
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
    """Open a URL in a browser on Windows or macOS."""
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

    # macOS
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


async def open_app(app_name: str) -> dict:
    """Open any app or game on Windows or macOS by name."""
    if IS_WINDOWS:
        try:
            exe = _find_windows_app(app_name)
            if exe and exe.startswith("ms-"):
                # Windows Store / Settings URI
                subprocess.Popen(["cmd", "/c", "start", exe])
            elif exe and Path(exe).exists():
                subprocess.Popen([exe])
            else:
                subprocess.Popen(["cmd", "/c", "start", exe], shell=True)
            return {"success": True, "confirmation": f"Opening {app_name} for you, sir."}
        except Exception as e:
            log.error(f"open_app failed: {e}")
            return {"success": False, "confirmation": f"I couldn't find {app_name} on your system, sir."}

    # macOS
    script = f'tell application "{app_name}"\n    activate\nend tell'
    proc = await asyncio.create_subprocess_exec(
        "osascript", "-e", script,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    success = proc.returncode == 0
    return {
        "success": success,
        "confirmation": f"Opening {app_name}, sir." if success else f"Couldn't open {app_name}, sir.",
    }


async def open_chrome(url: str) -> dict:
    return await open_browser(url, "chrome")


async def open_claude_in_project(project_dir: str, prompt: str) -> dict:
    """Open terminal in project directory and run Claude Code."""
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
    """Not supported on Windows — always returns graceful fallback."""
    if IS_WINDOWS:
        return {"success": False, "confirmation": f"Terminal prompting isn't supported on Windows yet, sir."}

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
    """Monitor a Claude Code build for completion."""
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
    """Route a classified intent to the right action."""
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
        # Check website shortcuts first
        for keyword, url in WEBSITE_SHORTCUTS.items():
            if keyword in target_lower:
                result = await open_browser(url)
                result["project_dir"] = None
                return result

        # Build URL
        if target.startswith("http://") or target.startswith("https://"):
            url = target
        else:
            url = f"https://www.google.com/search?q={quote(target)}"

        # Detect browser preference
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
