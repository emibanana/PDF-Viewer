import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import {
  CSV_BOM,
  buildMarkupsCsv,
  csvField,
  defaultCsvFileName,
  formatCsvDate,
  type CsvColumn,
  type CsvLabels,
} from "./csvExport";
import { buildMarkupRows, type MarkupRowSource } from "./markupRows";

const metres = { factor: 1, ratio: 1, unit: "m" };
const centimetres = { factor: 1, ratio: 1, unit: "cm" };

const labels: CsvLabels = {
  rowType: "Row type",
  markup: "Markup",
  subtotal: "Subtotal",
  total: "Total",
  group: "Group",
  mixedUnits: "mixed",
};

const format = { typeName: (row: { type: string }) => row.type, statusName: (status: string) => status };

const square = (side: number) => [
  { x: 0, y: 0 },
  { x: side, y: 0 },
  { x: side, y: side },
  { x: 0, y: side },
];

const area = (id: string, side: number, extra: Partial<MarkupRowSource> = {}): MarkupRowSource => ({
  id,
  pageIndex: 0,
  type: PdfAnnotationSubtype.POLYGON,
  vertices: square(side),
  custom: { markup: { v: 1, kind: "area" } },
  subject: "Slab",
  ...extra,
});

const rowsFor = (annotations: MarkupRowSource[]) =>
  buildMarkupRows(annotations, {
    scaleFor: (pageIndex) => (pageIndex === 0 ? metres : centimetres),
    typeName: (type) => type,
  });

const columns = (...ids: CsvColumn["id"][]): CsvColumn[] => ids.map((id) => ({ id, header: id }));

const parse = (csv: string) => csv.replace(CSV_BOM, "").split("\r\n");

describe("csvField", () => {
  it("quotes fields with commas, quotes and line breaks, and doubles the quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect(csvField("cr\rhere")).toBe('"cr\rhere"');
    expect(csvField("")).toBe("");
  });
});

describe("buildMarkupsCsv", () => {
  it("starts with a byte order mark, ends lines with CRLF and closes with a total row", () => {
    const csv = buildMarkupsCsv({
      columns: columns("subject", "comments"),
      rows: rowsFor([area("a", 2, { contents: "note" })]),
      groupBySubject: false,
      labels,
      format,
    });
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(parse(csv)).toEqual(["Row type,subject,comments", "Markup,Slab,note", "Total,Total (1),", ""]);
  });

  it("writes numbers as plain decimals and the unit in its own column", () => {
    const csv = buildMarkupsCsv({
      columns: columns("subject", "area", "unit"),
      rows: rowsFor([area("a", 3.3333)]),
      groupBySubject: false,
      labels,
      format,
    });
    expect(parse(csv)[1]).toBe("Markup,Slab,11.11,m");
  });

  it("quotes text that needs it", () => {
    const csv = buildMarkupsCsv({
      columns: columns("comments"),
      rows: rowsFor([area("a", 1, { contents: 'wall, "north"\nside' })]),
      groupBySubject: false,
      labels,
      format,
    });
    expect(csv).toContain('Markup,"wall, ""north""\nside"\r\n');
  });

  it("keeps spreadsheet programs from running text that starts like a formula", () => {
    const csv = buildMarkupsCsv({
      columns: columns("comments"),
      rows: rowsFor([area("a", 1, { contents: "=HYPERLINK(1)" })]),
      groupBySubject: false,
      labels,
      format,
    });
    expect(parse(csv)[1]).toBe("Markup,'=HYPERLINK(1)");
  });

  it("puts a subtotal row before each group and sums only rows of one unit", () => {
    const csv = buildMarkupsCsv({
      columns: columns("subject", "area", "unit"),
      rows: rowsFor([area("a", 2), area("b", 3), area("c", 4, { pageIndex: 1 }), area("d", 1, { subject: "Floor" })]),
      groupBySubject: true,
      labels,
      format,
    });
    expect(parse(csv)).toEqual([
      "Row type,subject,area,unit",
      "Subtotal,Floor (1),1.00,m",
      "Markup,Floor,1.00,m",
      "Subtotal,Slab (3),,mixed",
      "Markup,Slab,4.00,m",
      "Markup,Slab,9.00,m",
      "Markup,Slab,16.00,cm",
      "Total,Total (4),,mixed",
      "",
    ]);
  });

  it("adds a group column when grouped without the subject column", () => {
    const csv = buildMarkupsCsv({
      columns: columns("area"),
      rows: rowsFor([area("a", 2), area("b", 3)]),
      groupBySubject: true,
      labels,
      format,
    });
    expect(parse(csv)).toEqual([
      "Row type,Group,area",
      "Subtotal,Slab,13.00",
      "Markup,Slab,4.00",
      "Markup,Slab,9.00",
      "Total,,13.00",
      "",
    ]);
  });

  it("keeps the order of the rows it is given when not grouped", () => {
    const csv = buildMarkupsCsv({
      columns: columns("comments"),
      rows: rowsFor([area("a", 1, { contents: "second" }), area("b", 1, { contents: "first" })]),
      groupBySubject: false,
      labels,
      format,
    });
    expect(parse(csv).slice(1, 3)).toEqual(["Markup,second", "Markup,first"]);
  });
});

describe("helpers", () => {
  it("formats dates the way Excel reads them", () => {
    const time = new Date(2026, 10, 27, 8, 5, 9).getTime();
    expect(formatCsvDate(time)).toBe("2026-11-27 08:05:09");
  });

  it("names the file after the PDF", () => {
    expect(defaultCsvFileName("Floor plan.pdf")).toBe("Floor plan - Markups.csv");
    expect(defaultCsvFileName("a:b/c.PDF")).toBe("a_b_c - Markups.csv");
    expect(defaultCsvFileName(undefined)).toBe("Markups.csv");
  });
});
