import { loadPdf, savePdf } from "@editor/services/pdfEdit/common";
import { resolvePageSelection } from "@editor/services/pdfEdit/pages";

export interface CropArea {
  /** PDF points from the page's bottom-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Sets the visible box of the selected pages. The page content stays in the file, so this
 * hides what is outside the box but does not remove it. Use Redact for anything sensitive.
 */
export async function cropPdfs(area: CropArea, pageNumbers: string, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const count = doc.getPageCount();
    const selected = /^\s*(all)?\s*$/i.test(pageNumbers) ? doc.getPageIndices() : resolvePageSelection(pageNumbers, count);
    for (const i of new Set(selected)) {
      const page = doc.getPage(i);
      const media = page.getMediaBox();
      const x = Math.max(area.x, media.x);
      const y = Math.max(area.y, media.y);
      const width = Math.min(area.width, media.x + media.width - x);
      const height = Math.min(area.height, media.y + media.height - y);
      if (width <= 0 || height <= 0) {
        throw new Error(`The crop area is outside page ${i + 1} of ${file.name}.`);
      }
      page.setCropBox(x, y, width, height);
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
