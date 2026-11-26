import { pdfWorkerManager } from "@editor/services/pdfWorkerManager";
import type { PageRenderer } from "./flatten";

/** Browser page renderer (pdfjs + canvas). Kept apart from the processors so they stay testable in node. */
export const renderPagesWithPdfjs: PageRenderer = async (file, dpi) => {
  const pdf = await pdfWorkerManager.createDocument(await file.arrayBuffer(), {});
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error(`Could not render page ${n}`);
      pages.push({
        png: new Uint8Array(await blob.arrayBuffer()),
        widthPt: base.width,
        heightPt: base.height,
      });
    }
    return pages;
  } finally {
    await pdfWorkerManager.destroyDocument(pdf);
  }
};
