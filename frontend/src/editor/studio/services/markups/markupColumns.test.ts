import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKUP_COLUMNS,
  defaultMarkupListLayout,
  loadMarkupListLayout,
  sanitizeMarkupListLayout,
  saveMarkupListLayout,
  visibleColumnIds,
} from "./markupColumns";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("markup list layout", () => {
  it("shows the default columns, grouped by subject, when nothing is stored", () => {
    const layout = loadMarkupListLayout();
    expect(layout.groupBySubject).toBe(true);
    expect(layout.order).toHaveLength(MARKUP_COLUMNS.length);
    expect(visibleColumnIds(layout)).toContain("subject");
    expect(visibleColumnIds(layout)).not.toContain("label");
  });

  it("restores a saved layout", () => {
    const layout = defaultMarkupListLayout();
    layout.order = ["area", ...layout.order.filter((id) => id !== "area")];
    layout.hidden = ["comments"];
    layout.widths = { subject: 300 };
    layout.sorting = [{ id: "date", desc: true }];
    layout.groupBySubject = false;
    saveMarkupListLayout(layout);
    expect(loadMarkupListLayout()).toEqual(layout);
  });

  it("falls back to the default for unreadable storage", () => {
    localStorage.setItem("markups.list.layout", "{not json");
    expect(loadMarkupListLayout()).toEqual(defaultMarkupListLayout());
  });

  it("drops unknown and repeated ids and appends columns added since", () => {
    const layout = sanitizeMarkupListLayout({
      order: ["author", "bogus", "author", "subject"],
      hidden: ["bogus", "author"],
      widths: { subject: 5, author: 100000, bogus: 50, comments: "wide" },
      sorting: [{ id: "bogus", desc: true }, { id: "length" }],
      groupBySubject: "yes",
    });
    expect(layout.order.slice(0, 2)).toEqual(["author", "subject"]);
    expect(new Set(layout.order).size).toBe(MARKUP_COLUMNS.length);
    expect(layout.hidden).toContain("author");
    expect(layout.hidden).not.toContain("bogus");
    expect(layout.widths.subject).toBe(80);
    expect(layout.widths.author).toBe(800);
    expect(layout.widths.comments).toBeUndefined();
    expect(layout.sorting).toEqual([{ id: "length", desc: false }]);
    expect(layout.groupBySubject).toBe(true);
  });

  it("keeps a column the user showed visible when the saved layout predates it", () => {
    const layout = sanitizeMarkupListLayout({ order: ["subject", "type"], hidden: [] });
    expect(visibleColumnIds(layout)).toContain("type");
    expect(visibleColumnIds(layout)).not.toContain("label");
  });
});
