pub mod files;
pub mod fonts;
pub mod platform;
pub mod window;

pub use files::{
    add_opened_file, clear_opened_files, file_disk_state, get_opened_files, pop_opened_files,
    write_file_atomic,
};
pub use fonts::{list_system_fonts, serve_system_font};
pub use platform::{get_desktop_os, get_os_username};
pub use window::{
    build_main_window, forward_files_to_window, open_in_new_window, target_window_label,
    MAIN_WINDOW_LABEL,
};
