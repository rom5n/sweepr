// Read-only scanner. Builds the target list from Sweepr_clean-methods.txt (Parts 4-9) and measures each one.

use crate::paths::{self, expand, now_ms, AgeRule, Roots, DAY_MS};
use crate::sys::{self, norm};
use serde::Serialize;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;

#[derive(Serialize, Clone, Copy, PartialEq, Eq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    Safe,
    Low,
    Medium,
    High,
}
use Risk::*;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Age {
    None,
    /// "Temporary files older than" setting, plus the 24 h folder rule.
    Setting,
    Days(u64),
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    pub id: String,
    pub cat: &'static str,
    /// English name; the UI translates it, or builds it from `name_key` + `app`.
    pub name: String,
    pub name_key: Option<&'static str>,
    pub app: Option<String>,
    pub display: String,
    pub size: u64,
    pub files: u64,
    pub risk: Risk,
    pub admin: bool,
    pub bin: bool,
    pub note: Option<&'static str>,
    pub note_key: Option<&'static str>,
    pub days: Option<u64>,
    pub consequence: Option<&'static str>,
    /// Label of the app that locks this target, set only while it runs.
    pub lock: Option<String>,
    pub cmd: Option<&'static str>,
    #[serde(skip)]
    pub paths: Vec<PathBuf>,
    #[serde(skip)]
    pub age: Age,
    #[serde(skip)]
    pub lock_exes: Vec<(String, String)>,
    #[serde(skip)]
    pub newest: u64,
    #[serde(skip)]
    pub exes: u64,
    #[serde(skip)]
    pub tool_only: bool,
    #[serde(skip)]
    measured: bool,
}

impl Target {
    pub(crate) fn new(id: impl Into<String>, cat: &'static str, name: impl Into<String>, risk: Risk) -> Target {
        Target {
            id: id.into(),
            cat,
            name: name.into(),
            name_key: None,
            app: None,
            display: String::new(),
            size: 0,
            files: 0,
            risk,
            admin: false,
            bin: false,
            note: None,
            note_key: None,
            days: None,
            consequence: None,
            lock: None,
            cmd: None,
            paths: vec![],
            age: Age::None,
            lock_exes: vec![],
            newest: 0,
            exes: 0,
            tool_only: false,
            measured: false,
        }
    }
    fn app(mut self, key: &'static str, app: &str) -> Self {
        self.name_key = Some(key);
        self.app = Some(app.to_string());
        self
    }
    fn locks(mut self, exes: &[&str], label: &str) -> Self {
        self.lock_exes = exes.iter().map(|e| (e.to_string(), label.to_string())).collect();
        self
    }
}

// ---------- static targets ----------

struct Def {
    id: &'static str,
    cat: &'static str,
    name: &'static str,
    risk: Risk,
    pats: &'static [&'static str],
    admin: bool,
    age: Age,
    cmd: Option<&'static str>,
    note: Option<&'static str>,
    lock: &'static [&'static str],
    lock_label: &'static str,
    consequence: Option<&'static str>,
    /// Hardlinked stores and read-only module caches: only the tool's own cleaner, never a folder delete.
    tool_only: bool,
}

const fn d(id: &'static str, cat: &'static str, name: &'static str, risk: Risk, pats: &'static [&'static str]) -> Def {
    Def { id, cat, name, risk, pats, admin: false, age: Age::None, cmd: None, note: None, lock: &[], lock_label: "", consequence: None, tool_only: false }
}

const REDOWNLOAD: Option<&str> = Some("Packages re-download on the next install");
const HARDLINKED: Option<&str> = Some("Hardlinked store: may free much less than shown");
const STUTTER: Option<&str> = Some("First launch of each game may stutter briefly");
const STEAM: &[&str] = &["steam.exe", "steamwebhelper.exe"];

const DEFS: &[Def] = &[
    // Developer caches (Part 7)
    Def { cmd: Some("npm cache clean --force"), ..d("npm", "dev", "npm cache", Low, &[r"{LOCAL}\npm-cache"]) },
    Def { cmd: Some("yarn cache clean"), note: REDOWNLOAD, ..d("yarn", "dev", "Yarn v1 cache", Low, &[r"{LOCAL}\Yarn\Cache"]) },
    Def { cmd: Some("pnpm store prune"), note: HARDLINKED, tool_only: true, ..d("pnpm", "dev", "pnpm store", Safe, &[r"{LOCAL}\pnpm\store", r"{LOCAL}\pnpm-store"]) },
    Def { cmd: Some("bun pm cache rm"), ..d("bun", "dev", "Bun cache", Low, &[r"{PROFILE}\.bun\install\cache"]) },
    Def { cmd: Some("pip cache purge"), ..d("pip", "dev", "pip cache", Low, &[r"{LOCAL}\pip\Cache"]) },
    Def { cmd: Some("uv cache clean"), ..d("uv", "dev", "uv cache", Low, &[r"{LOCAL}\uv\cache"]) },
    Def { cmd: Some("poetry cache clear --all PyPI"), ..d("poetry", "dev", "Poetry cache", Low, &[r"{LOCAL}\pypoetry\Cache"]) },
    Def {
        cmd: Some("conda clean --all -y"),
        note: HARDLINKED,
        tool_only: true,
        ..d("conda", "dev", "Conda packages", Low, &[
            r"{PROFILE}\anaconda3\pkgs", r"{PROFILE}\miniconda3\pkgs", r"{PROFILE}\miniforge3\pkgs",
            r"{PROGRAMDATA}\anaconda3\pkgs", r"{PROGRAMDATA}\miniconda3\pkgs", r"{LOCAL}\anaconda3\pkgs",
        ])
    },
    Def { cmd: Some("go clean -cache"), ..d("gocache", "dev", "Go build cache", Safe, &[r"{LOCAL}\go-build"]) },
    Def { cmd: Some("go clean -modcache"), note: REDOWNLOAD, tool_only: true, ..d("gomod", "dev", "Go module cache", Low, &[r"{PROFILE}\go\pkg\mod"]) },
    Def { note: REDOWNLOAD, ..d("cargo", "dev", "Cargo registry cache", Low, &[r"{PROFILE}\.cargo\registry\cache", r"{PROFILE}\.cargo\registry\src"]) },
    Def { cmd: Some("gradle --stop"), note: REDOWNLOAD, ..d("gradle", "dev", "Gradle caches", Low, &[r"{PROFILE}\.gradle\caches"]) },
    Def { note: REDOWNLOAD, ..d("maven", "dev", "Maven repository", Low, &[r"{PROFILE}\.m2\repository"]) },
    Def { cmd: Some("dotnet nuget locals all --clear"), note: REDOWNLOAD, ..d("nuget", "dev", "NuGet cache", Low, &[r"{LOCAL}\NuGet\v3-cache", r"{PROFILE}\.nuget\packages"]) },
    Def { ..d("playwright", "dev", "Playwright browsers", Low, &[r"{LOCAL}\ms-playwright"]) },
    Def { ..d("puppeteer", "dev", "Puppeteer browsers", Low, &[r"{PROFILE}\.cache\puppeteer"]) },
    Def { ..d("jetbrains", "dev", "JetBrains caches & logs", Low, &[r"{LOCAL}\JetBrains\*\caches", r"{LOCAL}\JetBrains\*\log"]) },
    Def {
        lock: &["devenv.exe"],
        lock_label: "Visual Studio",
        ..d("vscache", "dev", "Visual Studio component cache", Safe, &[r"{LOCAL}\Microsoft\VisualStudio\*\ComponentModelCache"])
    },
    // GPU & games (Part 6)
    Def { note: STUTTER, ..d("nvdx", "gpu", "NVIDIA shader cache", Safe, &[r"{LOCAL}\NVIDIA\DXCache", r"{LOCAL}\NVIDIA\GLCache"]) },
    Def { note: STUTTER, ..d("amd", "gpu", "AMD shader cache", Safe, &[r"{LOCAL}\AMD\DxCache", r"{LOCAL}\AMD\DxcCache", r"{LOCAL}\AMD\VkCache", r"{LOCAL}\AMD\GLCache"]) },
    Def { note: STUTTER, ..d("intel", "gpu", "Intel shader cache", Safe, &[r"{LOCAL}\Intel\ShaderCache"]) },
    Def { ..d("d3d", "gpu", "DirectX shader cache", Safe, &[r"{LOCAL}\D3DSCache"]) },
    Def {
        lock: &["epicgameslauncher.exe"],
        lock_label: "Epic Games Launcher",
        ..d("epic", "gpu", "Epic Games web cache & logs", Safe, &[r"{LOCAL}\EpicGamesLauncher\Saved\webcache*", r"{LOCAL}\EpicGamesLauncher\Saved\Logs"])
    },
    Def { lock: &["robloxplayerbeta.exe"], lock_label: "Roblox", ..d("roblox", "gpu", "Roblox logs", Safe, &[r"{LOCAL}\Roblox\logs"]) },
    Def { lock: &["prismlauncher.exe"], lock_label: "Prism Launcher", ..d("prism", "gpu", "Prism Launcher cache", Safe, &[r"{ROAMING}\PrismLauncher\cache"]) },
    // Windows system (Part 4)
    Def { age: Age::Setting, note: Some("Open files and folders changed in the last 24 h are kept"), ..d("temp", "sys", "Temporary files", Safe, &[r"{TEMP}"]) },
    Def { age: Age::Setting, admin: true, ..d("wintemp", "sys", "Windows temporary files", Safe, &[r"{WINDIR}\Temp"]) },
    Def { admin: true, ..d("wu", "sys", "Windows Update cache", Low, &[r"{WINDIR}\SoftwareDistribution\Download"]) },
    Def { note: Some("Explorer rebuilds thumbnails as you browse"), ..d("thumb", "sys", "Thumbnail cache", Safe, &[r"{LOCAL}\Microsoft\Windows\Explorer\thumbcache_*.db"]) },
    Def { ..d("wer", "sys", "Error reports", Safe, &[r"{LOCAL}\Microsoft\Windows\WER\ReportArchive", r"{LOCAL}\Microsoft\Windows\WER\ReportQueue", r"{LOCAL}\Microsoft\Windows\WER\Temp"]) },
    Def {
        admin: true,
        ..d("syswer", "sys", "System error reports", Safe, &[r"{PROGRAMDATA}\Microsoft\Windows\WER\ReportArchive", r"{PROGRAMDATA}\Microsoft\Windows\WER\ReportQueue", r"{PROGRAMDATA}\Microsoft\Windows\WER\Temp"])
    },
    Def { ..d("dumps", "sys", "App crash dumps", Safe, &[r"{LOCAL}\CrashDumps"]) },
    Def { admin: true, note: Some("Crash diagnostics are lost"), ..d("memdump", "sys", "Memory dumps", Low, &[r"{WINDIR}\MEMORY.DMP", r"{WINDIR}\Minidump", r"{WINDIR}\LiveKernelReports"]) },
    Def { admin: true, age: Age::Days(30), ..d("winlogs", "sys", "Windows logs", Safe, &[r"{WINDIR}\Logs\CBS\*.log", r"{WINDIR}\Logs\DISM\*.log", r"{WINDIR}\Panther"]) },
    Def {
        admin: true,
        ..d("drvleft", "sys", "Driver installer leftovers", Safe, &[r"{SYSDRIVE}\NVIDIA", r"{SYSDRIVE}\AMD", r"{PROGRAMDATA}\NVIDIA Corporation\Downloader"])
    },
    Def {
        admin: true,
        consequence: Some("you can no longer roll back to the previous Windows version"),
        ..d("winold", "sys", "Previous Windows installation", High, &[r"{SYSDRIVE}Windows.old", r"{SYSDRIVE}$Windows.~BT", r"{SYSDRIVE}$Windows.~WS", r"{SYSDRIVE}$WinREAgent"])
    },
    Def {
        ..d("storecache", "sys", "Store app caches", Low, &[r"{LOCAL}\Packages\*\LocalCache", r"{LOCAL}\Packages\*\TempState", r"{LOCAL}\Packages\*\AC\INetCache", r"{LOCAL}\Packages\*\AC\Temp"])
    },
    // Apps (Part 8)
    Def {
        lock: &["telegram.exe"],
        lock_label: "Telegram",
        note: Some("Media re-downloads when you open old chats"),
        ..d("tg", "apps", "Telegram media cache", Low, &[r"{ROAMING}\Telegram Desktop\tdata\user_data"])
    },
    Def { lock: &["spotify.exe"], lock_label: "Spotify", ..d("spotify", "apps", "Spotify cache", Low, &[r"{LOCAL}\Spotify\Storage", r"{LOCAL}\Spotify\Data"]) },
    Def { ..d("officecache", "apps", "Office file cache", Low, &[r"{LOCAL}\Microsoft\Office\16.0\OfficeFileCache"]) },
    Def { lock: &["capcut.exe"], lock_label: "CapCut", ..d("capcut", "apps", "CapCut cache", Low, &[r"{LOCAL}\CapCut\User Data\Cache"]) },
    Def { ..d("onedrivelogs", "apps", "OneDrive logs", Safe, &[r"{LOCAL}\Microsoft\OneDrive\logs"]) },
    Def { ..d("adobe", "apps", "Adobe media cache", Low, &[r"{ROAMING}\Adobe\Common\Media Cache Files", r"{ROAMING}\Adobe\Common\Media Cache"]) },
];

/// `{LOCAL}\x` -> `%LOCALAPPDATA%\x` for display.
fn show(pat: &str) -> String {
    pat.replace("{LOCAL}", "%LOCALAPPDATA%")
        .replace("{ROAMING}", "%APPDATA%")
        .replace("{PROFILE}", "%USERPROFILE%")
        .replace("{PROGRAMDATA}", "%ProgramData%")
        .replace("{WINDIR}", "%SystemRoot%")
        .replace("{TEMP}", "%TEMP%")
        .replace("{DOWNLOADS}", "Downloads")
        .replace("{SYSDRIVE}", "%SystemDrive%")
}

fn from_def(df: &Def, r: &Roots) -> Target {
    let mut t = Target::new(df.id, df.cat, df.name, df.risk);
    t.paths = df.pats.iter().flat_map(|p| expand(&r.fill(p))).collect();
    t.display = df.cmd.map(str::to_string).unwrap_or_else(|| show(df.pats[0]));
    t.admin = df.admin;
    t.age = df.age;
    t.cmd = df.cmd;
    t.note = df.note;
    t.consequence = df.consequence;
    t.tool_only = df.tool_only;
    t.lock_exes = df.lock.iter().map(|e| (e.to_string(), df.lock_label.to_string())).collect();
    t
}

// ---------- discovered targets ----------

const CHROMIUM: &[(&str, &str, &str)] = &[
    ("Chrome", r"{LOCAL}\Google\Chrome\User Data", "chrome.exe"),
    ("Edge", r"{LOCAL}\Microsoft\Edge\User Data", "msedge.exe"),
    ("Brave", r"{LOCAL}\BraveSoftware\Brave-Browser\User Data", "brave.exe"),
    ("Vivaldi", r"{LOCAL}\Vivaldi\User Data", "vivaldi.exe"),
    ("Yandex", r"{LOCAL}\Yandex\YandexBrowser\User Data", "browser.exe"),
    ("Opera", r"{LOCAL}\Opera Software\Opera Stable", "opera.exe"),
];
const CHROMIUM_CACHES: &[&str] = &[
    r"*\Cache", r"*\Code Cache", r"*\GPUCache", r"*\Service Worker\CacheStorage", r"*\Service Worker\ScriptCache",
    r"*\DawnGraphiteCache", r"*\DawnWebGPUCache", r"ShaderCache", r"GrShaderCache", r"GraphiteDawnCache", r"component_crx_cache",
    r"Cache", r"Code Cache", r"GPUCache",
];
const CHROMIUM_PRIVACY: &[&str] = &[r"*\History", r"*\Network\Cookies", r"*\Visited Links", r"*\Top Sites"];
const FIREFOX: &[(&str, &str, &str)] = &[
    ("Firefox", r"Mozilla\Firefox\Profiles", "firefox.exe"),
    ("Zen", r"zen\Profiles", "zen.exe"),
    ("LibreWolf", r"librewolf\Profiles", "librewolf.exe"),
    ("Waterfox", r"Waterfox\Profiles", "waterfox.exe"),
    ("Floorp", r"Floorp\Profiles", "floorp.exe"),
];

fn browsers(r: &Roots) -> Vec<Target> {
    let mut out = Vec::new();
    let mut privacy = Target::new("cookies", "web", "Cookies & history", Medium);
    privacy.note = Some("Passwords and bookmarks are never touched");
    privacy.consequence = Some("you will be signed out of most websites");
    let mut names = Vec::new();
    for (label, base, exe) in CHROMIUM {
        let base = r.fill(base);
        let paths: Vec<PathBuf> = CHROMIUM_CACHES.iter().flat_map(|c| expand(&format!(r"{base}\{c}"))).collect();
        if paths.is_empty() {
            continue;
        }
        let mut t = Target::new(format!("web-{}", label.to_lowercase()), "web", format!("{label} cache"), Safe).app("appCache", label).locks(&[exe], label);
        t.display = show(&format!(r"{}\*\Cache", CHROMIUM.iter().find(|c| c.0 == *label).unwrap().1));
        t.paths = paths;
        out.push(t);
        privacy.paths.extend(CHROMIUM_PRIVACY.iter().flat_map(|c| expand(&format!(r"{base}\{c}"))));
        privacy.lock_exes.push((exe.to_string(), label.to_string()));
        names.push(*label);
    }
    for (label, prof, exe) in FIREFOX {
        let local = format!(r"{}\{prof}", r.local.display());
        let paths: Vec<PathBuf> = [r"*\cache2", r"*\startupCache"].iter().flat_map(|c| expand(&format!(r"{local}\{c}"))).collect();
        if paths.is_empty() {
            continue;
        }
        let mut t = Target::new(format!("web-{}", label.to_lowercase()), "web", format!("{label} cache"), Safe).app("appCache", label).locks(&[exe], label);
        t.display = format!(r"{prof}\*\cache2");
        t.paths = paths;
        out.push(t);
        privacy.paths.extend(expand(&format!(r"{}\{prof}\*\cookies.sqlite", r.roaming.display())));
        privacy.lock_exes.push((exe.to_string(), label.to_string()));
        names.push(*label);
    }
    if !privacy.paths.is_empty() {
        privacy.display = names.join(", ");
        out.push(privacy);
    }
    out
}

const ELECTRON_CACHES: &[&str] = &["Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache", "DawnWebGPUCache", r"Crashpad\reports", "logs"];

fn pretty_app(folder: &str) -> String {
    match folder.to_lowercase().as_str() {
        "code" => "VS Code".into(),
        "discord" => "Discord".into(),
        "obsidian" => "Obsidian".into(),
        "notion" => "Notion".into(),
        "microsoft teams" => "Teams".into(),
        _ => {
            let mut c = folder.chars();
            c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
        }
    }
}

/// Electron apps in %APPDATA% (Discord, Slack, VS Code, Obsidian, ...): only their cache folders, never Local Storage / IndexedDB.
fn electron(r: &Roots, skip: &HashSet<String>) -> Vec<Target> {
    let Ok(rd) = std::fs::read_dir(&r.roaming) else { return vec![] };
    let mut out = Vec::new();
    for e in rd.flatten() {
        let dir = e.path();
        let folder = e.file_name().to_string_lossy().to_string();
        if skip.contains(&folder.to_lowercase()) || !(dir.join("GPUCache").is_dir() || dir.join("Code Cache").is_dir()) {
            continue;
        }
        let app = pretty_app(&folder);
        let exe = format!("{}.exe", folder.to_lowercase());
        let mut t = Target::new(format!("app-{}", norm(&folder)), "apps", format!("{app} cache"), Safe).app("appCache", &app).locks(&[&exe], &app);
        t.paths = ELECTRON_CACHES.iter().map(|c| dir.join(c)).filter(|p| p.exists()).collect();
        t.display = format!(r"%APPDATA%\{folder}\Cache");
        out.push(t);
    }
    out
}

/// "publisher.name-1.2.3[-platform]" -> ("publisher.name", [1,2,3]).
pub fn ext_version(dir: &str) -> Option<(String, Vec<u64>)> {
    let parts: Vec<&str> = dir.split('-').collect();
    let i = parts.iter().position(|p| p.starts_with(|c: char| c.is_ascii_digit()) && p.contains('.'))?;
    if i == 0 {
        return None;
    }
    let ver = parts[i].split('.').map(|n| n.parse().unwrap_or(0)).collect();
    Some((parts[..i].join("-").to_lowercase(), ver))
}

/// Old versions of the same extension (VS Code keeps them after updates).
fn old_extensions(r: &Roots, id: &str, label: &str, folder: &str, exe: &str) -> Option<Target> {
    let dir = r.profile.join(folder).join("extensions");
    let mut all: Vec<(String, Vec<u64>, PathBuf)> = std::fs::read_dir(&dir)
        .ok()?
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| ext_version(&e.file_name().to_string_lossy()).map(|(n, v)| (n, v, e.path())))
        .collect();
    all.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
    let mut seen = HashSet::new();
    let old: Vec<PathBuf> = all.into_iter().filter(|(n, _, _)| !seen.insert(n.clone())).map(|(_, _, p)| p).collect();
    if old.is_empty() {
        return None;
    }
    let mut t = Target::new(id, "dev", format!("{label} old extensions"), Safe).locks(&[exe], label);
    t.name_key = Some("oldExt");
    t.app = Some(label.into());
    t.display = format!(r"{folder}\extensions");
    t.paths = old;
    Some(t)
}

fn steam(r: &Roots) -> Vec<Target> {
    let mut out = Vec::new();
    let steam = windows_registry::CURRENT_USER
        .open(r"Software\Valve\Steam")
        .and_then(|k| k.get_string("SteamPath"))
        .map(|s| PathBuf::from(s.replace('/', "\\")))
        .ok();
    let mut web = Target::new("steamweb", "gpu", "Steam web cache", Safe).locks(STEAM, "Steam");
    web.display = r"%LOCALAPPDATA%\Steam\htmlcache".into();
    web.paths = expand(&r.fill(r"{LOCAL}\Steam\htmlcache"));
    if let Some(s) = &steam {
        web.paths.extend(expand(&format!(r"{}\appcache\httpcache", s.display())));
        let mut logs = Target::new("steamlogs", "gpu", "Steam logs & dumps", Safe).locks(STEAM, "Steam");
        logs.display = r"Steam\logs, Steam\dumps".into();
        logs.paths = ["logs", "dumps"].iter().map(|x| s.join(x)).filter(|p| p.is_dir()).collect();
        out.push(logs);
        // Library folders: steamapps\libraryfolders.vdf has lines like  "path"  "D:\\SteamLibrary"
        let mut libs = vec![s.clone()];
        if let Ok(vdf) = std::fs::read_to_string(s.join(r"steamapps\libraryfolders.vdf")) {
            for line in vdf.lines() {
                let q: Vec<&str> = line.split('"').collect();
                if q.len() >= 4 && q[1] == "path" {
                    libs.push(PathBuf::from(q[3].replace(r"\\", r"\")));
                }
            }
        }
        libs.dedup();
        let mut sh = Target::new("steamshader", "gpu", "Steam shader cache", Safe).locks(STEAM, "Steam");
        sh.note = STUTTER;
        sh.display = r"steamapps\shadercache".into();
        sh.paths = libs.iter().map(|l| l.join(r"steamapps\shadercache")).filter(|p| p.is_dir()).collect();
        out.push(sh);
    }
    out.insert(0, web);
    out
}

/// Folder names that are tools, caches or Windows parts, never "leftovers".
const NOT_LEFTOVER: &[&str] = &[
    "microsoft", "packages", "temp", "programs", "comms", "connecteddevicesplatform", "crashdumps", "d3dscache", "nvidia",
    "nvidiacorporation", "amd", "intel", "google", "mozilla", "npm", "npmcache", "yarn", "pnpm", "pnpmstore", "pip", "uv",
    "pypoetry", "gobuild", "go", "nuget", "msplaywright", "jetbrains", "docker", "dockerdesktop", "wsl", "virtualstore",
    "history", "ssh", "usoshared", "usoprivate", "softwaredistribution", "windows", "regid19912microsoft", "applicationdata",
    "desktop", "documents", "startmenu", "templates", "packagecache", "pythonsoftwarefoundation", "python", "jedi", "code",
    "ms", "cache", "caches", "logs", "log", "tmp", "local", "roaming", "locallow", "fontcache", "identities", "peernet",
];

/// AppData / ProgramData folders that match no installed program, no running process, untouched for 30+ days.
fn leftover_candidates(r: &Roots, words: &HashSet<String>) -> Vec<Target> {
    let matches = |n: &str| {
        words.contains(n) || words.iter().any(|w| w.len() >= 5 && (n.contains(w.as_str()) || (n.len() >= 5 && w.contains(n))))
    };
    let mut out = Vec::new();
    for (base, shown) in [(&r.roaming, "%APPDATA%"), (&r.local, "%LOCALAPPDATA%"), (&r.program_data, "%ProgramData%")] {
        let Ok(rd) = std::fs::read_dir(base) else { continue };
        for e in rd.flatten() {
            let folder = e.file_name().to_string_lossy().to_string();
            let n = norm(&folder);
            let Ok(m) = e.metadata() else { continue };
            if !m.is_dir() || m.file_attributes_reparse() || n.len() < 3 || folder.starts_with(['.', '{']) || NOT_LEFTOVER.contains(&n.as_str()) || matches(&n) {
                continue;
            }
            let app = pretty_app(&folder);
            let mut t = Target::new(format!("left-{n}"), "left", format!("{app} leftovers"), Medium).app("appLeftovers", &app);
            t.bin = true;
            t.note_key = Some("untouched");
            t.consequence = Some("settings and data go to the Recycle Bin");
            t.display = format!(r"{shown}\{folder}");
            t.paths = vec![e.path()];
            out.push(t);
        }
    }
    out
}

trait Reparse {
    fn file_attributes_reparse(&self) -> bool;
}
impl Reparse for std::fs::Metadata {
    fn file_attributes_reparse(&self) -> bool {
        use std::os::windows::fs::MetadataExt;
        self.file_attributes() & 0x400 != 0
    }
}

const LEFTOVER_MIN: u64 = 100 * 1024 * 1024;

fn old_installers(r: &Roots) -> Option<Target> {
    if r.in_cloud(&r.downloads) {
        return None; // ponytail: synced Downloads skipped until the cloud-delete warning exists
    }
    let mut t = Target::new("inst", "left", "Old installers", Medium);
    t.bin = true;
    t.note = Some("Older than 30 days");
    t.consequence = Some("installers you might reuse go to the Recycle Bin");
    t.display = r"Downloads\*.exe, *.msi, *.iso, *.zip".into();
    t.age = Age::Days(30);
    t.paths = ["exe", "msi", "iso", "zip"].iter().flat_map(|x| expand(&r.fill(&format!(r"{{DOWNLOADS}}\*.{x}")))).collect();
    Some(t)
}

fn recycle_bin() -> Target {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHQueryRecycleBinW, SHQUERYRBINFO};
    let mut t = Target::new("recycle", "sys", "Recycle Bin", Medium);
    t.consequence = Some("deleted files can no longer be restored");
    t.display = "Recycle Bin".into();
    let mut info = SHQUERYRBINFO { cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32, ..Default::default() };
    if unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }.is_ok() {
        t.size = info.i64Size.max(0) as u64;
        t.files = info.i64NumItems.max(0) as u64;
    }
    t.measured = true;
    t
}

// ---------- scan ----------

pub const CATS: [&str; 6] = ["dev", "gpu", "left", "sys", "apps", "web"];

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub scanned_at: u64,
    pub drive: sys::Drive,
    pub targets: Vec<Target>,
    pub uptime_ms: u64,
    pub pending_reboot: bool,
    pub vdisks: Vec<sys::Vdisk>,
    pub startup: Vec<sys::StartupApp>,
}

/// Builds every target with its resolved paths (nothing measured yet).
/// The fixed target table only (all admin targets live here). The helper uses this, never paths from the app.
pub fn static_targets(r: &Roots) -> Vec<Target> {
    let mut t: Vec<Target> = DEFS.iter().map(|df| from_def(df, r)).collect();
    for x in &mut t {
        x.paths.retain(|p| !r.in_cloud(p) && !paths::is_protected(p, r));
    }
    t
}

pub fn targets(r: &Roots, procs: &HashSet<String>) -> Vec<Target> {
    let mut t = static_targets(r);
    t.extend(old_extensions(r, "vscodeext", "VS Code", ".vscode", "code.exe"));
    t.extend(old_extensions(r, "cursorext", "Cursor", ".cursor", "cursor.exe"));
    t.extend(steam(r));
    let left = leftover_candidates(r, &sys::installed_words(r, procs));
    let left_folders: HashSet<String> = left.iter().flat_map(|l| l.paths.iter()).filter_map(|p| p.file_name()).map(|f| f.to_string_lossy().to_lowercase()).collect();
    t.extend(left);
    t.extend(old_installers(r));
    t.push(recycle_bin());
    t.extend(electron(r, &left_folders));
    t.extend(browsers(r));
    // Never touch synced cloud folders (L7) or protected paths.
    for x in &mut t {
        x.paths.retain(|p| !r.in_cloud(p) && !paths::is_protected(p, r));
    }
    t
}

pub fn run(min_age_days: u64, excludes: &[String], progress: &(dyn Fn(u32) + Sync)) -> ScanResult {
    let r = Roots::resolve().with_excludes(excludes);
    let procs = sys::processes();
    let mut list = targets(&r, &procs);
    let now = now_ms();

    // Measure in parallel; one worker per core, at most 8.
    let next = AtomicUsize::new(0);
    let total = list.len().max(1);
    let (tx, rx) = mpsc::channel();
    let workers = std::thread::available_parallelism().map(|n| n.get().min(8)).unwrap_or(4);
    let results = std::thread::scope(|s| {
        for _ in 0..workers {
            let (tx, next, list, r) = (tx.clone(), &next, &list, &r);
            s.spawn(move || loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                let Some(t) = list.get(i) else { break };
                let w = if t.measured { paths::Walk::default() } else { measure(t, r, min_age_days, now) };
                if tx.send((i, w)).is_err() {
                    break;
                }
            });
        }
        drop(tx);
        let mut done = 0;
        let mut results = Vec::new();
        for (i, w) in rx {
            done += 1;
            progress(((done * 100) / total) as u32);
            results.push((i, w));
        }
        results
    });
    for (i, w) in results {
        let t = &mut list[i];
        if !t.measured {
            t.size = w.size;
            t.files = w.files;
            t.newest = w.newest;
            t.exes = w.exes;
        }
    }

    for t in &mut list {
        if let Some((_, label)) = t.lock_exes.iter().find(|(e, _)| procs.contains(e)) {
            t.lock = Some(label.clone());
        }
        if t.cat == "left" && t.id != "inst" {
            t.days = Some(now.saturating_sub(t.newest) / DAY_MS);
        }
    }
    list.retain(|t| {
        t.size > 0 && (t.cat != "left" || t.id == "inst" || (t.size >= LEFTOVER_MIN && t.days.unwrap_or(0) >= 30 && t.exes == 0))
    });
    list.sort_by(|a, b| {
        let ci = |c: &str| CATS.iter().position(|x| *x == c).unwrap_or(9);
        ci(a.cat).cmp(&ci(b.cat)).then(b.size.cmp(&a.size))
    });

    ScanResult {
        scanned_at: now,
        drive: sys::drive(&r),
        uptime_ms: unsafe { windows::Win32::System::SystemInformation::GetTickCount64() },
        pending_reboot: sys::pending_reboot(),
        vdisks: sys::vdisks(&r),
        startup: sys::startup(&r),
        targets: list,
    }
}

/// The same age rule for scan and clean, so the estimate matches what gets deleted.
pub fn age_rule(t: &Target, min_age_days: u64, now: u64) -> Option<AgeRule> {
    match t.age {
        Age::None => None,
        Age::Setting => Some(AgeRule { min_age_ms: min_age_days * DAY_MS, now }),
        Age::Days(d) => Some(AgeRule { min_age_ms: d * DAY_MS, now }),
    }
}

pub fn measure(t: &Target, r: &Roots, min_age_days: u64, now: u64) -> paths::Walk {
    let age = age_rule(t, min_age_days, now);
    let mut total = paths::Walk::default();
    for p in &t.paths {
        let w = paths::walk(p, r, age, &mut |_, _| {});
        total.size += w.size;
        total.files += w.files;
        total.newest = total.newest.max(w.newest);
        total.denied |= w.denied;
        total.exes += w.exes;
    }
    total
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_versions() {
        assert_eq!(ext_version("ms-python.python-2024.2.1"), Some(("ms-python.python".into(), vec![2024, 2, 1])));
        assert_eq!(ext_version("ms-python.vscode-pylance-2024.1.1"), Some(("ms-python.vscode-pylance".into(), vec![2024, 1, 1])));
        assert_eq!(ext_version("rust-lang.rust-analyzer-0.3.2000-win32-x64"), Some(("rust-lang.rust-analyzer".into(), vec![0, 3, 2000])));
        assert_eq!(ext_version(".obsolete"), None);
    }

    #[test]
    fn all_static_targets_have_known_categories_and_tokens() {
        for df in DEFS {
            assert!(CATS.contains(&df.cat), "{}", df.id);
            for p in df.pats {
                assert!(p.starts_with('{'), "{} must start from a resolved root: {p}", df.id);
            }
        }
    }

    #[test]
    fn real_scan_is_sane() {
        let r = Roots::resolve();
        let res = run(3, &[], &|_| {});
        assert!(res.drive.total > 0);
        for t in &res.targets {
            assert!(t.size > 0, "{}", t.id);
            assert!(t.paths.iter().all(|p| !paths::is_protected(p, &r)), "{}", t.id);
            if t.risk == Medium || t.risk == High {
                assert!(t.consequence.is_some(), "{} needs a consequence", t.id);
            }
        }
    }

    /// Dev aid: `cargo test print_scan -- --ignored --nocapture` lists what this PC would show.
    #[test]
    #[ignore]
    fn print_scan() {
        let t0 = std::time::Instant::now();
        let res = run(3, &[], &|_| {});
        for t in &res.targets {
            println!("{:5} {:>9.1} MB {:7} {:?} {:<40} lock={:?} days={:?} {}", t.cat, t.size as f64 / 1048576.0, t.files, t.risk, t.name, t.lock, t.days, t.display);
        }
        println!("{} targets in {:?}; drive {:?}; reboot {}; vdisks {:?}", res.targets.len(), t0.elapsed(), res.drive, res.pending_reboot, res.vdisks);
        for s in &res.startup {
            println!("startup {:<40} {:6} enabled={} admin={}", s.name, s.impact, s.enabled, s.admin);
        }
    }
}
