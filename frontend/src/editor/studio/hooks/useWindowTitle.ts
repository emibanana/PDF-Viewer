import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAllFiles, useFileSelection } from "@editor/contexts/FileContext";
import { isTauriRuntime } from "@editor/services/tauriFiles";

const APP_TITLE = "PDF Viewer";

/** "● name - PDF Viewer": the selected file (this hook mounts above the viewer, so it cannot ask which is on screen), with a dot while it has unsaved changes. */
export function windowTitleFor(name: string | undefined, dirty: boolean) {
  if (!name) return APP_TITLE;
  return `${dirty ? "\u25CF " : ""}${name} - ${APP_TITLE}`;
}

export function useWindowTitle(): void {
  const { fileStubs } = useAllFiles();
  const { selectedFileIds } = useFileSelection();
  const stub = fileStubs.find((candidate) => candidate.id === selectedFileIds[0]) ?? fileStubs[0];
  const title = windowTitleFor(stub?.name, stub?.isDirty === true);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    document.title = title;
    void getCurrentWindow().setTitle(title);
  }, [title]);
}
