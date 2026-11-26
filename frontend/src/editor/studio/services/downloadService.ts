import { assertFilesNotBlocked } from "@editor/services/policyFileGuard";
import { saveToLocalPath, showSaveDialog } from "@editor/services/localFileSaveService";
import { isTauriRuntime } from "@editor/services/tauriFiles";

export interface DownloadRequest {
  data: Blob | File;
  filename: string;
  localPath?: string;
  /** Workspace fileId of the file being exported, when known. */
  fileId?: string;
}

/** PDF Viewer writes to real paths, so a saved file stays linked to its path. */
export const SAVES_TO_DISK = true;

export interface DownloadResult {
  savedPath?: string;
  cancelled?: boolean;
}

function browserDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Save always overwrites: with a linked path the file is replaced in place with
 * no prompt; without one the user picks a location once and the file links to it.
 */
export async function downloadFile(request: DownloadRequest): Promise<DownloadResult> {
  assertFilesNotBlocked([request.fileId]);

  if (!isTauriRuntime()) {
    const url = URL.createObjectURL(request.data);
    browserDownload(url, request.filename);
    URL.revokeObjectURL(url);
    return { savedPath: request.localPath };
  }

  const target = request.localPath ?? (await showSaveDialog(request.filename));
  if (!target) return { cancelled: true };

  const result = await saveToLocalPath(request.data, target);
  if (!result.success) {
    throw new Error(result.error ?? "Could not save the file");
  }
  return { savedPath: target };
}

export async function downloadFromUrl(url: string, filename: string, localPath?: string): Promise<DownloadResult> {
  assertFilesNotBlocked();
  if (!isTauriRuntime()) {
    browserDownload(url, filename);
    return { savedPath: localPath };
  }
  const blob = await (await fetch(url)).blob();
  return downloadFile({ data: blob, filename, localPath });
}
