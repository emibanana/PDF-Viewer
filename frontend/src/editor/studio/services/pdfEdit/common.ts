import {
  EncryptedPDFError,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  PDFPage,
  PDFRawStream,
} from "@cantoo/pdf-lib";

/**
 * Shared helpers for the client-side PDF tools. They only depend on pdf-lib so
 * the processors can be unit tested without the app's context providers.
 */

export const isEncryptedPdfError = (error: unknown): boolean =>
  error instanceof EncryptedPDFError;

/**
 * pdf-lib keeps a loaded file's cross-reference and object streams as ordinary objects and
 * writes them back out next to the objects it already unpacked from them. That bloats every
 * re-save and keeps stale copies of old content (a replaced Info dictionary, the Encrypt
 * dictionary of a file we just unlocked) inside the new file, so drop them.
 */
function dropStaleObjects(doc: PDFDocument): void {
  if (doc.isEncrypted) return;
  const { context } = doc;
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    const type =
      object instanceof PDFRawStream
        ? object.dict.lookupMaybe(PDFName.of("Type"), PDFName)?.decodeText()
        : undefined;
    const isEncryptDict =
      object instanceof PDFDict &&
      object.lookupMaybe(PDFName.of("Filter"), PDFName)?.decodeText() ===
        "Standard" &&
      object.has(PDFName.of("O")) &&
      object.has(PDFName.of("U"));
    if (
      type === "XRef" ||
      type === "ObjStm" ||
      object instanceof PDFInvalidObject ||
      isEncryptDict
    ) {
      context.delete(ref);
    }
  }
}

/** Opens `file` for editing. `updateMetadata: false` keeps Producer/ModDate as they were. */
export async function loadPdf(
  file: File,
  options: { password?: string; ignoreEncryption?: boolean } = {},
): Promise<PDFDocument> {
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer(), {
      updateMetadata: false,
      ...options,
    });
    dropStaleObjects(doc);
    return doc;
  } catch (error) {
    if (isEncryptedPdfError(error)) {
      throw new Error(
        `${file.name} is password protected. Remove the password first.`,
        { cause: error },
      );
    }
    throw new Error(
      `Could not read ${file.name}: ${error instanceof Error ? error.message : "unknown error"}`,
      { cause: error },
    );
  }
}

export async function savePdf(
  doc: PDFDocument,
  name: string,
): Promise<File> {
  const bytes = await doc.save();
  return new File([bytes as BlobPart], name, { type: "application/pdf" });
}

export const baseName = (name: string): string =>
  name.replace(/\.[^./\\]+$/, "");

/** Copies the document information (title, author, ...) so a rebuilt document keeps it. */
export function copyDocumentInfo(from: PDFDocument, to: PDFDocument): void {
  const title = from.getTitle();
  const author = from.getAuthor();
  const subject = from.getSubject();
  const keywords = from.getKeywords();
  const creator = from.getCreator();
  const producer = from.getProducer();
  const created = from.getCreationDate();
  const modified = from.getModificationDate();
  if (title !== undefined) to.setTitle(title);
  if (author !== undefined) to.setAuthor(author);
  if (subject !== undefined) to.setSubject(subject);
  if (keywords !== undefined) to.setKeywords([keywords]);
  if (creator !== undefined) to.setCreator(creator);
  if (producer !== undefined) to.setProducer(producer);
  if (created !== undefined) to.setCreationDate(created);
  if (modified !== undefined) to.setModificationDate(modified);
}

/** Marks a blank page (sized like the first source page) in a page sequence. */
export const BLANK_PAGE = -1;

/**
 * Builds a new document from `sequence` (zero-based source indices in output order, repeats
 * allowed, BLANK_PAGE for an empty page). Copying into a fresh document, rather than deleting
 * pages in place, means dropped pages' content does not stay inside the saved file.
 */
export async function buildFromPages(
  source: PDFDocument,
  sequence: number[],
): Promise<PDFDocument> {
  const out = await PDFDocument.create({ updateMetadata: false });
  copyDocumentInfo(source, out);

  // Copy every distinct page in one call so shared fonts and images are stored once.
  const distinct = [...new Set(sequence.filter((i) => i !== BLANK_PAGE))];
  const copies = new Map<number, PDFPage>();
  (await out.copyPages(source, distinct)).forEach((page, n) =>
    copies.set(distinct[n], page),
  );

  for (const index of sequence) {
    if (index === BLANK_PAGE) {
      const { width, height } = source.getPage(0).getSize();
      out.addPage([width, height]);
      continue;
    }
    // A page node can only sit in the page tree once, so a repeat is copied again.
    const page =
      copies.get(index) ?? (await out.copyPages(source, [index]))[0];
    copies.delete(index);
    out.addPage(page);
  }
  return out;
}
