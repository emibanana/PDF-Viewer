use tauri::{AppHandle, Manager};
use tauri_plugin_window_state::StateFlags;

pub mod commands;
mod utils;

use commands::{
    add_opened_file, build_main_window, clear_opened_files, file_disk_state,
    forward_files_to_window, get_desktop_os, get_opened_files, get_os_username, list_system_fonts,
    open_in_new_window, pop_opened_files, serve_system_font, target_window_label, write_file_atomic, MAIN_WINDOW_LABEL,
};
use utils::{add_log, get_app_logs};

// Existing file paths from command-line args (skips the executable name).
fn parse_launch_files(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| std::path::Path::new(arg).exists())
        .cloned()
        .collect()
}

// URLs the webview may show: the bundled app and the dev server only.
// Anything else (file://, https://...) must never replace the app UI.
fn is_app_url(url: &tauri::Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "blob" | "data" => true,
        "http" | "https" => matches!(
            url.host_str(),
            Some("tauri.localhost") | Some("localhost") | Some("127.0.0.1")
        ),
        _ => false,
    }
}

fn focus_window(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("sysfont", |_ctx, request| serve_system_font(request))
        .plugin(
            // Dropping a file outside a dropzone makes the webview navigate to it
            // and kills the UI. Block every off-app navigation at the Rust layer.
            tauri::plugin::Builder::<tauri::Wry, ()>::new("navigation-guard")
                .on_navigation(|_webview, url| {
                    let allowed = is_app_url(url);
                    if !allowed {
                        add_log(format!("Blocked webview navigation to: {}", url));
                    }
                    allowed
                })
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all())
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Runs in the running instance when a second launch is attempted
            // ("open with", double-click while the app is open).
            // Each document opens in a window of its own.
            let files = parse_launch_files(&args);
            if files.is_empty() {
                let label =
                    target_window_label(app).unwrap_or_else(|| MAIN_WINDOW_LABEL.to_string());
                focus_window(app, &label);
            } else {
                for file in files {
                    let handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(err) = open_in_new_window(handle, vec![file]).await {
                            add_log(format!("Could not open a window for a file: {}", err));
                        }
                    });
                }
            }
        }))
        .setup(|app| {
            add_log("PDF Viewer starting".to_string());
            if let Err(err) = build_main_window(app.handle()) {
                add_log(format!("Failed to build main window: {}", err));
                return Err(err.into());
            }
            // Files passed on the command line at first launch load once the
            // frontend mounts and pops the queue.
            let args: Vec<String> = std::env::args().collect();
            for path in parse_launch_files(&args) {
                add_opened_file(MAIN_WINDOW_LABEL, path);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_opened_files,
            pop_opened_files,
            clear_opened_files,
            file_disk_state,
            write_file_atomic,
            open_in_new_window,
            get_desktop_os,
            get_os_username,
            list_system_fonts,
            get_app_logs,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }),
                label,
                ..
            } = event
            {
                let file_paths: Vec<String> = paths
                    .iter()
                    .filter_map(|p| p.to_str().map(|s| s.to_string()))
                    .collect();
                if !file_paths.is_empty() {
                    forward_files_to_window(app_handle, &label, file_paths);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::is_app_url;

    fn allows(raw: &str) -> bool {
        is_app_url(&tauri::Url::parse(raw).expect("valid url"))
    }

    #[test]
    fn allows_bundled_app_and_dev_server() {
        assert!(allows("tauri://localhost/index.html"));
        assert!(allows("http://tauri.localhost/"));
        assert!(allows("http://localhost:5173/"));
        assert!(allows("blob:http://localhost:5173/abc"));
        assert!(allows("about:blank"));
    }

    #[test]
    fn blocks_dropped_files_and_remote_origins() {
        assert!(!allows("file:///C:/Users/me/report.pdf"));
        assert!(!allows("https://example.com/"));
        assert!(!allows("https://localhost.evil.test/"));
    }
}
