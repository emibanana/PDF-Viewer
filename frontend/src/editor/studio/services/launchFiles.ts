import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@editor/services/tauriFiles";

let ingesting = 0;

/** Marks files the OS handed us as being loaded, so session restore waits for them. */
export function beginLaunchIngest(): () => void {
  ingesting++;
  let done = false;
  return () => {
    if (!done) {
      done = true;
      ingesting--;
    }
  };
}

/**
 * Whether files the OS handed this window ("open with", command line, a second
 * launch) are still on their way in. Session restoration reopens files too, but
 * must leave incoming files' selection and view alone.
 */
export async function launchFilesPending(): Promise<boolean> {
  if (ingesting > 0) return true;
  if (!isTauriRuntime()) return false;
  try {
    const queued = await invoke<string[]>("get_opened_files");
    return queued.length > 0;
  } catch {
    return false;
  }
}
