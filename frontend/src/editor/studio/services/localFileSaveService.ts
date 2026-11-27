import { save } from "@tauri-apps/plugin-dialog";
import { ensureFreeTextAppearances } from "@editor/services/pdfEdit/freeTextAppearance";
import { ensureMeasureDictionaries } from "@editor/services/pdfEdit/measureDictionaries";
import { resolveFileKey } from "@editor/services/markups/pageScaleStore";
import { pageScalesToWrite } from "@editor/services/viewerExportFinish";
import { isStirlingFile } from "@editor/types/fileContext";
import { isTauriRuntime, writeBlobToPath } from "@editor/services/tauriFiles";

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

/** Page scales the user set in the app for the file being saved, by page index. */
function userScalesFor(data: Blob | File, fileId: string | undefined) {
  return pageScalesToWrite(resolveFileKey(fileId ?? (isStirlingFile(data) ? data.fileId : undefined)));
}

/**
 * Text boxes are saved with a stored appearance, so every viewer draws them the same way, and
 * measurements carry the dictionaries other viewers read them by.
 */
async function withViewerCompatibility(data: Blob | File, filePath: string, fileId: string | undefined): Promise<Blob> {
  if (!/\.pdf$/i.test(filePath)) return data;
  const original = new Uint8Array(await data.arrayBuffer());
  const withText = await ensureFreeTextAppearances(original);
  const fixed = await ensureMeasureDictionaries(withText, userScalesFor(data, fileId));
  return fixed === original ? data : new Blob([fixed as BlobPart], { type: "application/pdf" });
}

/**
 * Writes `data` to `filePath`, replacing the file in place. `fileId` is the workspace file the
 * bytes belong to, which is how the page scales set for it are found.
 */
export async function saveToLocalPath(data: Blob | File, filePath: string, fileId?: string): Promise<SaveResult> {
  if (!isTauriRuntime()) {
    return { success: false, error: "Local file save needs the desktop app" };
  }
  try {
    await writeBlobToPath(await withViewerCompatibility(data, filePath, fileId), filePath);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface SaveDialogFilter {
  name: string;
  extensions: string[];
}

const PDF_FILTER: SaveDialogFilter = { name: "PDF", extensions: ["pdf"] };

/** Native "Save as" dialog, offering PDF files unless `filter` says otherwise; null when the user cancels. */
export async function showSaveDialog(
  defaultFilename: string,
  defaultDirectory?: string,
  filter: SaveDialogFilter = PDF_FILTER,
): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const defaultPath = defaultDirectory ? `${defaultDirectory.replace(/[\\/]+$/, "")}\\${defaultFilename}` : defaultFilename;
  return save({
    defaultPath,
    filters: [filter],
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
    const result = await saveToLocalPath(file, `${folder.replace(/[\\/]+$/, "")}\\${name}`);
    if (!result.success) {
      return { success: false, savedCount, error: result.error };
    }
    savedCount++;
  }
  return { success: true, savedCount };
}
