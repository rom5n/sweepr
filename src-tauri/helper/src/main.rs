// sweepr-helper.exe: started elevated (one UAC prompt) for one admin batch, then exits.
// Accepts only allow-listed work: admin targets from its own target table, WSL/Docker disk compaction,
// HKLM StartupApproved values, and a restore point. Paths never come from the app, except the
// virtual disk path, which is validated against the known locations.
#![windows_subsystem = "windows"]

use serde_json::json;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;
use sweepr_core::clean::{self, Ctl, Opts};
use sweepr_core::paths::Roots;
use sweepr_core::proto::{Event, Request, Task};
use sweepr_core::{scan, startup, sys};

const NO_WINDOW: u32 = 0x0800_0000;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let arg = |k: &str| args.iter().position(|a| a == k).and_then(|i| args.get(i + 1)).cloned();
    let (Some(pipe), Some(token)) = (arg("--pipe"), arg("--token")) else { return };
    if !pipe.starts_with(r"\\.\pipe\sweepr-") {
        return;
    }
    let Ok(conn) = std::fs::OpenOptions::new().read(true).write(true).open(&pipe) else { return };
    let mut out = conn.try_clone().expect("pipe");
    let mut line = String::new();
    if BufReader::new(conn).read_line(&mut line).is_err() {
        return;
    }
    let Ok(req) = serde_json::from_str::<Request>(&line) else { return };
    if req.token != token {
        return;
    }
    let mut send = |e: Event| {
        let _ = writeln!(out, "{}", serde_json::to_string(&e).unwrap());
        let _ = out.flush();
    };
    run(req, &mut send);
    send(Event::Done);
}

fn item(id: &str, status: &str, freed: u64, reason: Option<&str>, app: Option<&str>) -> Event {
    Event::Item(json!({ "id": id, "status": status, "p": 1.0, "freed": freed, "reason": reason, "app": app, "recycled": false, "kept": 0 }))
}

fn run(req: Request, send: &mut dyn FnMut(Event)) {
    let cell = std::cell::RefCell::new(send);
    let send = |e: Event| (cell.borrow_mut())(e);
    let r = Roots::resolve().with_excludes(&req.excludes);
    let seq = if req.restore_point {
        send(Event::Item(json!({ "id": "restore", "status": "running", "p": 0.0, "freed": 0, "recycled": false, "kept": 0 })));
        let res = restore_point(true, 0);
        match res {
            Ok(_) => send(item("restore", "done", 0, None, None)),
            Err(1058) => send(item("restore", "skipped", 0, Some("restoreOff"), None)),
            Err(_) => send(item("restore", "skipped", 0, Some("restoreFailed"), None)),
        }
        res.ok()
    } else {
        None
    };

    // Admin targets: allow-listed by the helper's own table.
    let all = scan::static_targets(&r);
    let pick: Vec<scan::Target> = all.into_iter().filter(|t| t.admin && req.targets.contains(&t.id)).collect();
    for id in req.targets.iter().filter(|id| !pick.iter().any(|t| &t.id == *id)) {
        send(item(id, "skipped", 0, Some("notAllowed"), None));
    }
    let opts = Opts { dry: false, recycle: false, min_age_days: req.min_age_days, elevated: true };
    let ctl = Ctl::default();
    let forward = |it: &clean::Item| Event::Item(serde_json::to_value(it).unwrap());
    let mut batch = Vec::new();
    for t in pick {
        match t.id.as_str() {
            "winold" => send(previous_windows()),
            "wu" => {
                // Windows Update holds its cache open: stop the services, clean, start them again.
                for s in ["wuauserv", "bits"] {
                    sh("net", &["stop", s, "/y"]);
                }
                clean::run(vec![t], opts, &r, &ctl, &|it| send(forward(it)));
                for s in ["bits", "wuauserv"] {
                    sh("net", &["start", s]);
                }
            }
            _ => batch.push(t),
        }
    }
    if !batch.is_empty() {
        clean::run(batch, opts, &r, &ctl, &|it| send(forward(it)));
    }

    for task in req.tasks {
        match task {
            Task::WslCompact { id, path } => send(compact(&id, Path::new(&path), &r)),
        }
    }

    for w in req.registry {
        let ok = matches!(startup::location(&w.source), Some((_, _, true)))
            && startup::exists(&w.source, &w.name, &r)
            && startup::write(&w.source, &w.name, w.value.as_deref()).is_ok();
        send(Event::Reg { id: w.id, ok });
    }

    if let Some(seq) = seq {
        let _ = restore_point(false, seq);
    }
}

fn sh(cmd: &str, args: &[&str]) -> bool {
    Command::new(cmd).args(args).creation_flags(NO_WINDOW).status().map(|s| s.success()).unwrap_or(false)
}

/// SRSetRestorePoint. Windows may allow only one per 24 h; then it reports success without a new point.
fn restore_point(begin: bool, seq: i64) -> Result<i64, u32> {
    use windows::Win32::System::Restore::*;
    let mut info = RESTOREPOINTINFOW {
        dwEventType: if begin { BEGIN_SYSTEM_CHANGE } else { END_SYSTEM_CHANGE },
        dwRestorePtType: MODIFY_SETTINGS,
        llSequenceNumber: seq,
        ..Default::default()
    };
    for (i, c) in "Sweepr cleanup".encode_utf16().enumerate() {
        info.szDescription[i] = c;
    }
    let mut st = STATEMGRSTATUS::default();
    if unsafe { SRSetRestorePointW(&info, &mut st) }.as_bool() {
        Ok(st.llSequenceNumber)
    } else {
        Err(st.nStatus.0)
    }
}

/// Windows.old and setup folders are ACL-protected: use Disk Cleanup's own handlers (4.11).
fn previous_windows() -> Event {
    use windows_registry_shim::*;
    let r = Roots::resolve();
    let before = sys::drive(&r).free;
    let handlers = ["Previous Installations", "Temporary Setup Files"];
    let set = handlers.iter().filter(|h| set_flag(h, true)).count();
    if set == 0 {
        return item("winold", "skipped", 0, Some("toolMissing"), None);
    }
    let ok = sh("cleanmgr", &["/sagerun:777"]);
    handlers.iter().for_each(|h| {
        set_flag(h, false);
    });
    let freed = sys::drive(&r).free.saturating_sub(before);
    if ok {
        item("winold", "done", freed, None, None)
    } else {
        item("winold", "skipped", freed, Some("toolFailed"), None)
    }
}

mod windows_registry_shim {
    const VC: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches";
    /// StateFlags0777 = 2 selects a handler for `cleanmgr /sagerun:777`. Opens existing keys only.
    pub fn set_flag(handler: &str, on: bool) -> bool {
        let Ok(k) = windows_registry::LOCAL_MACHINE.options().read().write().open(format!(r"{VC}\{handler}")) else { return false };
        if on {
            k.set_u32("StateFlags0777", 2).is_ok()
        } else {
            k.remove_value("StateFlags0777").is_ok()
        }
    }
}

/// Compacts a WSL/Docker virtual disk with diskpart (9.2 option B).
fn compact(id: &str, p: &Path, r: &Roots) -> Event {
    let s = p.to_string_lossy().to_lowercase();
    let users = format!("{}users\\", r.system_drive.to_string_lossy().to_lowercase());
    let file = p.file_name().map(|f| f.to_string_lossy().to_lowercase()).unwrap_or_default();
    let ok_path = s.starts_with(&users) && s.contains(r"\appdata\local\") && (file == "ext4.vhdx" || file == "docker_data.vhdx") && !s.contains("..");
    let Ok(meta) = std::fs::symlink_metadata(p) else { return item(id, "skipped", 0, Some("notAllowed"), None) };
    if !ok_path || !meta.is_file() {
        return item(id, "skipped", 0, Some("notAllowed"), None);
    }
    let procs = sys::processes();
    if s.contains(r"\docker\") && (procs.contains("docker desktop.exe") || procs.contains("com.docker.backend.exe")) {
        return item(id, "skipped", 0, Some("appRunning"), Some("Docker Desktop"));
    }
    sh("wsl", &["--shutdown"]);
    let script = std::env::temp_dir().join(format!("sweepr-compact-{}.txt", std::process::id()));
    let body = format!("select vdisk file=\"{}\"\r\nattach vdisk readonly\r\ncompact vdisk\r\ndetach vdisk\r\n", p.display());
    if std::fs::write(&script, body).is_err() {
        return item(id, "skipped", 0, Some("toolFailed"), None);
    }
    let ok = sh("diskpart", &["/s", &script.to_string_lossy()]);
    let _ = std::fs::remove_file(&script);
    let after = std::fs::metadata(p).map(|m| m.len()).unwrap_or(meta.len());
    let freed = meta.len().saturating_sub(after);
    if ok {
        item(id, "done", freed, None, None)
    } else {
        item(id, "skipped", freed, Some("toolFailed"), None)
    }
}
