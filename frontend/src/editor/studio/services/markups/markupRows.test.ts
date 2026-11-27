import { describe, expect, it } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import {
  MIXED_UNITS,
  buildMarkupRows,
  computeTotals,
  facetValues,
  filterByFacets,
  filterByText,
  groupBySubject,
  readMarkupStatus,
  withMarkupStatus,
  type MarkupRow,
  type MarkupRowOptions,
  type MarkupRowSource,
} from "./markupRows";
import { readMarkupCustom } from "./markupModel";

// One PDF point is one metre, which keeps the expected numbers readable.
const metres = { factor: 1, ratio: 1, unit: "m" };
const feet = { factor: 1, ratio: 1, unit: "ft" };

const options = (scales: Record<number, typeof metres | null> = {}): MarkupRowOptions => ({
  scaleFor: (pageIndex) => scales[pageIndex] ?? null,
  typeName: (type) => `type:${type}`,
});

const square = (side: number) => [
  { x: 0, y: 0 },
  { x: side, y: 0 },
  { x: side, y: side },
  { x: 0, y: side },
];

const annotation = (patch: Partial<MarkupRowSource> & Pick<MarkupRowSource, "id" | "type">): MarkupRowSource => ({
  pageIndex: 0,
  ...patch,
});

const area = (id: string, side: number, extra: Partial<MarkupRowSource> = {}) =>
  annotation({
    id,
    type: PdfAnnotationSubtype.POLYGON,
    vertices: square(side),
    custom: { markup: { v: 1, kind: "area" } },
    subject: "Area",
    ...extra,
  });

describe("buildMarkupRows", () => {
  it("lists highlights, notes and shapes that carry no measurement", () => {
    const rows = buildMarkupRows(
      [
        annotation({
          id: "h",
          type: PdfAnnotationSubtype.HIGHLIGHT,
          strokeColor: "#ffff00",
          contents: "look here",
          author: "Ann",
        }),
        annotation({ id: "n", type: PdfAnnotationSubtype.TEXT, subject: "Note", pageIndex: 2 }),
        annotation({ id: "i", type: PdfAnnotationSubtype.INK, color: "#00ff00" }),
      ],
      options(),
    );
    expect(rows.map((row) => [row.id, row.type, row.measurement])).toEqual([
      ["h", "highlight", false],
      ["n", "note", false],
      ["i", "ink", false],
    ]);
    expect(rows[0]).toMatchObject({
      comments: "look here",
      author: "Ann",
      colour: "#ffff00",
      unit: "",
      length: null,
      area: null,
    });
    expect(rows[2].colour).toBe("#00ff00");
    expect(rows[1].pageLabel).toBe("3");
  });

  it("falls back to the type name when there is no subject", () => {
    const [row] = buildMarkupRows([annotation({ id: "h", type: PdfAnnotationSubtype.HIGHLIGHT, subject: "  " })], options());
    expect(row.subject).toBe("type:highlight");
  });

  it("leaves out links, popups and form fields", () => {
    const rows = buildMarkupRows(
      [
        annotation({ id: "l", type: PdfAnnotationSubtype.LINK }),
        annotation({ id: "p", type: PdfAnnotationSubtype.POPUP }),
        annotation({ id: "w", type: PdfAnnotationSubtype.WIDGET }),
        annotation({ id: "t", type: PdfAnnotationSubtype.FREETEXT }),
      ],
      options(),
    );
    expect(rows.map((row) => row.id)).toEqual(["t"]);
  });

  it("measures our own markups on the page scale", () => {
    const [row] = buildMarkupRows([area("a", 10)], options({ 0: metres }));
    expect(row).toMatchObject({ type: "area", measurement: true, area: 100, perimeter: 40, unit: "m", length: null });
  });

  it("measures a dimension annotation another program wrote from its /IT", () => {
    const line = annotation({
      id: "revu",
      type: PdfAnnotationSubtype.LINE,
      intent: "LineDimension",
      linePoints: { start: { x: 0, y: 0 }, end: { x: 3, y: 4 } },
      contents: "5 m",
    });
    const [row] = buildMarkupRows([line], options({ 0: metres }));
    expect(row).toMatchObject({ type: "length", length: 5, unit: "m", comments: "5 m" });
  });

  it("measures in paper millimetres on a page without a scale", () => {
    const [row] = buildMarkupRows([area("a", 10)], options());
    expect(row.unit).toBe("mm");
  });

  it("reads wall height and volume depth into the extent column", () => {
    const wall = annotation({
      id: "w",
      type: PdfAnnotationSubtype.POLYLINE,
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      custom: { markup: { v: 1, kind: "wall", height: 3, label: "W1" } },
    });
    const [row] = buildMarkupRows([wall], options({ 0: metres }));
    expect(row).toMatchObject({ length: 10, extent: 3, wallArea: 30, label: "W1" });
  });

  it("prefers the modified date and marks hidden annotations", () => {
    const [row] = buildMarkupRows(
      [
        annotation({
          id: "x",
          type: PdfAnnotationSubtype.SQUARE,
          created: new Date(1000),
          modified: new Date(2000),
          flags: ["print", "hidden"],
        }),
      ],
      options(),
    );
    expect(row.date).toBe(2000);
    expect(row.hidden).toBe(true);
  });

  it("uses the page label function when there is one", () => {
    const [row] = buildMarkupRows([annotation({ id: "x", type: PdfAnnotationSubtype.SQUARE, pageIndex: 4 })], {
      ...options(),
      pageLabelFor: (pageIndex) => `A-${pageIndex + 1}`,
    });
    expect(row.pageLabel).toBe("A-5");
  });
});

describe("status", () => {
  it("keeps the status of our own measurements with the rest of custom.markup", () => {
    const custom = withMarkupStatus({ markup: { v: 1, kind: "area" } }, "Accepted");
    expect(readMarkupCustom(custom)).toMatchObject({ kind: "area", status: "Accepted" });
    expect(readMarkupStatus(custom)).toBe("Accepted");
    expect(readMarkupStatus(withMarkupStatus(custom, ""))).toBe("");
  });

  it("keeps the status of any other annotation in custom.markupMeta and leaves other keys alone", () => {
    const custom = withMarkupStatus({ other: 1 }, "Rejected");
    expect(custom).toEqual({ other: 1, markupMeta: { status: "Rejected" } });
    expect(readMarkupStatus(custom)).toBe("Rejected");
    expect(withMarkupStatus(custom, "")).toEqual({ other: 1 });
    expect(withMarkupStatus(undefined, "")).toEqual({});
  });
});

describe("filtering", () => {
  const rows = buildMarkupRows(
    [
      annotation({ id: "1", type: PdfAnnotationSubtype.HIGHLIGHT, author: "Ann", contents: "Check the slab" }),
      annotation({ id: "2", type: PdfAnnotationSubtype.TEXT, author: "Bob", pageIndex: 1, contents: "Slab thickness?" }),
      annotation({ id: "3", type: PdfAnnotationSubtype.HIGHLIGHT, author: "Bob", pageIndex: 1 }),
    ],
    options(),
  );

  it("requires every word of the query somewhere in the given texts", () => {
    const texts = (row: MarkupRow) => [row.comments, row.author];
    expect(filterByText(rows, "slab bob", texts).map((row) => row.id)).toEqual(["2"]);
    expect(filterByText(rows, "  ", texts)).toHaveLength(3);
  });

  it("filters by facet, combining facets with and", () => {
    expect(filterByFacets(rows, { author: new Set(["Bob"]) }).map((row) => row.id)).toEqual(["2", "3"]);
    expect(filterByFacets(rows, { author: new Set(["Bob"]), type: new Set(["highlight"]) }).map((row) => row.id)).toEqual([
      "3",
    ]);
    expect(filterByFacets(rows, { author: new Set() })).toHaveLength(3);
  });

  it("lists the distinct values of a facet, pages in numeric order", () => {
    expect(facetValues(rows, "author")).toEqual(["Ann", "Bob"]);
    expect(facetValues(rows, "page")).toEqual(["0", "1"]);
  });
});

describe("totals and grouping", () => {
  it("adds the rows of one unit", () => {
    const rows = buildMarkupRows([area("a", 10), area("b", 5)], options({ 0: metres }));
    const totals = computeTotals(rows);
    expect(totals.count).toBe(2);
    expect(totals.sums.area).toEqual({ value: 125, unit: "m" });
    expect(totals.sums.perimeter).toEqual({ value: 60, unit: "m" });
    expect(totals.sums.length).toBeNull();
    expect(totals.unit).toBe("m");
  });

  it("does not add values measured in different units", () => {
    const rows = buildMarkupRows([area("a", 10), area("b", 5, { pageIndex: 1 })], options({ 0: metres, 1: feet }));
    const totals = computeTotals(rows);
    expect(totals.sums.area).toBe(MIXED_UNITS);
    expect(totals.unit).toBe(MIXED_UNITS);
  });

  it("ignores rows without a measurement when summing and when naming the unit", () => {
    const rows = buildMarkupRows(
      [area("a", 10), annotation({ id: "h", type: PdfAnnotationSubtype.HIGHLIGHT, subject: "Area" })],
      options({ 0: metres }),
    );
    const totals = computeTotals(rows);
    expect(totals.count).toBe(2);
    expect(totals.sums.area).toEqual({ value: 100, unit: "m" });
    expect(totals.unit).toBe("m");
  });

  it("groups by subject in order, keeping the rows' order and a subtotal per group", () => {
    const rows = buildMarkupRows(
      [
        area("1", 1, { subject: "Slab" }),
        annotation({ id: "2", type: PdfAnnotationSubtype.HIGHLIGHT, subject: "Notes" }),
        area("3", 2, { subject: "slab" }),
        area("4", 3, { subject: "Floor", pageIndex: 1 }),
      ],
      options({ 0: metres, 1: feet }),
    );
    const groups = groupBySubject(rows);
    expect(groups.map((group) => [group.subject, group.rows.map((row) => row.id)])).toEqual([
      ["Floor", ["4"]],
      ["Notes", ["2"]],
      ["Slab", ["1", "3"]],
    ]);
    expect(groups[2].totals.sums.area).toEqual({ value: 5, unit: "m" });
    expect(groups[0].totals.sums.area).toEqual({ value: 9, unit: "ft" });
    expect(groupBySubject(rows, true).map((group) => group.subject)).toEqual(["Slab", "Notes", "Floor"]);
  });
});
