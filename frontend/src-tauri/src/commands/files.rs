use crate::utils::add_log;
use serde::Serialize;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::collections::BTreeMap;
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request};

// Paths handed to the app by the OS ("open with", command line, second launch)
// that the target window has not picked up yet, keyed by window label so each
// window only ever opens the files meant for it.
static OPENED_FILES: Mutex<BTreeMap<String, Vec<String>>> = Mutex::new(BTreeMap::new());

pub fn add_opened_file(label: &str, file_path: String) {
    if let Ok(mut queues) = OPENED_FILES.lock() {
        add_log(format!("File queued for window '{}': {}", label, file_path));
        queues.entry(label.to_string()).or_default().push(file_path);
    }
}

#[tauri::command]
pub fn get_opened_files(window: tauri::WebviewWindow) -> Vec<String> {
    OPENED_FILES
        .lock()
        .map(|queues| queues.get(window.label()).cloned().unwrap_or_default())
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_opened_files(window: tauri::WebviewWindow) {
    if let Ok(mut queues) = OPENED_FILES.lock() {
        queues.remove(window.label());
    }
}

// Atomically take and clear this window's queue.
#[tauri::command]
pub fn pop_opened_files(window: tauri::WebviewWindow) -> Vec<String> {
    OPENED_FILES
        .lock()
        .map(|mut queues| queues.remove(window.label()).unwrap_or_default())
        .unwrap_or_default()
}

#[derive(Serialize, Debug, PartialEq, Eq)]
#[serde(tag = "availability", rename_all = "camelCase")]
pub enum DiskFileState {
    #[serde(rename_all = "camelCase")]
    Present {
        size: u64,
        // Epoch ms; 0 when the platform gives no modified time.
        modified_ms: u64,
    },
    Gone,
    Unavailable,
}

#[tauri::command]
pub fn file_disk_state(path: String) -> DiskFileState {
    match std::fs::metadata(&path) {
        Ok(meta) => DiskFileState::Present {
            size: meta.len(),
            modified_ms: meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        },
        Err(e) if e.kind() == ErrorKind::NotFound => DiskFileState::Gone,
        Err(_) => DiskFileState::Unavailable,
    }
}

// Overwrite `target` in place: write a temp file in the same folder, flush it
// to disk, then replace the target. A crash or a sync client (OneDrive,
// SharePoint) therefore never sees a half-written PDF.
fn replace_file(target: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let dir = target.parent().unwrap_or_else(|| Path::new("."));
    let name = target
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    let tmp: PathBuf = dir.join(format!(".{}.{}.tmp", name, std::process::id()));

    let result = (|| {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        drop(file);
        std::fs::rename(&tmp, target)
    })();

    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

// Raw-binary command: the body is the file bytes, the target path travels
// URL-encoded in the `x-path` header, so large PDFs never go through JSON.
#[tauri::command]
pub fn write_file_atomic(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("write_file_atomic expects a raw binary body".to_string());
    };
    let encoded = request
        .headers()
        .get("x-path")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "missing x-path header".to_string())?;
    let path = urlencoding::decode(encoded).map_err(|e| e.to_string())?;

    replace_file(Path::new(path.as_ref()), bytes).map_err(|e| {
        add_log(format!("Save failed for {}: {}", path, e));
        e.to_string()
    })?;
    add_log(format!("Saved {} ({} bytes)", path, bytes.len()));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replace_file_overwrites_in_place_and_leaves_no_temp_file() {
        let dir = std::env::temp_dir().join(format!("pdf-viewer-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("doc.pdf");
        std::fs::write(&target, b"old").unwrap();

        replace_file(&target, b"new contents").unwrap();

        assert_eq!(std::fs::read(&target).unwrap(), b"new contents");
        let leftovers = std::fs::read_dir(&dir).unwrap().count();
        assert_eq!(leftovers, 1);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn disk_state_reports_gone_for_missing_file() {
        assert_eq!(
            file_disk_state("C:/definitely/not/here.pdf".to_string()),
            DiskFileState::Gone
        );
    }
}
