import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@editor/services/tauriFiles";

/** Bundled fallback file -> the name the Rust host serves for the matching Windows font. */
const WINDOWS_EQUIVALENT: Record<string, string> = {
  "LiberationSans-Regular.ttf": "arial.ttf",
  "LiberationSans-Bold.ttf": "arial-bold.ttf",
  "LiberationSans-Italic.ttf": "arial-italic.ttf",
  "LiberationSans-BoldItalic.ttf": "arial-bold-italic.ttf",
  "LiberationSerif-Regular.ttf": "times.ttf",
  "LiberationSerif-Bold.ttf": "times-bold.ttf",
  "LiberationSerif-Italic.ttf": "times-italic.ttf",
  "LiberationSerif-BoldItalic.ttf": "times-bold-italic.ttf",
  "LiberationMono-Regular.ttf": "cour.ttf",
  "LiberationMono-Bold.ttf": "cour-bold.ttf",
  "LiberationMono-Italic.ttf": "cour-italic.ttf",
  "LiberationMono-BoldItalic.ttf": "cour-bold-italic.ttf",
  "DejaVuSans.ttf": "verdana.ttf",
  "DejaVuSans-Bold.ttf": "verdana-bold.ttf",
  "DejaVuSans-Oblique.ttf": "verdana-italic.ttf",
  "DejaVuSans-BoldOblique.ttf": "verdana-bold-italic.ttf",
  "NotoSans-Regular.ttf": "segoeui.ttf",
  "NotoSansArabic-Regular.ttf": "segoeui.ttf",
  "NotoSansHebrew-Regular.ttf": "segoeui.ttf",
  "NotoSansThai-Regular.ttf": "thai.ttf",
  "NotoSansJP-Regular.ttf": "japanese.ttc",
  "NotoSansKR-Regular.ttf": "korean.ttf",
  "NotoSansSC-Regular.ttf": "chinese-simplified.ttc",
  "NotoSansTC-Regular.ttf": "chinese-traditional.ttc",
};

// Windows serves a custom scheme as http://<scheme>.localhost.
const SYSTEM_FONT_ORIGIN = "http://sysfont.localhost";

/** The installed Windows fonts, keyed by the bundled fallback file each one replaces. */
export async function loadSystemFontUrls(): Promise<Record<string, string>> {
  if (!isTauriRuntime()) return {};
  const installed = new Set(await invoke<string[]>("list_system_fonts"));
  const urls: Record<string, string> = {};
  for (const [bundled, served] of Object.entries(WINDOWS_EQUIVALENT)) {
    if (installed.has(served)) urls[bundled] = `${SYSTEM_FONT_ORIGIN}/${served}`;
  }
  return urls;
}
