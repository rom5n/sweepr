// Path resolution, wildcard expansion, the protection list and the read-only tree walk.

use std::fs;
use std::os::windows::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
const FILE_ATTRIBUTE_OFFLINE: u32 = 0x1000;
const FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS: u32 = 0x40_0000;
pub const DAY_MS: u64 = 86_400_000;

/// Base folders. Resolved once per scan; never hardcoded (user name, drive letter, redirected folders).
#[derive(Clone, Debug)]
pub struct Roots {
    pub local: PathBuf,
    pub roaming: PathBuf,
    pub profile: PathBuf,
    pub program_data: PathBuf,
    pub windows: PathBuf,
    pub temp: PathBuf,
    pub downloads: PathBuf,
    pub system_drive: PathBuf,
    /// OneDrive / Dropbox roots. Nothing inside is deleted without a cloud-delete warning.
    pub cloud: Vec<PathBuf>,
    /// User-chosen folders (Settings > Excluded folders): never scanned, reviewed or cleaned.
    pub excludes: Vec<PathBuf>,
}

impl Roots {
    pub fn resolve() -> Roots {
        use windows::Win32::UI::Shell::*;
        let windows = known(&FOLDERID_Windows).unwrap_or_else(|| env_path("SystemRoot"));
        let profile = known(&FOLDERID_Profile).unwrap_or_else(|| env_path("USERPROFILE"));
        let mut cloud: Vec<PathBuf> = ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]
            .iter()
            .filter_map(|v| std::env::var_os(v).map(PathBuf::from))
            .collect();
        cloud.push(profile.join("Dropbox"));
        cloud.push(profile.join("Google Drive"));
        Roots {
            local: known(&FOLDERID_LocalAppData).unwrap_or_else(|| env_path("LOCALAPPDATA")),
            roaming: known(&FOLDERID_RoamingAppData).unwrap_or_else(|| env_path("APPDATA")),
            program_data: known(&FOLDERID_ProgramData).unwrap_or_else(|| env_path("ProgramData")),
            downloads: known(&FOLDERID_Downloads).unwrap_or_else(|| profile.join("Downloads")),
            temp: std::env::temp_dir(),
            system_drive: windows.ancestors().last().map(Path::to_path_buf).unwrap_or_default(),
            windows,
            profile,
            cloud,
            excludes: vec![],
        }
    }

    /// Replaces {LOCAL} {ROAMING} {PROFILE} {PROGRAMDATA} {WINDIR} {TEMP} {DOWNLOADS} {SYSDRIVE}.
    pub fn fill(&self, pattern: &str) -> String {
        let s = |p: &PathBuf| p.to_string_lossy().trim_end_matches('\\').to_string();
        pattern
            .replace("{LOCAL}", &s(&self.local))
            .replace("{ROAMING}", &s(&self.roaming))
            .replace("{PROFILE}", &s(&self.profile))
            .replace("{PROGRAMDATA}", &s(&self.program_data))
            .replace("{WINDIR}", &s(&self.windows))
            .replace("{TEMP}", &s(&self.temp))
            .replace("{DOWNLOADS}", &s(&self.downloads))
            .replace("{SYSDRIVE}", &s(&self.system_drive))
    }

    pub fn with_excludes(mut self, ex: &[String]) -> Roots {
        self.excludes = ex.iter().filter(|e| !e.trim().is_empty()).map(PathBuf::from).collect();
        self
    }

    pub fn in_cloud(&self, p: &Path) -> bool {
        let p = lower(p);
        self.cloud.iter().any(|c| !c.as_os_str().is_empty() && p.starts_with(&lower(c)))
    }
}

fn env_path(name: &str) -> PathBuf {
    std::env::var_os(name).map(PathBuf::from).unwrap_or_default()
}

fn known(id: &windows::core::GUID) -> Option<PathBuf> {
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::UI::Shell::{SHGetKnownFolderPath, KF_FLAG_DEFAULT};
    unsafe {
        let p = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
        let s = p.to_string().ok();
        CoTaskMemFree(Some(p.0 as _));
        s.filter(|s| !s.is_empty()).map(PathBuf::from)
    }
}

pub fn lower(p: &Path) -> String {
    p.to_string_lossy().to_lowercase().replace('/', "\\")
}

/// Case-insensitive `*` / `?` match of one path segment.
pub fn wildcard(pat: &str, name: &str) -> bool {
    let (p, n): (Vec<char>, Vec<char>) = (pat.to_lowercase().chars().collect(), name.to_lowercase().chars().collect());
    let (mut pi, mut ni, mut star, mut mark) = (0, 0, usize::MAX, 0);
    while ni < n.len() {
        if pi < p.len() && (p[pi] == '?' || p[pi] == n[ni]) {
            pi += 1;
            ni += 1;
        } else if pi < p.len() && p[pi] == '*' {
            star = pi;
            mark = ni;
            pi += 1;
        } else if star != usize::MAX {
            pi = star + 1;
            mark += 1;
            ni = mark;
        } else {
            return false;
        }
    }
    p[pi..].iter().all(|c| *c == '*')
}

/// Expands a filled pattern with wildcard segments into existing paths. Never follows reparse points.
pub fn expand(pattern: &str) -> Vec<PathBuf> {
    let mut parts = pattern.split('\\').filter(|s| !s.is_empty());
    let Some(first) = parts.next() else { return vec![] };
    let mut cur = vec![PathBuf::from(format!("{first}\\"))];
    for seg in parts {
        let mut next = Vec::new();
        for base in &cur {
            if seg.contains(['*', '?']) {
                let Ok(rd) = fs::read_dir(base) else { continue };
                for e in rd.flatten() {
                    let name = e.file_name().to_string_lossy().to_string();
                    let reparse = e.metadata().map(|m| m.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0).unwrap_or(true);
                    if !reparse && wildcard(seg, &name) {
                        next.push(e.path());
                    }
                }
            } else {
                let p = base.join(seg);
                if fs::symlink_metadata(&p).map(|m| m.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT == 0).unwrap_or(false) {
                    next.push(p);
                }
            }
        }
        cur = next;
    }
    cur
}

/// Part 13 protection list. Anything matching is never counted, listed or deleted.
pub fn is_protected(p: &Path, r: &Roots) -> bool {
    let s = lower(p);
    if r.excludes.iter().map(|e| lower(e).trim_end_matches('\\').to_string()).any(|e| s == e || s.starts_with(&format!("{e}\\"))) {
        return true;
    }
    let win = lower(&r.windows);
    let pd = lower(&r.program_data);
    let prefixes = [
        format!("{win}\\installer"),
        format!("{win}\\winsxs"),
        format!("{win}\\prefetch"),
        format!("{win}\\system32"),
        format!("{win}\\syswow64"),
        format!("{pd}\\package cache"),
    ];
    if prefixes.iter().any(|x| s == *x || s.starts_with(&format!("{x}\\"))) {
        return true;
    }
    let segs: Vec<&str> = s.split('\\').collect();
    let has = |x: &str| segs.contains(&x);
    let file = segs.last().copied().unwrap_or("");
    // Browser credentials, bookmarks, extensions; app logins and offline data.
    if ["login data", "login data for account", "bookmarks", "web data", "logins.json", "key4.db", "places.sqlite", "preferences"].contains(&file)
        || has("local storage") || has("indexeddb") || has("session storage")
        || (has("extensions") && (has("user data") || has("profiles")))
    {
        return true;
    }
    // Store app user data; Store Python's user site-packages.
    if has("packages") && (has("localstate") || has("settings") || has("roamingstate") || has("local-packages")) {
        return true;
    }
    // Game saves.
    if has("saved games") || (has("my games") && has("saves")) {
        return true;
    }
    // Databases, Docker volumes, VM disks, AI models.
    if has(".ollama") || has(".lmstudio") || has("lm studio") || has("huggingface") || has("volumes") && has("docker")
        || ["vhdx", "vhd", "vmdk", "vdi", "avhdx"].iter().any(|e| file.ends_with(&format!(".{e}")))
        || (has("mongodb") || has("postgresql") || has("mysql") || has("redis")) && (has("data") || has("db"))
    {
        return true;
    }
    false
}

#[derive(Default, Clone, Copy, Debug)]
pub struct Walk {
    pub size: u64,
    pub files: u64,
    /// Newest modification time in the tree, ms since epoch.
    pub newest: u64,
    pub denied: bool,
    /// Executables seen; a folder with programs in it is never a "leftover".
    pub exes: u64,
}

/// Age rule for Temp/log targets (L1): only files older than `min_age_ms`, and skip any folder changed in the last 24 h.
#[derive(Clone, Copy)]
pub struct AgeRule {
    pub min_age_ms: u64,
    pub now: u64,
}

pub fn ms(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

pub fn now_ms() -> u64 {
    ms(SystemTime::now())
}

fn skip_attrs(a: u32) -> bool {
    a & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_OFFLINE | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS) != 0
}

/// Read-only size walk. Calls `visit` for every counted file (the cleaner reuses this to pick files).
pub fn walk(root: &Path, r: &Roots, age: Option<AgeRule>, visit: &mut dyn FnMut(&Path, u64)) -> Walk {
    let mut w = Walk::default();
    let Ok(meta) = fs::symlink_metadata(root) else { return w };
    if skip_attrs(meta.file_attributes()) || is_protected(root, r) {
        return w;
    }
    if meta.is_file() {
        count(root, &meta, age, &mut w, visit);
        return w;
    }
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let rd = match fs::read_dir(&dir) {
            Ok(rd) => rd,
            Err(e) => {
                if e.kind() == std::io::ErrorKind::PermissionDenied {
                    w.denied = true;
                }
                continue;
            }
        };
        for e in rd.flatten() {
            let Ok(m) = e.metadata() else { continue };
            if skip_attrs(m.file_attributes()) {
                continue;
            }
            let p = e.path();
            if is_protected(&p, r) {
                continue;
            }
            if m.is_dir() {
                if let Some(a) = age {
                    let changed = m.modified().map(ms).unwrap_or(a.now);
                    if a.now.saturating_sub(changed) < DAY_MS {
                        continue;
                    }
                }
                stack.push(p);
            } else {
                count(&p, &m, age, &mut w, visit);
            }
        }
    }
    w
}

fn count(p: &Path, m: &fs::Metadata, age: Option<AgeRule>, w: &mut Walk, visit: &mut dyn FnMut(&Path, u64)) {
    let modified = m.modified().map(ms).unwrap_or(0);
    if let Some(a) = age {
        if a.now.saturating_sub(modified) < a.min_age_ms {
            return;
        }
    }
    w.size += m.len();
    w.files += 1;
    w.newest = w.newest.max(modified);
    if p.extension().is_some_and(|e| e.eq_ignore_ascii_case("exe")) {
        w.exes += 1;
    }
    visit(p, m.len());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roots() -> Roots {
        Roots {
            local: r"C:\Users\u\AppData\Local".into(),
            roaming: r"C:\Users\u\AppData\Roaming".into(),
            profile: r"C:\Users\u".into(),
            program_data: r"C:\ProgramData".into(),
            windows: r"C:\Windows".into(),
            temp: r"C:\Users\u\AppData\Local\Temp".into(),
            downloads: r"C:\Users\u\OneDrive\Downloads".into(),
            system_drive: r"C:\".into(),
            cloud: vec![r"C:\Users\u\OneDrive".into()],
            excludes: vec![],
        }
    }

    #[test]
    fn fills_tokens() {
        let r = roots();
        assert_eq!(r.fill(r"{LOCAL}\NVIDIA\DXCache"), r"C:\Users\u\AppData\Local\NVIDIA\DXCache");
        assert_eq!(r.fill(r"{SYSDRIVE}\NVIDIA"), r"C:\NVIDIA");
        assert_eq!(r.fill(r"{WINDIR}\Temp"), r"C:\Windows\Temp");
    }

    #[test]
    fn real_known_folders_resolve() {
        let r = Roots::resolve();
        for p in [&r.local, &r.roaming, &r.profile, &r.program_data, &r.windows] {
            assert!(p.is_dir(), "{p:?}");
        }
        assert!(r.system_drive.to_string_lossy().ends_with(":\\"));
    }

    #[test]
    fn user_excludes_are_protected() {
        let r = roots().with_excludes(&[r"D:\Work\Keep\".into(), "".into()]);
        assert!(is_protected(Path::new(r"d:\work\keep"), &r));
        assert!(is_protected(Path::new(r"D:\Work\Keep\cache\a.bin"), &r));
        assert!(!is_protected(Path::new(r"D:\Work\Keeper\a.bin"), &r));
        assert_eq!(r.excludes.len(), 1);
    }

    #[test]
    fn wildcard_segments() {
        assert!(wildcard("thumbcache_*.db", "thumbcache_256.db"));
        assert!(wildcard("Profile*", "profile 1"));
        assert!(wildcard("webcache*", "webcache_4430"));
        assert!(!wildcard("thumbcache_*.db", "iconcache_16.db"));
        assert!(wildcard("*", "anything"));
    }

    #[test]
    fn cloud_detection() {
        let r = roots();
        assert!(r.in_cloud(Path::new(r"C:\Users\u\OneDrive\Downloads\a.exe")));
        assert!(!r.in_cloud(Path::new(r"C:\Users\u\Downloads\a.exe")));
    }

    #[test]
    fn protection_list() {
        let r = roots();
        let yes = [
            r"C:\Windows\Installer\x.msi",
            r"C:\WINDOWS\WinSxS",
            r"C:\Windows\Prefetch\A.pf",
            r"C:\Windows\System32\DriverStore\FileRepository",
            r"C:\ProgramData\Package Cache\{id}\vc.exe",
            r"C:\Users\u\AppData\Local\Google\Chrome\User Data\Default\Login Data",
            r"C:\Users\u\AppData\Local\Google\Chrome\User Data\Default\Bookmarks",
            r"C:\Users\u\AppData\Local\Google\Chrome\User Data\Default\Extensions\abc",
            r"C:\Users\u\AppData\Roaming\discord\Local Storage\leveldb",
            r"C:\Users\u\AppData\Roaming\discord\IndexedDB",
            r"C:\Users\u\AppData\Roaming\Mozilla\Firefox\Profiles\x.default\logins.json",
            r"C:\Users\u\AppData\Local\Packages\App_1\LocalState\db",
            r"C:\Users\u\AppData\Local\Packages\Python_1\LocalCache\local-packages\x",
            r"C:\Users\u\Saved Games\Game\save1",
            r"C:\Users\u\Documents\My Games\Skyrim\Saves\a.ess",
            r"C:\Users\u\.ollama\models\blob",
            r"C:\Users\u\.cache\huggingface\hub",
            r"C:\Users\u\AppData\Local\Docker\wsl\disk\docker_data.vhdx",
        ];
        for p in yes {
            assert!(is_protected(Path::new(p), &r), "should protect {p}");
        }
        let no = [
            r"C:\Windows\Temp\x.tmp",
            r"C:\Windows\SoftwareDistribution\Download\a",
            r"C:\Users\u\AppData\Local\Google\Chrome\User Data\Default\Cache\Cache_Data\f_0001",
            r"C:\Users\u\AppData\Roaming\discord\Cache\Cache_Data\data_1",
            r"C:\Users\u\.vscode\extensions\ms-python.python-2024.1.0",
            r"C:\Users\u\AppData\Local\Packages\App_1\LocalCache\x",
            r"C:\Users\u\AppData\Local\NVIDIA\DXCache\a.bin",
        ];
        for p in no {
            assert!(!is_protected(Path::new(p), &r), "should allow {p}");
        }
    }

    #[test]
    fn age_rule_skips_new_files_and_recent_dirs() {
        let dir = std::env::temp_dir().join(format!("sweepr-age-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join("fresh")).unwrap();
        fs::write(dir.join("new.tmp"), b"12345").unwrap();
        fs::write(dir.join("fresh").join("x.tmp"), b"1").unwrap();
        let r = roots();
        let all = walk(&dir, &r, None, &mut |_, _| {});
        assert_eq!((all.files, all.size), (2, 6));
        // Everything was just written: a 1-day age rule counts nothing.
        let aged = walk(&dir, &r, Some(AgeRule { min_age_ms: DAY_MS, now: now_ms() }), &mut |_, _| {});
        assert_eq!(aged.files, 0);
        // Three days later, files and the folder are both old enough.
        let later = walk(&dir, &r, Some(AgeRule { min_age_ms: DAY_MS, now: now_ms() + 3 * DAY_MS }), &mut |_, _| {});
        assert_eq!(later.files, 2);
        fs::remove_dir_all(&dir).unwrap();
    }
}
