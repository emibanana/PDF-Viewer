import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import { labelAnchor, pointAlongPath, polygonCentroid, readableTextColor } from "./labelPlacement";

describe("pointAlongPath", () => {
  it("finds the middle of a bent path by length", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 30 },
    ];
    expect(pointAlongPath(path, 0.5)).toEqual({ x: 10, y: 10 });
  });

  it("handles degenerate paths", () => {
    expect(pointAlongPath([], 0.5)).toBeNull();
    expect(pointAlongPath([{ x: 3, y: 4 }], 0.5)).toEqual({ x: 3, y: 4 });
    expect(
      pointAlongPath(
        [
          { x: 3, y: 4 },
          { x: 3, y: 4 },
        ],
        0.5,
      ),
    ).toEqual({ x: 3, y: 4 });
  });
});

describe("polygonCentroid", () => {
  it("is the centre of a rectangle whichever way it is wound", () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polygonCentroid(rect)).toEqual({ x: 10, y: 5 });
    expect(polygonCentroid([...rect].reverse())).toEqual({ x: 10, y: 5 });
  });

  it("falls back to the mean of the corners for a flat polygon", () => {
    expect(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });
});

describe("labelAnchor", () => {
  it("anchors a length on the middle of its line", () => {
    expect(
      labelAnchor({ type: PdfAnnotationSubtype.LINE, linePoints: { start: { x: 0, y: 0 }, end: { x: 10, y: 20 } } }, "length"),
    ).toEqual({ x: 5, y: 10 });
  });

  it("anchors an area on its centroid", () => {
    expect(
      labelAnchor(
        {
          type: PdfAnnotationSubtype.POLYGON,
          vertices: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
          ],
        },
        "area",
      ),
    ).toEqual({ x: 2, y: 2 });
  });
});

describe("readableTextColor", () => {
  it("picks dark text on light colours and light text on dark ones", () => {
    expect(readableTextColor("#ffff00")).toBe("#111");
    expect(readableTextColor("#e53935")).toBe("#fff");
    expect(readableTextColor("#000")).toBe("#fff");
    expect(readableTextColor("#fff")).toBe("#111");
  });

  it("defaults to white for something it cannot read", () => {
    expect(readableTextColor(undefined)).toBe("#fff");
    expect(readableTextColor("red")).toBe("#fff");
  });
});
