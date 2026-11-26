import { open } from "@tauri-apps/plugin-dialog";
import { createQuickKey } from "@editor/types/fileContext";
import { isTauriRuntime, readPathAsFile } from "@editor/services/tauriFiles";

export interface FileWithPath {
  file: File;
  path: string;
  quickKey: string;
}

export interface FileDialogOptions {
  multiple?: boolean;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}

/** The desktop app has a native picker, so cancelling it must not open a browser one. */
export const hasNativeFileDialog = isTauriRuntime();

/** Native open dialog; returns each chosen file with the path it came from. */
export async function openFileDialog(options?: FileDialogOptions): Promise<FileWithPath[]> {
  if (!isTauriRuntime()) return [];

  const selected = await open({
    multiple: options?.multiple ?? true,
    filters: options?.filters,
  });
  if (!selected) return [];

  const paths = Array.isArray(selected) ? selected : [selected];
  const files: FileWithPath[] = [];
  for (const path of paths) {
    const file = await readPathAsFile(path);
    files.push({ file, path, quickKey: createQuickKey(file) });
  }
  return files;
}
