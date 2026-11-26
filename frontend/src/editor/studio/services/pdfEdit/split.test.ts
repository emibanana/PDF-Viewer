import { describe, expect, it } from "vitest";
import { PDFDict, PDFHexString, PDFName, PDFNumber } from "@cantoo/pdf-lib";
import { parseSize, splitPdfs } from "./split";
import { readOutline, replaceOutline } from "./outline";
import { makePdf, open, widths } from "./testPdf";

const pageCounts = async (files: File[]) =>
  Promise.all(files.map(async (f) => (await open(f)).getPageCount()));

describe("splitPdfs", () => {
  it("splits after the listed pages", async () => {
    const out = await splitPdfs({ kind: "afterPages", pages: "2,4" }, [
      await makePdf(5, "a.pdf"),
    ]);
    expect(out.map((f) => f.name)).toEqual(["a_1.pdf", "a_2.pdf", "a_3.pdf"]);
    expect(await widths(out[0])).toEqual([100, 101]);
    expect(await widths(out[1])).toEqual([102, 103]);
    expect(await widths(out[2])).toEqual([104]);
  });

  it("splits every N pages and into N documents", async () => {
    const every = await splitPdfs({ kind: "pageCount", count: 2 }, [
      await makePdf(5),
    ]);
    expect(await pageCounts(every)).toEqual([2, 2, 1]);
    const docs = await splitPdfs({ kind: "docCount", count: 2 }, [
      await makePdf(5),
    ]);
    expect(await pageCounts(docs)).toEqual([3, 2]);
  });

  it("starts a new part when the size limit is exceeded", async () => {
    const parts = await splitPdfs({ kind: "size", maxBytes: 1 }, [
      await makePdf(3),
    ]);
    expect(parts).toHaveLength(3);
  });

  it("splits on top-level bookmarks", async () => {
    const file = await makePdf(4, "book.pdf", (doc) => {
      const { context } = doc;
      const root = context.nextRef();
      const item = (title: string, page: number) =>
        context.register(
          context.obj({
            Title: PDFHexString.fromText(title),
            Parent: root,
            Dest: [doc.getPage(page).ref, PDFName.of("Fit")],
          }),
        );
      const a = item("Intro", 0);
      const b = item("Body", 2);
      context.lookup(a, PDFDict).set(PDFName.of("Next"), b);
      context.assign(
        root,
        context.obj({
          Type: "Outlines",
          First: a,
          Last: b,
          Count: PDFNumber.of(2),
        }),
      );
      doc.catalog.set(PDFName.of("Outlines"), root);
    });
    expect(
      readOutline(await open(file)).map((e) => [e.title, e.pageIndex]),
    ).toEqual([
      ["Intro", 0],
      ["Body", 2],
    ]);
    const out = await splitPdfs({ kind: "chapters", level: 1 }, [file]);
    expect(out.map((f) => f.name)).toEqual([
      "book_1_Intro.pdf",
      "book_2_Body.pdf",
    ]);
    expect(await widths(out[1])).toEqual([102, 103]);
  });

  it("explains a missing bookmark level", async () => {
    await expect(
      splitPdfs({ kind: "chapters", level: 1 }, [await makePdf(2)]),
    ).rejects.toThrow(/No bookmarks/);
  });
});

describe("parseSize", () => {
  it("reads units", () => {
    expect(parseSize("10MB")).toBe(10 * 1024 * 1024);
    expect(parseSize("500")).toBe(500);
    expect(() => parseSize("big")).toThrow();
  });
});

describe("replaceOutline", () => {
  it("writes nested bookmarks, clamps pages, and can clear them", async () => {
    const file = await makePdf(3, "t.pdf");
    const out = await replaceOutline(file, [
      {
        title: "Part",
        pageNumber: 1,
        children: [{ title: "Chapter", pageNumber: 99, children: [] }],
      },
      { title: "End", pageNumber: 3, children: [] },
    ]);
    expect(readOutline(await open(out))).toEqual([
      { title: "Part", pageIndex: 0, level: 1 },
      { title: "Chapter", pageIndex: 2, level: 2 },
      { title: "End", pageIndex: 2, level: 1 },
    ]);
    const cleared = await replaceOutline(out, []);
    expect(readOutline(await open(cleared))).toEqual([]);
  });
});
