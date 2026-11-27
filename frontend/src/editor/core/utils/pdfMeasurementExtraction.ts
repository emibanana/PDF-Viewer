import type {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
} from "@cantoo/pdf-lib";
import type {
  MeasureScale,
  PageMeasureScales,
  PageScaleInfo,
  ViewportScale,
} from "@editor/utils/measurementTypes";
import { getUnitFactor } from "@editor/utils/measurementUtils";
import { getDocumentBytes } from "@editor/services/documentBytesCache";

type PdfMeasurementObjects = Pick<
  typeof import("@cantoo/pdf-lib"),
  | "PDFArray"
  | "PDFDict"
  | "PDFHexString"
  | "PDFName"
  | "PDFNumber"
  | "PDFString"
>;

function asPdfArray(
  value: unknown,
  { PDFArray }: PdfMeasurementObjects,
): PDFArray | null {
  return value instanceof PDFArray ? value : null;
}

function asPdfDict(
  value: unknown,
  { PDFDict }: PdfMeasurementObjects,
): PDFDict | null {
  return value instanceof PDFDict ? value : null;
}

function asPdfNumber(
  value: unknown,
  { PDFNumber }: PdfMeasurementObjects,
): PDFNumber | null {
  return value instanceof PDFNumber ? value : null;
}

function asPdfText(
  value: unknown,
  { PDFHexString, PDFName, PDFString }: PdfMeasurementObjects,
): PDFHexString | PDFName | PDFString | null {
  if (
    value instanceof PDFString ||
    value instanceof PDFHexString ||
    value instanceof PDFName
  ) {
    return value;
  }
  return null;
}

function lookupArray(
  dict: PDFDict,
  key: string,
  pdfObjects: PdfMeasurementObjects,
): PDFArray | null {
  return asPdfArray(dict.lookup(pdfObjects.PDFName.of(key)), pdfObjects);
}

function lookupDict(
  dict: PDFDict,
  key: string,
  pdfObjects: PdfMeasurementObjects,
): PDFDict | null {
  return asPdfDict(dict.lookup(pdfObjects.PDFName.of(key)), pdfObjects);
}

function lookupNumber(
  dict: PDFDict,
  key: string,
  pdfObjects: PdfMeasurementObjects,
): number | null {
  return (
    asPdfNumber(
      dict.lookup(pdfObjects.PDFName.of(key)),
      pdfObjects,
    )?.asNumber() ?? null
  );
}

function lookupText(
  dict: PDFDict,
  key: string,
  pdfObjects: PdfMeasurementObjects,
): string | null {
  return (
    asPdfText(
      dict.lookup(pdfObjects.PDFName.of(key)),
      pdfObjects,
    )?.decodeText() ?? null
  );
}

function readArrayNumber(
  array: PDFArray,
  index: number,
  pdfObjects: PdfMeasurementObjects,
): number | null {
  return asPdfNumber(array.lookup(index), pdfObjects)?.asNumber() ?? null;
}

function readBBox(
  bboxArray: PDFArray | null,
  pdfObjects: PdfMeasurementObjects,
): ViewportScale["bbox"] {
  if (!bboxArray || bboxArray.size() < 4) {
    return null;
  }

  const x0 = readArrayNumber(bboxArray, 0, pdfObjects);
  const y0 = readArrayNumber(bboxArray, 1, pdfObjects);
  const x1 = readArrayNumber(bboxArray, 2, pdfObjects);
  const y1 = readArrayNumber(bboxArray, 3, pdfObjects);

  if (x0 === null || y0 === null || x1 === null || y1 === null) {
    return null;
  }

  return [x0, y0, x1, y1];
}

function readNumberFormat(
  measureDict: PDFDict,
  key: string,
  pdfObjects: PdfMeasurementObjects,
): { factor: number; unit: string } | null {
  const fmtArray = lookupArray(measureDict, key, pdfObjects);
  if (!fmtArray || fmtArray.size() === 0) return null;

  const firstFmt = asPdfDict(fmtArray.lookup(0), pdfObjects);
  if (!firstFmt) return null;

  const factor = lookupNumber(firstFmt, "C", pdfObjects);
  if (factor === null || factor <= 0) return null;

  const unit = lookupText(firstFmt, "U", pdfObjects)?.trim().toLowerCase();
  return unit ? { factor, unit } : null;
}

function parseScale(
  measureDict: PDFDict | null,
  pdfObjects: PdfMeasurementObjects,
): MeasureScale | null {
  if (!measureDict) return null;

  // Some writers put the scale in /D, others in /X with /D as a plain display
  // format (factor 1); the entry whose factor is not 1 carries the scale.
  const formats = ["D", "X"]
    .map((key) => readNumberFormat(measureDict, key, pdfObjects))
    .filter((format) => format !== null);
  const chosen = formats.find((format) => format.factor !== 1) ?? formats[0];
  if (!chosen) return null;

  const baseFactor = getUnitFactor(chosen.unit);
  if (!baseFactor) return null;

  const ratio = chosen.factor / baseFactor;
  return { factor: chosen.factor, ratio, unit: chosen.unit };
}

export async function extractPageMeasureScales(
  file: Blob,
): Promise<PageMeasureScales | null> {
  try {
    const pdfLib = await import("@cantoo/pdf-lib");
    const { PDFDocument, PDFArray, PDFDict, PDFName } = pdfLib;
    const pdfDoc = await PDFDocument.load(await getDocumentBytes(file), {
      ignoreEncryption: true,
    });

    const result: PageMeasureScales = new Map();

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      const page = pdfDoc.getPage(i);
      const pageHeight = page.getHeight();
      const viewports: ViewportScale[] = [];

      const vpObj = page.node.lookup(PDFName.of("VP"));
      if (vpObj instanceof PDFArray) {
        for (let j = 0; j < vpObj.size(); j++) {
          const vpEntry = vpObj.lookup(j);
          if (!(vpEntry instanceof PDFDict)) continue;

          const scale = parseScale(
            lookupDict(vpEntry, "Measure", pdfLib),
            pdfLib,
          );
          if (!scale) continue;

          viewports.push({
            bbox: readBBox(lookupArray(vpEntry, "BBox", pdfLib), pdfLib),
            scale,
          });
        }
      }

      if (viewports.length === 0) {
        const scale = parseScale(
          lookupDict(page.node, "Measure", pdfLib),
          pdfLib,
        );
        if (scale) {
          viewports.push({ bbox: null, scale });
        }
      }

      if (viewports.length > 0) {
        result.set(i, { viewports, pageHeight } satisfies PageScaleInfo);
      }
    }

    return result.size > 0 ? result : null;
  } catch (error) {
    console.warn("[Measurement] Failed to extract PDF scales", error);
    return null;
  }
}
