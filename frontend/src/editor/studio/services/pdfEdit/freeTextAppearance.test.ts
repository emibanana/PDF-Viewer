import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString, decodePDFRawStream, PDFRawStream } from "@cantoo/pdf-lib";
import { ensureFreeTextAppearances, standardFontFor } from "./freeTextAppearance";

async function pdfWithTextBox(opts: {
  contents: string;
  da: string;
  color?: number[];
  apContent?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const { context } = doc;
  const apStream = context.stream(opts.apContent ?? "/GS gs ", {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, 200, 60],
  });
  const annot = context.obj({
    Type: "Annot",
    Subtype: "FreeText",
    Rect: [20, 200, 220, 260],
    Contents: PDFString.of(opts.contents),
    DA: PDFString.of(opts.da),
    Q: 0,
    F: 4,
    AP: { N: context.register(apStream) },
    ...(opts.color ? { C: opts.color } : {}),
  });
  page.node.set(PDFName.of("Annots"), context.obj([context.register(annot)]));
  return doc.save();
}

async function firstAnnot(bytes: Uint8Array): Promise<PDFDict> {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPages()[0].node.lookup(PDFName.of("Annots"), PDFArray);
  return annots.lookup(0, PDFDict);
}

function streamText(annot: PDFDict): string {
  const ap = annot.lookup(PDFName.of("AP"), PDFDict);
  const stream = ap.lookup(PDFName.of("N"));
  const bytes =
    stream instanceof PDFRawStream
      ? decodePDFRawStream(stream).decode()
      : (stream as { getContents(): Uint8Array }).getContents();
  return new TextDecoder("latin1").decode(bytes);
}

describe("standardFontFor", () => {
  it("maps DA names to standard fonts", () => {
    expect(standardFontFor("FXF_Courier").key).toBe("Cour");
    expect(standardFontFor("FXF_Helvetica_Bold").key).toBe("HeBo");
    expect(standardFontFor("TiRo").key).toBe("TiRo");
    expect(standardFontFor("Unknown").key).toBe("Helv");
  });
});

describe("ensureFreeTextAppearances", () => {
  it("draws the text in the box's own font, size and colour", async () => {
    const input = await pdfWithTextBox({
      contents: "Hello world",
      da: "0.5 0 0 rg /FXF_Courier 18 Tf",
    });
    const annot = await firstAnnot(await ensureFreeTextAppearances(input));
    const content = streamText(annot);
    expect(content).toMatch(/\bTj\b/);
    expect(content).toContain("/Cour 18 Tf");
    expect(content).toContain("0.5 0 0 rg");
    const da = (annot.lookup(PDFName.of("DA")) as PDFString).decodeText();
    expect(da).toContain("/Cour 18 Tf");
  });

  it("wraps long text inside the box", async () => {
    const input = await pdfWithTextBox({
      contents: "one two three four five six seven eight nine ten eleven twelve",
      da: "0 0 0 rg /Helv 14 Tf",
    });
    const content = streamText(await firstAnnot(await ensureFreeTextAppearances(input)));
    expect((content.match(/\bTj\b/g) ?? []).length).toBeGreaterThan(1);
  });

  it("fills the background from /C and leaves it out when absent", async () => {
    const withBg = streamText(
      await firstAnnot(
        await ensureFreeTextAppearances(await pdfWithTextBox({ contents: "x", da: "0 0 0 rg /Helv 12 Tf", color: [1, 1, 0] })),
      ),
    );
    expect(withBg).toContain("1 1 0 rg 0 0 200 60 re f");
    const without = streamText(
      await firstAnnot(await ensureFreeTextAppearances(await pdfWithTextBox({ contents: "x", da: "0 0 0 rg /Helv 12 Tf" }))),
    );
    expect(without).not.toContain(" re f");
  });

  it("leaves a box that already has text in its appearance alone", async () => {
    const input = await pdfWithTextBox({
      contents: "Keep me",
      da: "0 0 0 rg /Helv 12 Tf",
      apContent: "BT /F1 12 Tf (Keep me) Tj ET",
    });
    expect(await ensureFreeTextAppearances(input)).toBe(input);
  });

  it("returns the same bytes when there is no text box", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    expect(await ensureFreeTextAppearances(bytes)).toBe(bytes);
  });

  it("replaces characters Helvetica cannot draw instead of failing", async () => {
    const input = await pdfWithTextBox({
      contents: "Hi 你好",
      da: "0 0 0 rg /Helv 12 Tf",
    });
    const out = await ensureFreeTextAppearances(input);
    expect(streamText(await firstAnnot(out))).toMatch(/\bTj\b/);
  });
});
