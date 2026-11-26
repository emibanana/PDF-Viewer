import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  StandardFonts,
} from "@cantoo/pdf-lib";

/**
 * The text-box (FreeText) annotations the viewer's engine writes have an empty appearance
 * stream, so any viewer that draws the stored appearance (Edge, Chrome, our own on reopen)
 * shows nothing, and viewers that fall back to the DA string pick their own font. This adds a
 * real appearance with the box's own font, size, colour and wrapped text.
 *
 * Only boxes whose appearance has no text are touched; other programs' boxes are left alone.
 * Standard fonts only (WinAnsi): characters outside it are written as "?".
 */

const PAD = 2;
const LINE_HEIGHT = 1.2;
const FREE_TEXT = PDFName.of("FreeText");

type FontSpec = { font: StandardFonts; key: string };

/** Maps the font name in a DA string (e.g. FXF_Helvetica_Bold, Helv, TiRo) to a standard font. */
export function standardFontFor(name: string): FontSpec {
  const n = name.toLowerCase();
  const bold = /bold|bd/.test(n);
  const italic = /oblique|italic|it\b/.test(n);
  if (/cour/.test(n)) {
    if (bold && italic) return { font: StandardFonts.CourierBoldOblique, key: "CoBO" };
    if (bold) return { font: StandardFonts.CourierBold, key: "CoBo" };
    if (italic) return { font: StandardFonts.CourierOblique, key: "CoOb" };
    return { font: StandardFonts.Courier, key: "Cour" };
  }
  if (/times|tiro|roman/.test(n)) {
    if (bold && italic) return { font: StandardFonts.TimesRomanBoldItalic, key: "TiBI" };
    if (bold) return { font: StandardFonts.TimesRomanBold, key: "TiBo" };
    if (italic) return { font: StandardFonts.TimesRomanItalic, key: "TiIt" };
    return { font: StandardFonts.TimesRoman, key: "TiRo" };
  }
  if (bold && italic) return { font: StandardFonts.HelveticaBoldOblique, key: "HeBO" };
  if (bold) return { font: StandardFonts.HelveticaBold, key: "HeBo" };
  if (italic) return { font: StandardFonts.HelveticaOblique, key: "HeOb" };
  return { font: StandardFonts.Helvetica, key: "Helv" };
}

interface DefaultAppearance {
  fontName: string;
  size: number;
  rgb: [number, number, number];
}

function parseDefaultAppearance(da: string): DefaultAppearance {
  const num = "(-?[\\d.]+)";
  let rgb: [number, number, number] = [0, 0, 0];
  const rg = da.match(new RegExp(`${num}\\s+${num}\\s+${num}\\s+rg`));
  const g = da.match(new RegExp(`${num}\\s+g\\b`));
  const k = da.match(new RegExp(`${num}\\s+${num}\\s+${num}\\s+${num}\\s+k\\b`));
  if (rg) rgb = [Number(rg[1]), Number(rg[2]), Number(rg[3])];
  else if (g) rgb = [Number(g[1]), Number(g[1]), Number(g[1])];
  else if (k) {
    const [c, m, y, key] = [k[1], k[2], k[3], k[4]].map(Number);
    rgb = [(1 - c) * (1 - key), (1 - m) * (1 - key), (1 - y) * (1 - key)];
  }
  const tf = da.match(new RegExp(`/(\\S+)\\s+${num}\\s+Tf`));
  const size = tf ? Number(tf[2]) : 12;
  return {
    fontName: tf ? tf[1] : "Helv",
    size: size > 0 ? size : 12,
    rgb,
  };
}

const n = (value: number) => (Math.round(value * 1000) / 1000).toString();

function readText(dict: PDFDict, key: string): string {
  const value = dict.lookup(PDFName.of(key));
  if (value instanceof PDFString || value instanceof PDFHexString) return value.decodeText();
  return "";
}

function readNumbers(dict: PDFDict, key: string): number[] {
  const value = dict.lookup(PDFName.of(key));
  if (!(value instanceof PDFArray)) return [];
  const out: number[] = [];
  for (let i = 0; i < value.size(); i++) {
    const item = value.lookup(i);
    if (item instanceof PDFNumber) out.push(item.asNumber());
  }
  return out;
}

function appearanceHasText(annot: PDFDict): boolean {
  const ap = annot.lookup(PDFName.of("AP"));
  if (!(ap instanceof PDFDict)) return false;
  const normal = ap.lookup(PDFName.of("N"));
  if (!(normal instanceof PDFStream)) return false;
  try {
    const bytes = normal instanceof PDFRawStream ? decodePDFRawStream(normal).decode() : normal.getContents();
    return /\b(Tj|TJ)\b/.test(new TextDecoder("latin1").decode(bytes));
  } catch {
    return true; // can't read it, so don't replace it
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function toWinAnsi(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text.replace(/\r\n?/g, "\n").replace(/\t/g, "    "))
    .map((ch) => (ch === "\n" || supported.has(ch.codePointAt(0)!) ? ch : "?"))
    .join("");
}

async function rebuildAppearance(doc: PDFDocument, annot: PDFDict, fonts: Map<string, PDFFont>): Promise<boolean> {
  const contents = readText(annot, "Contents");
  const rect = readNumbers(annot, "Rect");
  if (!contents.trim() || rect.length < 4) return false;

  const da = parseDefaultAppearance(readText(annot, "DA"));
  const spec = standardFontFor(da.fontName);
  let font = fonts.get(spec.key);
  if (!font) {
    font = await doc.embedFont(spec.font);
    fonts.set(spec.key, font);
  }

  const width = Math.abs(rect[2] - rect[0]);
  const height = Math.abs(rect[3] - rect[1]);
  const borderWidth = annot.lookup(PDFName.of("BS"));
  const border =
    borderWidth instanceof PDFDict ? ((borderWidth.lookup(PDFName.of("W")) as PDFNumber | undefined)?.asNumber() ?? 0) : 0;
  const pad = PAD + border;

  const text = toWinAnsi(contents, font);
  const lines = wrap(text, font, da.size, Math.max(1, width - 2 * pad));
  const align = (annot.lookup(PDFName.of("Q")) as PDFNumber | undefined)?.asNumber() ?? 0;

  const ascent = font.heightAtSize(da.size, { descender: false });
  const ops: string[] = ["q"];
  const background = readNumbers(annot, "C");
  if (background.length === 3 || background.length === 1) {
    const [r, g, b] = background.length === 3 ? background : [background[0], background[0], background[0]];
    ops.push(`${n(r)} ${n(g)} ${n(b)} rg 0 0 ${n(width)} ${n(height)} re f`);
  }
  ops.push(`0 0 ${n(width)} ${n(height)} re W n`);
  ops.push("BT", `/${spec.key} ${n(da.size)} Tf`, `${da.rgb.map(n).join(" ")} rg`);
  lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, da.size);
    const x = align === 1 ? (width - lineWidth) / 2 : align === 2 ? width - pad - lineWidth : pad;
    const y = height - pad - ascent - index * da.size * LINE_HEIGHT;
    ops.push(`1 0 0 1 ${n(x)} ${n(y)} Tm ${font.encodeText(line).toString()} Tj`);
  });
  ops.push("ET", "Q");

  const opacity = (annot.lookup(PDFName.of("CA")) as PDFNumber | undefined)?.asNumber();
  const resources: Record<string, unknown> = {
    Font: { [spec.key]: font.ref },
  };
  if (opacity !== undefined && opacity < 1) {
    resources.ExtGState = { GS: { Type: "ExtGState", ca: opacity, CA: opacity } };
    ops[0] = "q /GS gs";
  }

  const { context } = doc;
  const stream = context.stream(ops.join("\n"), {
    Type: "XObject",
    Subtype: "Form",
    FormType: 1,
    BBox: [0, 0, width, height],
    Resources: resources as never,
  });
  const ref: PDFRef = context.register(stream);
  annot.set(PDFName.of("AP"), context.obj({ N: ref }));
  annot.set(PDFName.of("DA"), PDFString.of(`${da.rgb.map(n).join(" ")} rg /${spec.key} ${n(da.size)} Tf`));
  return true;
}

/** Makes the standard fonts named in the annotations' DA strings resolvable from the AcroForm. */
function registerDefaultResources(doc: PDFDocument, fonts: Map<string, PDFFont>) {
  const { context, catalog } = doc;
  let acroForm = catalog.lookup(PDFName.of("AcroForm"));
  if (!(acroForm instanceof PDFDict)) {
    acroForm = context.obj({});
    catalog.set(PDFName.of("AcroForm"), acroForm);
  }
  const form = acroForm as PDFDict;
  let resources = form.lookup(PDFName.of("DR"));
  if (!(resources instanceof PDFDict)) {
    resources = context.obj({});
    form.set(PDFName.of("DR"), resources);
  }
  let fontDict = (resources as PDFDict).lookup(PDFName.of("Font"));
  if (!(fontDict instanceof PDFDict)) {
    fontDict = context.obj({});
    (resources as PDFDict).set(PDFName.of("Font"), fontDict);
  }
  for (const [key, font] of fonts) {
    if (!(fontDict as PDFDict).has(PDFName.of(key))) (fontDict as PDFDict).set(PDFName.of(key), font.ref);
  }
}

function includesBytes(bytes: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    if (bytes[i] !== needle[0]) continue;
    for (let j = 1; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const FREE_TEXT_MARKER = new TextEncoder().encode("/FreeText");
const OBJECT_STREAM_MARKER = new TextEncoder().encode("/ObjStm");

/** Cheap pre-check, so files without text boxes are never reparsed. Object streams hide the marker. */
function mayContainFreeText(bytes: Uint8Array): boolean {
  return includesBytes(bytes, FREE_TEXT_MARKER) || includesBytes(bytes, OBJECT_STREAM_MARKER);
}

/**
 * Returns the PDF with a proper appearance on each text box that lacks one, or the same bytes
 * when there is nothing to fix. Never throws: a file this cannot read is returned as it was.
 */
export async function ensureFreeTextAppearances(bytes: Uint8Array): Promise<Uint8Array> {
  if (!mayContainFreeText(bytes)) return bytes;
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const fonts = new Map<string, PDFFont>();
    let changed = false;
    for (const page of doc.getPages()) {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        const annot = annots.lookup(i);
        if (!(annot instanceof PDFDict)) continue;
        if (annot.lookup(PDFName.of("Subtype")) !== FREE_TEXT) continue;
        if (appearanceHasText(annot)) continue;
        if (await rebuildAppearance(doc, annot, fonts)) changed = true;
      }
    }
    if (!changed) return bytes;
    registerDefaultResources(doc, fonts);
    return await doc.save();
  } catch (error) {
    console.warn("[freeText] could not add text appearances", error);
    return bytes;
  }
}
