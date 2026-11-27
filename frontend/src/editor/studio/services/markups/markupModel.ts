import { PdfAnnotationSubtype } from "@embedpdf/models";

export const MARKUP_KINDS = ["length", "polylength", "curve", "area", "wall", "volume"] as const;
export type MarkupKind = (typeof MARKUP_KINDS)[number];

export type MeasureToolId =
  | "measureLength"
  | "measurePolylength"
  | "measureCurve"
  | "measureArea"
  | "measureWall"
  | "measureVolume";

export interface MeasureToolSpec {
  id: MeasureToolId;
  kind: MarkupKind;
  subtype: PdfAnnotationSubtype;
  /** `/IT` written to the file, which is how Acrobat and Revu recognise a measurement. */
  intent: "LineDimension" | "PolyLineDimension" | "PolygonDimension";
  /** `/Subj` of a new markup; the Markups List groups by it. */
  subject: string;
}

export const MEASURE_TOOL_SPECS: readonly MeasureToolSpec[] = [
  {
    id: "measureLength",
    kind: "length",
    subtype: PdfAnnotationSubtype.LINE,
    intent: "LineDimension",
    subject: "Length",
  },
  {
    id: "measurePolylength",
    kind: "polylength",
    subtype: PdfAnnotationSubtype.POLYLINE,
    intent: "PolyLineDimension",
    subject: "Polylength",
  },
  {
    id: "measureCurve",
    kind: "curve",
    subtype: PdfAnnotationSubtype.POLYLINE,
    intent: "PolyLineDimension",
    subject: "Curve",
  },
  {
    id: "measureArea",
    kind: "area",
    subtype: PdfAnnotationSubtype.POLYGON,
    intent: "PolygonDimension",
    subject: "Area",
  },
  {
    id: "measureWall",
    kind: "wall",
    subtype: PdfAnnotationSubtype.POLYLINE,
    intent: "PolyLineDimension",
    subject: "Wall",
  },
  {
    id: "measureVolume",
    kind: "volume",
    subtype: PdfAnnotationSubtype.POLYGON,
    intent: "PolygonDimension",
    subject: "Volume",
  },
];

export function measureSpecForKind(kind: MarkupKind): MeasureToolSpec {
  return MEASURE_TOOL_SPECS.find((spec) => spec.kind === kind) as MeasureToolSpec;
}

export function measureSpecForToolId(id: string): MeasureToolSpec | undefined {
  return MEASURE_TOOL_SPECS.find((spec) => spec.id === id);
}

export function isMeasureToolId(id: string | null | undefined): id is MeasureToolId {
  return !!id && MEASURE_TOOL_SPECS.some((spec) => spec.id === id);
}

/** Kinds whose geometry is a closed polygon. */
export function isClosedKind(kind: MarkupKind): boolean {
  return kind === "area" || kind === "volume";
}

export interface MarkupPoint {
  x: number;
  y: number;
}

/**
 * Our fields on an annotation, stored under `custom.markup`. EmbedPDF writes `custom` as JSON
 * into `/EPDFCustom`, so it survives save and reopen. Heights and depths are in the page
 * scale's unit.
 */
export interface MarkupCustom {
  v: 1;
  kind: MarkupKind;
  label?: string;
  status?: string;
  height?: number;
  depth?: number;
  /** Curve only: the clicked points; the annotation's vertices are the sampled spline. */
  controlPoints?: MarkupPoint[];
  /** Set once the user types their own comment, so the measured value stops overwriting it. */
  manualContents?: boolean;
}

/** The part of an annotation object the model reads; `PdfAnnotationObject` satisfies it. */
export interface MarkupAnnotation {
  type: PdfAnnotationSubtype;
  intent?: string;
  subject?: string;
  contents?: string;
  custom?: unknown;
  linePoints?: { start: MarkupPoint; end: MarkupPoint };
  vertices?: MarkupPoint[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPositiveNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

const isPoint = (value: unknown): value is MarkupPoint =>
  isRecord(value) && typeof value.x === "number" && typeof value.y === "number";

export function isMarkupKind(value: unknown): value is MarkupKind {
  return typeof value === "string" && (MARKUP_KINDS as readonly string[]).includes(value);
}

/** Reads `custom.markup` defensively: the JSON comes from a file and may be anything. */
export function readMarkupCustom(custom: unknown): MarkupCustom | null {
  if (!isRecord(custom) || !isRecord(custom.markup)) return null;
  const raw = custom.markup;
  if (!isMarkupKind(raw.kind)) return null;
  const result: MarkupCustom = { v: 1, kind: raw.kind };
  if (typeof raw.label === "string") result.label = raw.label;
  if (typeof raw.status === "string") result.status = raw.status;
  if (isPositiveNumber(raw.height)) result.height = raw.height;
  if (isPositiveNumber(raw.depth)) result.depth = raw.depth;
  if (Array.isArray(raw.controlPoints) && raw.controlPoints.every(isPoint)) {
    result.controlPoints = raw.controlPoints.map(({ x, y }) => ({ x, y }));
  }
  if (raw.manualContents === true) result.manualContents = true;
  return result;
}

/** A new `custom` object with `patch` applied to `custom.markup`; other keys are kept. A key set to `undefined` is removed. */
export function mergeMarkupCustom(
  custom: unknown,
  patch: Partial<Omit<MarkupCustom, "v">> & { kind?: MarkupKind },
): Record<string, unknown> {
  const base = isRecord(custom) ? custom : {};
  const existing = isRecord(base.markup) ? base.markup : {};
  const markup: Record<string, unknown> = { ...existing, v: 1, ...patch };
  for (const key of Object.keys(markup)) {
    if (markup[key] === undefined) delete markup[key];
  }
  return { ...base, markup };
}

/**
 * The measurement kind an annotation represents: our own `custom.markup.kind`, else the kind
 * a plain dimension annotation from another program stands for (from `/IT` and the subtype).
 */
export function markupKindOf(annotation: MarkupAnnotation): MarkupKind | null {
  const custom = readMarkupCustom(annotation.custom);
  if (custom) return custom.kind;
  switch (annotation.intent) {
    case "LineDimension":
      return annotation.type === PdfAnnotationSubtype.LINE ? "length" : null;
    case "PolyLineDimension":
      return annotation.type === PdfAnnotationSubtype.POLYLINE ? "polylength" : null;
    case "PolygonDimension":
      return annotation.type === PdfAnnotationSubtype.POLYGON ? "area" : null;
    default:
      return null;
  }
}

/** True for annotations our tools created, as opposed to a dimension annotation read from a file. */
export function isOwnMarkup(annotation: MarkupAnnotation): boolean {
  return readMarkupCustom(annotation.custom) !== null;
}
