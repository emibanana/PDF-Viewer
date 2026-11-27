import { formatNumber } from "@editor/services/markups/measureMath";
import type { MarkupRow, MarkupTypeId, NumericColumn } from "@editor/services/markups/markupRows";

export const MARKUP_COLUMN_IDS = [
  "subject",
  "pageLabel",
  "comments",
  "label",
  "author",
  "date",
  "status",
  "colour",
  "length",
  "area",
  "perimeter",
  "wallArea",
  "volume",
  "extent",
  "unit",
  "type",
] as const;
export type MarkupColumnId = (typeof MARKUP_COLUMN_IDS)[number];

export type MarkupColumnKind = "text" | "number" | "date" | "colour" | "status" | "type";

export interface MarkupColumnSpec {
  id: MarkupColumnId;
  kind: MarkupColumnKind;
  /** Translation key and English fallback of the header. */
  labelKey: string;
  defaultLabel: string;
  width: number;
  minWidth: number;
  defaultVisible: boolean;
  /** Set for columns a group subtotal sums. */
  total?: NumericColumn;
}

export const MARKUP_COLUMNS: readonly MarkupColumnSpec[] = [
  {
    id: "subject",
    kind: "text",
    labelKey: "markups.list.columns.subject",
    defaultLabel: "Subject",
    width: 170,
    minWidth: 80,
    defaultVisible: true,
  },
  {
    id: "pageLabel",
    kind: "text",
    labelKey: "markups.list.columns.pageLabel",
    defaultLabel: "Page Label",
    width: 90,
    minWidth: 60,
    defaultVisible: true,
  },
  {
    id: "comments",
    kind: "text",
    labelKey: "markups.list.columns.comments",
    defaultLabel: "Comments",
    width: 220,
    minWidth: 80,
    defaultVisible: true,
  },
  {
    id: "label",
    kind: "text",
    labelKey: "markups.list.columns.label",
    defaultLabel: "Label",
    width: 120,
    minWidth: 60,
    defaultVisible: false,
  },
  {
    id: "author",
    kind: "text",
    labelKey: "markups.list.columns.author",
    defaultLabel: "Author",
    width: 120,
    minWidth: 60,
    defaultVisible: true,
  },
  {
    id: "date",
    kind: "date",
    labelKey: "markups.list.columns.date",
    defaultLabel: "Date",
    width: 150,
    minWidth: 90,
    defaultVisible: true,
  },
  {
    id: "status",
    kind: "status",
    labelKey: "markups.list.columns.status",
    defaultLabel: "Status",
    width: 100,
    minWidth: 70,
    defaultVisible: true,
  },
  {
    id: "colour",
    kind: "colour",
    labelKey: "markups.list.columns.colour",
    defaultLabel: "Colour",
    width: 70,
    minWidth: 50,
    defaultVisible: true,
  },
  {
    id: "length",
    kind: "number",
    labelKey: "markups.list.columns.length",
    defaultLabel: "Length",
    width: 90,
    minWidth: 60,
    defaultVisible: true,
    total: "length",
  },
  {
    id: "area",
    kind: "number",
    labelKey: "markups.list.columns.area",
    defaultLabel: "Area",
    width: 90,
    minWidth: 60,
    defaultVisible: true,
    total: "area",
  },
  {
    id: "perimeter",
    kind: "number",
    labelKey: "markups.list.columns.perimeter",
    defaultLabel: "Perimeter",
    width: 90,
    minWidth: 60,
    defaultVisible: false,
    total: "perimeter",
  },
  {
    id: "wallArea",
    kind: "number",
    labelKey: "markups.list.columns.wallArea",
    defaultLabel: "Wall Area",
    width: 90,
    minWidth: 60,
    defaultVisible: true,
    total: "wallArea",
  },
  {
    id: "volume",
    kind: "number",
    labelKey: "markups.list.columns.volume",
    defaultLabel: "Volume",
    width: 90,
    minWidth: 60,
    defaultVisible: true,
    total: "volume",
  },
  {
    id: "extent",
    kind: "number",
    labelKey: "markups.list.columns.extent",
    defaultLabel: "Height/Depth",
    width: 100,
    minWidth: 60,
    defaultVisible: false,
  },
  {
    id: "unit",
    kind: "text",
    labelKey: "markups.list.columns.unit",
    defaultLabel: "Unit",
    width: 60,
    minWidth: 40,
    defaultVisible: true,
  },
  {
    id: "type",
    kind: "type",
    labelKey: "markups.list.columns.type",
    defaultLabel: "Type",
    width: 110,
    minWidth: 60,
    defaultVisible: false,
  },
];

const COLUMN_BY_ID = new Map<string, MarkupColumnSpec>(MARKUP_COLUMNS.map((column) => [column.id, column]));

export function markupColumn(id: string): MarkupColumnSpec | undefined {
  return COLUMN_BY_ID.get(id);
}

export function isMarkupColumnId(value: unknown): value is MarkupColumnId {
  return typeof value === "string" && COLUMN_BY_ID.has(value);
}

/** The row's raw value for sorting and totals: a number for number and date columns, else text. */
export function columnSortValue(row: MarkupRow, id: MarkupColumnId): string | number | null {
  switch (id) {
    case "pageLabel":
      return row.pageIndex;
    case "date":
      return row.date;
    case "length":
    case "area":
    case "perimeter":
    case "wallArea":
    case "volume":
    case "extent":
      return row[id];
    case "subject":
    case "comments":
    case "label":
    case "author":
    case "status":
    case "colour":
    case "unit":
    case "type":
      return row[id];
  }
}

/** Display text that depends on the language: type and status names and the date format. */
export interface MarkupTextFormat {
  typeName: (row: MarkupRow) => string;
  statusName: (status: string) => string;
  date: (time: number) => string;
}

/** The text of one cell as the grid shows it; numbers carry their page's decimals. */
export function columnDisplayText(row: MarkupRow, id: MarkupColumnId, format: MarkupTextFormat): string {
  switch (id) {
    case "date":
      return row.date === null ? "" : format.date(row.date);
    case "status":
      return row.status === "" ? "" : format.statusName(row.status);
    case "type":
      return format.typeName(row);
    case "length":
    case "area":
    case "perimeter":
    case "wallArea":
    case "volume":
    case "extent": {
      const value = row[id];
      return value === null ? "" : formatNumber(value, row.precision);
    }
    case "pageLabel":
      return row.pageLabel;
    case "subject":
    case "comments":
    case "label":
    case "author":
    case "colour":
    case "unit":
      return row[id];
  }
}

export interface MarkupListSort {
  id: MarkupColumnId;
  desc: boolean;
}

export interface MarkupListLayout {
  /** Every column id, in display order. */
  order: MarkupColumnId[];
  hidden: MarkupColumnId[];
  widths: Partial<Record<MarkupColumnId, number>>;
  sorting: MarkupListSort[];
  groupBySubject: boolean;
}

const LAYOUT_STORAGE_KEY = "markups.list.layout";
const MAX_COLUMN_WIDTH = 800;

export function defaultMarkupListLayout(): MarkupListLayout {
  return {
    order: MARKUP_COLUMNS.map((column) => column.id),
    hidden: MARKUP_COLUMNS.filter((column) => !column.defaultVisible).map((column) => column.id),
    widths: {},
    sorting: [],
    groupBySubject: true,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A layout from whatever was stored: unknown or repeated ids are dropped, columns added since
 * the layout was saved are appended at the end and keep their default visibility, widths are
 * clamped. Anything unusable falls back to the default.
 */
export function sanitizeMarkupListLayout(raw: unknown): MarkupListLayout {
  const layout = defaultMarkupListLayout();
  if (!isRecord(raw)) return layout;

  if (Array.isArray(raw.order)) {
    const seen = new Set<MarkupColumnId>();
    const order: MarkupColumnId[] = [];
    for (const id of raw.order) {
      if (isMarkupColumnId(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
    const known = new Set(raw.order);
    const added = layout.order.filter((id) => !seen.has(id));
    layout.order = [...order, ...added];
    if (Array.isArray(raw.hidden)) {
      const hidden = raw.hidden.filter(isMarkupColumnId);
      const newlyAddedHidden = layout.hidden.filter((id) => !known.has(id));
      layout.hidden = [...new Set([...hidden, ...newlyAddedHidden])];
    }
  } else if (Array.isArray(raw.hidden)) {
    layout.hidden = [...new Set(raw.hidden.filter(isMarkupColumnId))];
  }

  if (isRecord(raw.widths)) {
    for (const [id, width] of Object.entries(raw.widths)) {
      const spec = markupColumn(id);
      if (spec && typeof width === "number" && Number.isFinite(width)) {
        layout.widths[spec.id] = Math.min(MAX_COLUMN_WIDTH, Math.max(spec.minWidth, Math.round(width)));
      }
    }
  }

  if (Array.isArray(raw.sorting)) {
    layout.sorting = raw.sorting.flatMap((entry): MarkupListSort[] =>
      isRecord(entry) && isMarkupColumnId(entry.id) ? [{ id: entry.id, desc: entry.desc === true }] : [],
    );
  }
  if (typeof raw.groupBySubject === "boolean") layout.groupBySubject = raw.groupBySubject;
  return layout;
}

export function loadMarkupListLayout(): MarkupListLayout {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LAYOUT_STORAGE_KEY);
    return sanitizeMarkupListLayout(raw ? (JSON.parse(raw) as unknown) : null);
  } catch {
    return defaultMarkupListLayout();
  }
}

export function saveMarkupListLayout(layout: MarkupListLayout): void {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be full or blocked; the layout then simply is not remembered.
  }
}

/** Visible column ids in display order. */
export function visibleColumnIds(layout: MarkupListLayout): MarkupColumnId[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => !hidden.has(id));
}

/** Translation key and English fallback of each type's name. */
export const MARKUP_TYPE_LABELS: Record<MarkupTypeId, readonly [key: string, fallback: string]> = {
  length: ["markups.list.types.length", "Length"],
  polylength: ["markups.list.types.polylength", "Polylength"],
  curve: ["markups.list.types.curve", "Curve"],
  area: ["markups.list.types.area", "Area"],
  wall: ["markups.list.types.wall", "Wall"],
  volume: ["markups.list.types.volume", "Volume"],
  angle: ["markups.list.types.angle", "Angle"],
  count: ["markups.list.types.count", "Count"],
  note: ["markups.list.types.note", "Note"],
  textBox: ["markups.list.types.textBox", "Text Box"],
  line: ["markups.list.types.line", "Line"],
  polyline: ["markups.list.types.polyline", "Polyline"],
  polygon: ["markups.list.types.polygon", "Polygon"],
  rectangle: ["markups.list.types.rectangle", "Rectangle"],
  ellipse: ["markups.list.types.ellipse", "Ellipse"],
  highlight: ["markups.list.types.highlight", "Highlight"],
  underline: ["markups.list.types.underline", "Underline"],
  squiggly: ["markups.list.types.squiggly", "Squiggly Underline"],
  strikeout: ["markups.list.types.strikeout", "Strikeout"],
  stamp: ["markups.list.types.stamp", "Stamp"],
  caret: ["markups.list.types.caret", "Caret"],
  ink: ["markups.list.types.ink", "Pen"],
  redaction: ["markups.list.types.redaction", "Redaction"],
  attachment: ["markups.list.types.attachment", "File Attachment"],
  other: ["markups.list.types.other", "Other"],
};

/** Translation key and English fallback of each status the list offers; other values are shown as written. */
export const MARKUP_STATUS_LABELS: Record<string, readonly [key: string, fallback: string]> = {
  Accepted: ["markups.list.status.accepted", "Accepted"],
  Rejected: ["markups.list.status.rejected", "Rejected"],
  Cancelled: ["markups.list.status.cancelled", "Cancelled"],
  Completed: ["markups.list.status.completed", "Completed"],
};
