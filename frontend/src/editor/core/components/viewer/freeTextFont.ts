import { PdfStandardFont } from "@embedpdf/models";

/** The fonts a text box can use. They are PDF standard fonts, so every viewer has them. */
export const FREE_TEXT_FONTS: { label: string; value: PdfStandardFont }[] = [
  { label: "Helvetica", value: PdfStandardFont.Helvetica },
  { label: "Times", value: PdfStandardFont.Times_Roman },
  { label: "Courier", value: PdfStandardFont.Courier },
];

/**
 * The engine takes the numeric enum. A string such as "Helvetica" reads as 0
 * (Courier), which is how text boxes used to be saved in the wrong font.
 */
export function toStandardFont(value: unknown): PdfStandardFont {
  if (typeof value === "number" && value in PdfStandardFont) {
    return value === PdfStandardFont.Unknown
      ? PdfStandardFont.Helvetica
      : (value);
  }
  if (typeof value === "string") {
    const name = value.trim().toLowerCase();
    if (name.startsWith("times")) return PdfStandardFont.Times_Roman;
    if (name.startsWith("courier")) return PdfStandardFont.Courier;
  }
  return PdfStandardFont.Helvetica;
}
