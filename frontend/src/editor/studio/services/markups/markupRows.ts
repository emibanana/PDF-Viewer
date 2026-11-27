import { PdfAnnotationSubtype } from "@embedpdf/models";
import type { MeasureScale } from "@editor/utils/measurementTypes";
import { DEFAULT_PRECISION, computeMeasurement } from "@editor/services/markups/measureMath";
import {
  isMarkupKind,
  markupKindOf,
  mergeMarkupCustom,
  readMarkupCustom,
  type MarkupAnnotation,
  type MarkupKind,
} from "@editor/services/markups/markupModel";

/** Everything the list can show about an annotation, whichever program wrote it. */
export type MarkupTypeId =
  | MarkupKind
  | "note"
  | "textBox"
  | "line"
  | "polyline"
  | "polygon"
  | "rectangle"
  | "ellipse"
  | "highlight"
  | "underline"
  | "squiggly"
  | "strikeout"
  | "stamp"
  | "caret"
  | "ink"
  | "redaction"
  | "attachment"
  | "other";

export const MARKUP_TYPE_IDS: readonly MarkupTypeId[] = [
  "length",
  "polylength",
  "curve",
  "area",
  "wall",
  "volume",
  "note",
  "textBox",
  "line",
  "polyline",
  "polygon",
  "rectangle",
  "ellipse",
  "highlight",
  "underline",
  "squiggly",
  "strikeout",
  "stamp",
  "caret",
  "ink",
  "redaction",
  "attachment",
  "other",
];

/** Review states a markup can be marked with; "" is none. Stored as these English words, which is also what Revu writes. */
export const MARKUP_STATUSES = ["Accepted", "Rejected", "Cancelled", "Completed"] as const;

export const NUMERIC_COLUMNS = ["length", "area", "perimeter", "wallArea", "volume"] as const;
export type NumericColumn = (typeof NUMERIC_COLUMNS)[number];

/** The fields of an annotation object the list reads; `PdfAnnotationObject` satisfies it. */
export interface MarkupRowSource extends MarkupAnnotation {
  id: string;
  pageIndex: number;
  author?: string;
  created?: Date;
  modified?: Date;
  strokeColor?: string;
  color?: string;
  fontColor?: string;
  flags?: readonly string[];
}

export interface MarkupRow {
  id: string;
  pageIndex: number;
  pageLabel: string;
  subject: string;
  comments: string;
  label: string;
  author: string;
  /** Milliseconds since the epoch of the last change, else of creation; null when the file has neither. */
  date: number | null;
  /** "" when none is set. */
  status: string;
  /** A CSS colour, or "" when the annotation has none. */
  colour: string;
  type: MarkupTypeId;
  /** True for a markup of ours or a dimension annotation another program wrote. */
  measurement: boolean;
  length: number | null;
  area: number | null;
  perimeter: number | null;
  wallArea: number | null;
  volume: number | null;
  /** Wall height or volume depth, in `unit`. */
  extent: number | null;
  /** The real-world unit of the values; "" when the row has no measured values. */
  unit: string;
  /** Decimal places of the page scale the values were measured with. */
  precision: number;
  hidden: boolean;
}

export interface MarkupRowOptions {
  /** The page's scale, or null when none is set (values are then in paper millimetres). */
  scaleFor: (pageIndex: number) => MeasureScale | null;
  precisionFor?: (pageIndex: number) => number;
  /** The page's printed label; the page number when omitted. */
  pageLabelFor?: (pageIndex: number) => string;
  /** The name shown as subject for an annotation that has none. */
  typeName: (type: MarkupTypeId) => string;
}

/** Annotation subtypes that are plumbing or form fields, not markups. */
const UNLISTED_SUBTYPES: ReadonlySet<PdfAnnotationSubtype> = new Set([
  PdfAnnotationSubtype.UNKNOWN,
  PdfAnnotationSubtype.LINK,
  PdfAnnotationSubtype.POPUP,
  PdfAnnotationSubtype.WIDGET,
  PdfAnnotationSubtype.SCREEN,
  PdfAnnotationSubtype.PRINTERMARK,
  PdfAnnotationSubtype.TRAPNET,
  PdfAnnotationSubtype.WATERMARK,
  PdfAnnotationSubtype.XFAWIDGET,
]);

const SUBTYPE_TYPES: Partial<Record<PdfAnnotationSubtype, MarkupTypeId>> = {
  [PdfAnnotationSubtype.TEXT]: "note",
  [PdfAnnotationSubtype.FREETEXT]: "textBox",
  [PdfAnnotationSubtype.LINE]: "line",
  [PdfAnnotationSubtype.POLYLINE]: "polyline",
  [PdfAnnotationSubtype.POLYGON]: "polygon",
  [PdfAnnotationSubtype.SQUARE]: "rectangle",
  [PdfAnnotationSubtype.CIRCLE]: "ellipse",
  [PdfAnnotationSubtype.HIGHLIGHT]: "highlight",
  [PdfAnnotationSubtype.UNDERLINE]: "underline",
  [PdfAnnotationSubtype.SQUIGGLY]: "squiggly",
  [PdfAnnotationSubtype.STRIKEOUT]: "strikeout",
  [PdfAnnotationSubtype.STAMP]: "stamp",
  [PdfAnnotationSubtype.CARET]: "caret",
  [PdfAnnotationSubtype.INK]: "ink",
  [PdfAnnotationSubtype.REDACT]: "redaction",
  [PdfAnnotationSubtype.FILEATTACHMENT]: "attachment",
};

export function isListedAnnotation(annotation: Pick<MarkupAnnotation, "type">): boolean {
  return !UNLISTED_SUBTYPES.has(annotation.type);
}

export function markupTypeOf(annotation: MarkupAnnotation): MarkupTypeId {
  return markupKindOf(annotation) ?? SUBTYPE_TYPES[annotation.type] ?? "other";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Status of an annotation: our measurements keep it with the rest of `custom.markup`; every
 * other annotation has no `markup` entry (it needs a measurement kind), so its status lives
 * in `custom.markupMeta`.
 */
export function readMarkupStatus(custom: unknown): string {
  const own = readMarkupCustom(custom);
  if (own) return own.status ?? "";
  if (isRecord(custom) && isRecord(custom.markupMeta) && typeof custom.markupMeta.status === "string") {
    return custom.markupMeta.status;
  }
  return "";
}

/** The `custom` value to patch an annotation with so that its status becomes `status` ("" clears it). */
export function withMarkupStatus(custom: unknown, status: string): Record<string, unknown> {
  const value = status === "" ? undefined : status;
  if (readMarkupCustom(custom)) return mergeMarkupCustom(custom, { status: value });
  const base = isRecord(custom) ? custom : {};
  const meta: Record<string, unknown> = { ...(isRecord(base.markupMeta) ? base.markupMeta : {}) };
  if (value === undefined) delete meta.status;
  else meta.status = value;
  const { markupMeta: _previous, ...rest } = base;
  return Object.keys(meta).length > 0 ? { ...rest, markupMeta: meta } : rest;
}

function colourOf(annotation: MarkupRowSource): string {
  return annotation.strokeColor || annotation.color || annotation.fontColor || "";
}

function dateOf(annotation: MarkupRowSource): number | null {
  const date = annotation.modified ?? annotation.created;
  const time = date instanceof Date ? date.getTime() : Number.NaN;
  return Number.isFinite(time) ? time : null;
}

function labelOf(custom: unknown): string {
  return readMarkupCustom(custom)?.label ?? "";
}

export function isHiddenAnnotation(annotation: Pick<MarkupRowSource, "flags">): boolean {
  return !!annotation.flags && (annotation.flags.includes("hidden") || annotation.flags.includes("noView"));
}

export function buildMarkupRow(annotation: MarkupRowSource, options: MarkupRowOptions): MarkupRow {
  const type = markupTypeOf(annotation);
  const scale = options.scaleFor(annotation.pageIndex);
  const measurement = computeMeasurement(annotation, scale);
  const comments = annotation.contents ?? "";
  const subject = annotation.subject?.trim() || options.typeName(type);
  return {
    id: annotation.id,
    pageIndex: annotation.pageIndex,
    pageLabel: options.pageLabelFor?.(annotation.pageIndex) ?? String(annotation.pageIndex + 1),
    subject,
    comments,
    label: labelOf(annotation.custom),
    author: annotation.author ?? "",
    date: dateOf(annotation),
    status: readMarkupStatus(annotation.custom),
    colour: colourOf(annotation),
    type,
    measurement: isMarkupKind(type),
    length: measurement?.length ?? null,
    area: measurement?.area ?? null,
    perimeter: measurement?.perimeter ?? null,
    wallArea: measurement?.wallArea ?? null,
    volume: measurement?.volume ?? null,
    extent: measurement?.height ?? measurement?.depth ?? null,
    unit: measurement?.unit ?? "",
    precision: options.precisionFor?.(annotation.pageIndex) ?? DEFAULT_PRECISION,
    hidden: isHiddenAnnotation(annotation),
  };
}

/** Rows for every listed annotation, in the order given. */
export function buildMarkupRows(annotations: readonly MarkupRowSource[], options: MarkupRowOptions): MarkupRow[] {
  const rows: MarkupRow[] = [];
  for (const annotation of annotations) {
    if (isListedAnnotation(annotation)) rows.push(buildMarkupRow(annotation, options));
  }
  return rows;
}

export type RowFacet = "type" | "page" | "author" | "status";

/** Selected values per facet; a facet with no values does not filter. Values are `facetValue` results. */
export type RowFacetFilter = Partial<Record<RowFacet, ReadonlySet<string>>>;

export function facetValue(row: MarkupRow, facet: RowFacet): string {
  switch (facet) {
    case "type":
      return row.type;
    case "page":
      return String(row.pageIndex);
    case "author":
      return row.author;
    case "status":
      return row.status;
  }
}

export function filterByFacets(rows: readonly MarkupRow[], filter: RowFacetFilter): MarkupRow[] {
  const active = (Object.keys(filter) as RowFacet[]).filter((facet) => (filter[facet]?.size ?? 0) > 0);
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every((facet) => filter[facet]?.has(facetValue(row, facet))));
}

/** Rows that contain every whitespace-separated word of `query` in one of the texts `texts` returns. */
export function filterByText(
  rows: readonly MarkupRow[],
  query: string,
  texts: (row: MarkupRow) => readonly string[],
): MarkupRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const haystack = texts(row).join("\n").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Distinct values of a facet over `rows`, sorted by the display text. */
export function facetValues(rows: readonly MarkupRow[], facet: RowFacet): string[] {
  const seen = new Set<string>();
  for (const row of rows) seen.add(facetValue(row, facet));
  const values = [...seen];
  return facet === "page" ? values.sort((a, b) => Number(a) - Number(b)) : values.sort((a, b) => a.localeCompare(b));
}

/** Marks a total that sums values in more than one unit and so means nothing. */
export const MIXED_UNITS = Symbol("mixed units");
export type Mixed = typeof MIXED_UNITS;

export interface QuantityTotal {
  value: number;
  unit: string;
}

/** Subtotal of a set of rows. A sum only adds rows measured in the same unit. */
export interface MarkupTotals {
  count: number;
  sums: Record<NumericColumn, QuantityTotal | Mixed | null>;
  /** The one unit of every measured row, MIXED_UNITS when they differ, null when none is measured. */
  unit: string | Mixed | null;
  /** The largest number of decimals among the summed rows. */
  precision: number;
}

export function computeTotals(rows: readonly MarkupRow[]): MarkupTotals {
  const sums = Object.fromEntries(NUMERIC_COLUMNS.map((column) => [column, null])) as MarkupTotals["sums"];
  let unit: MarkupTotals["unit"] = null;
  let precision = 0;
  for (const row of rows) {
    if (row.unit !== "") {
      if (unit === null) unit = row.unit;
      else if (unit !== row.unit) unit = MIXED_UNITS;
    }
    for (const column of NUMERIC_COLUMNS) {
      const value = row[column];
      if (value === null) continue;
      precision = Math.max(precision, row.precision);
      const current = sums[column];
      if (current === null) sums[column] = { value, unit: row.unit };
      else if (current !== MIXED_UNITS && current.unit === row.unit)
        sums[column] = { value: current.value + value, unit: row.unit };
      else sums[column] = MIXED_UNITS;
    }
  }
  return { count: rows.length, sums, unit, precision: precision || DEFAULT_PRECISION };
}

export interface MarkupGroup {
  key: string;
  subject: string;
  rows: MarkupRow[];
  totals: MarkupTotals;
}

/**
 * Splits rows (already in display order) into groups by subject, keeping each group's rows in
 * their order. Groups are ordered by subject, ascending unless `descending`; subjects are
 * compared case-insensitively and rows whose subjects differ only in case share a group.
 */
export function groupBySubject(rows: readonly MarkupRow[], descending = false): MarkupGroup[] {
  const groups = new Map<string, MarkupGroup>();
  for (const row of rows) {
    const key = row.subject.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = { key, subject: row.subject, rows: [], totals: computeTotals([]) };
      groups.set(key, group);
    }
    group.rows.push(row);
  }
  const ordered = [...groups.values()].sort((a, b) =>
    a.subject.localeCompare(b.subject, undefined, { numeric: true, sensitivity: "base" }),
  );
  if (descending) ordered.reverse();
  for (const group of ordered) group.totals = computeTotals(group.rows);
  return ordered;
}
