"""
JARVIS Screen Awareness — Windows + macOS compatible.

1. Window/app list via Windows API (pygetwindow) or AppleScript on Mac
2. Screenshot via PIL.ImageGrab (Windows) or screencapture (Mac)
"""

import asyncio
import base64
import logging
import platform
import tempfile
from pathlib import Path

log = logging.getLogger("jarvis.screen")

IS_WINDOWS = platform.system() == "Windows"


async def get_active_windows() -> list[dict]:
    """Get list of visible windows. Works on Windows and macOS."""
    if IS_WINDOWS:
        return await _get_windows_windows()
    return await _get_mac_windows()


async def _get_windows_windows() -> list[dict]:
    try:
        import pygetwindow as gw
        windows = []
        all_wins = gw.getAllWindows()
        active = gw.getActiveWindow()
        active_title = active.title if active else ""
        for w in all_wins:
            if w.title and w.title.strip() and w.visible:
                windows.append({
                    "app": w.title.split(" - ")[-1] if " - " in w.title else w.title,
                    "title": w.title,
                    "frontmost": w.title == active_title,
                })
        return windows
    except ImportError:
        log.warning("pygetwindow not installed — run: pip install pygetwindow")
        return []
    except Exception as e:
        log.warning(f"get_active_windows error: {e}")
        return []


async def _get_mac_windows() -> list[dict]:
    script = """
set windowList to ""
tell application "System Events"
    set frontApp to name of first application process whose frontmost is true
    set visibleApps to every application process whose visible is true
    repeat with proc in visibleApps
        set appName to name of proc
        try
            set winCount to count of windows of proc
            if winCount > 0 then
                repeat with w in (windows of proc)
                    try
                        set winTitle to name of w
                        if winTitle is not "" and winTitle is not missing value then
                            set windowList to windowList & appName & "|||" & winTitle & "|||" & (appName = frontApp) & linefeed
                        end if
                    end try
                end repeat
            end if
        end try
    end repeat
end tell
return windowList
"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5)
        if proc.returncode != 0:
            return []
        windows = []
        for line in stdout.decode().strip().split("\n"):
            parts = line.strip().split("|||")
            if len(parts) >= 3:
                windows.append({
                    "app": parts[0].strip(),
                    "title": parts[1].strip(),
                    "frontmost": parts[2].strip().lower() == "true",
                })
        return windows
    except Exception as e:
        log.warning(f"get_active_windows error: {e}")
        return []


async def get_running_apps() -> list[str]:
    """Get list of running application names."""
    if IS_WINDOWS:
        try:
            import pygetwindow as gw
            wins = gw.getAllWindows()
            apps = list({w.title.split(" - ")[-1] for w in wins if w.title and w.visible})
            return apps
        except Exception:
            return []

    script = """
tell application "System Events"
    set appNames to name of every application process whose visible is true
    set output to ""
    repeat with a in appNames
        set output to output & a & linefeed
    end repeat
    return output
end tell
"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "osascript", "-e", script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        if proc.returncode == 0:
            return [a.strip() for a in stdout.decode().strip().split("\n") if a.strip()]
        return []
    except Exception as e:
        log.warning(f"get_running_apps error: {e}")
        return []


async def take_screenshot(display_only: bool = True) -> str | None:
    """Take a screenshot and return base64-encoded PNG."""
    if IS_WINDOWS:
        return await _screenshot_windows()
    return await _screenshot_mac(display_only)


async def _screenshot_windows() -> str | None:
    try:
        from PIL import ImageGrab
        import io
        img = ImageGrab.grab(all_screens=False)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img.close()
        data = buf.getvalue()
        log.info(f"Screenshot captured: {len(data)} bytes")
        return base64.b64encode(data).decode()
    except ImportError:
        log.warning("Pillow not installed — run: pip install Pillow")
        return None
    except Exception as e:
        log.warning(f"Screenshot error: {e}")
        return None


async def _screenshot_mac(display_only: bool) -> str | None:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    try:
        cmd = ["screencapture", "-x"]
        if display_only:
            cmd.append("-m")
        cmd.append(tmp_path)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await asyncio.wait_for(proc.communicate(), timeout=10)
        if proc.returncode != 0 or not Path(tmp_path).exists():
            return None
        data = Path(tmp_path).read_bytes()
        return base64.b64encode(data).decode()
    except Exception as e:
        log.warning(f"Screenshot error: {e}")
        return None
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


async def describe_screen(anthropic_client) -> str:
    """Describe what's on the user's screen."""
    screenshot_b64 = await take_screenshot()
    if screenshot_b64 and anthropic_client:
        try:
            response = await anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                system=(
                    "You are JARVIS analyzing a screenshot of the user's desktop. "
                    "Describe what you see concisely: which apps are open, what the user "
                    "appears to be working on, any notable content visible. "
                    "Be specific about app names, file names, URLs, code, or documents visible. "
                    "2-4 sentences max. No markdown."
                ),
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": screenshot_b64,
                            },
                        },
                        {"type": "text", "text": "What's on my screen right now?"},
                    ],
                }],
            )
            return response.content[0].text
        except Exception as e:
            log.warning(f"Vision call failed: {e}")

    windows = await get_active_windows()
    apps = await get_running_apps()

    if not windows and not apps:
        return "I wasn't able to see your screen, sir."

    context_parts = []
    if windows:
        for w in windows:
            marker = " (ACTIVE)" if w["frontmost"] else ""
            context_parts.append(f"{w['app']}: {w['title']}{marker}")
    if apps:
        window_apps = set(w["app"] for w in windows) if windows else set()
        bg_apps = [a for a in apps if a not in window_apps]
        if bg_apps:
            context_parts.append(f"Background apps: {', '.join(bg_apps)}")

    if anthropic_client and context_parts:
        try:
            response = await anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=100,
                system="You are JARVIS. Given the user's open windows, summarize what they appear to be working on in 1-2 sentences. Natural voice, no markdown.",
                messages=[{"role": "user", "content": "Open windows:\n" + "\n".join(context_parts)}],
            )
            return response.content[0].text
        except Exception:
            pass

    if windows:
        active = next((w for w in windows if w["frontmost"]), None)
        result = f"You have {len(windows)} windows open."
        if active:
            result += f" Currently focused on {active['title']}."
        return result

    return f"Running apps: {', '.join(apps)}."


def format_windows_for_context(windows: list[dict]) -> str:
    if not windows:
        return ""
    lines = ["Currently open on your desktop:"]
    for w in windows:
        marker = " (active)" if w["frontmost"] else ""
        lines.append(f"  - {w['app']}: {w['title']}{marker}")
    return "\n".join(lines)
