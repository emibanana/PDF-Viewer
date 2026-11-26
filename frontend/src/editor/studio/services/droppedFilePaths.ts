import { listen } from "@tauri-apps/api/event";
import { pendingFilePathMappings } from "@editor/services/pendingFilePathMappings";
import { isTauriRuntime } from "@editor/services/tauriFiles";

export interface DroppedPathLookup {
  link: (files: File[]) => void;
}

/** The host answers within milliseconds; past this the file is simply left unlinked. */
const LOOKUP_TIMEOUT_MS = 2000;

/** Message prefix the Rust host listens for (`commands/dropped_paths.rs`). */
const DROP_MESSAGE_PREFIX = "pdfv-drop:";

interface WebViewHost {
  postMessageWithAdditionalObjects?: (message: string, objects: File[]) => void;
}

const NO_LOOKUP: DroppedPathLookup = { link: () => {} };

const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`;

/**
 * WebView2 reveals a dropped file's path only to the host, so the files are
 * posted to Rust, which answers with a `dropped-paths` event carrying the same
 * request id.
 */
export function beginDroppedPathLookup(transfer: DataTransfer): DroppedPathLookup {
  const natives = Array.from(transfer.files);
  const host = (window as { chrome?: { webview?: WebViewHost } }).chrome?.webview;
  if (!isTauriRuntime() || natives.length === 0) return NO_LOOKUP;
  if (typeof host?.postMessageWithAdditionalObjects !== "function") return NO_LOOKUP;

  const id = crypto.randomUUID();
  const paths = new Promise<string[]>((resolve) => {
    let unlisten: (() => void) | undefined;
    const timer = setTimeout(() => {
      unlisten?.();
      resolve([]);
    }, LOOKUP_TIMEOUT_MS);
    void listen<{ id: string; paths: string[] }>("dropped-paths", (event) => {
      if (event.payload.id !== id) return;
      clearTimeout(timer);
      unlisten?.();
      resolve(event.payload.paths);
    }).then((off) => {
      unlisten = off;
      host.postMessageWithAdditionalObjects?.(DROP_MESSAGE_PREFIX + id, natives);
    });
  });

  return {
    link(files) {
      for (const file of files) {
        const index = natives.findIndex((native) => fileKey(native) === fileKey(file));
        if (index < 0) continue;
        pendingFilePathMappings.set(
          file,
          paths.then((resolved) => resolved[index] || undefined),
        );
      }
    },
  };
}
