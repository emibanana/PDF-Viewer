import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
  PDFHexString,
  PDFStream,
} from "@cantoo/pdf-lib";
import type { PdfInfoBackendData, PdfTocEntry, PdfPageInfo } from "@editor-core/types/getPdfInfo";
import { readOutline } from "@editor/services/pdfEdit/outline";

const N = (s: string) => PDFName.of(s);
const fmtDate = (d: Date | undefined) => (d ? d.toISOString() : null);
const round = (n: number, digits = 2) => Number(n.toFixed(digits));

/** Page size names, in points, for the "Standard Page" line. */
const STANDARD_SIZES: [string, number, number][] = [
  ["A3", 842, 1191],
  ["A4", 595, 842],
  ["A5", 420, 595],
  ["Letter", 612, 792],
  ["Legal", 612, 1008],
];

function standardName(w: number, h: number): string {
  const [a, b] = w <= h ? [w, h] : [h, w];
  const hit = STANDARD_SIZES.find(([, sw, sh]) => Math.abs(sw - a) <= 2 && Math.abs(sh - b) <= 2);
  return hit?.[0] ?? "Custom";
}

const box = (p: { x: number; y: number; width: number; height: number }) =>
  `[${round(p.x)}, ${round(p.y)}, ${round(p.x + p.width)}, ${round(p.y + p.height)}]`;

function pageInfo(doc: PDFDocument, index: number): PdfPageInfo {
  const page = doc.getPage(index);
  const { width, height } = page.getSize();
  const resources = page.node.Resources();
  const fonts: NonNullable<PdfPageInfo["Fonts"]> = [];
  const images: NonNullable<PdfPageInfo["Images"]> = [];
  let forms = 0;

  const fontDict = resources?.lookupMaybe(N("Font"), PDFDict);
  fontDict?.entries().forEach(([, ref]) => {
    const font = doc.context.lookupMaybe(ref, PDFDict);
    if (!font) return;
    const descriptor = font.lookupMaybe(N("FontDescriptor"), PDFDict);
    fonts.push({
      Name: font.lookupMaybe(N("BaseFont"), PDFName)?.decodeText(),
      Subtype: font.lookupMaybe(N("Subtype"), PDFName)?.decodeText(),
      IsEmbedded: !!(
        descriptor &&
        (descriptor.has(N("FontFile")) || descriptor.has(N("FontFile2")) || descriptor.has(N("FontFile3")))
      ),
    });
  });

  const xObjects = resources?.lookupMaybe(N("XObject"), PDFDict);
  xObjects?.entries().forEach(([, ref]) => {
    const x = doc.context.lookup(ref);
    const dict = x instanceof PDFStream ? x.dict : undefined;
    const subtype = dict?.lookupMaybe(N("Subtype"), PDFName)?.decodeText();
    if (subtype === "Image") {
      images.push({
        Width: dict?.lookupMaybe(N("Width"), PDFNumber)?.asNumber(),
        Height: dict?.lookupMaybe(N("Height"), PDFNumber)?.asNumber(),
        ColorSpace:
          dict?.lookup(N("ColorSpace")) instanceof PDFName
            ? (dict.lookup(N("ColorSpace")) as PDFName).decodeText()
            : undefined,
      });
    } else if (subtype === "Form") forms++;
  });

  const links: NonNullable<PdfPageInfo["Links"]> = [];
  const annots = page.node.lookupMaybe(N("Annots"), PDFArray);
  for (let i = 0; annots && i < annots.size(); i++) {
    const a = annots.lookupMaybe(i, PDFDict);
    const uri = a?.lookupMaybe(N("A"), PDFDict)?.lookupMaybe(N("URI"), PDFString, PDFHexString);
    if (uri) links.push({ URI: uri.decodeText() });
  }

  return {
    Size: {
      "Width (px)": String(round(width)),
      "Height (px)": String(round(height)),
      "Width (in)": String(round(width / 72)),
      "Height (in)": String(round(height / 72)),
      "Width (cm)": String(round((width / 72) * 2.54)),
      "Height (cm)": String(round((height / 72) * 2.54)),
      "Standard Page": standardName(width, height),
    },
    Rotation: page.getRotation().angle,
    "Page Orientation": width > height ? "Landscape" : "Portrait",
    MediaBox: box(page.getMediaBox()),
    CropBox: box(page.getCropBox()),
    Annotations: { AnnotationsCount: annots?.size() ?? 0 },
    Images: images,
    Links: links,
    Fonts: fonts,
    XObjectCounts: { Image: images.length, Form: forms },
  };
}

/**
 * Reads a PDF's properties into the shape the Get Info report view renders. Text statistics,
 * PDF/A conformance and the structure tree need a text or validation engine and are left out.
 */
export async function getPdfInfo(file: File): Promise<PdfInfoBackendData> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch (error) {
    throw new Error(`Could not read ${file.name}: ${error instanceof Error ? error.message : "unknown error"}`, {
      cause: error,
    });
  }

  const header = /%PDF-(\d\.\d)/.exec(new TextDecoder("latin1").decode(bytes.slice(0, 1024)));
  // The report view prints a string entry as is, so the nesting is written into the text.
  const outline = readOutline(doc).map(
    (e) => `${"    ".repeat(e.level - 1)}${e.title}${e.pageIndex !== null ? ` (page ${e.pageIndex + 1})` : ""}`,
  ) as unknown as PdfTocEntry[];

  const formFields: Record<string, string> = {};
  try {
    for (const f of doc.getForm().getFields()) {
      formFields[f.getName()] = f.constructor.name.replace(/^PDF/, "");
    }
  } catch {
    // An encrypted or malformed form is reported as having no fields.
  }

  const names = doc.catalog.lookupMaybe(N("Names"), PDFDict);
  const embedded = names?.lookupMaybe(N("EmbeddedFiles"), PDFDict)?.lookupMaybe(N("Names"), PDFArray);
  const embeddedFiles: { Name?: string }[] = [];
  for (let i = 0; embedded && i < embedded.size(); i += 2) {
    embeddedFiles.push({
      Name: embedded.lookupMaybe(i, PDFString, PDFHexString)?.decodeText(),
    });
  }

  const pageCount = doc.getPageCount();
  const perPage: Record<string, PdfPageInfo> = {};
  for (let i = 0; i < pageCount; i++) perPage[`Page ${i + 1}`] = pageInfo(doc, i);

  const totalImages = Object.values(perPage).reduce((sum, p) => sum + (p.Images?.length ?? 0), 0);
  const hasStream = [...doc.context.enumerateIndirectObjects()].some(([, o]) => o instanceof PDFRawStream);

  return {
    Metadata: {
      Title: doc.getTitle() ?? null,
      Author: doc.getAuthor() ?? null,
      Subject: doc.getSubject() ?? null,
      Keywords: doc.getKeywords() ?? null,
      Creator: doc.getCreator() ?? null,
      Producer: doc.getProducer() ?? null,
      CreationDate: fmtDate(doc.getCreationDate()),
      ModificationDate: fmtDate(doc.getModificationDate()),
    },
    BasicInfo: {
      FileSizeInBytes: file.size,
      "Number of pages": pageCount,
      TotalImages: totalImages,
      Compression: hasStream,
    },
    DocumentInfo: {
      "PDF version": header?.[1],
      "Page Mode": doc.catalog.lookupMaybe(N("PageMode"), PDFName)?.decodeText() ?? "UseNone",
    },
    Encryption: { IsEncrypted: doc.isEncrypted },
    FormFields: formFields,
    Other: {
      EmbeddedFiles: embeddedFiles,
      "Bookmarks/Outline/TOC": outline,
      JavaScript: names?.has(N("JavaScript")) ? [{ "JS Name": "Document JavaScript" }] : [],
    },
    "Bookmarks/Outline/TOC": outline,
    PerPageInfo: perPage,
  };
}
