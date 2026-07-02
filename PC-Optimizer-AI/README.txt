=====================================================================
 PC-OPTIMIZER-AI  -  one-button Windows 10 optimizer
=====================================================================

WHAT THIS IS
  A professional, safety-first optimizer built for gaming PCs. It
  inspects your real hardware first, applies only documented and
  reversible changes, backs everything up, and can undo itself
  completely.

INSTALL (one file)
  1. Save GET-PC-OPTIMIZER.bat to your Desktop:
     https://raw.githubusercontent.com/ttvmarss/X-MAN-Ascension/claude/windows-performance-engineer-857o3v/GET-PC-OPTIMIZER.bat
     (open the link, press Ctrl+S, save to Desktop)
  2. Double-click it. It installs everything to C:\PC-Optimizer-AI
     and opens the menu. Re-running it updates to the latest version.

  Already have the repo? Just double-click
  C:\PC-Optimizer-AI\START-PC-OPTIMIZER.bat (or the copy in the repo).

THE MENU
  1  Inspect only        - read-only. Detects CPU, GPU + NVIDIA driver
                           version, RAM (amount/speed/channel mode),
                           motherboard, BIOS, chipset, storage + health
                           + TRIM, Ethernet/Wi-Fi/Bluetooth, audio,
                           monitor refresh rate, Windows build, power
                           plan, startup apps, services, Device Manager
                           problem devices, and 7 days of Event Viewer
                           errors (WHEA/disk/crashes). Writes a report.
  2  Driver scan         - versions + age of GPU/chipset/network/audio
                           drivers, official download pages only.
                           Never installs anything itself.
  3  NVIDIA optimization - detects your GPU/driver, checks NVIDIA
                           services, Game Ready vs Studio advice, and
                           an explained NVIDIA Control Panel checklist.
                           No overclocking, ever.
  4  Safe debloat        - shows the fluff apps present, asks before
                           removing. Store/Xbox-services/Defender/
                           networking are protected in code.
  5  Registry tweaks     - only documented ones (Game Mode, GameDVR
                           off, menu delay). Every key backed up first.
  6  FULL optimize       - inspect > restore point > registry backup >
                           driver scan > Windows + NVIDIA optimization >
                           debloat (asks) > temp clean > verify >
                           before/after report + rollback instructions.
  7  Revert changes      - undoes every recorded change, newest first.
  8  Open latest report
  9  UPDATE drivers      - rescans hardware, lists problem + hidden
                          devices, then finds and INSTALLS driver
                          updates through the official Windows Update
                          channel (Microsoft-signed only), with your
                          approval and a restore point first.
  10 Max refresh rate    - sets every monitor to its highest supported
                          refresh rate at the current resolution.
                          Test-before-apply; revertible via option 7.

  The menu loops - when an admin window finishes, come back to the
  menu window and pick the next option.

WHERE THINGS LIVE
  C:\PC-Optimizer-AI\Reports\          reports (Markdown + JSON)
  C:\PC-Optimizer-AI\Logs\             run logs + changes.json journal
  C:\PC-Optimizer-AI\RegistryBackups\  .reg exports (second undo path)
  C:\PC-Optimizer-AI\DriverBackups\    driver inventory CSVs

SAFETY MODEL (three independent undo paths)
  1. Option 7 replays the change journal in reverse.
  2. Every registry key was exported to RegistryBackups before change -
     double-click a .reg file to restore that key wholesale.
  3. A System Restore point named "PC-Optimizer-AI ..." is created
     before anything is modified.

WHAT IT WILL NEVER DO
  - Disable Defender, firewall, UAC, mitigations, or Windows Update
  - Run "driver updater" tools or download drivers from mirrors
  - Apply Nagle/TcpAckFrequency, timer-resolution, or other fake
    FPS registry hacks
  - Disable services, overclock, or change fan/voltage settings
  - Delete personal files (temp cleanup only touches temp folders,
    files older than 48 hours)
  - Remove apps without asking you first

REQUIREMENTS
  Windows 10 (also fine on 11), PowerShell 5.1 (built in),
  Administrator approval when the menu asks for it.
=====================================================================
