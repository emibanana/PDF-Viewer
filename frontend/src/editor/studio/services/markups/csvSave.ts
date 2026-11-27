import { showSaveDialog } from "@editor/services/localFileSaveService";
import { isTauriRuntime, writeBlobToPath } from "@editor/services/tauriFiles";

export type CsvSaveResult = { status: "saved"; path?: string } | { status: "cancelled" };

/**
 * Writes `csv` through the native save dialog in the desktop app, or as a browser download in a
 * plain browser tab. Rejects when the file cannot be written; cancelling the dialog is a result.
 */
export async function saveCsvFile(csv: string, fileName: string): Promise<CsvSaveResult> {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  if (!isTauriRuntime()) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return { status: "saved" };
  }
  const path = await showSaveDialog(fileName, undefined, { name: "CSV", extensions: ["csv"] });
  if (!path) return { status: "cancelled" };
  await writeBlobToPath(blob, path);
  return { status: "saved", path };
}
