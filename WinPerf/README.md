# WinPerf — Windows Performance Toolkit

A careful, evidence-first performance toolkit for Windows 10/11. It inspects
your **actual** hardware and configuration, writes an engineering report with
bottleneck analysis, and applies only **documented, measurable, reversible**
optimizations — with a System Restore point, registry backups, and a change
journal so everything can be undone.

> **Why this exists instead of "remote optimization":** the assistant that
> built this runs in an isolated cloud container and has no access to your PC
> (see `RUN-JARVIS-WINDOWS.md` in the repo root). This toolkit *is* the
> engineer — it performs the inspection and optimization locally when you run
> it, and its report tells you exactly what it found and changed.

## Quick start

1. Get the repo onto your PC (clone it, or download the ZIP from GitHub).
2. Double-click **`WinPerf\START-WINPERF.bat`**.
3. Pick a mode:

| Mode | What it does | Changes anything? |
|---|---|---|
| **1 — Inspect** | Full hardware/software inventory + report | No (read-only) |
| **2 — Optimize** | Restore point, then safe optimizations | Yes (all reversible) |
| **3 — Revert** | Undoes every change from the journal | Restores originals |
| **4 — Full** | Inspect → Optimize → re-inspect to verify | Yes (all reversible) |

The report is written to `%LOCALAPPDATA%\WinPerf\reports\` and a copy is
placed on your Desktop.

PowerShell equivalent (elevated):

```powershell
cd path\to\X-MAN-Ascension\WinPerf
powershell -ExecutionPolicy Bypass -File .\WinPerf.ps1 -Mode Inspect   # or Optimize / Revert / Full
```

## What Inspect gathers

CPU, GPU (+ driver version/age), RAM (size, channels, speed, usage),
motherboard and BIOS version, physical disks (media type, health, SSD wear and
temperature where the drive reports it), volume free space, TRIM state, active
power plan, Game Mode / Game DVR / hardware-accelerated GPU scheduling state,
Defender / firewall / Secure Boot status, startup entries, top processes by
memory, running third-party services, System event log errors from the last 7
days (WHEA hardware errors, disk errors, unexpected shutdowns), and active
network adapters with link speed.

The findings section flags real bottlenecks: single-channel RAM, HDD as a game
drive, <10% free disk space, >6-month-old GPU drivers, failing drive health,
WHEA errors (often an unstable XMP/overclock), and more.

## What Optimize changes — and why each is safe

Every change is recorded in `%LOCALAPPDATA%\WinPerf\changes.json` with the old
value, and the affected registry key is exported to
`%LOCALAPPDATA%\WinPerf\backups\*.reg` first.

| Change | Rationale | Reversal |
|---|---|---|
| System Restore point | Safety net before anything else | Windows System Restore |
| Disable Game DVR **background** recording (`GameDVR_Enabled`, `AppCaptureEnabled`) | Always-on capture costs CPU/GPU time in every game; manual clipping still works | Revert mode / `.reg` backup |
| Enable Game Mode | Microsoft-documented foreground-game prioritization | Revert mode |
| Enable TRIM if disabled (`fsutil`) | Required for long-term SSD performance/lifespan | Revert mode |
| High-performance power plan (**desktops only**, skipped on laptops) | Removes CPU frequency ramp-up latency | Revert mode restores the previous plan |
| Delete temp files older than 48 h | Reclaims space; the 48 h guard avoids files in use | n/a (files were stale temp data) |

## What it deliberately does NOT do

These are refused on purpose — they are popular online but undocumented,
unmeasurable, or actively harmful:

- **Never** disables Windows Defender, the firewall, UAC, Spectre/Meltdown
  mitigations, or Windows Update.
- **Never** runs "debloat" scripts or uninstalls Store apps.
- **Never** disables SysMain/Superfetch, prefetch, or resizes the pagefile —
  Windows defaults are correct on modern hardware.
- **Never** applies Nagle/`TcpAckFrequency`, timer-resolution, or HPET
  registry hacks — negligible or unmeasurable on modern Windows.
- **Never** auto-disables your startup apps or third-party services — the
  report lists them so *you* decide (Task Manager → Startup apps).
- **Never** flips hardware-accelerated GPU scheduling automatically — results
  vary per game/GPU; the report tells you where the switch lives so you can
  A/B test it.

## Undoing everything

- Run `START-WINPERF.bat` → option **3 (Revert)**. It replays the change
  journal in reverse: registry values restored (or removed if they didn't
  exist before), previous power plan reactivated, TRIM setting restored.
- Belt-and-braces: double-click any `.reg` file in
  `%LOCALAPPDATA%\WinPerf\backups\` to restore that key wholesale, or use the
  System Restore point named `WinPerf before optimization <timestamp>`.

## Things only you (or BIOS) can do

The report will point these out when relevant, but no script can do them:
enable XMP/EXPO in BIOS, add a second RAM stick for dual-channel, update the
BIOS itself, update GPU drivers from the vendor, or move games from an HDD to
an SSD.
