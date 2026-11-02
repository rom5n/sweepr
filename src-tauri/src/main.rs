// Hide the console window in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod elevate;
mod shell;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use sweepr_core::paths::{now_ms, Roots};
use sweepr_core::proto::{Event, RegWrite, Request, Task};
use sweepr_core::{clean, scan, startup, sys};
use tauri::ipc::Channel;
use tauri::State;

#[derive(Default)]
struct App {
    cpu: sys::CpuPrev,
    /// Last scan. The cleaner only accepts ids from it; paths never come from the UI.
    last: Arc<Mutex<scan::ScanResult>>,
    ctl: Arc<clean::Ctl>,
    /// Admin tasks waiting for the next admin batch (WSL disk compaction).
    tasks: Arc<Mutex<Vec<Task>>>,
}

/// Read-only scan. Streams progress (0-100) and returns every target with size > 0.
#[tauri::command]
async fn scan(min_age_days: u64, excludes: Vec<String>, on_progress: Channel<u32>, app: State<'_, App>) -> Result<Value, String> {
    let res = tauri::async_runtime::spawn_blocking(move || scan::run(min_age_days, &excludes, &|p| {
        let _ = on_progress.send(p);
    }))
    .await
    .map_err(|e| e.to_string())?;
    let mut v = serde_json::to_value(&res).unwrap();
    v["undoAvailable"] = json!(!startup::load(&Roots::resolve()).is_empty());
    *app.last.lock().unwrap() = res;
    Ok(v)
}

/// Cleans the given ids from the last scan. Admin targets, queued tasks and the restore point ("restore")
/// run first in one elevated batch (one UAC prompt); the rest runs in this process. Streams per-item updates.
#[tauri::command]
async fn clean(ids: Vec<String>, dry: bool, recycle: bool, min_age_days: u64, excludes: Vec<String>, on_item: Channel<Value>, app: State<'_, App>) -> Result<Value, String> {
    let targets: Vec<scan::Target> = {
        let last = app.last.lock().unwrap();
        ids.iter().filter_map(|id| last.targets.iter().find(|t| &t.id == id).cloned()).collect()
    };
    let tasks: Vec<Task> = app.tasks.lock().unwrap().iter().filter(|t| ids.iter().any(|i| i == task_id(t))).cloned().collect();
    let restore = ids.iter().any(|i| i == "restore");
    let (ctl, queue) = (app.ctl.clone(), app.tasks.clone());
    ctl.paused.store(false, Ordering::Relaxed);
    ctl.cancel.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        let r = Roots::resolve().with_excludes(&excludes);
        let free_before = sys::drive(&r).free;
        let finals: std::cell::RefCell<Vec<Value>> = Default::default();
        let send = |v: Value| {
            let _ = on_item.send(v.clone());
            if v["status"] == "done" || v["status"] == "skipped" {
                let mut f = finals.borrow_mut();
                f.retain(|x| x["id"] != v["id"]);
                f.push(v);
            }
        };
        let (admin, user): (Vec<_>, Vec<_>) = targets.into_iter().partition(|t| t.admin);
        let skip = |id: &str, reason: &str, freed: u64| json!({ "id": id, "status": "skipped", "p": 1.0, "freed": freed, "reason": reason, "recycled": false, "kept": 0 });
        if dry {
            for t in &admin {
                send(json!({ "id": t.id, "status": "done", "p": 1.0, "freed": t.size, "recycled": false, "kept": 0 }));
            }
            for t in &tasks {
                send(skip(task_id(t), "preview", 0));
            }
        } else if !admin.is_empty() || !tasks.is_empty() || restore {
            let req = Request {
                token: String::new(),
                restore_point: restore,
                min_age_days,
                targets: admin.iter().map(|t| t.id.clone()).collect(),
                tasks: tasks.clone(),
                registry: vec![],
                excludes: excludes.clone(),
            };
            let res = elevate::run_batch(req, &mut |e| {
                if let Event::Item(v) = e {
                    send(v);
                }
            });
            if let Err(reason) = res {
                let ids: Vec<String> = admin.iter().map(|t| t.id.clone()).chain(tasks.iter().map(|t| task_id(t).to_string())).chain(restore.then(|| "restore".into())).collect();
                for id in ids.iter().filter(|id| !finals.borrow().iter().any(|f| f["id"] == **id)) {
                    send(skip(id, reason, 0));
                }
            }
            queue.lock().unwrap().retain(|t| !tasks.iter().any(|x| task_id(x) == task_id(t)));
        }
        let res = clean::run(user, clean::Opts { dry, recycle, min_age_days, elevated: false }, &r, &ctl, &|it| {
            let _ = on_item.send(serde_json::to_value(it).unwrap());
        });
        let mut finals = finals.into_inner();
        finals.extend(res.items.iter().map(|it| serde_json::to_value(it).unwrap()));
        json!({ "freeBefore": free_before, "freeAfter": sys::drive(&r).free, "items": finals, "log": res.log })
    })
    .await
    .map_err(|e| e.to_string())
}

fn task_id(t: &Task) -> &str {
    match t {
        Task::WslCompact { id, .. } => id,
    }
}

/// Queues a virtual disk from the last scan for compaction in the next admin batch.
#[tauri::command]
fn queue_compact(path: String, app: State<'_, App>) -> Result<String, String> {
    let i = app.last.lock().unwrap().vdisks.iter().position(|v| v.path == path).ok_or("unknown disk")?;
    let id = format!("task-wsl-{i}");
    let mut q = app.tasks.lock().unwrap();
    if !q.iter().any(|t| task_id(t) == id) {
        q.push(Task::WslCompact { id: id.clone(), path });
    }
    Ok(id)
}

#[tauri::command]
fn clean_pause(paused: bool, app: State<'_, App>) {
    app.ctl.paused.store(paused, Ordering::Relaxed);
}

#[tauri::command]
fn clean_cancel(app: State<'_, App>) {
    app.ctl.cancel.store(true, Ordering::Relaxed);
}

#[tauri::command]
fn live_stats(app: State<'_, App>) -> sys::Live {
    sys::live(&app.cpu)
}

// ---------- startup manager ----------

#[derive(Deserialize)]
struct Change {
    id: String,
    enabled: bool,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct Applied {
    ok: Vec<String>,
    failed: Vec<String>,
    reason: Option<&'static str>,
    undo_available: bool,
}

/// Writes StartupApproved values: HKCU here, HKLM through the helper (one UAC prompt). Every touched
/// key is exported first, and the previous values go to the undo journal.
fn apply_values(writes: Vec<(String, Option<Vec<u8>>)>, r: &Roots) -> Applied {
    let mut out = Applied::default();
    let mut elevated = Vec::new();
    for (id, value) in writes {
        let Some((src, name)) = startup::split_id(&id) else {
            out.failed.push(id);
            continue;
        };
        match startup::location(src) {
            Some((_, _, true)) => elevated.push(RegWrite { id: id.clone(), source: src.into(), name: name.into(), value }),
            Some(_) if startup::exists(src, name, r) && startup::write(src, name, value.as_deref()).is_ok() => out.ok.push(id),
            _ => out.failed.push(id),
        }
    }
    if !elevated.is_empty() {
        let ids: Vec<String> = elevated.iter().map(|w| w.id.clone()).collect();
        let req = Request { token: String::new(), restore_point: false, min_age_days: 0, targets: vec![], tasks: vec![], registry: elevated, excludes: vec![] };
        let mut seen = Vec::new();
        let res = elevate::run_batch(req, &mut |e| {
            if let Event::Reg { id, ok } = e {
                seen.push((id, ok));
            }
        });
        out.reason = res.err();
        for id in ids {
            match seen.iter().find(|s| s.0 == id) {
                Some((_, true)) => out.ok.push(id),
                _ => out.failed.push(id),
            }
        }
    }
    out
}

#[tauri::command]
async fn startup_apply(changes: Vec<Change>) -> Result<Applied, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = Roots::resolve();
        let at = now_ms();
        let mut sources: Vec<&str> = changes.iter().filter_map(|c| startup::split_id(&c.id).map(|s| s.0)).collect();
        sources.sort();
        sources.dedup();
        startup::export_keys(&r, &sources, at);
        let prev: Vec<startup::Entry> = changes
            .iter()
            .filter_map(|c| startup::split_id(&c.id).map(|(s, n)| startup::Entry { id: c.id.clone(), prev: startup::read(s, n) }))
            .collect();
        let ft = startup::filetime_now();
        let writes = changes.iter().map(|c| (c.id.clone(), Some(startup::encode(c.enabled, ft).to_vec()))).collect();
        let mut out = apply_values(writes, &r);
        let mut journal = startup::load(&r);
        let entries: Vec<startup::Entry> = prev.into_iter().filter(|e| out.ok.contains(&e.id)).collect();
        if !entries.is_empty() {
            journal.push(startup::Session { at, entries });
            let _ = startup::save(&r, &journal);
        }
        out.undo_available = !journal.is_empty();
        out
    })
    .await
    .map_err(|e| e.to_string())
}

/// Restores the values saved before the last apply.
#[tauri::command]
async fn startup_undo() -> Result<Applied, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let r = Roots::resolve();
        let mut journal = startup::load(&r);
        let Some(last) = journal.pop() else { return Applied::default() };
        let mut out = apply_values(last.entries.iter().rev().map(|e| (e.id.clone(), e.prev.clone())).collect(), &r);
        if out.failed.is_empty() {
            let _ = startup::save(&r, &journal);
        } else {
            journal.push(last);
        }
        out.undo_available = !journal.is_empty();
        out
    })
    .await
    .map_err(|e| e.to_string())
}

/// Current startup entries (re-read after apply or undo).
#[tauri::command]
fn startup_list() -> Vec<sys::StartupApp> {
    sys::startup(&Roots::resolve())
}

fn main() {
    let auto = std::env::args().any(|a| a == "--auto-clean");
    tauri::Builder::default()
        // A second launch focuses the running window; the weekly task's --auto-clean runs inside it.
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if args.iter().any(|a| a == "--auto-clean") {
                let h = app.clone();
                std::thread::spawn(move || shell::auto_clean(&h));
            } else {
                shell::show_main(app);
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(tauri_plugin_window_state::StateFlags::POSITION).build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(App::default())
        // Closing hides to the tray; Quit in the tray menu exits.
        .on_window_event(|w, e| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = e {
                api.prevent_close();
                let _ = w.hide();
            }
        })
        .setup(move |app| {
            if auto {
                let h = app.handle().clone();
                std::thread::spawn(move || {
                    shell::auto_clean(&h);
                    h.exit(0);
                });
            } else {
                shell::tray(app.handle())?;
                shell::show_main(app.handle());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan, clean, clean_pause, clean_cancel, queue_compact, live_stats, startup_apply, startup_undo, startup_list,
            shell::settings_load, shell::settings_save, shell::set_weekly
        ])
        .run(tauri::generate_context!())
        .expect("error while running Sweepr");
}
