import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask } from "@tauri-apps/plugin-dialog";
import { useAllFiles } from "@editor/contexts/FileContext";
import { isTauriRuntime } from "@editor/services/tauriFiles";

/** Names shown in the prompt; the rest are summarised so the dialog stays short. */
const LISTED_NAMES = 5;

export function unsavedPrompt(names: string[]): string {
  const listed = names.slice(0, LISTED_NAMES).join("\n");
  const more = names.length > LISTED_NAMES ? `\n+ ${names.length - LISTED_NAMES} more` : "";
  return `These files have unsaved changes:\n\n${listed}${more}\n\nClose without saving?`;
}

/** Closing the window with unsaved changes asks first; clean windows close at once. */
export function useUnsavedCloseGuard(): void {
  const { fileStubs } = useAllFiles();
  const unsavedNames = useRef<string[]>([]);
  unsavedNames.current = fileStubs.filter((stub) => stub.isDirty).map((stub) => stub.name);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      const names = unsavedNames.current;
      if (names.length === 0) return;
      event.preventDefault();
      const discard = await ask(unsavedPrompt(names), {
        title: "Unsaved changes",
        kind: "warning",
        okLabel: "Close without saving",
        cancelLabel: "Cancel",
      });
      if (discard) await appWindow.destroy();
    });
    return () => {
      void unlisten.then((off) => off());
    };
  }, []);
}
