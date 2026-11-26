use std::collections::VecDeque;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

// Last few log lines, kept in memory so the frontend can show them for debugging.
static LOGS: Mutex<VecDeque<String>> = Mutex::new(VecDeque::new());
const MAX_LOG_LINES: usize = 200;

// %APPDATA%\PDF Viewer\logs on Windows, a temp folder elsewhere.
fn log_directory() -> PathBuf {
    let base = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("PDF Viewer").join("logs")
}

pub fn add_log(message: String) {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let entry = format!("{}: {}", timestamp, message.trim_end_matches('\n'));

    if let Ok(mut logs) = LOGS.lock() {
        logs.push_back(entry.clone());
        if logs.len() > MAX_LOG_LINES {
            logs.pop_front();
        }
    }

    let dir = log_directory();
    if std::fs::create_dir_all(&dir).is_ok() {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("pdf-viewer.log"))
        {
            let _ = writeln!(file, "{}", entry);
        }
    }
    println!("{}", entry);
}

#[tauri::command]
pub fn get_app_logs() -> Vec<String> {
    LOGS.lock()
        .map(|logs| logs.iter().cloned().collect())
        .unwrap_or_default()
}
