use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DesktopOS {
    MacOS,
    Windows,
    Linux,
    Unknown,
}

#[tauri::command]
pub fn get_desktop_os() -> DesktopOS {
    match std::env::consts::OS {
        "macos" => DesktopOS::MacOS,
        "windows" => DesktopOS::Windows,
        "linux" => DesktopOS::Linux,
        _ => DesktopOS::Unknown,
    }
}

/// The signed-in Windows user's name, used as the author of new annotations.
#[tauri::command]
pub fn get_os_username() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_default()
}
