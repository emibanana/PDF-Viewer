pub mod files;
pub mod platform;
pub mod window;

pub use files::{
    add_opened_file, clear_opened_files, file_disk_state, get_opened_files, pop_opened_files,
    write_file_atomic,
};
pub use platform::get_desktop_os;
pub use window::{
    build_main_window, forward_files_to_window, open_in_new_window, target_window_label,
    MAIN_WINDOW_LABEL,
};
