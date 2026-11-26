import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@editor/services/tauriFiles";

const FALLBACK_AUTHOR = "Guest";
let author = FALLBACK_AUTHOR;

// The viewer reads the name when a document opens, which is long after this resolves.
if (isTauriRuntime()) {
  void invoke<string>("get_os_username")
    .then((name) => {
      if (name.trim()) author = name.trim();
    })
    .catch(() => {});
}

/** The Windows user's name; annotations are authored by whoever is signed in to this PC. */
export function getAnnotationAuthor(): string {
  return author;
}
