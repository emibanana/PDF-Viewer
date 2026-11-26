import { save } from "@tauri-apps/plugin-dialog";
import {
  isTauriRuntime,
  writeBlobToPath,
} from "@editor/services/tauriFiles";

export interface SaveResult {
  success: boolean;
  error?: string;
}

export interface MultiFileSaveResult {
  success: boolean;
  savedCount: number;
  cancelledByUser?: boolean;
  error?: string;
}

/** Writes `data` to `filePath`, replacing the file in place. */
export async function saveToLocalPath(
  data: Blob | File,
  filePath: string,
): Promise<SaveResult> {
  if (!isTauriRuntime()) {
    return { success: false, error: "Local file save needs the desktop app" };
  }
  try {
    await writeBlobToPath(data, filePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Native "Save as" dialog; null when the user cancels. */
export async function showSaveDialog(
  defaultFilename: string,
  defaultDirectory?: string,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const defaultPath = defaultDirectory
    ? `${defaultDirectory.replace(/[\\/]+$/, "")}\\${defaultFilename}`
    : defaultFilename;
  return save({
    defaultPath,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
}

/** Saves several files into one folder the user picks. */
export async function saveMultipleFilesWithPrompt(
  files: (Blob | File)[],
  defaultDirectory?: string,
): Promise<MultiFileSaveResult> {
  if (!isTauriRuntime()) {
    return {
      success: false,
      savedCount: 0,
      error: "Saving several files needs the desktop app",
    };
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const folder = await open({ directory: true, defaultPath: defaultDirectory });
  if (typeof folder !== "string") {
    return { success: false, savedCount: 0, cancelledByUser: true };
  }
  let savedCount = 0;
  for (const file of files) {
    const name = file instanceof File ? file.name : `file-${savedCount + 1}.pdf`;
    const result = await saveToLocalPath(
      file,
      `${folder.replace(/[\\/]+$/, "")}\\${name}`,
    );
    if (!result.success) {
      return { success: false, savedCount, error: result.error };
    }
    savedCount++;
  }
  return { success: true, savedCount };
}
