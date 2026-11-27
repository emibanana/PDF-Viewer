import {
  columnDisplayText,
  markupColumn,
  type MarkupColumnId,
  type MarkupTextFormat,
} from "@editor/services/markups/markupColumns";
import {
  MIXED_UNITS,
  computeTotals,
  groupBySubject,
  type MarkupRow,
  type MarkupTotals,
} from "@editor/services/markups/markupRows";
import { formatNumber } from "@editor/services/markups/measureMath";

export interface CsvLabels {
  /** Header of the first column, which tells markup, subtotal and total rows apart. */
  rowType: string;
  markup: string;
  subtotal: string;
  total: string;
  /** Header of the group column that stands in for Subject when that column is not exported. */
  group: string;
  /** Unit cell of a subtotal that adds values in different units. */
  mixedUnits: string;
}

export interface CsvColumn {
  id: MarkupColumnId;
  header: string;
}

export interface MarkupsCsvInput {
  /** The visible columns, in display order. */
  columns: readonly CsvColumn[];
  /** The rows to export, already filtered and sorted. */
  rows: readonly MarkupRow[];
  groupBySubject: boolean;
  /** True when the grid lists subjects Z to A. */
  subjectDescending?: boolean;
  labels: CsvLabels;
  format: Pick<MarkupTextFormat, "typeName" | "statusName">;
}

export const CSV_BOM = "﻿";
const LINE_BREAK = "\r\n";

/** Spreadsheet programs run a cell that starts with one of these as a formula; PDF text is not trusted. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** RFC 4180: a field with a comma, quote or line break is quoted and its quotes doubled. */
export function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `2026-11-27 08:52:39` in local time, which Excel reads as a date. */
export function formatCsvDate(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function textCell(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function markupCells(row: MarkupRow, columns: readonly CsvColumn[], format: MarkupsCsvInput["format"]): string[] {
  const textFormat: MarkupTextFormat = { ...format, date: formatCsvDate };
  return columns.map(({ id }) => {
    const text = columnDisplayText(row, id, textFormat);
    return markupColumn(id)?.kind === "number" ? text : textCell(text);
  });
}

function totalCells(columns: readonly CsvColumn[], totals: MarkupTotals, subjectText: string, labels: CsvLabels): string[] {
  return columns.map(({ id }) => {
    if (id === "subject") return textCell(subjectText);
    if (id === "unit") return totals.unit === MIXED_UNITS ? labels.mixedUnits : (totals.unit ?? "");
    const quantity = markupColumn(id)?.total;
    if (!quantity) return "";
    const sum = totals.sums[quantity];
    return sum === null || sum === MIXED_UNITS ? "" : formatNumber(sum.value, totals.precision);
  });
}

/**
 * CSV text of the Markups List: a "Row type" column first, then the visible columns. Grouped
 * export puts a subtotal row before each group's markups, ungrouped export has none, and a
 * total row closes the file either way. Numbers are plain decimals with `.`, units are in the
 * Unit column, the file starts with a byte order mark so Excel reads it as UTF-8, and lines end
 * in CRLF. A text cell that would start a spreadsheet formula gets a leading apostrophe.
 */
export function buildMarkupsCsv(input: MarkupsCsvInput): string {
  const { columns, rows, labels, format } = input;
  const groupColumn = input.groupBySubject && !columns.some(({ id }) => id === "subject");
  const lines: string[][] = [];

  const withLeading = (kind: string, group: string, cells: string[]) =>
    groupColumn ? [kind, group, ...cells] : [kind, ...cells];

  lines.push(
    groupColumn
      ? [labels.rowType, labels.group, ...columns.map(({ header }) => header)]
      : [labels.rowType, ...columns.map(({ header }) => header)],
  );

  if (input.groupBySubject) {
    for (const group of groupBySubject(rows, input.subjectDescending)) {
      lines.push(
        withLeading(
          labels.subtotal,
          textCell(group.subject),
          totalCells(columns, group.totals, `${group.subject} (${group.rows.length})`, labels),
        ),
      );
      for (const row of group.rows)
        lines.push(withLeading(labels.markup, textCell(group.subject), markupCells(row, columns, format)));
    }
  } else {
    for (const row of rows) lines.push(withLeading(labels.markup, "", markupCells(row, columns, format)));
  }

  const grand = computeTotals(rows);
  lines.push(withLeading(labels.total, "", totalCells(columns, grand, `${labels.total} (${rows.length})`, labels)));

  return CSV_BOM + lines.map((line) => line.map(csvField).join(",")).join(LINE_BREAK) + LINE_BREAK;
}

/** `Plan.pdf` becomes `Plan - Markups.csv`; characters Windows forbids in a file name are replaced. */
export function defaultCsvFileName(pdfName: string | null | undefined, suffix = "Markups"): string {
  const stem = (pdfName ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .trim();
  return stem ? `${stem} - ${suffix}.csv` : `${suffix}.csv`;
}
