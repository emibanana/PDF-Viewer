import { PDFDocument } from "@cantoo/pdf-lib";
import { copyDocumentInfo, loadPdf, savePdf } from "@editor/services/pdfEdit/common";

/**
 * Burns each file's interactive form fields into the page content so they can no
 * longer be edited. Flattening whole pages to images is not done here.
 */
export async function flattenForms(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    doc.getForm().flatten();
    out.push(await savePdf(doc, file.name));
  }
  return out;
}

/** A rendered page: PNG bytes plus the page's size in PDF points. */
export interface RenderedPage {
  png: Uint8Array;
  widthPt: number;
  heightPt: number;
}

/** Renders every page of `file` at `dpi`. Injected so tests need no canvas. */
export type PageRenderer = (file: File, dpi: number) => Promise<RenderedPage[]>;

/**
 * Replaces each page with a picture of itself, so text, vector art, annotations and
 * form fields all become one flat image. The text is no longer selectable or searchable.
 */
export async function flattenToImages(files: File[], dpi: number, render: PageRenderer): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const pages = await render(file, dpi);
    const doc = await PDFDocument.create({ updateMetadata: false });
    copyDocumentInfo(await loadPdf(file), doc);
    for (const p of pages) {
      const image = await doc.embedPng(p.png);
      const page = doc.addPage([p.widthPt, p.heightPt]);
      page.drawImage(image, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
