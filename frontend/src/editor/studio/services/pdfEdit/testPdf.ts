import { PDFDocument } from "@cantoo/pdf-lib";

/** A PDF whose page i (zero-based) is 100 + i points wide, so tests can tell pages apart. */
export async function makePdf(
  pageCount: number,
  name = "doc.pdf",
  tweak?: (doc: PDFDocument) => void,
): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([100 + i, 200]);
  tweak?.(doc);
  return new File([(await doc.save()) as BlobPart], name, {
    type: "application/pdf",
  });
}

export async function open(
  file: File,
  password?: string,
): Promise<PDFDocument> {
  return PDFDocument.load(await file.arrayBuffer(), {
    updateMetadata: false,
    password,
  });
}

/** Page widths, which identify which source page each output page is. */
export async function widths(file: File): Promise<number[]> {
  return (await open(file)).getPages().map((p) => p.getWidth());
}
