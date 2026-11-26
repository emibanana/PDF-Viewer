import { describe, expect, it } from "vitest";
import {
  PDFArray,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFString,
} from "@cantoo/pdf-lib";
import { mergePdfs } from "./merge";
import { makePdf, open, widths } from "./testPdf";

const noOptions = { removeDigitalSignature: false, generateTableOfContents: false };

describe("mergePdfs", () => {
  it("concatenates the files in the order given", async () => {
    const a = await makePdf(2, "a.pdf");
    const b = await makePdf(3, "b.pdf", (d) => d.getPage(0).setSize(500, 200));
    const merged = await mergePdfs([b, a], noOptions);
    expect(merged.name).toBe("merged_b.pdf");
    expect(await widths(merged)).toEqual([500, 101, 102, 100, 101]);
  });

  it("adds one bookmark per file when asked", async () => {
    const merged = await mergePdfs(
      [await makePdf(2, "first.pdf"), await makePdf(1, "second.pdf")],
      { ...noOptions, generateTableOfContents: true },
    );
    const doc = await open(merged);
    const outlines = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    expect(outlines.get(PDFName.of("Count"))?.toString()).toBe("2");

    let item = outlines.lookup(PDFName.of("First"), PDFDict);
    const titles: string[] = [];
    const targets: unknown[] = [];
    while (item) {
      titles.push(
        (item.lookup(PDFName.of("Title")) as PDFHexString | PDFString).decodeText(),
      );
      const dest = item.lookup(PDFName.of("Dest"), PDFArray);
      targets.push(dest.get(0));
      item = item.lookupMaybe(PDFName.of("Next"), PDFDict) as PDFDict;
    }
    expect(titles).toEqual(["first", "second"]);
    expect(targets).toEqual([doc.getPage(0).ref, doc.getPage(2).ref]);
  });

  it("writes no outline by default", async () => {
    const merged = await mergePdfs([await makePdf(1), await makePdf(1)], noOptions);
    expect((await open(merged)).catalog.has(PDFName.of("Outlines"))).toBe(false);
  });

  it("drops signature widgets only when asked", async () => {
    const withSignature = await makePdf(1, "signed.pdf", (doc) => {
      const { context } = doc;
      const widget = context.register(
        context.obj({
          Type: "Annot",
          Subtype: "Widget",
          FT: "Sig",
          Rect: [0, 0, 10, 10],
        }),
      );
      doc.getPage(0).node.set(PDFName.of("Annots"), context.obj([widget]));
    });
    const annotCount = async (file: File) =>
      (await open(file))
        .getPage(0)
        .node.lookupMaybe(PDFName.of("Annots"), PDFArray)
        ?.size() ?? 0;

    expect(await annotCount(await mergePdfs([withSignature], noOptions))).toBe(1);
    expect(
      await annotCount(
        await mergePdfs([withSignature], { ...noOptions, removeDigitalSignature: true }),
      ),
    ).toBe(0);
  });
});
