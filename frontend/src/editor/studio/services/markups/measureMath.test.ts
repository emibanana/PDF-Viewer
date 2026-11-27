import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import {
  PAPER_SCALE,
  computeMeasurement,
  convertLength,
  defaultExtent,
  formatNumber,
  formatPrimary,
  formatQuantity,
  angleAt,
  polygonArea,
  polygonPerimeter,
  polylineLength,
  primaryValue,
  sampleCatmullRom,
} from "./measureMath";

// Metres of real distance per PDF point at 1:100.
const oneToHundredMetres = { factor: (0.0254 / 72) * 100, ratio: 100, unit: "m" };

const square = (side: number) => [
  { x: 0, y: 0 },
  { x: side, y: 0 },
  { x: side, y: side },
  { x: 0, y: side },
];

describe("polylength and polygon geometry", () => {
  it("adds the segments of an open path", () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 10 },
      ]),
    ).toBe(11);
  });

  it("takes the area by the shoelace formula, whichever way the polygon winds", () => {
    expect(polygonArea(square(10))).toBe(100);
    expect(polygonArea([...square(10)].reverse())).toBe(100);
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 3 },
      ]),
    ).toBe(6);
  });

  it("closes the outline for the perimeter", () => {
    expect(polygonPerimeter(square(10))).toBe(40);
  });

  it("gives no area to fewer than three points", () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ]),
    ).toBe(0);
  });
});

describe("sampleCatmullRom", () => {
  const controls = [
    { x: 0, y: 0 },
    { x: 50, y: 40 },
    { x: 100, y: 0 },
    { x: 150, y: 40 },
  ];

  it("passes through every clicked point", () => {
    const sampled = sampleCatmullRom(controls);
    for (const control of controls) {
      expect(sampled.some((p) => Math.hypot(p.x - control.x, p.y - control.y) < 1e-9)).toBe(true);
    }
    expect(sampled[0]).toEqual(controls[0]);
    expect(sampled[sampled.length - 1]).toEqual(controls[3]);
  });

  it("is dense enough to draw as a curve", () => {
    expect(sampleCatmullRom(controls).length).toBeGreaterThan(controls.length * 8);
  });

  it("follows an arc through points on it, to within a percent of its length", () => {
    const arc = [0, 30, 60, 90].map((degrees) => ({
      x: 100 * Math.cos((degrees * Math.PI) / 180),
      y: 100 * Math.sin((degrees * Math.PI) / 180),
    }));
    const length = polylineLength(sampleCatmullRom(arc));
    const exact = (Math.PI / 2) * 100;
    expect(Math.abs(length - exact) / exact).toBeLessThan(0.01);
    expect(length).toBeGreaterThan(polylineLength(arc));
  });

  it("keeps collinear points on their line with the straight length", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 90, y: 0 },
    ];
    const sampled = sampleCatmullRom(line);
    expect(sampled.every((p) => Math.abs(p.y) < 1e-9)).toBe(true);
    expect(polylineLength(sampled)).toBeCloseTo(90, 6);
  });

  it("returns two points unchanged", () => {
    const two = [
      { x: 1, y: 1 },
      { x: 9, y: 9 },
    ];
    expect(sampleCatmullRom(two)).toEqual(two);
  });
});

describe("formatting", () => {
  it("writes the value and the unit the way a measurement comment reads", () => {
    expect(formatQuantity(15.6666, "m", "length")).toBe("15.67 m");
    expect(formatQuantity(13.783, "m", "area")).toBe("13.78 sq m");
    expect(formatQuantity(0.456, "m", "volume")).toBe("0.46 cu m");
    expect(formatQuantity(12, "ft", "area", 0)).toBe("12 sq ft");
  });

  it("never prints a negative zero", () => {
    expect(formatNumber(-0.0001)).toBe("0.00");
  });
});

describe("unit conversion", () => {
  it("converts between supported units", () => {
    expect(convertLength(1, "m", "cm")).toBeCloseTo(100, 9);
    expect(convertLength(1, "ft", "in")).toBeCloseTo(12, 9);
    expect(convertLength(1, "m", "parsec")).toBeNull();
  });
});

function annotation(over: Record<string, unknown>) {
  return { type: PdfAnnotationSubtype.POLYLINE, ...over } as Parameters<typeof computeMeasurement>[0];
}

const inchLine = {
  type: PdfAnnotationSubtype.LINE,
  custom: { markup: { v: 1, kind: "length" } },
  linePoints: { start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
};

describe("computeMeasurement", () => {
  it("scales a line by the page scale", () => {
    // 72 pt is one inch of paper, 25.4 mm, which is 2.54 m at 1:100.
    expect(computeMeasurement(annotation(inchLine), oneToHundredMetres)?.length).toBeCloseTo(2.54, 9);
  });

  it("measures in paper millimetres when the page has no scale", () => {
    const measurement = computeMeasurement(annotation(inchLine), null);
    expect(measurement).toMatchObject({ unit: PAPER_SCALE.unit, scaled: false });
    expect(measurement?.length).toBeCloseTo(25.4, 9);
  });

  it("reports area and perimeter of a polygon, squaring the factor for the area", () => {
    const polygon = annotation({
      type: PdfAnnotationSubtype.POLYGON,
      custom: { markup: { v: 1, kind: "area" } },
      vertices: square(72),
    });
    const measurement = computeMeasurement(polygon, oneToHundredMetres);
    expect(measurement?.area).toBeCloseTo(2.54 * 2.54, 9);
    expect(measurement?.perimeter).toBeCloseTo(4 * 2.54, 9);
  });

  it("multiplies a wall's length by its height", () => {
    const wall = annotation({
      custom: { markup: { v: 1, kind: "wall", height: 3 } },
      vertices: [
        { x: 0, y: 0 },
        { x: 72, y: 0 },
      ],
    });
    const measurement = computeMeasurement(wall, oneToHundredMetres);
    expect(measurement?.height).toBe(3);
    expect(measurement?.wallArea).toBeCloseTo(2.54 * 3, 9);
    expect(formatPrimary(measurement!)).toBe("7.62 sq m");
  });

  it("multiplies a volume's area by its depth", () => {
    const slab = annotation({
      type: PdfAnnotationSubtype.POLYGON,
      custom: { markup: { v: 1, kind: "volume", depth: 0.1 } },
      vertices: square(72),
    });
    const measurement = computeMeasurement(slab, oneToHundredMetres);
    expect(measurement?.volume).toBeCloseTo(2.54 * 2.54 * 0.1, 9);
    expect(primaryValue(measurement!)?.quantity).toBe("volume");
    expect(formatPrimary(measurement!)).toBe("0.65 cu m");
  });

  it("falls back to the length while a wall has no height", () => {
    const wall = annotation({
      custom: { markup: { v: 1, kind: "wall" } },
      vertices: [
        { x: 0, y: 0 },
        { x: 72, y: 0 },
      ],
    });
    expect(formatPrimary(computeMeasurement(wall, oneToHundredMetres)!)).toBe("2.54 m");
  });

  it("measures a plain dimension annotation from another program by its intent", () => {
    const line = annotation({
      type: PdfAnnotationSubtype.LINE,
      intent: "LineDimension",
      linePoints: { start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
    });
    expect(computeMeasurement(line, oneToHundredMetres)?.kind).toBe("length");
  });

  it("is null for an annotation that is not a measurement, or has too few points", () => {
    const plain = annotation({
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
    expect(computeMeasurement(plain, null)).toBeNull();
    const twoPointArea = annotation({
      type: PdfAnnotationSubtype.POLYGON,
      custom: { markup: { v: 1, kind: "area" } },
      vertices: square(1).slice(0, 2),
    });
    expect(computeMeasurement(twoPointArea, null)).toBeNull();
  });
});

describe("defaultExtent", () => {
  it("gives a wall height and slab depth in the scale's own unit", () => {
    expect(defaultExtent("m")).toEqual({ height: 3, depth: 0.1 });
    expect(defaultExtent("ft").height).toBe(10);
  });
});

describe("angle and count", () => {
  it("measures the angle at the middle point in degrees", () => {
    expect(angleAt({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(90);
    expect(angleAt({ x: 10, y: 0 }, { x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(180);
    expect(angleAt({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 5, y: 5 })).toBe(0);
  });

  it("writes an angle to /Contents with one decimal and needs three points", () => {
    const points = [
      { x: 10, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ];
    const angle = computeMeasurement({ type: PdfAnnotationSubtype.POLYLINE, intent: "PolyLineAngle", vertices: points }, null);
    expect(angle && formatPrimary(angle)).toBe("45.0°");
    expect(computeMeasurement({ type: PdfAnnotationSubtype.POLYLINE, intent: "PolyLineAngle", vertices: points.slice(0, 2) }, null)).toBeNull();
  });

  it("leaves a count's /Contents alone", () => {
    const count = computeMeasurement({ type: PdfAnnotationSubtype.POLYGON, intent: "PolygonCount", vertices: square(2) }, null);
    expect(count && formatPrimary(count)).toBeNull();
  });
});
