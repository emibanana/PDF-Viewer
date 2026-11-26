import { describe, expect, it } from "vitest";
import { flattenForms, flattenToImages } from "./flatten";
import { makePdf, open } from "./testPdf";

describe("flattenForms", () => {
  it("turns form fields into page content", async () => {
    const file = await makePdf(1, "form.pdf", (doc) => {
      const field = doc.getForm().createTextField("name");
      field.setText("Ada");
      field.addToPage(doc.getPage(0), { x: 10, y: 100, width: 80, height: 20 });
    });
    expect((await open(file)).getForm().getFields()).toHaveLength(1);

    const [out] = await flattenForms([file]);
    const doc = await open(out);
    expect(doc.getForm().getFields()).toHaveLength(0);
    expect(doc.getPageCount()).toBe(1);
  });

  it("leaves a document without a form alone", async () => {
    const [out] = await flattenForms([await makePdf(2)]);
    expect((await open(out)).getPageCount()).toBe(2);
  });
});

describe("flattenToImages", () => {
  it("rebuilds each page as one image and drops the text", async () => {
    const src = await makePdf(2, "a.pdf", (doc) => doc.getPage(0).drawText("secret"));
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const [out] = await flattenToImages([src], 150, async () => [
      { png: bytes, widthPt: 100, heightPt: 200 },
      { png: bytes, widthPt: 101, heightPt: 200 },
    ]);
    const doc = await open(out);
    expect(doc.getPages().map((p) => p.getWidth())).toEqual([100, 101]);
    expect(Buffer.from(await out.arrayBuffer()).includes("secret")).toBe(false);
  });
});
