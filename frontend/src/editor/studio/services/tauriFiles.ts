import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";

/** True inside the PDF Viewer desktop shell, false in a plain browser tab (vite dev). */
export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  tif: "image/tiff",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  md: "text/markdown",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
};

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function mimeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

/** Reads a file from disk into a browser File, keeping its real modified time. */
export async function readPathAsFile(path: string): Promise<File> {
  const bytes = await readFile(path);
  let lastModified = Date.now();
  try {
    const state = await invoke<{ availability: string; modifiedMs?: number }>(
      "file_disk_state",
      { path },
    );
    if (state.availability === "present" && state.modifiedMs) {
      lastModified = state.modifiedMs;
    }
  } catch {
    // The modified time is only used for de-duplication; fall back to now.
  }
  return new File([bytes], baseName(path), {
    type: mimeFor(path),
    lastModified,
  });
}

/**
 * Overwrites `path` in place (temp file + rename in the same folder, done in
 * Rust). The bytes travel as a raw IPC body, never JSON or base64.
 */
export async function writeBlobToPath(
  data: Blob,
  path: string,
): Promise<void> {
  const bytes = new Uint8Array(await data.arrayBuffer());
  await invoke("write_file_atomic", bytes, {
    headers: { "x-path": encodeURIComponent(path) },
  });
}
