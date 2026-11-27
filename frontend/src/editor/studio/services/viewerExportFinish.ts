import { ensureMeasureDictionaries, type PageScaleToWrite } from "@editor/services/pdfEdit/measureDictionaries";
import { getActiveFileKey, getUserPageScales } from "@editor/services/markups/pageScaleStore";
import { listAnnotations } from "@editor/services/markups/markupController";
import { isOwnMarkup } from "@editor/services/markups/markupModel";

/** The scales the user set in the app for a file, as the save pass writes them. */
export function pageScalesToWrite(fileKey: string | null | undefined): Map<number, PageScaleToWrite> {
  const scales = new Map<number, PageScaleToWrite>();
  for (const [pageIndex, { scale, precision }] of getUserPageScales(fileKey)) scales.set(pageIndex, { scale, precision });
  return scales;
}

/**
 * Writes the `/Measure` and `/VP` dictionaries into the viewer's exported bytes, so a version
 * saved in the app keeps its page scales, units and wall height or slab depth after a reload.
 * Skipped when the document has neither a user scale nor one of our markups, because the pass
 * reparses the whole file.
 */
export async function finishViewerExport(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const scales = pageScalesToWrite(getActiveFileKey());
  const hasOwnMarkups = listAnnotations().some((tracked) => isOwnMarkup(tracked.object));
  if (scales.size === 0 && !hasOwnMarkups) return bytes;
  const input = new Uint8Array(bytes);
  const output = await ensureMeasureDictionaries(input, scales);
  if (output === input) return bytes;
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}
