/**
 * Last step of every export of the viewer's live document (`exportActions.saveAsCopy`): bytes in,
 * bytes out. Core returns them untouched; the studio build shadows this file to add what other
 * viewers need to read the document's measurements, so a version saved inside the app carries it
 * too and not only a file written to disk.
 */
export async function finishViewerExport(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  return bytes;
}
