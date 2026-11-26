import { describe, expect, it } from "vitest";
import { getPdfInfo } from "./pdfInfo";
import { makePdf } from "./testPdf";

describe("getPdfInfo", () => {
  it("reports metadata, size and per-page details", async () => {
    const file = await makePdf(2, "info.pdf", (doc) => {
      doc.setTitle("Report");
      doc.setAuthor("Ada");
    });
    const info = await getPdfInfo(file);
    expect(info.Metadata).toMatchObject({ Title: "Report", Author: "Ada" });
    expect(info.BasicInfo?.["Number of pages"]).toBe(2);
    expect(info.BasicInfo?.FileSizeInBytes).toBe(file.size);
    expect(info.DocumentInfo?.["PDF version"]).toMatch(/^\d\.\d$/);
    expect(info.Encryption?.IsEncrypted).toBe(false);
    expect(Object.keys(info.PerPageInfo ?? {})).toEqual(["Page 1", "Page 2"]);
    expect(info.PerPageInfo?.["Page 2"]?.Size?.["Width (px)"]).toBe("101");
    expect(info.PerPageInfo?.["Page 1"]?.["Page Orientation"]).toBe("Portrait");
  });

  it("lists form fields and no bookmarks for a plain document", async () => {
    const file = await makePdf(1, "form.pdf", (doc) => {
      doc.getForm().createTextField("name").addToPage(doc.getPage(0), { x: 1, y: 1, width: 50, height: 10 });
    });
    const info = await getPdfInfo(file);
    expect(Object.keys(info.FormFields ?? {})).toEqual(["name"]);
    expect(info["Bookmarks/Outline/TOC"]).toEqual([]);
  });

  it("rejects a file that is not a PDF", async () => {
    await expect(getPdfInfo(new File(["nope"], "x.pdf"))).rejects.toThrow(/Could not read x.pdf/);
  });
});
