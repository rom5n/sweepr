// Step 5: settings file, weekly Task Scheduler entry, --auto-clean mode, tray.

use serde_json::Value;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use sweepr_core::clean::{self, Ctl, Opts};
use sweepr_core::paths::Roots;
use sweepr_core::scan::{self, Risk};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

const NO_WINDOW: u32 = 0x0800_0000;
const TASK: &str = "Sweepr Weekly Clean";

fn settings_path() -> PathBuf {
    Roots::resolve().roaming.join(r"Sweepr\settings.json")
}

#[tauri::command]
pub fn settings_load() -> Option<Value> {
    // Tolerate a UTF-8 BOM (Notepad / PowerShell edits).
    let b = std::fs::read(settings_path()).ok()?;
    serde_json::from_slice(b.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(&b)).ok()
}

#[tauri::command]
pub fn settings_save(settings: Value) -> Result<(), String> {
    let p = settings_path();
    std::fs::create_dir_all(p.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(p, serde_json::to_vec_pretty(&settings).unwrap()).map_err(|e| e.to_string())
}

pub const DAYS: [&str; 7] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/// "HH:MM", 24 h.
pub fn valid_time(t: &str) -> bool {
    let b = t.as_bytes();
    b.len() == 5 && b[2] == b':' && t[..2].parse::<u8>().is_ok_and(|h| h < 24) && t[3..].parse::<u8>().is_ok_and(|m| m < 60)
}

/// Auto-clean: a per-user scheduled task on the chosen weekday and time, running `Sweepr.exe --auto-clean`.
#[tauri::command]
pub fn set_weekly(on: bool, day: String, time: String) -> Result<(), String> {
    let mut c = std::process::Command::new("schtasks");
    if on {
        if !DAYS.contains(&day.as_str()) || !valid_time(&time) {
            return Err("bad schedule".into());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        c.args(["/Create", "/TN", TASK, "/TR", &format!("\"{}\" --auto-clean", exe.display()), "/SC", "WEEKLY", "/D", &day, "/ST", &time, "/F"]);
    } else {
        c.args(["/Delete", "/TN", TASK, "/F"]);
    }
    let ok = c.creation_flags(NO_WINDOW).output().map(|o| o.status.success()).unwrap_or(false);
    // Deleting a task that is not there is fine.
    if ok || !on {
        Ok(())
    } else {
        Err("schtasks failed".into())
    }
}

/// --auto-clean: SAFE, user-level, unlocked targets only; no window, one toast, then done.
pub fn auto_clean(app: &AppHandle) {
    let s = settings_load().unwrap_or(Value::Null);
    let age = s["cfg"]["age"].as_u64().unwrap_or(3);
    let lang = s["lang"].as_str().unwrap_or("en").to_string();
    let excludes: Vec<String> = s["cfg"]["excludes"].as_array().map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default();
    let picks: Vec<scan::Target> = scan::run(age, &excludes, &|_| {})
        .targets
        .into_iter()
        .filter(|t| t.risk == Risk::Safe && !t.admin && !t.bin && t.lock.is_none())
        .collect();
    let r = Roots::resolve().with_excludes(&excludes);
    let res = clean::run(picks, Opts { dry: false, recycle: true, min_age_days: age, elevated: false }, &r, &Ctl::default(), &|_| {});
    let freed = res.free_after.saturating_sub(res.free_before);
    let _ = app.notification().builder().title("Sweepr").body(toast_text(&lang, freed)).show();
}

fn toast_text(lang: &str, bytes: u64) -> String {
    let gb = bytes as f64 / (1u64 << 30) as f64;
    let (num, unit) = if gb >= 1.0 { (format!("{gb:.1}"), "GB") } else { (format!("{}", (gb * 1024.0).round() as u64), "MB") };
    let num = if matches!(lang, "ru" | "es") { num.replace('.', ",") } else { num };
    match lang {
        "ru" => format!("Еженедельная очистка · освобождено {num} {}", if unit == "GB" { "ГБ" } else { "МБ" }),
        "es" => format!("Limpieza semanal · {num} {unit} liberados"),
        "zh" => format!("每周清理 · 已释放 {num} {unit}"),
        _ => format!("Weekly clean · {num} {unit} freed"),
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Tray: Open, Quick clean (Safe only), Scan again, Settings, Quit. Actions go to the UI as a "tray" event.
pub fn tray(app: &AppHandle) -> tauri::Result<()> {
    let item = |id: &str, label: &str| MenuItem::with_id(app, id, label, true, None::<&str>);
    let menu = Menu::with_items(
        app,
        &[
            &item("open", "Open")?,
            &item("quick", "Quick clean (Safe only)")?,
            &item("scan", "Scan again")?,
            &item("settings", "Settings")?,
            &PredefinedMenuItem::separator(app)?,
            &item("quit", "Quit")?,
        ],
    )?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().expect("icon"))
        .tooltip("Sweepr")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "quit" => app.exit(0),
            "open" => show_main(app),
            id => {
                show_main(app);
                let _ = app.emit("tray", id);
            }
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn schedule_time_validation() {
        assert!(super::valid_time("21:00") && super::valid_time("00:05"));
        assert!(!super::valid_time("24:00") && !super::valid_time("9:00") && !super::valid_time("21:60"));
    }

    #[test]
    fn toast_text_follows_language() {
        assert_eq!(super::toast_text("en", 3 << 30), "Weekly clean · 3.0 GB freed");
        assert_eq!(super::toast_text("ru", 3 << 29), "Еженедельная очистка · освобождено 1,5 ГБ");
        assert_eq!(super::toast_text("zh", 5 << 20), "每周清理 · 已释放 5 MB");
    }
}
