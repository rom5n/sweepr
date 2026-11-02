# Developing Sweepr

Tauri 2 (Rust) with a WebView2 frontend (TypeScript + lit-html). The UI is ported from the design in `Sweepr.html`;
the cleanup rules come from `Sweepr_clean-methods.txt`.

## Build

Requirements: Node 20+, Rust (stable, MSVC), WebView2 (included in Windows 10/11).

```
npm install
npm run dev                                   # UI only, in a browser at http://127.0.0.1:1420 (mock data)
cd src-tauri && cargo build                   # sweepr.exe + sweepr-helper.exe (debug)
src-tauri\target\debug\sweepr.exe             # runs against the dev server
cd src-tauri && cargo build --release -p sweepr-helper && cd .. && npx tauri build   # NSIS installer
```

The installer lands in `src-tauri/target/release/bundle/nsis/` and bundles `sweepr-helper.exe`.

## Releases (CI)

`.github/workflows/release.yml` runs on every push to `main` (not for docs-only changes):
typecheck, `cargo test --workspace`, release build, then a GitHub release with the installer.
The version is `MAJOR.MINOR.(PATCH + run number)` from `src-tauri/tauri.conf.json` (`scripts/ci-version.mjs`),
so every release is newer than the last one. The app checks `releases/latest` of `rom5n/sweepr` for updates
(Settings → Advanced → Check for updates).

## Project structure

```
index.html                 app entry
src/main.ts                state and screens
src/api.ts                 backend calls and shared types; falls back to src/mock.ts outside Tauri
src/design.css             CSS ported from the design (tokens, palettes, corners, components)
src/shell.css              window shell, sliding segmented control, fonts
src/i18n.ts                UI and data strings in en/ru/es/zh
src/geometry.ts, logo.ts   squircle and logo geometry, logo SVG symbols
src/mock.ts                mock scan for the browser preview and screenshots
src-tauri/src/main.rs      Tauri commands: scan, clean (+ pause/cancel), queue_compact, startup_*, live_stats
src-tauri/src/shell.rs     settings file, scheduled auto-clean, --auto-clean mode, tray menu
src-tauri/src/elevate.rs   named-pipe server + ShellExecuteEx("runas") for one admin batch
src-tauri/core/            sweepr-core, shared by the app and the helper:
  clean.rs   per-file delete with pause/cancel, tool commands, Recycle Bin (IFileOperation), deletion log
  scan.rs    target table (DEFS), discovered targets (browsers, Electron apps, Steam, leftovers...), parallel scan
  paths.rs   known folders, wildcard expansion, protection list, excluded folders, read-only walk with the Temp age rule
  sys.rs     processes, drive, live stats, pending reboot, WSL/Docker disks, startup apps, installed programs
  startup.rs StartupApproved read/write (create key only if missing), undo journal, reg export
  proto.rs   app <-> helper JSON messages
src-tauri/helper/          sweepr-helper.exe (requireAdministrator): admin targets from its own table,
                           Windows Update service stop/start, Disk Cleanup handlers for Windows.old,
                           diskpart compaction, HKLM StartupApproved, SRSetRestorePoint
scripts/                   make-icons.mjs, readme-media.mjs, ci-version.mjs, shot-window.ps1
gallery.html, icon.html    dev-only pages for contact sheets and icon export
```

## Dev URL parameters

`/?lang=ru&font=inter&theme=light&palette=pastel&seed=teal&chart=waffle&corners=sharp&startView=review`
plus `hc=1`, `cvd=1`, `adv=1`, `weekly=1`, `scroll=<px>` and `demo=confirm|running|done`.
`/gallery.html?set=screens|palettes|seeds|charts|corners|langs` shows a contact sheet.
`node scripts/readme-media.mjs` rebuilds the README screenshots and videos (dev server, Edge and ffmpeg needed).

## Adding a new target

1. Add a `Def` to `DEFS` in `src-tauri/core/src/scan.rs`:
   ```rust
   Def { note: REDOWNLOAD, lock: &["foo.exe"], lock_label: "Foo", ..d("foo", "apps", "Foo cache", Low, &[r"{LOCAL}\Foo\Cache"]) },
   ```
   Paths start from a root token (`{LOCAL}` `{ROAMING}` `{PROFILE}` `{PROGRAMDATA}` `{WINDIR}` `{TEMP}` `{DOWNLOADS}` `{SYSDRIVE}`);
   a segment may contain `*`. Set `admin`, `age` (Temp-style age rule), `cmd` (the tool's own cleaner) and, for
   MEDIUM/HIGH, `consequence`. Category ids: dev, gpu, left, sys, apps, web.
2. Add the English name (and note/consequence) with ru/es/zh translations to `DATA_ADD` in `src/i18n.ts`.
3. Run `cargo test` and `cargo test print_scan -- --ignored --nocapture` to see what this PC finds.

## Admin batch

When a run includes admin targets or queued tasks, the app opens a named pipe and starts `sweepr-helper.exe` with
the `runas` verb (one UAC prompt). The helper receives only target ids, task kinds and HKLM startup values; it
builds admin targets from its own table, validates the virtual disk path and the startup entry, and streams item
updates back.

## Startup undo

Before every apply, each touched key is exported with `reg export` and the previous values are added to
`%LOCALAPPDATA%\Sweepr\undo\journal.json`. "Undo" on the Startup screen restores the last apply.

## Tests

```
cd src-tauri
cargo test --workspace                               # paths, protection list, age rule, StartupApproved, sandbox clean, dry run
cargo test print_scan -- --ignored --nocapture       # list what this PC would show
cargo test preview_this_pc -- --ignored --nocapture  # preview-clean every target here (deletes nothing)
```

## Logs

Every run writes `%LOCALAPPDATA%\Sweepr\logs\clean-*.log` (or `preview-*.log`): one line per file with UTC time,
action (`DELETED`, `RECYCLED`, `WOULD`), size and path, plus tool output and free space before/after. The newest 20 are kept.

## Fonts

Golos Text, Inter, Manrope, IBM Plex Sans, Noto Sans SC and JetBrains Mono are bundled from `@fontsource`
packages under the SIL Open Font License 1.1 (license files ship in `node_modules/@fontsource*/*/LICENSE`).
