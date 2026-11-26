import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFPage,
} from "@cantoo/pdf-lib";
import { baseName, loadPdf, savePdf } from "./common";

export interface MergeOptions {
  /** Drop digital-signature fields from the merged pages (their signatures cannot survive a merge). */
  removeDigitalSignature: boolean;
  /** Add one bookmark per source file, titled with the file name, pointing at its first page. */
  generateTableOfContents: boolean;
}

/** Whether a widget annotation belongs to a signature field (the type may be inherited from a parent). */
function isSignatureWidget(annot: PDFDict): boolean {
  let node: PDFDict | undefined = annot;
  for (let depth = 0; node && depth < 16; depth++) {
    const type = node.lookupMaybe(PDFName.of("FT"), PDFName);
    if (type) return type.decodeText() === "Sig";
    node = node.lookupMaybe(PDFName.of("Parent"), PDFDict);
  }
  return false;
}

function stripSignatureWidgets(page: PDFPage): void {
  const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
  if (!annots) return;
  for (let i = annots.size() - 1; i >= 0; i--) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (annot && isSignatureWidget(annot)) annots.remove(i);
  }
}

/** Flat outline (bookmarks) with one entry per `{ title, page }`. */
function addOutline(
  doc: PDFDocument,
  entries: { title: string; page: PDFPage }[],
): void {
  if (entries.length === 0) return;
  const { context } = doc;
  const outlineRef = context.nextRef();
  const itemRefs = entries.map(() => context.nextRef());
  entries.forEach(({ title, page }, i) => {
    context.assign(
      itemRefs[i],
      context.obj({
        Title: PDFHexString.fromText(title),
        Parent: outlineRef,
        Dest: [page.ref, PDFName.of("Fit")],
        ...(i > 0 ? { Prev: itemRefs[i - 1] } : {}),
        ...(i < entries.length - 1 ? { Next: itemRefs[i + 1] } : {}),
      }),
    );
  });
  context.assign(
    outlineRef,
    context.obj({
      Type: "Outlines",
      First: itemRefs[0],
      Last: itemRefs[itemRefs.length - 1],
      Count: entries.length,
    }),
  );
  doc.catalog.set(PDFName.of("Outlines"), outlineRef);
}

/**
 * Concatenates the files, in the order given, into one PDF. Pages are copied, so
 * the sources' own bookmarks and interactive form fields are not carried over
 * (the pages still show the fields' appearance).
 */
export async function mergePdfs(
  files: File[],
  options: MergeOptions,
): Promise<File> {
  if (files.length === 0) throw new Error("No files to merge.");
  const merged = await PDFDocument.create({ updateMetadata: false });
  const outline: { title: string; page: PDFPage }[] = [];

  for (const file of files) {
    const source = await loadPdf(file);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page, i) => {
      if (options.removeDigitalSignature) stripSignatureWidgets(page);
      merged.addPage(page);
      if (i === 0) outline.push({ title: baseName(file.name), page });
    });
  }

  if (options.generateTableOfContents) addOutline(merged, outline);
  return savePdf(merged, `merged_${files[0].name}`);
}
