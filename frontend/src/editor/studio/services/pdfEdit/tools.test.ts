import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from "@cantoo/pdf-lib";
import { cropPdfs } from "./crop";
import { addPageNumbers, addWatermark } from "./pageMarks";
import { sanitizePdfs } from "./sanitize";
import { makePdf, open } from "./testPdf";

/** A page's content stream bytes as text, so tests can look for drawn text. */
async function pageContent(file: File, index: number): Promise<string> {
  const page = (await open(file)).getPage(index);
  const { context } = page.doc;
  const contents = page.node.lookup(PDFName.of("Contents"));
  if (!contents) return "";
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => context.lookup(r)) : [contents];
  return streams
    .map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString("latin1"))
    .join("\n")
    .replace(/<([0-9A-Fa-f]+)>/g, (_, hex: string) => Buffer.from(hex, "hex").toString("latin1"));
}

describe("cropPdfs", () => {
  it("sets the crop box on the selected pages only", async () => {
    const [out] = await cropPdfs({ x: 10, y: 20, width: 50, height: 60 }, "2", [
      await makePdf(2),
    ]);
    const doc = await open(out);
    expect(doc.getPage(1).getCropBox()).toMatchObject({ x: 10, y: 20, width: 50, height: 60 });
    expect(doc.getPage(0).getCropBox().width).toBe(100);
  });

  it("clamps to the page and rejects an area outside it", async () => {
    const [out] = await cropPdfs({ x: 0, y: 0, width: 9999, height: 9999 }, "all", [
      await makePdf(1),
    ]);
    expect((await open(out)).getPage(0).getCropBox()).toMatchObject({ width: 100, height: 200 });
    await expect(
      cropPdfs({ x: 500, y: 500, width: 10, height: 10 }, "all", [await makePdf(1)]),
    ).rejects.toThrow(/outside page 1/);
  });
});

describe("addPageNumbers", () => {
  const base = {
    position: 8,
    margin: "medium" as const,
    fontSize: 12,
    font: "Helvetica" as const,
    startingNumber: 1,
    pages: "",
    text: "",
    zeroPad: 0,
  };

  it("numbers every page from the starting number", async () => {
    const [out] = await addPageNumbers({ ...base, startingNumber: 5, text: "Page {n} of {total}" }, [
      await makePdf(2),
    ]);
    expect(await pageContent(out, 0)).toContain("Page 5 of 2");
    expect(await pageContent(out, 1)).toContain("Page 6 of 2");
  });

  it("numbers only the chosen pages and pads", async () => {
    const [out] = await addPageNumbers({ ...base, pages: "2", zeroPad: 3 }, [await makePdf(2)]);
    expect(await pageContent(out, 0)).not.toContain("002");
    expect(await pageContent(out, 1)).toContain("002");
  });
});

describe("addWatermark", () => {
  const opts = { fontSize: 20, rotation: 45, opacity: 0.5, widthSpacer: 10, heightSpacer: 10, color: "#ff0000" };

  it("tiles the text over every page", async () => {
    const [out] = await addWatermark({ ...opts, text: "DRAFT" }, [await makePdf(2)]);
    expect(await pageContent(out, 0)).toContain("DRAFT");
    expect(await pageContent(out, 1)).toContain("DRAFT");
  });

  it("refuses empty text and characters the font cannot draw", async () => {
    await expect(addWatermark({ ...opts, text: " " }, [await makePdf(1)])).rejects.toThrow(/watermark text/);
    await expect(addWatermark({ ...opts, text: "水印" }, [await makePdf(1)])).rejects.toThrow(/cannot draw/);
  });
});

describe("sanitizePdfs", () => {
  const none = {
    removeJavaScript: false,
    removeEmbeddedFiles: false,
    removeXMPMetadata: false,
    removeMetadata: false,
    removeLinks: false,
    removeFonts: false,
  };

  it("removes document JavaScript but leaves the rest", async () => {
    const file = await makePdf(1, "js.pdf", (doc) => {
      const { context, catalog } = doc;
      const action = context.obj({ S: "JavaScript", JS: PDFString.of("app.alert(1)") });
      catalog.set(PDFName.of("OpenAction"), action);
      catalog.set(PDFName.of("Names"), context.obj({ JavaScript: context.obj({ Names: [] }) }));
      doc.setTitle("Keep me");
    });
    const [out] = await sanitizePdfs({ ...none, removeJavaScript: true }, [file]);
    const doc = await open(out);
    expect(doc.catalog.has(PDFName.of("OpenAction"))).toBe(false);
    expect(doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.has(PDFName.of("JavaScript"))).toBeFalsy();
    expect(doc.getTitle()).toBe("Keep me");
  });

  it("clears the information dictionary and XMP metadata", async () => {
    const file = await makePdf(1, "m.pdf", (doc) => {
      doc.setTitle("Secret");
      doc.setAuthor("Ada");
      doc.catalog.set(PDFName.of("Metadata"), doc.context.stream("<xmp/>"));
    });
    const [out] = await sanitizePdfs({ ...none, removeMetadata: true, removeXMPMetadata: true }, [file]);
    const doc = await open(out);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.catalog.has(PDFName.of("Metadata"))).toBe(false);
  });

  it("removes link annotations on request", async () => {
    const file = await makePdf(1, "l.pdf", (doc) => {
      const link = doc.context.register(
        doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10] }),
      );
      doc.getPage(0).node.set(PDFName.of("Annots"), doc.context.obj([link]));
    });
    const [out] = await sanitizePdfs({ ...none, removeLinks: true }, [file]);
    expect((await open(out)).getPage(0).node.Annots()?.size() ?? 0).toBe(0);
  });
});
