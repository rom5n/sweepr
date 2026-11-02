// User-level cleaner (step 3). Deletes only what the scan's walk selects (same protection list and age rule),
// pauses and cancels between files, skips targets whose app is running, and logs every deleted path.
// Admin targets run only inside sweepr-helper.exe (Opts.elevated); the app process skips them.

use crate::paths::{self, is_protected, now_ms, Roots};
use crate::scan::{self, Target};
use crate::sys;
use serde::Serialize;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

#[derive(Default)]
pub struct Ctl {
    pub paused: AtomicBool,
    pub cancel: AtomicBool,
}

impl Ctl {
    /// Blocks while paused. Returns false when cancelled.
    fn go_on(&self) -> bool {
        while self.paused.load(Ordering::Relaxed) && !self.cancel.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(100));
        }
        !self.cancel.load(Ordering::Relaxed)
    }
}

#[derive(Clone, Copy)]
pub struct Opts {
    pub dry: bool,
    /// "Recycle Bin for my files": user files (leftovers, old installers) go to the Recycle Bin.
    pub recycle: bool,
    pub min_age_days: u64,
    /// Set only inside sweepr-helper.exe; the app process never deletes admin targets.
    pub elevated: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    /// queued | running | done | skipped
    pub status: &'static str,
    pub p: f32,
    pub freed: u64,
    pub reason: Option<&'static str>,
    pub app: Option<String>,
    pub recycled: bool,
    /// Files left because they were open or locked.
    pub kept: u64,
}

impl Item {
    fn new(id: &str) -> Item {
        Item { id: id.into(), status: "queued", p: 0.0, freed: 0, reason: None, app: None, recycled: false, kept: 0 }
    }
    fn skip(mut self, reason: &'static str) -> Item {
        self.status = "skipped";
        self.reason = Some(reason);
        self
    }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CleanResult {
    pub free_before: u64,
    pub free_after: u64,
    pub items: Vec<Item>,
    pub log: String,
}

pub fn run(targets: Vec<Target>, o: Opts, r: &Roots, ctl: &Ctl, emit: &dyn Fn(&Item)) -> CleanResult {
    unsafe {
        // IFileOperation needs COM on this thread. Already-initialized is fine.
        let _ = windows::Win32::System::Com::CoInitializeEx(None, windows::Win32::System::Com::COINIT_APARTMENTTHREADED);
    }
    let mut log = Log::open(r, o.dry);
    let free_before = sys::drive(r).free;
    let mut items = Vec::new();
    for t in &targets {
        let mut it = Item::new(&t.id);
        if ctl.cancel.load(Ordering::Relaxed) {
            it = it.skip("cancelled");
        } else if t.admin && !o.elevated {
            it = it.skip("needsAdmin");
        } else if let Some((_, app)) = running_lock(t) {
            it.app = Some(app);
            it = it.skip("appRunning");
        } else {
            it.status = "running";
            emit(&it);
            it = clean_one(t, it, o, r, ctl, &mut log, emit);
        }
        log.line(if it.status == "done" { "DONE" } else { "SKIP" }, it.freed, &format!("{} {}", t.id, it.reason.unwrap_or("")));
        emit(&it);
        items.push(it);
    }
    let free_after = sys::drive(r).free;
    log.line("FREE", free_after.saturating_sub(free_before), &format!("before={free_before} after={free_after}"));
    CleanResult { free_before, free_after, items, log: log.path.to_string_lossy().into() }
}

/// Re-checked right before each target: the app may have been closed since the scan.
fn running_lock(t: &Target) -> Option<(String, String)> {
    let procs = sys::processes();
    t.lock_exes.iter().find(|(e, _)| procs.contains(e)).cloned()
}

fn clean_one(t: &Target, mut it: Item, o: Opts, r: &Roots, ctl: &Ctl, log: &mut Log, emit: &dyn Fn(&Item)) -> Item {
    if t.id == "recycle" {
        return empty_recycle_bin(t, it, o, log);
    }
    if let Some(cmd) = t.cmd {
        let tool = find_tool(cmd.split_whitespace().next().unwrap_or(""), r);
        if t.tool_only && tool.is_none() {
            return it.skip("toolMissing");
        }
        if let (Some(tool), false) = (&tool, o.dry) {
            let before = sys::drive(r).free;
            let ok = run_tool(tool, cmd, log, ctl);
            it.freed = sys::drive(r).free.saturating_sub(before);
            if !ok {
                return it.skip(if ctl.cancel.load(Ordering::Relaxed) { "cancelled" } else { "toolFailed" });
            }
            // gradle --stop only releases the cache; the folder is deleted below.
            if t.id != "gradle" {
                it.status = "done";
                it.p = 1.0;
                return it;
            }
        } else if t.tool_only {
            // Dry run of a hardlinked store: the scan size is the honest upper bound.
            it.freed = t.size;
            it.status = "done";
            it.p = 1.0;
            return it;
        }
    }
    if t.bin && o.recycle {
        return recycle(t, it, o, r, log);
    }
    delete_files(t, it, o, r, ctl, log, emit)
}

/// Deletes the files the scan walk selects, one by one. Locked files are skipped, never forced.
fn delete_files(t: &Target, mut it: Item, o: Opts, r: &Roots, ctl: &Ctl, log: &mut Log, emit: &dyn Fn(&Item)) -> Item {
    let age = scan::age_rule(t, o.min_age_days, now_ms());
    let mut files: Vec<(PathBuf, u64, usize)> = Vec::new();
    for (root_i, root) in t.paths.iter().enumerate() {
        paths::walk(root, r, age, &mut |p, size| files.push((p.to_path_buf(), size, root_i)));
    }
    let total: u64 = files.iter().map(|f| f.1).sum::<u64>().max(1);
    let (mut done_bytes, mut last) = (0u64, Instant::now());
    let mut touched_dirs: Vec<(PathBuf, usize)> = Vec::new();
    for (p, size, root_i) in &files {
        if !ctl.go_on() {
            it.status = "skipped";
            it.reason = Some("cancelled");
            return it;
        }
        // Defense in depth: every path is re-validated against the protection list and the target root.
        if is_protected(p, r) || !p.starts_with(&t.paths[*root_i]) || r.in_cloud(p) {
            continue;
        }
        if o.dry {
            it.freed += size;
            log.line("WOULD", *size, &p.to_string_lossy());
        } else {
            match fs::remove_file(p) {
                Ok(()) => {
                    it.freed += size;
                    log.line("DELETED", *size, &p.to_string_lossy());
                    if let Some(parent) = p.parent() {
                        touched_dirs.push((parent.to_path_buf(), *root_i));
                    }
                }
                Err(_) => it.kept += 1,
            }
        }
        done_bytes += size;
        if last.elapsed() > Duration::from_millis(150) {
            it.p = done_bytes as f32 / total as f32;
            emit(&it);
            last = Instant::now();
        }
    }
    // Remove folders this run emptied (deepest first). The target roots themselves stay.
    touched_dirs.sort_by_key(|d| std::cmp::Reverse(d.0.components().count()));
    touched_dirs.dedup();
    for (d, root_i) in touched_dirs {
        let root = &t.paths[root_i];
        for a in d.ancestors().take_while(|a| *a != root.as_path() && a.starts_with(root)) {
            if fs::remove_dir(a).is_err() {
                break;
            }
        }
    }
    it.status = "done";
    it.p = 1.0;
    it
}

fn has_protected(root: &Path, r: &Roots) -> bool {
    let mut stack = vec![root.to_path_buf()];
    while let Some(d) = stack.pop() {
        let Ok(rd) = fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            if is_protected(&p, r) {
                return true;
            }
            if e.file_type().map(|f| f.is_dir() && !f.is_symlink()).unwrap_or(false) {
                stack.push(p);
            }
        }
    }
    false
}

/// User files go to the Recycle Bin through the shell, so they can be restored.
fn recycle(t: &Target, mut it: Item, o: Opts, r: &Roots, log: &mut Log) -> Item {
    let age = scan::age_rule(t, o.min_age_days, now_ms());
    let mut items: Vec<(PathBuf, u64)> = Vec::new();
    for root in &t.paths {
        let w = paths::walk(root, r, age, &mut |_, _| {});
        if root.is_dir() && !has_protected(root, r) {
            items.push((root.clone(), w.size));
        } else {
            paths::walk(root, r, age, &mut |p, s| items.push((p.to_path_buf(), s)));
        }
    }
    if o.dry {
        for (p, s) in &items {
            it.freed += s;
            log.line("WOULD-RECYCLE", *s, &p.to_string_lossy());
        }
    } else {
        match shell_recycle(&items.iter().map(|i| i.0.clone()).collect::<Vec<_>>()) {
            Ok(()) => {
                for (p, s) in &items {
                    if !p.exists() {
                        it.freed += s;
                        log.line("RECYCLED", *s, &p.to_string_lossy());
                    } else {
                        it.kept += 1;
                    }
                }
            }
            Err(e) => {
                log.line("ERROR", 0, &format!("recycle {}: {e}", t.id));
                return it.skip("toolFailed");
            }
        }
    }
    it.recycled = true;
    it.status = "done";
    it.p = 1.0;
    it
}

fn shell_recycle(items: &[PathBuf]) -> windows::core::Result<()> {
    use windows::core::HSTRING;
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
    use windows::Win32::UI::Shell::*;
    if items.is_empty() {
        return Ok(());
    }
    unsafe {
        let op: IFileOperation = CoCreateInstance(&FileOperation, None, CLSCTX_ALL)?;
        // NUKEWARNING: if an item is too big for the Recycle Bin, Windows asks instead of deleting it for good.
        op.SetOperationFlags(FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_WANTNUKEWARNING | FOF_NOERRORUI | FOF_SILENT | FOFX_RECYCLEONDELETE)?;
        for p in items {
            let item: IShellItem = SHCreateItemFromParsingName(&HSTRING::from(p.as_os_str()), None)?;
            op.DeleteItem(&item, None)?;
        }
        op.PerformOperations()
    }
}

fn empty_recycle_bin(t: &Target, mut it: Item, o: Opts, log: &mut Log) -> Item {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHEmptyRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI, SHERB_NOSOUND};
    if !o.dry {
        if unsafe { SHEmptyRecycleBinW(None, PCWSTR::null(), SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI | SHERB_NOSOUND) }.is_err() {
            return it.skip("toolFailed");
        }
    }
    it.freed = t.size;
    log.line(if o.dry { "WOULD" } else { "EMPTIED" }, t.size, "Recycle Bin");
    it.status = "done";
    it.p = 1.0;
    it
}

// ---------- tool commands ----------

/// Known install locations; dev tools are often not on PATH (L9).
fn probes(name: &str) -> &'static [&'static str] {
    match name {
        "npm" => &[r"%ProgramFiles%\nodejs\npm.cmd", r"%APPDATA%\npm\npm.cmd"],
        "yarn" => &[r"%APPDATA%\npm\yarn.cmd", r"%LOCALAPPDATA%\Yarn\bin\yarn.cmd", r"%ProgramFiles(x86)%\Yarn\bin\yarn.cmd", r"%ProgramFiles%\nodejs\yarn.cmd"],
        "pnpm" => &[r"%LOCALAPPDATA%\pnpm\pnpm.exe", r"%APPDATA%\npm\pnpm.cmd", r"%ProgramFiles%\nodejs\pnpm.cmd"],
        "bun" => &[r"%USERPROFILE%\.bun\bin\bun.exe"],
        "pip" => &[r"%LOCALAPPDATA%\Programs\Python\Python3*\Scripts\pip.exe"],
        "uv" => &[r"%USERPROFILE%\.local\bin\uv.exe", r"%USERPROFILE%\.cargo\bin\uv.exe"],
        "poetry" => &[r"%APPDATA%\Python\Scripts\poetry.exe", r"%APPDATA%\pypoetry\venv\Scripts\poetry.exe"],
        "conda" => &[
            r"%USERPROFILE%\anaconda3\Scripts\conda.exe", r"%USERPROFILE%\miniconda3\Scripts\conda.exe", r"%USERPROFILE%\miniforge3\Scripts\conda.exe",
            r"%ProgramData%\anaconda3\Scripts\conda.exe", r"%ProgramData%\miniconda3\Scripts\conda.exe",
        ],
        "go" => &[r"%ProgramFiles%\Go\bin\go.exe", r"%USERPROFILE%\sdk\go*\bin\go.exe"],
        "dotnet" => &[r"%ProgramFiles%\dotnet\dotnet.exe"],
        _ => &[],
    }
}

fn env_fill(s: &str) -> String {
    let mut out = s.to_string();
    while let Some(a) = out.find('%') {
        let Some(len) = out[a + 1..].find('%') else { break };
        let var = &out[a + 1..a + 1 + len];
        let val = std::env::var(var).unwrap_or_default();
        out.replace_range(a..a + 2 + len, &val);
    }
    out
}

pub fn find_tool(name: &str, _r: &Roots) -> Option<PathBuf> {
    if name.is_empty() {
        return None;
    }
    if let Some(path) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path) {
            for ext in ["exe", "cmd", "bat"] {
                let p = dir.join(format!("{name}.{ext}"));
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }
    probes(name).iter().flat_map(|p| paths::expand(&env_fill(p))).find(|p| p.is_file())
}

/// Runs the tool's own cleaner with no window; output goes to the log. Cancel kills it.
fn run_tool(tool: &Path, cmd: &str, log: &mut Log, ctl: &Ctl) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let args: Vec<&str> = cmd.split_whitespace().skip(1).collect();
    let script = tool.extension().is_some_and(|e| e.eq_ignore_ascii_case("cmd") || e.eq_ignore_ascii_case("bat"));
    let mut c = if script {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(tool).args(&args);
        c
    } else {
        let mut c = Command::new(tool);
        c.args(&args);
        c
    };
    log.line("RUN", 0, &format!("{} {}", tool.display(), args.join(" ")));
    let out = log.file.as_ref().and_then(|f| f.try_clone().ok());
    let err = log.file.as_ref().and_then(|f| f.try_clone().ok());
    c.creation_flags(CREATE_NO_WINDOW)
        .stdin(Stdio::null())
        .stdout(out.map(Stdio::from).unwrap_or_else(Stdio::null))
        .stderr(err.map(Stdio::from).unwrap_or_else(Stdio::null));
    let Ok(mut child) = c.spawn() else { return false };
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Ok(None) if ctl.cancel.load(Ordering::Relaxed) => {
                let _ = child.kill();
                return false;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(200)),
            Err(_) => return false,
        }
    }
}

// ---------- log ----------

/// %LOCALAPPDATA%\Sweepr\logs\clean-<time>.log: every deleted path, its size and a timestamp.
pub struct Log {
    pub path: PathBuf,
    file: Option<File>,
}

impl Log {
    fn open(r: &Roots, dry: bool) -> Log {
        let dir = r.local.join(r"Sweepr\logs");
        let _ = fs::create_dir_all(&dir);
        // Keep the newest 20 logs (names sort by time).
        if let Ok(rd) = fs::read_dir(&dir) {
            let mut old: Vec<PathBuf> = rd.flatten().map(|e| e.path()).filter(|p| p.extension().is_some_and(|e| e == "log")).collect();
            old.sort_by_key(|p| p.file_name().map(|n| n.to_string_lossy().split('-').skip(1).collect::<String>()));
            for p in old.iter().rev().skip(19) {
                let _ = fs::remove_file(p);
            }
        }
        let stamp = iso(now_ms()).replace([':', '-'], "").replace('T', "-");
        let path = dir.join(format!("{}-{}.log", if dry { "preview" } else { "clean" }, &stamp[..15]));
        let file = File::create(&path).ok();
        Log { path, file }
    }
    fn line(&mut self, kind: &str, size: u64, what: &str) {
        if let Some(f) = &mut self.file {
            let _ = writeln!(f, "{}\t{kind}\t{size}\t{what}", iso(now_ms()));
        }
    }
}

/// UTC ISO-8601 from ms since epoch (civil-from-days, no date crate needed).
pub fn iso(ms: u64) -> String {
    let secs = ms / 1000;
    let (days, rem) = ((secs / 86_400) as i64, secs % 86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scan::{Age, Risk};

    #[test]
    fn iso_dates() {
        assert_eq!(iso(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso(1_793_577_600_000), "2026-11-02T00:00:00Z");
        assert_eq!(iso(951_782_400_000), "2000-02-29T00:00:00Z");
    }

    #[test]
    fn env_fill_expands_vars() {
        std::env::set_var("SWEEPR_T", r"C:\x");
        assert_eq!(env_fill(r"%SWEEPR_T%\bin\a.exe"), r"C:\x\bin\a.exe");
    }

    /// Sandbox tree: cache files, a protected subfolder, a fresh Temp-style folder, a locked file.
    fn sandbox(name: &str) -> (PathBuf, Roots) {
        let base = std::env::temp_dir().join(format!("sweepr-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let cache = base.join("Cache");
        fs::create_dir_all(cache.join(r"a\b")).unwrap();
        fs::create_dir_all(cache.join("Local Storage")).unwrap();
        fs::write(cache.join("f1.bin"), vec![0u8; 1000]).unwrap();
        fs::write(cache.join(r"a\b\f2.bin"), vec![0u8; 2000]).unwrap();
        fs::write(cache.join(r"Local Storage\login.ldb"), b"secret").unwrap();
        let mut r = Roots::resolve();
        r.local = base.clone();
        (base, r)
    }

    fn target(paths: Vec<PathBuf>) -> Target {
        let mut t = Target::new("sandbox", "apps", "Sandbox", Risk::Safe);
        t.paths = paths;
        t.age = Age::None;
        t
    }

    #[test]
    fn full_clean_in_sandbox() {
        let (base, r) = sandbox("clean");
        let cache = base.join("Cache");
        // Held open without delete sharing, like an app's live file: must be kept.
        let mut locked = std::os::windows::fs::OpenOptionsExt::share_mode(fs::OpenOptions::new().write(true).create(true), 0)
            .open(cache.join("locked.bin"))
            .unwrap();
        locked.write_all(&[1u8; 10]).unwrap();
        let res = run(vec![target(vec![cache.clone()])], Opts { dry: false, recycle: false, min_age_days: 3, elevated: false }, &r, &Ctl::default(), &|_| {});
        let it = &res.items[0];
        assert_eq!(it.status, "done");
        assert_eq!(it.freed, 3000);
        assert!(!cache.join("f1.bin").exists());
        assert!(!cache.join(r"a\b").exists(), "emptied folders are removed");
        assert!(cache.is_dir(), "the target root stays");
        assert!(cache.join(r"Local Storage\login.ldb").exists(), "protected data is never touched");
        assert!(cache.join("locked.bin").exists() && it.kept == 1, "open files are kept, never forced");
        assert!(Path::new(&res.log).is_file());
        drop(locked);
        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn dry_run_deletes_nothing() {
        let (base, r) = sandbox("dry");
        let cache = base.join("Cache");
        let res = run(vec![target(vec![cache.clone()])], Opts { dry: true, recycle: false, min_age_days: 3, elevated: false }, &r, &Ctl::default(), &|_| {});
        assert_eq!(res.items[0].freed, 3000);
        assert!(cache.join("f1.bin").exists() && cache.join(r"a\b\f2.bin").exists());
        fs::remove_dir_all(&base).unwrap();
    }

    /// Dev aid: `cargo test preview_this_pc -- --ignored --nocapture` previews every target of this PC (deletes nothing).
    #[test]
    #[ignore]
    fn preview_this_pc() {
        let r = Roots::resolve();
        let targets = scan::run(3, &[], &|_| {}).targets;
        let res = run(targets.clone(), Opts { dry: true, recycle: true, min_age_days: 3, elevated: false }, &r, &Ctl::default(), &|_| {});
        for (t, it) in targets.iter().zip(&res.items) {
            let tool = t.cmd.map(|c| find_tool(c.split_whitespace().next().unwrap(), &r).map(|p| p.display().to_string()).unwrap_or("-".into()));
            println!("{:<34} {:>9.1} MB est {:>9.1} MB {:8} {:?} tool={:?}", t.name, it.freed as f64 / 1048576.0, t.size as f64 / 1048576.0, it.status, it.reason, tool);
        }
        println!("free before {} after {} log {}", res.free_before, res.free_after, res.log);
    }

    #[test]
    fn cancel_and_admin_and_running_app_skip() {
        let (base, r) = sandbox("skip");
        let cache = base.join("Cache");
        let mut admin = target(vec![cache.clone()]);
        admin.admin = true;
        let mut locked = target(vec![cache.clone()]);
        let me = std::env::current_exe().unwrap().file_name().unwrap().to_string_lossy().to_lowercase();
        locked.lock_exes = vec![(me, "Test".into())];
        let res = run(vec![admin, locked], Opts { dry: false, recycle: false, min_age_days: 3, elevated: false }, &r, &Ctl::default(), &|_| {});
        assert_eq!(res.items[0].reason, Some("needsAdmin"));
        assert_eq!(res.items[1].reason, Some("appRunning"));
        let ctl = Ctl::default();
        ctl.cancel.store(true, Ordering::Relaxed);
        let res = run(vec![target(vec![cache.clone()])], Opts { dry: false, recycle: false, min_age_days: 3, elevated: false }, &r, &ctl, &|_| {});
        assert_eq!(res.items[0].reason, Some("cancelled"));
        assert!(cache.join("f1.bin").exists());
        fs::remove_dir_all(&base).unwrap();
    }
}
