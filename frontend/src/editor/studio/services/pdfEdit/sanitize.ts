import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
} from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "./common";

export interface SanitizeOptions {
  removeJavaScript: boolean;
  removeEmbeddedFiles: boolean;
  removeXMPMetadata: boolean;
  removeMetadata: boolean;
  removeLinks: boolean;
  removeFonts: boolean;
}

const N = (s: string) => PDFName.of(s);

const isJsAction = (action: PDFDict | undefined): boolean =>
  action?.lookup(N("S")) === N("JavaScript");

function dictsIn(doc: PDFDocument): PDFDict[] {
  return doc.context
    .enumerateIndirectObjects()
    .map(([, o]) => o)
    .filter((o): o is PDFDict => o instanceof PDFDict);
}

function removeJavaScript(doc: PDFDocument): void {
  const { catalog } = doc;
  if (isJsAction(catalog.lookupMaybe(N("OpenAction"), PDFDict))) catalog.delete(N("OpenAction"));
  catalog.delete(N("AA"));
  const names = catalog.lookupMaybe(N("Names"), PDFDict);
  names?.delete(N("JavaScript"));
  for (const d of dictsIn(doc)) {
    // Form fields, widgets and links run scripts through /A and /AA.
    if (isJsAction(d.lookupMaybe(N("A"), PDFDict))) d.delete(N("A"));
    if (d.has(N("AA")) && (d.has(N("FT")) || d.lookup(N("Subtype")) === N("Widget") || d.lookup(N("Type")) === N("Page"))) {
      d.delete(N("AA"));
    }
  }
}

function removeEmbeddedFiles(doc: PDFDocument): void {
  doc.catalog.lookupMaybe(N("Names"), PDFDict)?.delete(N("EmbeddedFiles"));
  doc.catalog.delete(N("AF"));
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
    if (!annots) continue;
    const keep = annots.asArray().filter((a) => {
      const d = doc.context.lookupMaybe(a, PDFDict);
      return d?.lookup(N("Subtype")) !== N("FileAttachment");
    });
    page.node.set(N("Annots"), doc.context.obj(keep));
  }
}

function removeLinks(doc: PDFDocument): void {
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
    if (!annots) continue;
    const keep = annots.asArray().filter((a) => {
      const d = doc.context.lookupMaybe(a, PDFDict);
      return d?.lookup(N("Subtype")) !== N("Link");
    });
    page.node.set(N("Annots"), doc.context.obj(keep));
  }
}

/** Drops the embedded font programs. Text stays but is drawn with whatever font the viewer substitutes. */
function removeFonts(doc: PDFDocument): void {
  for (const d of dictsIn(doc)) {
    if (d.lookup(N("Type")) !== N("FontDescriptor")) continue;
    for (const key of ["FontFile", "FontFile2", "FontFile3"]) d.delete(N(key));
  }
}

function removeInfo(doc: PDFDocument): void {
  const info = doc.context.lookupMaybe(doc.context.trailerInfo.Info, PDFDict);
  info?.keys().forEach((key) => info.delete(key));
}

/** Strips the selected kinds of hidden content from each file. */
export async function sanitizePdfs(
  options: SanitizeOptions,
  files: File[],
): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    if (options.removeJavaScript) removeJavaScript(doc);
    if (options.removeEmbeddedFiles) removeEmbeddedFiles(doc);
    if (options.removeLinks) removeLinks(doc);
    if (options.removeFonts) removeFonts(doc);
    if (options.removeXMPMetadata) doc.catalog.delete(N("Metadata"));
    if (options.removeMetadata) {
      removeInfo(doc);
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
