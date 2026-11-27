import { afterEach, describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { extractPageMeasureScales } from "../../core/utils/pdfMeasurementExtraction";
import { finishViewerExport, pageScalesToWrite } from "./viewerExportFinish";
import { resetPageScalesForTests, seedPageScales, setActiveFileKey, setPageScale } from "./markups/pageScaleStore";
import { bindMarkupController } from "./markups/markupController";

const SCALE = { factor: (0.0254 / 72) * 100, ratio: 100, unit: "m" };

async function plainPdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  doc.addPage([300, 400]);
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

afterEach(() => {
  resetPageScalesForTests();
  bindMarkupController(null);
});

describe("pageScalesToWrite", () => {
  it("returns only scales set in the app", () => {
    setPageScale("file-1", 0, SCALE, 3);
    seedPageScales("file-1", new Map([[1, { viewports: [{ bbox: null, scale: SCALE }] } as never]]));
    expect([...pageScalesToWrite("file-1").keys()]).toEqual([0]);
    expect(pageScalesToWrite("file-1").get(0)?.precision).toBe(3);
    expect(pageScalesToWrite(null).size).toBe(0);
  });
});

describe("finishViewerExport", () => {
  it("hands back the same buffer when the document has no scale and no markup of ours", async () => {
    setActiveFileKey("file-1");
    const bytes = await plainPdf();
    expect(await finishViewerExport(bytes)).toBe(bytes);
  });

  it("writes the page scales the user set into the exported bytes so a reload reads them back", async () => {
    setActiveFileKey("file-1");
    setPageScale("file-1", 1, SCALE, 2);
    const exported = await finishViewerExport(await plainPdf());
    const scales = await extractPageMeasureScales(new Blob([exported]));
    expect(scales?.get(0)).toBeUndefined();
    const read = scales?.get(1)?.viewports[0].scale;
    expect(read?.unit).toBe("m");
    expect(read?.ratio).toBeCloseTo(100, 3);
  });
});
