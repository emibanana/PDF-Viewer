import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from "@cantoo/pdf-lib";
import type { PDFObject, PDFPage } from "@cantoo/pdf-lib";
import type { MeasureScale } from "@editor/utils/measurementTypes";
import { measureSpecForKind, readMarkupCustom, type MeasureToolSpec } from "@editor/services/markups/markupModel";

/** A page scale the user set in the app, as the save pass needs it. */
export interface PageScaleToWrite {
  scale: MeasureScale;
  /** Decimal places a viewer shows for values on the page. */
  precision: number;
}

const PDF_NAMES = {
  annots: PDFName.of("Annots"),
  bbox: PDFName.of("BBox"),
  custom: PDFName.of("EPDFCustom"),
  intent: PDFName.of("IT"),
  measure: PDFName.of("Measure"),
  subtype: PDFName.of("Subtype"),
  viewports: PDFName.of("VP"),
};

const EXPECTED_SUBTYPE: Record<MeasureToolSpec["intent"], string> = {
  LineDimension: "Line",
  PolyLineDimension: "PolyLine",
  PolygonDimension: "Polygon",
};

function includesBytes(bytes: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    if (bytes[i] !== needle[0]) continue;
    for (let j = 1; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const CUSTOM_MARKER = new TextEncoder().encode("EPDFCustom");
const OBJECT_STREAM_MARKER = new TextEncoder().encode("/ObjStm");

/** Cheap pre-check, so files without our markups are never reparsed. Object streams hide the marker. */
function mayNeedPass(bytes: Uint8Array, pageScales: ReadonlyMap<number, PageScaleToWrite>): boolean {
  return pageScales.size > 0 || includesBytes(bytes, CUSTOM_MARKER) || includesBytes(bytes, OBJECT_STREAM_MARKER);
}

/** The scale as the text a viewer shows for it: "1:100" when it is a ratio of paper to real units. */
function scaleText({ factor, ratio, unit }: MeasureScale): string {
  if (ratio !== null && Number.isFinite(ratio)) return `1:${Number(ratio.toPrecision(6))}`;
  return `1 pt = ${Number(factor.toPrecision(6))} ${unit}`;
}

function numberFormat(doc: PDFDocument, unit: string, factor: number, precision: number): PDFDict {
  return doc.context.obj({
    Type: "NumberFormat",
    U: PDFString.of(unit),
    C: factor,
    F: "D",
    D: 10 ** Math.max(0, Math.min(6, precision)),
  });
}

/**
 * A `/Measure` dictionary of subtype `/RL`. `/X` carries the scale from page units; `/D` and
 * `/A` are the display formats of the distance and area it produces, so their conversion factor
 * is 1. The app's own reader (`extractPageMeasureScales`) takes the scale from whichever of `/D`
 * and `/X` has a factor other than 1.
 */
function buildMeasure(doc: PDFDocument, { scale, precision }: PageScaleToWrite): PDFDict {
  const { factor, unit } = scale;
  return doc.context.obj({
    Type: "Measure",
    Subtype: "RL",
    R: PDFString.of(scaleText(scale)),
    X: [numberFormat(doc, unit, factor, precision)],
    D: [numberFormat(doc, unit, 1, precision)],
    A: [numberFormat(doc, `sq ${unit}`, 1, precision)],
  });
}

function numbersOf(array: PDFArray | undefined): number[] {
  if (!array) return [];
  const result: number[] = [];
  for (let i = 0; i < array.size(); i++) {
    const value = array.lookup(i);
    if (value instanceof PDFNumber) result.push(value.asNumber());
  }
  return result;
}

/** True when the viewport has no box or a box covering the page, which is how a whole-page scale is written. */
function coversPage(viewport: PDFDict, page: PDFPage): boolean {
  const box = numbersOf(viewport.lookupMaybe(PDF_NAMES.bbox, PDFArray));
  if (box.length < 4) return true;
  const { width, height } = page.getMediaBox();
  return Math.abs(box[2] - box[0]) >= width * 0.99 && Math.abs(box[3] - box[1]) >= height * 0.99;
}

/** Puts `measure` in as the page's whole-page viewport, ahead of any region viewports the page already has. */
function writePageViewport(doc: PDFDocument, page: PDFPage, measure: PDFRef): void {
  const mediaBox = page.getMediaBox();
  const viewport = doc.context.obj({
    Type: "Viewport",
    BBox: [mediaBox.x, mediaBox.y, mediaBox.x + mediaBox.width, mediaBox.y + mediaBox.height],
    Name: PDFString.of("Scale"),
    Measure: measure,
  });
  const entries: PDFObject[] = [viewport];
  const existing = page.node.lookupMaybe(PDF_NAMES.viewports, PDFArray);
  for (let i = 0; existing && i < existing.size(); i++) {
    const entry = existing.lookup(i);
    if (entry instanceof PDFDict && !coversPage(entry, page)) entries.push(existing.get(i));
  }
  page.node.set(PDF_NAMES.viewports, doc.context.obj(entries));
}

/** The `/Measure` of the first viewport of a page that has one, for markups on a page whose scale came with the file. */
function existingPageMeasure(page: PDFPage): PDFDict | undefined {
  const viewports = page.node.lookupMaybe(PDF_NAMES.viewports, PDFArray);
  for (let i = 0; viewports && i < viewports.size(); i++) {
    const viewport = viewports.lookup(i);
    const measure = viewport instanceof PDFDict ? viewport.lookupMaybe(PDF_NAMES.measure, PDFDict) : undefined;
    if (measure) return measure;
  }
  return undefined;
}

function readOwnKind(annot: PDFDict) {
  const raw = annot.lookup(PDF_NAMES.custom);
  if (!(raw instanceof PDFString || raw instanceof PDFHexString)) return null;
  try {
    return readMarkupCustom(JSON.parse(raw.decodeText()))?.kind ?? null;
  } catch {
    return null;
  }
}

function subtypeName(annot: PDFDict): string | undefined {
  return annot.lookupMaybe(PDF_NAMES.subtype, PDFName)?.decodeText();
}

/** Sets `/IT` and, when the page has a scale, `/Measure` on one of our markups; true when it changed anything. */
function markAnnotation(annot: PDFDict, measure: PDFRef | PDFDict | undefined): boolean {
  const kind = readOwnKind(annot);
  if (!kind) return false;
  const spec = measureSpecForKind(kind);
  if (subtypeName(annot) !== EXPECTED_SUBTYPE[spec.intent]) return false;
  annot.set(PDF_NAMES.intent, PDFName.of(spec.intent));
  if (measure) annot.set(PDF_NAMES.measure, measure);
  return true;
}

/**
 * Writes what other viewers need to read our measurements as measurements: `/IT` and a
 * `/Measure` dictionary on each of our markups (found by their `/EPDFCustom` JSON), and a
 * whole-page `/VP` viewport on every page whose scale was set in the app. Pages the user did
 * not touch keep the `/VP` they came with, and their markups point at its `/Measure`.
 *
 * Returns the same bytes when there is nothing to write. Never throws: a file this cannot read
 * is returned as it was.
 */
export async function ensureMeasureDictionaries(
  bytes: Uint8Array,
  pageScales: ReadonlyMap<number, PageScaleToWrite>,
): Promise<Uint8Array> {
  if (!mayNeedPass(bytes, pageScales)) return bytes;
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    let changed = false;
    doc.getPages().forEach((page, pageIndex) => {
      const userScale = pageScales.get(pageIndex);
      let measure: PDFRef | PDFDict | undefined;
      if (userScale) {
        measure = doc.context.register(buildMeasure(doc, userScale));
        writePageViewport(doc, page, measure);
        changed = true;
      } else {
        measure = existingPageMeasure(page);
      }
      const annots = page.node.lookupMaybe(PDF_NAMES.annots, PDFArray);
      for (let i = 0; annots && i < annots.size(); i++) {
        const annot = annots.lookup(i);
        if (annot instanceof PDFDict && markAnnotation(annot, measure)) changed = true;
      }
    });
    return changed ? await doc.save() : bytes;
  } catch (error) {
    console.warn("[measure] could not write measurement dictionaries", error);
    return bytes;
  }
}
