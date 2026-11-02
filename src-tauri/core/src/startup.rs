// Startup toggles through Explorer\StartupApproved, exactly like Task Manager (11.1, L2).
// Never deletes the Run entry, never recreates a key, journals the previous value before every write.

use crate::paths::Roots;
use crate::sys::{APPROVED, RUN, RUN32};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use windows_registry::{Key, Type, CURRENT_USER, LOCAL_MACHINE};

/// Startup app id "<source>|<name>" -> (hive, StartupApproved subkey, needs admin).
pub fn location(source: &str) -> Option<(&'static Key, &'static str, bool)> {
    match source {
        "hkcu" => Some((CURRENT_USER, "Run", false)),
        "folder" => Some((CURRENT_USER, "StartupFolder", false)),
        "hklm" => Some((LOCAL_MACHINE, "Run", true)),
        "hklm32" => Some((LOCAL_MACHINE, "Run32", true)),
        "commonfolder" => Some((LOCAL_MACHINE, "StartupFolder", true)),
        _ => None,
    }
}

pub fn split_id(id: &str) -> Option<(&str, &str)> {
    id.split_once('|').filter(|(s, n)| location(s).is_some() && !n.is_empty())
}

/// The entry must really exist where the source says (allow-list for the helper).
pub fn exists(source: &str, name: &str, r: &Roots) -> bool {
    match source {
        "hkcu" => CURRENT_USER.open(RUN).and_then(|k| k.get_value(name)).is_ok(),
        "hklm" => LOCAL_MACHINE.open(RUN).and_then(|k| k.get_value(name)).is_ok(),
        "hklm32" => LOCAL_MACHINE.open(RUN32).and_then(|k| k.get_value(name)).is_ok(),
        "folder" => !name.contains(['\\', '/']) && r.roaming.join(r"Microsoft\Windows\Start Menu\Programs\Startup").join(name).is_file(),
        "commonfolder" => !name.contains(['\\', '/']) && r.program_data.join(r"Microsoft\Windows\Start Menu\Programs\StartUp").join(name).is_file(),
        _ => false,
    }
}

/// 12 bytes: byte 0 = 0x02 enabled / 0x03 disabled, bytes 4..12 = FILETIME of the change.
pub fn encode(enabled: bool, filetime: u64) -> [u8; 12] {
    let mut v = [0u8; 12];
    v[0] = if enabled { 0x02 } else { 0x03 };
    v[4..].copy_from_slice(&filetime.to_le_bytes());
    v
}

pub fn valid_value(v: &[u8]) -> bool {
    v.len() == 12 && matches!(v[0], 0x02 | 0x03 | 0x06 | 0x07)
}

pub fn filetime_now() -> u64 {
    let ft = unsafe { windows::Win32::System::SystemInformation::GetSystemTimeAsFileTime() };
    ((ft.dwHighDateTime as u64) << 32) | ft.dwLowDateTime as u64
}

pub fn read(source: &str, name: &str) -> Option<Vec<u8>> {
    let (hive, sub, _) = location(source)?;
    hive.open(format!(r"{APPROVED}\{sub}")).and_then(|k| k.get_value(name)).ok().map(|v| v.to_vec())
}

/// Sets (or with None removes) the StartupApproved value. The key is created only if missing; an existing
/// key is opened as-is, so other values are never lost.
pub fn write(source: &str, name: &str, value: Option<&[u8]>) -> Result<(), String> {
    let (hive, sub, _) = location(source).ok_or("bad source")?;
    let key = hive.create(format!(r"{APPROVED}\{sub}")).map_err(|e| e.to_string())?;
    match value {
        Some(v) if valid_value(v) => key.set_bytes(name, Type::Bytes, v).map_err(|e| e.to_string()),
        Some(_) => Err("bad value".into()),
        None => match key.remove_value(name) {
            Ok(()) => Ok(()),
            Err(e) if e.code().0 as u32 == 0x8007_0002 => Ok(()), // already absent
            Err(e) => Err(e.to_string()),
        },
    }
}

// ---------- undo journal (%LOCALAPPDATA%\Sweepr\undo) ----------

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Entry {
    pub id: String,
    /// Value before the change; None = it did not exist.
    pub prev: Option<Vec<u8>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Session {
    pub at: u64,
    pub entries: Vec<Entry>,
}

pub fn undo_dir(r: &Roots) -> PathBuf {
    r.local.join(r"Sweepr\undo")
}

pub fn load(r: &Roots) -> Vec<Session> {
    std::fs::read(undo_dir(r).join("journal.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

pub fn save(r: &Roots, s: &[Session]) -> Result<(), String> {
    let dir = undo_dir(r);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("journal.json"), serde_json::to_vec_pretty(s).unwrap()).map_err(|e| e.to_string())
}

/// `reg export` of each touched StartupApproved key, kept next to the journal for manual restore.
pub fn export_keys(r: &Roots, sources: &[&str], stamp: u64) {
    use std::os::windows::process::CommandExt;
    let dir = undo_dir(r);
    let _ = std::fs::create_dir_all(&dir);
    for s in sources {
        let Some((hive, sub, _)) = location(s) else { continue };
        let root = if std::ptr::eq(hive, CURRENT_USER) { "HKCU" } else { "HKLM" };
        let _ = std::process::Command::new("reg")
            .args(["export", &format!(r"{root}\{APPROVED}\{sub}"), &dir.join(format!("{stamp}-{s}.reg")).to_string_lossy(), "/y"])
            .creation_flags(0x0800_0000)
            .status();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_approved_encoding() {
        let v = encode(false, 0x01D9_0000_1234_5678);
        assert_eq!(v[0], 0x03);
        assert_eq!(&v[1..4], &[0, 0, 0]);
        assert_eq!(u64::from_le_bytes(v[4..].try_into().unwrap()), 0x01D9_0000_1234_5678);
        assert_eq!(encode(true, 0)[0], 0x02);
        assert!(valid_value(&encode(true, 7)) && valid_value(&encode(false, 7)));
        assert!(!valid_value(&[0x02; 11]) && !valid_value(&[0x09; 12]));
        assert!(crate::sys::approved_enabled(&encode(true, 1)) && !crate::sys::approved_enabled(&encode(false, 1)));
    }

    #[test]
    fn ids_are_allow_listed() {
        assert_eq!(split_id("hkcu|Steam"), Some(("hkcu", "Steam")));
        assert_eq!(split_id("hklm32|X|Y"), Some(("hklm32", "X|Y")));
        assert_eq!(split_id("hkcr|X"), None);
        assert_eq!(split_id("hkcu|"), None);
    }

    /// Writing to an existing key keeps its other values (the New-Item -Force bug, L2).
    #[test]
    fn write_keeps_other_values() {
        let path = r"Software\SweeprTest\StartupApproved";
        let k = CURRENT_USER.create(path).unwrap();
        k.set_bytes("Other", Type::Bytes, &encode(false, 1)).unwrap();
        let again = CURRENT_USER.create(path).unwrap();
        again.set_bytes("Mine", Type::Bytes, &encode(true, 2)).unwrap();
        assert_eq!(again.get_value("Other").unwrap().to_vec(), encode(false, 1).to_vec());
        CURRENT_USER.remove_tree(r"Software\SweeprTest").unwrap();
    }
}
