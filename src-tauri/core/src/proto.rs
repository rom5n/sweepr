// App <-> elevated helper protocol: one JSON request line, then JSON event lines, over a named pipe.

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    /// Must match the token the app passed on the helper's command line.
    pub token: String,
    pub restore_point: bool,
    pub min_age_days: u64,
    /// Admin target ids. The helper builds these targets itself; no paths cross the pipe.
    pub targets: Vec<String>,
    pub tasks: Vec<Task>,
    pub registry: Vec<RegWrite>,
    /// Excluded folders from Settings; the helper protects them too.
    #[serde(default)]
    pub excludes: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Task {
    /// wsl --shutdown, then diskpart "compact vdisk" on an ext4.vhdx / docker_data.vhdx.
    WslCompact { id: String, path: String },
}

/// A StartupApproved value in HKLM. `value: None` deletes the value (undo of a first-time write).
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegWrite {
    pub id: String,
    pub source: String,
    pub name: String,
    pub value: Option<Vec<u8>>,
}

/// Helper -> app event lines.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Event {
    /// A clean::Item as JSON (forwarded to the UI unchanged).
    Item(serde_json::Value),
    Reg { id: String, ok: bool },
    Done,
}
