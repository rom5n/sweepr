<div align="center">

<img src="src-tauri/icons/icon.png" width="112" alt="Sweepr logo">

# Sweepr

**A small, careful cleaner for Windows 10 and 11.**
Finds hidden junk, shows exactly what it is, and removes it only after you say so.

[![Latest release](https://img.shields.io/github/v/release/rom5n/sweepr?label=download&color=0A62D0)](https://github.com/rom5n/sweepr/releases/latest)
[![Build](https://github.com/rom5n/sweepr/actions/workflows/release.yml/badge.svg)](https://github.com/rom5n/sweepr/actions/workflows/release.yml)
![Windows 10 | 11](https://img.shields.io/badge/Windows-10%20%7C%2011-555)

**English** · [Русский](README.ru.md) · [Español](README.es.md) · [中文](README.zh.md)

<img src="docs/media/en/demo.gif" width="360" alt="Sweepr: scan, review, clean and report">

<sub>[Watch in HD (MP4)](docs/media/en/demo.mp4)</sub>

</div>

## Download

Get **Sweepr_…_x64-setup.exe** from the [latest release](https://github.com/rom5n/sweepr/releases/latest) and run it.
The installer is not code-signed yet: if Windows SmartScreen says "Windows protected your PC", choose
**More info → Run anyway**. Sweepr checks this page for new versions (you can turn that off in Settings).

## What it does

- **Finds what other cleaners miss.** Developer caches (npm, Yarn, pnpm, Go, Cargo, Gradle, NuGet, Playwright…),
  GPU shader caches, Steam and launcher caches, Electron apps, browsers, Windows Update and Store app caches,
  leftovers of uninstalled apps, old installers, and WSL/Docker virtual disks that never shrink by themselves.
- **Shows everything before it deletes anything.** Every item has its size, path, and risk shown as color, shape
  and word: Safe, Low, Medium, High. Only Safe items are selected for you.
- **Measures the truth.** Free space is measured before and after, so the report shows what you really got back,
  not the sum of file sizes.
- **Plays it safe.** Caches are deleted (apps rebuild them); your own files go to the Recycle Bin. Open files are
  skipped, never forced. Items of running apps (Steam, browsers, Discord…) wait until you close them.
- **One Windows prompt.** Admin items run together in a small helper after a restore point, under a single UAC
  prompt.
- **Startup apps** with impact and boot-time estimate; turn them off the way Task Manager does, and undo anytime.
- **Lives in the tray.** Quick clean, scan again, and an optional scheduled auto-clean (Safe items only, your day
  and time).

## Screenshots

<table>
  <tr>
    <td align="center"><img src="docs/media/en/home.png" width="190"><br><sub>Home</sub></td>
    <td align="center"><img src="docs/media/en/review.png" width="190"><br><sub>Review</sub></td>
    <td align="center"><img src="docs/media/en/confirm.png" width="190"><br><sub>Confirm</sub></td>
    <td align="center"><img src="docs/media/en/running.png" width="190"><br><sub>Cleaning</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/media/en/done.png" width="190"><br><sub>Report</sub></td>
    <td align="center"><img src="docs/media/en/startup.png" width="190"><br><sub>Startup apps</sub></td>
    <td align="center"><img src="docs/media/en/settings.png" width="190"><br><sub>Settings</sub></td>
    <td align="center"><img src="docs/media/en/light.png" width="190"><br><sub>Light theme, waffle chart</sub></td>
  </tr>
</table>

## Never touched

Passwords and bookmarks, browser extensions, app logins and offline data (Local Storage, IndexedDB), game saves,
OneDrive and Dropbox folders, `Windows\Installer`, WinSxS, Prefetch, DriverStore, Docker volumes, virtual machines,
AI models, database folders, and any folder you add under **Settings → Advanced → Excluded folders**.
No "registry cleaning", and Sweepr never turns off the pagefile, Windows Update, Defender, UAC or SmartScreen.

## Make it yours

Four languages (English, Русский, Español, 中文), dark and light themes, six accent colors, three palettes
(bright, pastel, black & white), four charts (squircle, round, bars, waffle), four fonts, three corner styles,
reduced motion, high contrast and colorblind-friendly status colors.

## Privacy

No account, no telemetry. The only network request is the optional update check against this repository's
releases. Every deleted file is written to a local log in `%LOCALAPPDATA%\Sweepr\logs`.

## For developers

Build steps, project structure, how to add a cleanup target, tests and the release pipeline:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
