import { degrees } from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "./common";

/** Turns every page of each file clockwise by `angle` (a multiple of 90), on top of its current rotation. */
export async function rotatePdfs(
  angle: number,
  files: File[],
): Promise<File[]> {
  const turn = ((angle % 360) + 360) % 360;
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    if (turn !== 0) {
      for (const page of doc.getPages()) {
        page.setRotation(degrees((page.getRotation().angle + turn) % 360));
      }
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
