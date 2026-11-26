//! Disk paths of files dropped on the window.
//!
//! OS drag-drop stays off so in-page drag and drop (page reordering) keeps
//! working, which means a dropped file reaches the page as a `File` with no
//! path. WebView2 can hand the path over when the page posts the dropped `File`
//! objects with `postMessageWithAdditionalObjects`; this reads them back and
//! emits `dropped-paths` for the page that asked.

use crate::utils::add_log;
use serde::Serialize;
use tauri::{Emitter, WebviewWindow};
use webview2_com::take_pwstr;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
};
use webview2_com::WebMessageReceivedEventHandler;
use windows_core::{Interface, PWSTR};

/// Messages from the page that carry dropped files start with this, followed by a request id.
const DROP_MESSAGE_PREFIX: &str = "pdfv-drop:";

#[derive(Clone, Serialize)]
struct DroppedPaths {
    id: String,
    paths: Vec<String>,
}

pub fn install(window: &WebviewWindow) {
    let emitter = window.clone();
    let result = window.with_webview(move |webview| {
        // SAFETY: runs on the webview's UI thread with a live controller; the
        // handler only reads the event arguments it is given.
        let installed = unsafe {
            webview
                .controller()
                .CoreWebView2()
                .and_then(|core| {
                    let mut token = 0;
                    core.add_WebMessageReceived(
                        &WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
                            if let Some(args) = args {
                                forward_dropped_paths(&emitter, &args);
                            }
                            Ok(())
                        })),
                        &mut token,
                    )
                })
        };
        if let Err(err) = installed {
            add_log(format!("Dropped-file paths unavailable: {}", err));
        }
    });
    if let Err(err) = result {
        add_log(format!("Dropped-file paths unavailable: {}", err));
    }
}

unsafe fn forward_dropped_paths(
    window: &WebviewWindow,
    args: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2WebMessageReceivedEventArgs,
) {
    let mut message = PWSTR::null();
    if args.TryGetWebMessageAsString(&mut message).is_err() {
        return;
    }
    let message = take_pwstr(message);
    let Some(id) = message.strip_prefix(DROP_MESSAGE_PREFIX) else {
        return;
    };
    let Ok(args2) = args.cast::<ICoreWebView2WebMessageReceivedEventArgs2>() else {
        return;
    };
    let Ok(objects) = args2.AdditionalObjects() else {
        return;
    };
    let mut count = 0;
    if objects.Count(&mut count).is_err() {
        return;
    }
    let mut paths = Vec::new();
    for index in 0..count {
        let path = objects
            .GetValueAtIndex(index)
            .and_then(|object| object.cast::<ICoreWebView2File>())
            .and_then(|file| {
                let mut path = PWSTR::null();
                file.Path(&mut path).map(|_| take_pwstr(path))
            });
        // An empty entry keeps the others aligned with the files the page sent.
        paths.push(path.unwrap_or_default());
    }
    let _ = window.emit(
        "dropped-paths",
        DroppedPaths {
            id: id.to_string(),
            paths,
        },
    );
}
