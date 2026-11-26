import { PDFDocument, PDFFont, StandardFonts, rgb, degrees } from "@cantoo/pdf-lib";
import { loadPdf, savePdf } from "./common";
import { resolvePageSelection } from "./pages";

export type NumberFont = "Times" | "Helvetica" | "Courier";
export type Margin = "small" | "medium" | "large" | "x-large";

export interface PageNumberOptions {
  position: number; // 1..9, left to right then top to bottom (8 = bottom centre)
  margin: Margin;
  fontSize: number;
  font: NumberFont;
  startingNumber: number;
  /** Pages to number, e.g. "1,3,5-8". Empty means all. */
  pages: string;
  /** Template with {n}, {total} and {filename}. Empty means just the number. */
  text: string;
  /** Zero-pad the number to this many digits; 0 for none. */
  zeroPad: number;
}

const MARGIN_FACTOR: Record<Margin, number> = {
  small: 0.02,
  medium: 0.035,
  large: 0.05,
  "x-large": 0.075,
};
const FONTS: Record<NumberFont, StandardFonts> = {
  Times: StandardFonts.TimesRoman,
  Helvetica: StandardFonts.Helvetica,
  Courier: StandardFonts.Courier,
};

/** Draws a page number (or a text template containing {n}, {total}, {filename}) on each selected page. */
export async function addPageNumbers(
  options: PageNumberOptions,
  files: File[],
): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const font = await doc.embedFont(FONTS[options.font]);
    const total = doc.getPageCount();
    const selected = options.pages.trim()
      ? resolvePageSelection(options.pages, total)
      : doc.getPageIndices();
    for (const i of new Set(selected)) {
      const page = doc.getPage(i);
      const n = String(options.startingNumber + i).padStart(options.zeroPad, "0");
      const label = (options.text.trim() || "{n}")
        .replaceAll("{n}", n)
        .replaceAll("{total}", String(total))
        .replaceAll("{filename}", file.name.replace(/\.pdf$/i, ""));
      const { width, height } = page.getSize();
      const size = options.fontSize;
      const textWidth = font.widthOfTextAtSize(label, size);
      const m = MARGIN_FACTOR[options.margin];
      const col = (options.position - 1) % 3;
      const row = Math.floor((options.position - 1) / 3);
      const x = [width * m, (width - textWidth) / 2, width * (1 - m) - textWidth][col];
      const y = [height * (1 - m) - size, (height - size) / 2, height * m][row];
      page.drawText(label, { x, y, size, font, color: rgb(0, 0, 0) });
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}

export interface WatermarkOptions {
  text?: string;
  image?: File;
  fontSize: number; // also the image's width in points
  rotation: number;
  opacity: number; // 0..1
  widthSpacer: number;
  heightSpacer: number;
  color: string; // "#rrggbb"
}

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? parseInt(m[1], 16) : 0xd3d3d3;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

/** WinAnsi-encodable text only: the standard fonts have no other glyphs. */
function assertDrawable(text: string, font: PDFFont): void {
  const known = new Set(font.getCharacterSet());
  if ([...text].some((ch) => !known.has(ch.codePointAt(0) as number))) {
    throw new Error(
      "The watermark text has characters the built-in font cannot draw. Use Latin letters, or an image watermark.",
    );
  }
}

/** Tiles a text or image watermark over every page. */
export async function addWatermark(
  options: WatermarkOptions,
  files: File[],
): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    const doc = await loadPdf(file);
    const draw = await markDrawer(doc, options);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const stepX = draw.width + options.widthSpacer;
      const stepY = draw.height + options.heightSpacer;
      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          draw.at(page, x, y);
        }
      }
    }
    out.push(await savePdf(doc, file.name));
  }
  return out;
}

async function markDrawer(doc: PDFDocument, o: WatermarkOptions) {
  const rotate = degrees(o.rotation);
  if (o.image) {
    const bytes = new Uint8Array(await o.image.arrayBuffer());
    const image = /png$/i.test(o.image.type)
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const scaled = image.scale(o.fontSize / image.width);
    return {
      width: scaled.width,
      height: scaled.height,
      at: (page: ReturnType<PDFDocument["getPage"]>, x: number, y: number) =>
        page.drawImage(image, { x, y, ...scaled, rotate, opacity: o.opacity }),
    };
  }
  const text = (o.text ?? "").trim();
  if (!text) throw new Error("Enter the watermark text or choose an image.");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  assertDrawable(text, font);
  const color = hexToRgb(o.color);
  return {
    width: font.widthOfTextAtSize(text, o.fontSize),
    height: o.fontSize,
    at: (page: ReturnType<PDFDocument["getPage"]>, x: number, y: number) =>
      page.drawText(text, { x, y, size: o.fontSize, font, color, rotate, opacity: o.opacity }),
  };
}
