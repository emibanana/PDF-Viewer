import { describe, expect, it } from "vitest";
import { degrees } from "@cantoo/pdf-lib";
import { rotatePdfs } from "./rotate";
import { makePdf, open } from "./testPdf";

const rotations = async (file: File) =>
  (await open(file)).getPages().map((p) => p.getRotation().angle);

describe("rotatePdfs", () => {
  it("adds the angle to each page's existing rotation", async () => {
    const file = await makePdf(3, "r.pdf", (doc) => {
      doc.getPage(1).setRotation(degrees(90));
      doc.getPage(2).setRotation(degrees(270));
    });
    const [out] = await rotatePdfs(90, [file]);
    expect(out.name).toBe("r.pdf");
    expect(await rotations(out)).toEqual([90, 180, 0]);
  });

  it("normalises negative and oversized angles", async () => {
    const file = await makePdf(1);
    expect(await rotations((await rotatePdfs(-90, [file]))[0])).toEqual([270]);
    expect(await rotations((await rotatePdfs(450, [file]))[0])).toEqual([90]);
    expect(await rotations((await rotatePdfs(360, [file]))[0])).toEqual([0]);
  });

  it("handles several files and keeps the page count", async () => {
    const out = await rotatePdfs(180, [
      await makePdf(2, "a.pdf"),
      await makePdf(4, "b.pdf"),
    ]);
    expect(out.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
    expect((await open(out[1])).getPageCount()).toBe(4);
  });
});
