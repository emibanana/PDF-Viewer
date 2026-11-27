import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { MEASURE_TOOL_SPECS, isMeasureToolId, markupKindOf, mergeMarkupCustom, readMarkupCustom } from "./markupModel";

describe("tool specs", () => {
  it("maps the tools to the subtypes and intents of the plan", () => {
    expect(MEASURE_TOOL_SPECS.map(({ id, subtype, intent }) => [id, subtype, intent])).toEqual([
      ["measureLength", PdfAnnotationSubtype.LINE, "LineDimension"],
      ["measurePolylength", PdfAnnotationSubtype.POLYLINE, "PolyLineDimension"],
      ["measureCurve", PdfAnnotationSubtype.POLYLINE, "PolyLineDimension"],
      ["measureArea", PdfAnnotationSubtype.POLYGON, "PolygonDimension"],
      ["measureWall", PdfAnnotationSubtype.POLYLINE, "PolyLineDimension"],
      ["measureVolume", PdfAnnotationSubtype.POLYGON, "PolygonDimension"],
      ["measureAngle", PdfAnnotationSubtype.POLYLINE, "PolyLineAngle"],
      ["measureCount", PdfAnnotationSubtype.POLYGON, "PolygonCount"],
    ]);
    expect(isMeasureToolId("measureWall")).toBe(true);
    expect(isMeasureToolId("polyline")).toBe(false);
  });
});

describe("markupKindOf for Bluebeam intents", () => {
  it("recognises angles and counts by /IT and subtype", () => {
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYLINE, intent: "PolyLineAngle" })).toBe("angle");
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYGON, intent: "PolygonCount" })).toBe("count");
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYGON, intent: "PolyLineAngle" })).toBeNull();
  });
});

describe("readMarkupCustom", () => {
  it("reads valid fields and drops invalid ones", () => {
    expect(
      readMarkupCustom({
        markup: { v: 1, kind: "wall", height: 3, depth: -2, label: "W1", status: 5, controlPoints: [{ x: 1, y: 2 }] },
      }),
    ).toEqual({ v: 1, kind: "wall", height: 3, label: "W1", controlPoints: [{ x: 1, y: 2 }] });
  });

  it("rejects anything that is not one of our markups", () => {
    expect(readMarkupCustom(undefined)).toBeNull();
    expect(readMarkupCustom({ other: 1 })).toBeNull();
    expect(readMarkupCustom({ markup: { kind: "spiral" } })).toBeNull();
    expect(readMarkupCustom({ markup: { kind: "length", controlPoints: [{ x: "a" }] } })).toEqual({
      v: 1,
      kind: "length",
    });
  });
});

describe("mergeMarkupCustom", () => {
  it("keeps other keys and drops a field set to undefined", () => {
    const merged = mergeMarkupCustom(
      { toolId: "x", markup: { v: 1, kind: "curve", controlPoints: [{ x: 0, y: 0 }] } },
      { controlPoints: undefined, label: "A" },
    );
    expect(merged).toEqual({ toolId: "x", markup: { v: 1, kind: "curve", label: "A" } });
  });
});

describe("markupKindOf", () => {
  it("prefers our own kind and otherwise infers it from the intent and subtype", () => {
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYLINE, custom: { markup: { v: 1, kind: "curve" } } })).toBe("curve");
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYGON, intent: "PolygonDimension" })).toBe("area");
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYLINE, intent: "PolyLineDimension" })).toBe("polylength");
    expect(markupKindOf({ type: PdfAnnotationSubtype.POLYLINE, intent: "PolygonDimension" })).toBeNull();
    expect(markupKindOf({ type: PdfAnnotationSubtype.LINE })).toBeNull();
  });
});
