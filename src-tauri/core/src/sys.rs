// System facts: processes, drive space, live stats, pending reboot, virtual disks, startup apps, installed programs.

use crate::paths::{expand, Roots};
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use windows_registry::{Key, CURRENT_USER, LOCAL_MACHINE};

/// Lowercase exe names of running processes.
pub fn processes() -> HashSet<String> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::*;
    let mut out = HashSet::new();
    unsafe {
        let Ok(snap) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else { return out };
        let mut e = PROCESSENTRY32W { dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32, ..Default::default() };
        let mut ok = Process32FirstW(snap, &mut e).is_ok();
        while ok {
            let n = e.szExeFile.iter().position(|c| *c == 0).unwrap_or(e.szExeFile.len());
            out.insert(String::from_utf16_lossy(&e.szExeFile[..n]).to_lowercase());
            ok = Process32NextW(snap, &mut e).is_ok();
        }
        let _ = CloseHandle(snap);
    }
    out
}

#[derive(Serialize, Clone, Copy, Debug, Default)]
pub struct Drive {
    pub letter: char,
    pub total: u64,
    pub free: u64,
}

pub fn drive(r: &Roots) -> Drive {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let root = r.system_drive.to_string_lossy().to_string();
    let (mut free, mut total) = (0u64, 0u64);
    unsafe {
        let _ = GetDiskFreeSpaceExW(&HSTRING::from(root.as_str()), None, Some(&mut total), Some(&mut free));
    }
    Drive { letter: root.chars().next().unwrap_or('C'), total, free }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Live {
    pub ram_used: u64,
    pub ram_total: u64,
    pub cpu: f64,
    pub uptime_ms: u64,
}

/// Previous (idle, total) CPU times for the delta.
pub type CpuPrev = std::sync::Mutex<(u64, u64)>;

pub fn live(prev: &CpuPrev) -> Live {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::SystemInformation::{GetTickCount64, GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetSystemTimes;
    let ft = |f: FILETIME| ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64;
    unsafe {
        let mut m = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
        let _ = GlobalMemoryStatusEx(&mut m);
        let (mut idle, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default());
        let _ = GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user));
        // Kernel time includes idle time.
        let (idle, total) = (ft(idle), ft(kernel) + ft(user));
        let mut p = prev.lock().unwrap();
        let first = p.1 == 0;
        let (di, dt) = (idle.saturating_sub(p.0), total.saturating_sub(p.1));
        *p = (idle, total);
        let cpu = if first || dt == 0 { 0.0 } else { 100.0 * (1.0 - di as f64 / dt as f64) };
        Live {
            ram_used: m.ullTotalPhys - m.ullAvailPhys,
            ram_total: m.ullTotalPhys,
            cpu: cpu.clamp(0.0, 100.0),
            uptime_ms: GetTickCount64(),
        }
    }
}

pub fn pending_reboot() -> bool {
    let lm = LOCAL_MACHINE;
    lm.open(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending").is_ok()
        || lm.open(r"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired").is_ok()
        || lm
            .open(r"SYSTEM\CurrentControlSet\Control\Session Manager")
            .and_then(|k| k.get_value("PendingFileRenameOperations"))
            .map(|v| v.len() > 4)
            .unwrap_or(false)
}

#[derive(Serialize, Debug, Clone)]
pub struct Vdisk {
    pub name: String,
    pub path: String,
    pub size: u64,
}

/// WSL and Docker virtual disks (they grow and never shrink by themselves). Report only here.
pub fn vdisks(r: &Roots) -> Vec<Vdisk> {
    let pats = [
        (r"{LOCAL}\Packages\*\LocalState\ext4.vhdx", "WSL"),
        (r"{LOCAL}\wsl\*\ext4.vhdx", "WSL"),
        (r"{LOCAL}\Docker\wsl\disk\docker_data.vhdx", "Docker"),
        (r"{LOCAL}\Docker\wsl\data\ext4.vhdx", "Docker"),
    ];
    let mut out: Vec<Vdisk> = pats
        .iter()
        .flat_map(|(p, name)| expand(&r.fill(p)).into_iter().map(move |f| (f, *name)))
        .filter_map(|(f, name)| {
            let size = std::fs::metadata(&f).ok()?.len();
            let file = f.file_name()?.to_string_lossy().to_string();
            Some(Vdisk { name: format!("{name} · {file}"), path: f.to_string_lossy().to_string(), size })
        })
        .collect();
    out.sort_by(|a, b| b.size.cmp(&a.size));
    out
}

// ---------- startup apps (read-only here; toggles come in step 4) ----------

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StartupApp {
    pub id: String,
    pub name: String,
    pub impact: &'static str,
    pub enabled: bool,
    pub admin: bool,
    pub command: String,
}

pub const RUN: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
pub const RUN32: &str = r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run";
pub const APPROVED: &str = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved";

/// Task Manager stores 12 bytes: byte 0 even = enabled (0x02), odd = disabled (0x03).
pub fn approved_enabled(bytes: &[u8]) -> bool {
    bytes.first().map(|b| b & 1 == 0).unwrap_or(true)
}

fn approved(hive: &Key, sub: &str, name: &str) -> bool {
    hive.open(format!(r"{APPROVED}\{sub}"))
        .and_then(|k| k.get_value(name))
        .map(|v| approved_enabled(&v))
        .unwrap_or(true)
}

// ponytail: impact is a name heuristic (High ≈ 4.5 s, Medium ≈ 2 s, Low ≈ 0.8 s); use boot-trace data if it ever becomes available.
fn impact(name: &str, command: &str) -> &'static str {
    let s = format!("{name} {command}").to_lowercase();
    const HIGH: [&str; 12] = ["steam", "epicgames", "docker", "teams", "creative cloud", "adobe", "battle.net", "ea desktop", "eadesktop", "ubisoft", "origin", "riotclient"];
    const MED: [&str; 14] = ["discord", "spotify", "onedrive", "dropbox", "googledrive", "roblox", "edge", "zoom", "slack", "skype", "telegram", "whatsapp", "nvidia", "icloud"];
    if HIGH.iter().any(|x| s.contains(x)) {
        "High"
    } else if MED.iter().any(|x| s.contains(x)) && !name.to_lowercase().contains("update") {
        "Medium"
    } else {
        "Low"
    }
}

fn pretty(name: &str) -> String {
    if name.starts_with("MicrosoftEdgeAutoLaunch") {
        return "Microsoft Edge auto-launch".into();
    }
    name.to_string()
}

pub fn startup(r: &Roots) -> Vec<StartupApp> {
    let mut out = Vec::new();
    let runs: [(&Key, &str, &str, &str, bool); 3] =
        [(CURRENT_USER, RUN, "Run", "hkcu", false), (LOCAL_MACHINE, RUN, "Run", "hklm", true), (LOCAL_MACHINE, RUN32, "Run32", "hklm32", true)];
    for (hive, path, sub, tag, admin) in runs {
        let Ok(k) = hive.open(path) else { continue };
        let Ok(values) = k.values() else { continue };
        for (name, v) in values {
            let command = String::try_from(v).unwrap_or_default();
            if name.is_empty() || command.is_empty() {
                continue;
            }
            out.push(StartupApp {
                id: format!("{tag}|{name}"),
                impact: impact(&name, &command),
                enabled: approved(hive, sub, &name),
                name: pretty(&name),
                admin,
                command,
            });
        }
    }
    let folders = [
        (r.roaming.join(r"Microsoft\Windows\Start Menu\Programs\Startup"), CURRENT_USER, "folder", false),
        (r.program_data.join(r"Microsoft\Windows\Start Menu\Programs\StartUp"), LOCAL_MACHINE, "commonfolder", true),
    ];
    for (dir, hive, tag, admin) in folders {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for e in rd.flatten() {
            let file = e.file_name().to_string_lossy().to_string();
            if file.eq_ignore_ascii_case("desktop.ini") {
                continue;
            }
            let name = file.rsplit_once('.').map(|(a, _)| a.to_string()).unwrap_or(file.clone());
            out.push(StartupApp {
                id: format!("{tag}|{file}"),
                impact: impact(&name, ""),
                enabled: approved(hive, "StartupFolder", &file),
                name,
                admin,
                command: e.path().to_string_lossy().to_string(),
            });
        }
    }
    // ponytail: logon-triggered scheduled tasks are not listed yet; add with the Task Scheduler COM API in step 4.
    out
}

// ---------- installed programs (for leftover detection) ----------

/// Normalized names and words of everything that looks installed: Uninstall entries, Program Files folders,
/// Store packages, running processes.
pub fn installed_words(r: &Roots, procs: &HashSet<String>) -> HashSet<String> {
    let mut names: Vec<String> = Vec::new();
    let uninst = [
        (LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall"),
    ];
    for (hive, path) in uninst {
        let Ok(k) = hive.open(path) else { continue };
        let Ok(keys) = k.keys() else { continue };
        for sub in keys {
            names.push(sub.clone());
            let Ok(e) = k.open(&sub) else { continue };
            for v in ["DisplayName", "Publisher", "InstallLocation", "DisplayIcon"] {
                if let Ok(s) = e.get_string(v) {
                    names.push(s);
                }
            }
        }
    }
    let dirs: [PathBuf; 4] = [
        std::env::var_os("ProgramFiles").map(PathBuf::from).unwrap_or_default(),
        std::env::var_os("ProgramFiles(x86)").map(PathBuf::from).unwrap_or_default(),
        r.local.join("Programs"),
        r.local.join("Packages"),
    ];
    for d in dirs {
        if let Ok(rd) = std::fs::read_dir(d) {
            names.extend(rd.flatten().map(|e| e.file_name().to_string_lossy().to_string()));
        }
    }
    names.extend(procs.iter().map(|p| p.trim_end_matches(".exe").to_string()));

    let mut words = HashSet::new();
    for n in names {
        for part in n.split(|c: char| !c.is_alphanumeric()) {
            if part.len() >= 3 {
                words.insert(part.to_lowercase());
            }
        }
        let whole = norm(&n);
        if whole.len() >= 3 {
            words.insert(whole);
        }
    }
    words
}

pub fn norm(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).collect::<String>().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_approved_bytes() {
        assert!(approved_enabled(&[0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(approved_enabled(&[0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(!approved_enabled(&[0x03, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]));
        assert!(approved_enabled(&[]));
    }

    #[test]
    fn impact_heuristic() {
        assert_eq!(impact("Steam", r#""C:\Program Files (x86)\Steam\steam.exe" -silent"#), "High");
        assert_eq!(impact("Discord", r"C:\Users\u\AppData\Local\Discord\Update.exe --processStart Discord.exe"), "Medium");
        assert_eq!(impact("Spotify", "Spotify.exe /minimized"), "Medium");
        assert_eq!(impact("SecurityHealth", "SecurityHealthSystray.exe"), "Low");
    }

    #[test]
    fn live_stats_are_sane() {
        let prev = CpuPrev::default();
        let l = live(&prev);
        assert!(l.ram_total > 0 && l.ram_used <= l.ram_total);
        assert!(l.uptime_ms > 0);
        assert!(!processes().is_empty());
    }
}
