//! Fonts installed in Windows, served to the PDF engine.
//!
//! PDFium in the webview cannot read the system font folder, and it ships no Helvetica, Times or
//! Courier, so a PDF's non-embedded fonts are drawn with fallback files the page supplies. This
//! serves the matching Windows fonts (Arial, Times New Roman, Courier New, Segoe UI, CJK) at
//! `sysfont://localhost/<name>` so the fallback is the font Edge would use. Only the names in
//! `SYSTEM_FONTS` are served, so the URL cannot reach any other file.

use std::path::PathBuf;
use tauri::http::{header, Request, Response, StatusCode};

/// (name the page asks for, file in the Windows fonts folder)
const SYSTEM_FONTS: &[(&str, &str)] = &[
    ("arial.ttf", "arial.ttf"),
    ("arial-bold.ttf", "arialbd.ttf"),
    ("arial-italic.ttf", "ariali.ttf"),
    ("arial-bold-italic.ttf", "arialbi.ttf"),
    ("times.ttf", "times.ttf"),
    ("times-bold.ttf", "timesbd.ttf"),
    ("times-italic.ttf", "timesi.ttf"),
    ("times-bold-italic.ttf", "timesbi.ttf"),
    ("cour.ttf", "cour.ttf"),
    ("cour-bold.ttf", "courbd.ttf"),
    ("cour-italic.ttf", "couri.ttf"),
    ("cour-bold-italic.ttf", "courbi.ttf"),
    ("verdana.ttf", "verdana.ttf"),
    ("verdana-bold.ttf", "verdanab.ttf"),
    ("verdana-italic.ttf", "verdanai.ttf"),
    ("verdana-bold-italic.ttf", "verdanaz.ttf"),
    ("segoeui.ttf", "segoeui.ttf"),
    ("thai.ttf", "LeelawUI.ttf"),
    ("japanese.ttc", "YuGothR.ttc"),
    ("korean.ttf", "malgun.ttf"),
    ("chinese-simplified.ttc", "msyh.ttc"),
    ("chinese-traditional.ttc", "msjh.ttc"),
];

fn fonts_dir() -> PathBuf {
    let windows = std::env::var_os("WINDIR").unwrap_or_else(|| r"C:\Windows".into());
    PathBuf::from(windows).join("Fonts")
}

fn path_for(name: &str) -> Option<PathBuf> {
    let (_, file) = SYSTEM_FONTS.iter().find(|(served, _)| *served == name)?;
    let path = fonts_dir().join(file);
    path.is_file().then_some(path)
}

/// The served names whose font is installed on this machine.
#[tauri::command]
pub fn list_system_fonts() -> Vec<String> {
    SYSTEM_FONTS
        .iter()
        .filter(|(served, _)| path_for(served).is_some())
        .map(|(served, _)| (*served).to_string())
        .collect()
}

/// Handler for the `sysfont` URI scheme.
pub fn serve_system_font(request: Request<Vec<u8>>) -> Response<Vec<u8>> {
    let name = request.uri().path().trim_start_matches('/');
    let found = path_for(name).and_then(|path| std::fs::read(path).ok());
    let (status, body) = match found {
        Some(bytes) => (StatusCode::OK, bytes),
        None => (StatusCode::NOT_FOUND, Vec::new()),
    };
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "font/ttf")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "max-age=86400")
        .body(body)
        .unwrap_or_else(|_| Response::new(Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_listed_names_resolve() {
        assert!(path_for(r"..\..\secret.txt").is_none());
        assert!(path_for("../arial.ttf").is_none());
        assert!(path_for("unknown.ttf").is_none());
    }

    #[test]
    fn unknown_font_is_a_404_with_cors() {
        let request = Request::builder()
            .uri("sysfont://localhost/not-a-font.ttf")
            .body(Vec::new())
            .unwrap();
        let response = serve_system_font(request);
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN).unwrap(),
            "*"
        );
    }
}
