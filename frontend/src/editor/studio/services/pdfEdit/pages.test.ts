import { describe, expect, it } from "vitest";
import {
  extractPages,
  removePages,
  reorganizePages,
  reorganizeSequence,
  resolvePageSelection,
} from "./pages";
import { BLANK_PAGE } from "./common";
import { makePdf, open, widths } from "./testPdf";

// Page n (one-based) of makePdf is 99 + n points wide.
const pageNumbersOf = async (file: File) =>
  (await widths(file)).map((w) => w - 99);

describe("resolvePageSelection", () => {
  it("keeps the written order of numbers and ranges", () => {
    expect(resolvePageSelection("3, 1,2", 5)).toEqual([2, 0, 1]);
    expect(resolvePageSelection("4-5,1", 5)).toEqual([3, 4, 0]);
  });

  it("supports open ranges, all, progressions and expressions", () => {
    expect(resolvePageSelection("4-", 6)).toEqual([3, 4, 5]);
    expect(resolvePageSelection("all", 3)).toEqual([0, 1, 2]);
    expect(resolvePageSelection("2n+1", 6)).toEqual([0, 2, 4]);
    expect(resolvePageSelection("odd & 1-5", 8)).toEqual([0, 2, 4]);
  });

  it("ignores pages past the end", () => {
    expect(resolvePageSelection("2,9,4-12", 5)).toEqual([1, 3, 4]);
  });
});

describe("removePages", () => {
  it("deletes the selected pages", async () => {
    const [out] = await removePages("2,4-5", [await makePdf(6, "x.pdf")]);
    expect(out.name).toBe("x.pdf");
    expect(await pageNumbersOf(out)).toEqual([1, 3, 6]);
  });

  it("refuses an empty selection and removing everything", async () => {
    const file = await makePdf(3);
    await expect(removePages("9", [file])).rejects.toThrow(/No pages/);
    await expect(removePages("1-3", [file])).rejects.toThrow(/every page/);
  });

  it("does not leave the removed page's content in the file", async () => {
    const marked = await makePdf(2, "m.pdf", (doc) => {
      doc.getPage(1).drawText("SECRET-MARKER");
    });
    const [out] = await removePages("2", [marked]);
    const bytes = Buffer.from(await out.arrayBuffer()).toString("latin1");
    expect(bytes).not.toContain("SECRET-MARKER");
  });
});

describe("extractPages", () => {
  it("keeps only the selected pages, in ascending order", async () => {
    const [out] = await extractPages("5,1,3-4", [await makePdf(6)]);
    expect(await pageNumbersOf(out)).toEqual([1, 3, 4, 5]);
  });

  it("fails when nothing matches", async () => {
    await expect(extractPages("8", [await makePdf(3)])).rejects.toThrow(
      /No pages/,
    );
  });
});

describe("reorganizeSequence", () => {
  const one = (mode: string, n: number, pages = "") =>
    reorganizeSequence(mode, pages, n).map((i) =>
      i === BLANK_PAGE ? "_" : i + 1,
    );

  it("custom order may repeat and drop pages", () => {
    expect(one("", 5, "3,1,3")).toEqual([3, 1, 3]);
  });

  it("presets", () => {
    expect(one("REVERSE_ORDER", 4)).toEqual([4, 3, 2, 1]);
    expect(one("DUPLEX_SORT", 5)).toEqual([1, 5, 2, 4, 3]);
    expect(one("BOOKLET_SORT", 8)).toEqual([8, 1, 2, 7, 6, 3, 4, 5]);
    expect(one("BOOKLET_SORT", 6)).toEqual(["_", 1, 2, "_", 6, 3, 4, 5]);
    expect(one("SIDE_STITCH_BOOKLET_SORT", 5)).toEqual([
      4, 1, 2, 3, "_", 5, "_", "_",
    ]);
    expect(one("ODD_EVEN_SPLIT", 5)).toEqual([1, 3, 5, 2, 4]);
    expect(one("ODD_EVEN_MERGE", 5)).toEqual([1, 4, 2, 5, 3]);
    expect(one("REMOVE_FIRST", 3)).toEqual([2, 3]);
    expect(one("REMOVE_LAST", 3)).toEqual([1, 2]);
    expect(one("REMOVE_FIRST_AND_LAST", 4)).toEqual([2, 3]);
    expect(one("DUPLICATE", 2, "3")).toEqual([1, 1, 1, 2, 2, 2]);
    expect(one("DUPLICATE", 2)).toEqual([1, 1, 2, 2]);
  });

  it("rejects unknown modes", () => {
    expect(() => reorganizeSequence("NOPE", "", 3)).toThrow(/Unknown/);
  });
});

describe("reorganizePages", () => {
  it("rebuilds the document in the new order", async () => {
    const [out] = await reorganizePages("", "3,1,2,2", [await makePdf(3)]);
    expect(await pageNumbersOf(out)).toEqual([3, 1, 2, 2]);
    const doc = await open(out);
    // Repeated pages are separate page objects, not one node listed twice.
    expect(new Set(doc.getPages().map((p) => p.ref.toString())).size).toBe(4);
  });

  it("adds blank pages of the source size for booklets", async () => {
    const [out] = await reorganizePages("BOOKLET_SORT", "", [
      await makePdf(2),
    ]);
    expect(await widths(out)).toEqual([100, 100, 101, 100]);
  });
});
