import { describe, expect, it, vi } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFString } from "@cantoo/pdf-lib";
import { extractPageMeasureScales } from "../../../core/utils/pdfMeasurementExtraction";
import { ensureMeasureDictionaries, type PageScaleToWrite } from "./measureDictionaries";

const scale: PageScaleToWrite = {
  scale: { factor: (0.0254 / 72) * 100, ratio: 100, unit: "m" },
  precision: 2,
};

interface AnnotSpec {
  subtype: string;
  kind?: string;
}

async function makeMarkedPdf(pages: AnnotSpec[][], tweak?: (doc: PDFDocument) => void): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const specs of pages) {
    const page = doc.addPage([300, 400]);
    const refs = specs.map(({ subtype, kind }) =>
      doc.context.register(
        doc.context.obj({
          Type: "Annot",
          Subtype: subtype,
          Rect: [10, 10, 100, 100],
          ...(kind ? { EPDFCustom: PDFString.of(JSON.stringify({ markup: { v: 1, kind } })) } : {}),
        }),
      ),
    );
    if (refs.length > 0) page.node.set(PDFName.of("Annots"), doc.context.obj(refs));
  }
  tweak?.(doc);
  return doc.save();
}

async function annotOf(bytes: Uint8Array, pageIndex: number, index = 0): Promise<PDFDict> {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPage(pageIndex).node.lookup(PDFName.of("Annots"), PDFArray);
  return annots.lookup(index, PDFDict);
}

const text = (dict: PDFDict, key: string) => (dict.lookup(PDFName.of(key)) as PDFString).decodeText();
const num = (dict: PDFDict, key: string) => (dict.lookup(PDFName.of(key)) as PDFNumber).asNumber();

describe("ensureMeasureDictionaries", () => {
  it("returns the same bytes when there are no markups and no scales", async () => {
    const bytes = await makeMarkedPdf([[{ subtype: "Square" }]]);
    expect(await ensureMeasureDictionaries(bytes, new Map())).toBe(bytes);
  });

  it("writes /IT, /Measure on the markup and /VP on the page whose scale was set", async () => {
    const bytes = await makeMarkedPdf([[{ subtype: "Line", kind: "length" }]]);
    const saved = await ensureMeasureDictionaries(bytes, new Map([[0, scale]]));

    const annot = await annotOf(saved, 0);
    expect(annot.lookup(PDFName.of("IT"))).toBe(PDFName.of("LineDimension"));
    const measure = annot.lookup(PDFName.of("Measure"), PDFDict);
    expect(measure.lookup(PDFName.of("Subtype"))).toBe(PDFName.of("RL"));
    expect(text(measure, "R")).toBe("1:100");
    const x = measure.lookup(PDFName.of("X"), PDFArray).lookup(0, PDFDict);
    expect(text(x, "U")).toBe("m");
    expect(num(x, "C")).toBeCloseTo(scale.scale.factor, 12);
    expect(num(x, "D")).toBe(100);
    const area = measure.lookup(PDFName.of("A"), PDFArray).lookup(0, PDFDict);
    expect(text(area, "U")).toBe("sq m");

    const doc = await PDFDocument.load(saved);
    const viewports = doc.getPage(0).node.lookup(PDFName.of("VP"), PDFArray);
    expect(viewports.size()).toBe(1);
    const viewport = viewports.lookup(0, PDFDict);
    expect(viewport.lookup(PDFName.of("Type"))).toBe(PDFName.of("Viewport"));
    expect(
      viewport
        .lookup(PDFName.of("BBox"), PDFArray)
        .asArray()
        .map((n) => (n as PDFNumber).asNumber()),
    ).toEqual([0, 0, 300, 400]);
    expect(String(viewport.get(PDFName.of("Measure")))).toBe(String(annot.get(PDFName.of("Measure"))));
  });

  it("writes a /VP our own reader reads back as the same scale", async () => {
    const bytes = await makeMarkedPdf([[], [{ subtype: "Line", kind: "length" }]]);
    const saved = await ensureMeasureDictionaries(bytes, new Map([[1, scale]]));
    const read = await extractPageMeasureScales(new Blob([saved as BlobPart], { type: "application/pdf" }));
    expect(read?.has(0)).toBe(false);
    const viewport = read?.get(1)?.viewports[0];
    expect(viewport?.scale.unit).toBe("m");
    expect(viewport?.scale.factor).toBeCloseTo(scale.scale.factor, 12);
    expect(viewport?.scale.ratio).toBeCloseTo(100, 6);
  });

  it("sets /IT with the intent of each kind, and only where the subtype fits", async () => {
    const bytes = await makeMarkedPdf([
      [
        { subtype: "PolyLine", kind: "curve" },
        { subtype: "Polygon", kind: "volume" },
        { subtype: "Square", kind: "length" },
        { subtype: "Highlight" },
      ],
    ]);
    const saved = await ensureMeasureDictionaries(bytes, new Map());
    expect((await annotOf(saved, 0, 0)).lookup(PDFName.of("IT"))).toBe(PDFName.of("PolyLineDimension"));
    expect((await annotOf(saved, 0, 1)).lookup(PDFName.of("IT"))).toBe(PDFName.of("PolygonDimension"));
    expect((await annotOf(saved, 0, 2)).has(PDFName.of("IT"))).toBe(false);
    expect((await annotOf(saved, 0, 3)).has(PDFName.of("IT"))).toBe(false);
    expect((await annotOf(saved, 0, 0)).has(PDFName.of("Measure"))).toBe(false);
  });

  it("leaves a page the user did not touch with the /VP it came with, and points its markups at it", async () => {
    const bytes = await makeMarkedPdf([[{ subtype: "Line", kind: "length" }]], (doc) => {
      const { context } = doc;
      const measure = context.register(
        context.obj({
          Type: "Measure",
          Subtype: "RL",
          X: [{ Type: "NumberFormat", U: PDFString.of("ft"), C: 0.0833, F: "D", D: 100 }],
        }),
      );
      const viewport = context.obj({ Type: "Viewport", BBox: [0, 0, 300, 400], Measure: measure });
      doc.getPage(0).node.set(PDFName.of("VP"), context.obj([viewport]));
    });
    const saved = await ensureMeasureDictionaries(bytes, new Map());
    const annot = await annotOf(saved, 0);
    const measure = annot.lookup(PDFName.of("Measure"), PDFDict);
    expect(text(measure.lookup(PDFName.of("X"), PDFArray).lookup(0, PDFDict), "U")).toBe("ft");
    const read = await extractPageMeasureScales(new Blob([saved as BlobPart], { type: "application/pdf" }));
    expect(read?.get(0)?.viewports[0].scale.unit).toBe("ft");
  });

  it("replaces a whole-page viewport but keeps a region viewport", async () => {
    const bytes = await makeMarkedPdf([[]], (doc) => {
      const { context } = doc;
      const fmt = (unit: string, c: number) => ({
        Type: "NumberFormat",
        U: PDFString.of(unit),
        C: c,
        F: "D",
        D: 100,
      });
      const old = context.obj({
        Type: "Viewport",
        BBox: [0, 0, 300, 400],
        Measure: { Type: "Measure", Subtype: "RL", D: [fmt("ft", 0.0833)] },
      });
      const region = context.obj({
        Type: "Viewport",
        BBox: [0, 0, 50, 50],
        Measure: { Type: "Measure", Subtype: "RL", D: [fmt("cm", 0.5)] },
      });
      doc.getPage(0).node.set(PDFName.of("VP"), context.obj([old, region]));
    });
    const saved = await ensureMeasureDictionaries(bytes, new Map([[0, scale]]));
    const read = await extractPageMeasureScales(new Blob([saved as BlobPart], { type: "application/pdf" }));
    const units = read?.get(0)?.viewports.map((viewport) => viewport.scale.unit);
    expect(units).toEqual(["m", "cm"]);
  });

  it("returns the original bytes for a file it cannot read", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const junk = new TextEncoder().encode("EPDFCustom is not a pdf");
    expect(await ensureMeasureDictionaries(junk, new Map())).toBe(junk);
  });

  it("writes Bluebeam's measurement types, and counts totalled per page and subject", async () => {
    const bytes = await makeMarkedPdf([
      [
        { subtype: "Polygon", kind: "count" },
        { subtype: "Polygon", kind: "count" },
        { subtype: "PolyLine", kind: "angle" },
        { subtype: "Line", kind: "length" },
        { subtype: "Polygon", kind: "area" },
      ],
    ]);
    const saved = await ensureMeasureDictionaries(bytes, new Map([[0, scale]]));

    const count = await annotOf(saved, 0, 0);
    expect(count.lookup(PDFName.of("IT"))).toBe(PDFName.of("PolygonCount"));
    expect(count.lookup(PDFName.of("CountStyle"))).toBe(PDFName.of("Checkmark"));
    expect(num(count, "MeasurementTypes")).toBe(128);
    expect(num(count, "NumCounts")).toBe(2);
    expect(text(count, "Contents")).toBe("2");
    expect(count.lookup(PDFName.of("BBMeasure"))).toBeInstanceOf(PDFDict);
    expect(count.lookup(PDFName.of("Measure"))).toBeUndefined();

    const angle = await annotOf(saved, 0, 2);
    expect(angle.lookup(PDFName.of("IT"))).toBe(PDFName.of("PolyLineAngle"));
    expect(num(angle, "MeasurementTypes")).toBe(1152);
    expect(num(await annotOf(saved, 0, 3), "MeasurementTypes")).toBe(130);
    expect(num(await annotOf(saved, 0, 4), "MeasurementTypes")).toBe(129);
  });
});
