import type { MeasureScale } from "@editor/utils/measurementTypes";
import { POINT_TO_UNIT, getUnitFactor } from "@editor/utils/measurementUtils";
import {
  isClosedKind,
  markupKindOf,
  readMarkupCustom,
  type MarkupAnnotation,
  type MarkupKind,
  type MarkupPoint,
} from "@editor/services/markups/markupModel";

export const DEFAULT_PRECISION = 2;

/** Decimal places of an angle; the page scale's precision is for lengths. Bluebeam writes `55.7°`. */
const ANGLE_PRECISION = 1;

/** What a page with no scale set measures in: millimetres on the paper. */
export const PAPER_SCALE: MeasureScale = { factor: POINT_TO_UNIT.mm, ratio: 1, unit: "mm" };

export type Quantity = "length" | "area" | "volume" | "angle";

export function distance(a: MarkupPoint, b: MarkupPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polylineLength(points: readonly MarkupPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** Closed outline: the last point joins back to the first. */
export function polygonPerimeter(points: readonly MarkupPoint[]): number {
  if (points.length < 2) return 0;
  return polylineLength(points) + distance(points[points.length - 1], points[0]);
}

/** Shoelace formula; the sign of the winding is dropped. Fewer than three points enclose nothing. */
export function polygonArea(points: readonly MarkupPoint[]): number {
  if (points.length < 3) return 0;
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

export interface CurveSampling {
  /** Longest chord, in page units, between two sampled points on a span. */
  maxStep?: number;
  minSegmentsPerSpan?: number;
  maxSegmentsPerSpan?: number;
}

export interface SampledCurve {
  points: MarkupPoint[];
  /** Index in `points` of each input point, in order: the vertices an editor should offer as handles. */
  controlIndices: number[];
}

/**
 * Samples a Catmull-Rom spline through `points`, which it passes through exactly. The first and
 * last spans use a reflected phantom neighbour, so the curve leaves the ends without a kink.
 * Fewer than three points are returned as they are: two points are already a straight line.
 * The sampling depends on the chord lengths, so moving one input point can change how many
 * samples every span gets.
 */
export function sampleCatmullRomIndexed(points: readonly MarkupPoint[], options: CurveSampling = {}): SampledCurve {
  const { maxStep = 4, minSegmentsPerSpan = 4, maxSegmentsPerSpan = 64 } = options;
  if (points.length < 3) {
    return { points: points.map(({ x, y }) => ({ x, y })), controlIndices: points.map((_, index) => index) };
  }
  const first = points[0];
  const second = points[1];
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  const padded = [
    { x: 2 * first.x - second.x, y: 2 * first.y - second.y },
    ...points,
    { x: 2 * last.x - beforeLast.x, y: 2 * last.y - beforeLast.y },
  ];
  const result: MarkupPoint[] = [{ x: first.x, y: first.y }];
  const controlIndices = [0];
  for (let i = 1; i < padded.length - 2; i++) {
    const [p0, p1, p2, p3] = [padded[i - 1], padded[i], padded[i + 1], padded[i + 2]];
    const chord = distance(p1, p2);
    const segments = Math.min(maxSegmentsPerSpan, Math.max(minSegmentsPerSpan, Math.ceil(chord / maxStep)));
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      result.push({ x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) });
    }
    result.push({ x: p2.x, y: p2.y });
    controlIndices.push(result.length - 1);
  }
  return { points: result, controlIndices };
}

export function sampleCatmullRom(points: readonly MarkupPoint[], options: CurveSampling = {}): MarkupPoint[] {
  return sampleCatmullRomIndexed(points, options).points;
}

export function effectiveScale(scale: MeasureScale | null | undefined): MeasureScale {
  return scale ?? PAPER_SCALE;
}

/** "m", "sq m" or "cu m". */
export function unitLabel(unit: string, quantity: Quantity): string {
  if (quantity === "area") return `sq ${unit}`;
  if (quantity === "volume") return `cu ${unit}`;
  if (quantity === "angle") return "°";
  return unit;
}

export function formatNumber(value: number, precision = DEFAULT_PRECISION): string {
  const text = value.toFixed(Math.max(0, Math.min(8, precision)));
  return /^-0(\.0+)?$/.test(text) ? text.slice(1) : text;
}

/** For example `15.67 m`, `13.78 sq m`, `0.46 cu m`. */
export function formatQuantity(value: number, unit: string, quantity: Quantity, precision = DEFAULT_PRECISION): string {
  if (quantity === "angle") return `${formatNumber(value, precision)}°`;
  return `${formatNumber(value, precision)} ${unitLabel(unit, quantity)}`;
}

/** Wall height and slab depth a new markup starts with, in the page scale's unit. */
export function defaultExtent(unit: string): { height: number; depth: number } {
  switch (unit.toLowerCase()) {
    case "m":
      return { height: 3, depth: 0.1 };
    case "cm":
      return { height: 300, depth: 10 };
    case "mm":
      return { height: 3000, depth: 100 };
    case "km":
      return { height: 0.003, depth: 0.0001 };
    default:
      return { height: 1, depth: 1 };
  }
}

/** Measured values in real-world units of `unit` (areas in its square, volumes in its cube). */
export interface Measurement {
  kind: MarkupKind;
  unit: string;
  /** False when the page has no scale and the values are paper millimetres. */
  scaled: boolean;
  length?: number;
  perimeter?: number;
  area?: number;
  height?: number;
  depth?: number;
  wallArea?: number;
  volume?: number;
  /** Degrees, 0 to 180, at the middle of the three points. */
  angle?: number;
}

/** The angle at `vertex` between the rays to `a` and `b`, in degrees from 0 to 180. */
export function angleAt(a: MarkupPoint, vertex: MarkupPoint, b: MarkupPoint): number {
  const first = { x: a.x - vertex.x, y: a.y - vertex.y };
  const second = { x: b.x - vertex.x, y: b.y - vertex.y };
  const lengths = Math.hypot(first.x, first.y) * Math.hypot(second.x, second.y);
  if (lengths === 0) return 0;
  const cosine = (first.x * second.x + first.y * second.y) / lengths;
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

function geometryOf(annotation: MarkupAnnotation, kind: MarkupKind): MarkupPoint[] {
  if (kind === "length") {
    if (annotation.linePoints) return [annotation.linePoints.start, annotation.linePoints.end];
    return annotation.vertices?.slice(0, 2) ?? [];
  }
  return annotation.vertices ?? [];
}

/**
 * The measured values of a measurement annotation on a page with `scale` (null: not set).
 * Derived on every call and never stored; null when the annotation is not a measurement or
 * has too few points.
 */
export function computeMeasurement(annotation: MarkupAnnotation, scale: MeasureScale | null): Measurement | null {
  const kind = markupKindOf(annotation);
  if (!kind) return null;
  const points = geometryOf(annotation, kind);
  if (kind === "count") return { kind, unit: effectiveScale(scale).unit, scaled: scale !== null };
  if (kind === "angle") {
    if (points.length < 3) return null;
    return { kind, unit: effectiveScale(scale).unit, scaled: scale !== null, angle: angleAt(points[0], points[1], points[2]) };
  }
  if (points.length < (isClosedKind(kind) ? 3 : 2)) return null;
  const { factor, unit } = effectiveScale(scale);
  const custom = readMarkupCustom(annotation.custom);
  const measurement: Measurement = { kind, unit, scaled: scale !== null };
  if (isClosedKind(kind)) {
    measurement.area = polygonArea(points) * factor * factor;
    measurement.perimeter = polygonPerimeter(points) * factor;
    if (kind === "volume" && custom?.depth !== undefined) {
      measurement.depth = custom.depth;
      measurement.volume = measurement.area * custom.depth;
    }
    return measurement;
  }
  measurement.length = polylineLength(points) * factor;
  if (kind === "wall" && custom?.height !== undefined) {
    measurement.height = custom.height;
    measurement.wallArea = measurement.length * custom.height;
  }
  return measurement;
}

/** The headline value of a measurement and what it is a quantity of. */
export function primaryValue(measurement: Measurement): { value: number; quantity: Quantity } | null {
  switch (measurement.kind) {
    case "length":
    case "polylength":
    case "curve":
      return measurement.length === undefined ? null : { value: measurement.length, quantity: "length" };
    case "area":
      return measurement.area === undefined ? null : { value: measurement.area, quantity: "area" };
    case "wall":
      if (measurement.wallArea !== undefined) return { value: measurement.wallArea, quantity: "area" };
      return measurement.length === undefined ? null : { value: measurement.length, quantity: "length" };
    case "angle":
      return measurement.angle === undefined ? null : { value: measurement.angle, quantity: "angle" };
    case "count":
      return null;
    case "volume":
      if (measurement.volume !== undefined) return { value: measurement.volume, quantity: "volume" };
      return measurement.area === undefined ? null : { value: measurement.area, quantity: "area" };
  }
}

/** The text written to an annotation's `/Contents`, or null when there is no value to show. */
export function formatPrimary(measurement: Measurement, precision = DEFAULT_PRECISION): string | null {
  const primary = primaryValue(measurement);
  if (primary?.quantity === "angle") return formatQuantity(primary.value, measurement.unit, "angle", ANGLE_PRECISION);
  return primary ? formatQuantity(primary.value, measurement.unit, primary.quantity, precision) : null;
}

/** Real-world distance of `pdfPoints` in `scale`, in the scale's unit. */
export function toRealLength(pdfPoints: number, scale: MeasureScale | null): number {
  return pdfPoints * effectiveScale(scale).factor;
}

/** Converts a length between two supported units; null for an unknown unit. */
export function convertLength(value: number, from: string, to: string): number | null {
  const source = getUnitFactor(from);
  const target = getUnitFactor(to);
  if (!source || !target) return null;
  return value * (target / source);
}
