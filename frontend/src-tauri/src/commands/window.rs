use crate::commands::files::add_opened_file;
use crate::utils::add_log;
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW_LABEL: &str = "main";

static NEXT_WINDOW_ID: AtomicU32 = AtomicU32::new(2);

pub const APP_TITLE: &str = "PDF Viewer";

fn next_window_label() -> String {
    format!("main-{}", NEXT_WINDOW_ID.fetch_add(1, Ordering::SeqCst))
}

// One place that builds every window, so they all share the same WebView2
// user-data folder (and therefore the same IndexedDB and settings).
// OS drag-drop is disabled so the web layer receives file drops itself.
fn build_window(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("/".into()))
        .title(APP_TITLE)
        .inner_size(1280.0, 800.0)
        // Below this width the web UI collapses to its mobile layout.
        .min_inner_size(1030.0, 600.0)
        .resizable(true)
        .disable_drag_drop_handler()
        .build()
        .map_err(|e| e.to_string())
}

pub fn build_main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    build_window(app, MAIN_WINDOW_LABEL)
}

// WebView2 refuses to create a webview off the main thread, but command
// handlers run on a worker thread, so window creation hops over first.
async fn run_on_main_thread<F, R>(app: &AppHandle, work: F) -> Result<R, String>
where
    F: FnOnce() -> R + Send + 'static,
    R: Send + 'static,
{
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(work());
    })
    .map_err(|e| e.to_string())?;
    rx.await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_in_new_window(app: AppHandle, paths: Vec<String>) -> Result<String, String> {
    let valid: Vec<String> = paths
        .into_iter()
        .filter(|p| std::path::Path::new(p).exists())
        .collect();

    let handle = app.clone();
    run_on_main_thread(&app, move || {
        let label = next_window_label();
        for path in &valid {
            add_opened_file(path.clone());
        }
        match build_window(&handle, &label) {
            Ok(window) => {
                add_log(format!("Opened window '{}' with {} file(s)", label, valid.len()));
                if !valid.is_empty() {
                    let _ = window.emit_to(label.as_str(), "files-changed", ());
                }
                Ok(label)
            }
            Err(err) => {
                add_log(format!("Failed to open window '{}': {}", label, err));
                Err(err)
            }
        }
    })
    .await?
}

// Best window to receive an opened file: the focused one, else main, else any.
pub fn target_window_label(app: &AppHandle) -> Option<String> {
    let windows = app.webview_windows();
    if let Some((label, _)) = windows
        .iter()
        .find(|(_, w)| w.is_focused().unwrap_or(false))
    {
        return Some(label.clone());
    }
    if windows.contains_key(MAIN_WINDOW_LABEL) {
        return Some(MAIN_WINDOW_LABEL.to_string());
    }
    windows.keys().next().cloned()
}

// Queue files and tell one window to pick them up.
pub fn forward_files_to_window(app: &AppHandle, label: &str, paths: Vec<String>) {
    for path in &paths {
        add_opened_file(path.clone());
    }
    if let Some(window) = app.get_webview_window(label) {
        let _ = app.emit_to(label, "files-changed", ());
        let _ = window.set_focus();
        let _ = window.unminimize();
    } else {
        let _ = app.emit("files-changed", ());
    }
}
