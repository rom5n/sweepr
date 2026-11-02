# Sweepr

A small, safe Windows 10/11 cleaner and optimizer. Tauri 2 (Rust) with a WebView2 frontend (TypeScript + lit-html).

Status: **step 5 of 6, shell.** Settings persist to `%APPDATA%\Sweepr\settings.json`, the window remembers its position, a second launch focuses the running window, the tray has Open / Quick clean / Scan again / Settings / Quit, and "Weekly auto-clean" creates the scheduled task `Sweepr Weekly Clean` (Sundays 21:00, `Sweepr.exe --auto-clean`, SAFE user-level items only, one toast). The NSIS installer bundles `sweepr-helper.exe`. Tests are step 6.

## Build

Requirements: Node 20+, Rust (stable, MSVC), WebView2 (included in Windows 11).

```
npm install
npm run tauri dev      # run the app
npm run tauri build    # MSI + NSIS installers in src-tauri/target/release/bundle
npm run dev            # UI only, in a browser at http://127.0.0.1:1420
```

## Project structure

```
index.html            app entry
src/main.ts           state, screens and the preview run engine (one file until a second screen set exists)
src/api.ts            backend calls and shared types; falls back to src/mock.ts outside Tauri
src/design.css        CSS ported unchanged from the design (tokens, palettes, corners, components)
src/shell.css         window shell: transparent frame, panel, CJK font
src/i18n.ts           UI and data strings in en/ru/es/zh, from the design
src/geometry.ts       squircle and logo geometry, from the design's generator
src/logo.ts           logo SVG symbols (app header, settings, icon export)
src/mock.ts           the design's mock scan, for the browser preview and screenshots
src-tauri/src/main.rs        Tauri commands: scan, clean (+ pause/cancel), queue_compact, startup_apply/undo/list, live_stats
src-tauri/src/shell.rs       settings file, weekly task, --auto-clean mode, tray menu
src-tauri/src/elevate.rs     named-pipe server + ShellExecuteEx("runas") for one admin batch
src-tauri/core/              sweepr-core library, shared by the app and the helper:
  clean.rs   per-file delete with pause/cancel, tool commands, Recycle Bin (IFileOperation), deletion log
  scan.rs    target table (DEFS), discovered targets (browsers, Electron apps, Steam, leftovers...), parallel scan
  paths.rs   known folders, wildcard expansion, protection list (Part 13), read-only walk with the Temp age rule
  sys.rs     processes, drive, live stats, pending reboot, WSL/Docker disks, startup apps, installed programs
  startup.rs StartupApproved read/write (create key only if missing), undo journal, reg export
  proto.rs   app <-> helper JSON messages
src-tauri/helper/            sweepr-helper.exe (requireAdministrator manifest): admin targets from its own table,
                             Windows Update service stop/start, Disk Cleanup handlers for Windows.old,
                             diskpart compaction, HKLM StartupApproved, SRSetRestorePoint
scripts/make-icons.mjs  builds icon.ico (small mark for 16-32 px, full mark for 48 px and up)
scripts/shot-window.ps1 screenshots the running app window
gallery.html, icon.html dev-only pages for screenshots and icon export
docs/screenshots/     UI variant contact sheets
```

## Dev URL parameters

`/?lang=ru&font=inter&theme=light&palette=pastel&seed=teal&chart=waffle&corners=sharp&startView=review`
plus `hc=1`, `cvd=1`, `adv=1`, `weekly=1` (demo schedule and excluded folders), `scroll=<px>`, and `demo=confirm|running|done`.
`/gallery.html?set=screens|palettes|seeds|charts|corners|langs` shows a contact sheet.

## Adding a new Target

1. Add a `Def` to `DEFS` in `src-tauri/src/scan.rs`:
   ```rust
   Def { note: REDOWNLOAD, lock: &["foo.exe"], lock_label: "Foo", ..d("foo", "apps", "Foo cache", Low, &[r"{LOCAL}FooCache"]) },
   ```
   Paths start from a root token (`{LOCAL}` `{ROAMING}` `{PROFILE}` `{PROGRAMDATA}` `{WINDIR}` `{TEMP}` `{DOWNLOADS}` `{SYSDRIVE}`);
   a segment may contain `*`. Set `admin`, `age` (Temp-style age rule), `cmd` (the tool's own cleaner) and, for
   MEDIUM/HIGH, `consequence`. Category ids: dev, gpu, left, sys, apps, web.
2. Add the English name (and note/consequence) with ru/es/zh translations to `DATA_ADD` in `src/i18n.ts`.
3. Run `cargo test` (checks tokens, categories, protection) and `cargo test print_scan -- --ignored --nocapture`
   to see what this PC finds.

Targets found at runtime (one per browser, Electron app, leftover folder) are built in the same file and use
`name_key` + `app` templates (`appCache`, `appLeftovers`) so their names translate.

## Fonts

Golos Text, Noto Sans SC (variable) and JetBrains Mono are bundled from `@fontsource` packages under the
SIL Open Font License 1.1. The license files ship with the packages in `node_modules/@fontsource*/*/LICENSE`.

## Settings

Look: language, font (Golos, Inter, Manrope, IBM Plex Sans), theme, accent, palette, chart. Cleaning: auto-clean day and time
(scheduled task `Sweepr Weekly Clean`), Recycle Bin for my files. Advanced: corners, motion, Temp age (1/3/7/30 days),
restore point, preview, high contrast, colorblind status, and **Excluded folders**: anything inside them is never scanned,
listed or cleaned (enforced in `paths::is_protected`, also inside the elevated helper).

## Admin batch

When a run includes admin targets or queued tasks, the app opens a named pipe and starts `sweepr-helper.exe` with
the `runas` verb (one UAC prompt). The helper receives only target ids, task kinds and HKLM startup values; it
builds admin targets from its own table, validates the virtual disk path and the startup entry, and streams item
updates back. Declining the prompt skips those items with "Windows prompt declined".

## Startup undo

Before every apply, each touched key is exported with `reg export` and the previous values are added to
`%LOCALAPPDATA%\Sweepr\undo\journal.json`. "Undo" (Startup screen, left button when nothing is pending) restores
the last apply.

## Tests

```
cd src-tauri
cargo test                                      # path resolution, protection list, age rule, StartupApproved bytes, live scan
cargo test print_scan -- --ignored --nocapture  # list what this PC would show
cargo test preview_this_pc -- --ignored --nocapture  # preview-clean every target here (deletes nothing)
```

## Logs

Every run writes `%LOCALAPPDATA%\Sweepr\logs\clean-*.log` (or `preview-*.log`): one line per file with UTC time, action (`DELETED`, `RECYCLED`, `WOULD`), size and path, plus tool output and free space before/after. The newest 20 logs are kept.
