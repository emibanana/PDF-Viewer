import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useFileHandler } from "@editor/hooks/useFileHandler";
import { useFileActions } from "@editor/contexts/FileContext";
import { pendingFilePathMappings } from "@editor/services/pendingFilePathMappings";
import { beginLaunchIngest } from "@editor/services/launchFiles";
import { isTauriRuntime, readPathAsFile } from "@editor/services/tauriFiles";
import { createQuickKey } from "@editor/types/fileContext";

/**
 * Loads files the OS hands the app into the workspace: files passed on the
 * command line at launch, "open with" / double-click while the app is running,
 * and files dropped on the window. The Rust host queues their paths and emits
 * `files-changed`; each window pops the queue and opens what it finds.
 */
export function useAppInitialization(): void {
  const { addFiles } = useFileHandler();
  const { actions } = useFileActions();
  const draining = useRef(false);
  const latest = useRef({ addFiles, actions });
  latest.current = { addFiles, actions };

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let disposed = false;

    const drain = async () => {
      if (draining.current) return;
      draining.current = true;
      const endIngest = beginLaunchIngest();
      try {
        const paths = await invoke<string[]>("pop_opened_files");
        if (disposed || paths.length === 0) return;

        const loaded: { file: File; path: string }[] = [];
        for (const path of paths) {
          try {
            const file = await readPathAsFile(path);
            pendingFilePathMappings.set(file, path);
            loaded.push({ file, path });
          } catch (error) {
            console.error("Could not read", path, error);
          }
        }
        if (loaded.length === 0) return;

        const added = await latest.current.addFiles(
          loaded.map((entry) => entry.file),
          { selectFiles: true },
        );
        // Link each opened file to its path so Save writes back to it.
        const pathByQuickKey = new Map(
          loaded.map(({ file, path }) => [createQuickKey(file), path]),
        );
        for (const stirlingFile of added) {
          const path = pathByQuickKey.get(stirlingFile.quickKey);
          if (path) {
            latest.current.actions.updateStirlingFileStub(stirlingFile.fileId, {
              localFilePath: path,
              isDirty: false,
            });
          }
        }
      } catch (error) {
        console.error("Opening launch files failed", error);
      } finally {
        endIngest();
        draining.current = false;
      }
    };

    void drain();
    const unlisten = listen("files-changed", () => void drain());
    return () => {
      disposed = true;
      void unlisten.then((off) => off());
    };
  }, []);
}
