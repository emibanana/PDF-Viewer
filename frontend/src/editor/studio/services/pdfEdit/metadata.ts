import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "@editor/services/pdfEdit/common";

export interface MetadataEdit {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: Date | null;
  modificationDate: Date | null;
  /** "True", "False" or "Unknown" */
  trapped: string;
  customMetadata: { key: string; value: string }[];
  deleteAll: boolean;
}

const TEXT_FIELDS = [
  ["Title", "title"],
  ["Author", "author"],
  ["Subject", "subject"],
  ["Keywords", "keywords"],
  ["Creator", "creator"],
  ["Producer", "producer"],
] as const;

function infoDict(doc: PDFDocument): PDFDict {
  const { context } = doc;
  const existing = context.lookupMaybe(context.trailerInfo.Info, PDFDict);
  if (existing) return existing;
  const created = context.obj({});
  context.trailerInfo.Info = context.register(created);
  return created;
}

/**
 * Rewrites the document information to match `edit`. The tool pre-fills its form from
 * the file, so the form is the full desired state: an empty field removes the entry,
 * and custom entries that are no longer listed are dropped.
 */
export function applyMetadata(doc: PDFDocument, edit: MetadataEdit): void {
  const info = infoDict(doc);
  for (const key of info.keys()) info.delete(key);

  if (edit.deleteAll) {
    // The XMP packet carries the same information as the info dictionary.
    doc.catalog.delete(PDFName.of("Metadata"));
    return;
  }

  for (const [key, field] of TEXT_FIELDS) {
    const value = edit[field];
    if (value.trim()) info.set(PDFName.of(key), PDFHexString.fromText(value));
  }
  if (edit.creationDate) {
    info.set(PDFName.of("CreationDate"), PDFString.fromDate(edit.creationDate));
  }
  if (edit.modificationDate) {
    info.set(PDFName.of("ModDate"), PDFString.fromDate(edit.modificationDate));
  }
  if (edit.trapped === "True" || edit.trapped === "False") {
    info.set(PDFName.of("Trapped"), PDFName.of(edit.trapped));
  }
  for (const { key, value } of edit.customMetadata) {
    if (key.trim() && value.trim()) {
      info.set(PDFName.of(key.trim()), PDFHexString.fromText(value.trim()));
    }
  }
}

export async function changeMetadata(edit: MetadataEdit, files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    applyMetadata(doc, edit);
    out.push(await savePdf(doc, file.name));
  }
  return out;
}
