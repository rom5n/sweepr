// Runs one admin batch in sweepr-helper.exe: one UAC prompt, a named pipe, JSON lines.
// The app is the pipe server (the elevated client can always connect to it); the helper exits after the batch.

use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::io::FromRawHandle;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use sweepr_core::proto::{Event, Request};
use windows::core::{w, HRESULT, HSTRING, PCWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::Storage::FileSystem::PIPE_ACCESS_DUPLEX;
use windows::Win32::System::Pipes::*;
use windows::Win32::System::Threading::{WaitForSingleObject, INFINITE};
use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW};
use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;

/// Errors are skip reasons shown in the UI: adminDeclined, helperMissing, helperFailed.
pub fn run_batch(mut req: Request, on: &mut dyn FnMut(Event)) -> Result<(), &'static str> {
    let helper = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join("sweepr-helper.exe")))
        .filter(|p| p.is_file())
        .ok_or("helperMissing")?;
    let nonce = format!("{}-{}", std::process::id(), sweepr_core::paths::now_ms());
    let pipe = format!(r"\\.\pipe\sweepr-{nonce}");
    req.token = {
        use std::hash::{BuildHasher, Hasher};
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write(nonce.as_bytes());
        format!("{:016x}", h.finish())
    };
    unsafe {
        let h = CreateNamedPipeW(
            &HSTRING::from(pipe.as_str()),
            PIPE_ACCESS_DUPLEX,
            PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS,
            1,
            65536,
            65536,
            0,
            None,
        );
        if h.is_invalid() {
            return Err("helperFailed");
        }
        let file = HSTRING::from(helper.as_os_str());
        let params = HSTRING::from(format!("--pipe {pipe} --token {}", req.token));
        let mut sei = SHELLEXECUTEINFOW {
            cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
            fMask: SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC,
            lpVerb: w!("runas"),
            lpFile: PCWSTR(file.as_ptr()),
            lpParameters: PCWSTR(params.as_ptr()),
            nShow: SW_HIDE.0,
            ..Default::default()
        };
        if let Err(e) = ShellExecuteExW(&mut sei) {
            let _ = CloseHandle(h);
            return Err(if e.code() == HRESULT::from_win32(1223) { "adminDeclined" } else { "helperFailed" });
        }
        // If the helper dies before connecting, connect a dummy client so ConnectNamedPipe returns.
        let connected = Arc::new(AtomicBool::new(false));
        let (flag, proc, name) = (connected.clone(), sei.hProcess.0 as usize, pipe.clone());
        std::thread::spawn(move || {
            WaitForSingleObject(HANDLE(proc as _), INFINITE);
            if !flag.load(Ordering::SeqCst) {
                let _ = std::fs::OpenOptions::new().read(true).write(true).open(&name);
            }
        });
        let _ = ConnectNamedPipe(h, None); // ERROR_PIPE_CONNECTED is fine too
        connected.store(true, Ordering::SeqCst);
        let mut conn = File::from_raw_handle(h.0);
        let sent = writeln!(conn, "{}", serde_json::to_string(&req).unwrap()).is_ok();
        let mut done = false;
        if sent {
            for line in BufReader::new(conn).lines() {
                let Ok(line) = line else { break };
                match serde_json::from_str::<Event>(&line) {
                    Ok(Event::Done) => {
                        done = true;
                        break;
                    }
                    Ok(e) => on(e),
                    Err(_) => break,
                }
            }
        }
        let _ = CloseHandle(sei.hProcess);
        if done {
            Ok(())
        } else {
            Err("helperFailed")
        }
    }
}
