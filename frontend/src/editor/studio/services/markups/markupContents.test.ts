import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { computeMarkupPatch, normalizeMarkupAnnotation } from "./markupContents";
import type { PageScale } from "./pageScaleStore";

const scale: PageScale = {
  scale: { factor: (0.0254 / 72) * 100, ratio: 100, unit: "m" },
  precision: 2,
  source: "user",
};

const line = (extra: Record<string, unknown> = {}) => ({
  type: PdfAnnotationSubtype.LINE,
  custom: { markup: { v: 1, kind: "length" } },
  linePoints: { start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
  ...extra,
});

const unitSquare = [
  { x: 0, y: 0 },
  { x: 72, y: 0 },
  { x: 72, y: 72 },
  { x: 0, y: 72 },
];

describe("computeMarkupPatch", () => {
  it("writes the formatted value into the contents", () => {
    expect(computeMarkupPatch(line(), scale)).toEqual({ contents: "2.54 m" });
  });

  it("uses the page's precision", () => {
    expect(computeMarkupPatch(line(), { ...scale, precision: 0 })).toEqual({ contents: "3 m" });
  });

  it("reports paper units while the page has no scale", () => {
    expect(computeMarkupPatch(line(), null)).toEqual({ contents: "25.40 mm" });
  });

  it("changes nothing once the contents are right", () => {
    expect(computeMarkupPatch(line({ contents: "2.54 m" }), scale)).toBeNull();
  });

  it("leaves a comment the user wrote alone", () => {
    const manual = line({ custom: { markup: { v: 1, kind: "length", manualContents: true } }, contents: "see detail 4" });
    expect(computeMarkupPatch(manual, scale)).toBeNull();
  });

  it("rewrites a foreign measurement's contents only when asked", () => {
    const foreign = {
      type: PdfAnnotationSubtype.LINE,
      intent: "LineDimension",
      contents: "10.58 m",
      linePoints: { start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
    };
    expect(computeMarkupPatch(foreign, scale)).toBeNull();
    expect(computeMarkupPatch(foreign, scale, { rewriteForeignContents: true })).toEqual({ contents: "2.54 m" });
    expect(computeMarkupPatch({ ...foreign, contents: "2.54 m" }, scale, { rewriteForeignContents: true })).toBeNull();
  });

  it("never rewrites an annotation that is not a measurement", () => {
    const highlight = { type: PdfAnnotationSubtype.HIGHLIGHT, contents: "x" };
    expect(computeMarkupPatch(highlight, scale, { rewriteForeignContents: true })).toBeNull();
  });

  it("leaves annotations that are not ours alone", () => {
    const foreign = { type: PdfAnnotationSubtype.LINE, intent: "LineDimension", contents: "x" };
    expect(computeMarkupPatch(foreign, scale)).toBeNull();
  });

  it("defaults a wall's height once the page has a scale, not before", () => {
    const wall = {
      type: PdfAnnotationSubtype.POLYLINE,
      custom: { markup: { v: 1, kind: "wall" } },
      vertices: [
        { x: 0, y: 0 },
        { x: 72, y: 0 },
      ],
    };
    expect(computeMarkupPatch(wall, null)).toEqual({ contents: "25.40 mm" });
    const patch = computeMarkupPatch(wall, scale);
    expect(patch?.custom).toEqual({ markup: { v: 1, kind: "wall", height: 3 } });
    expect(patch?.contents).toBe("7.62 sq m");
  });

  it("defaults a volume's depth", () => {
    const slab = {
      type: PdfAnnotationSubtype.POLYGON,
      custom: { markup: { v: 1, kind: "volume" } },
      vertices: unitSquare,
    };
    expect(computeMarkupPatch(slab, scale)?.custom).toEqual({ markup: { v: 1, kind: "volume", depth: 0.1 } });
  });
});

describe("normalizeMarkupAnnotation", () => {
  it("returns the same object when nothing needs writing", () => {
    const done = line({ contents: "2.54 m" });
    expect(normalizeMarkupAnnotation(done, scale)).toBe(done);
  });
});
