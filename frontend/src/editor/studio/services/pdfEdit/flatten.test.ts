import { describe, expect, it } from "vitest";
import { flattenForms } from "./flatten";
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
