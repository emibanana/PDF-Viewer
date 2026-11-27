import { describe, expect, it } from "vitest";
import { PdfAnnotationBorderStyle, PdfAnnotationSubtype } from "@embedpdf/models";
import {
  appearancePatch,
  commentPatch,
  dashArrayFor,
  extentPatch,
  hasFill,
  isHiddenAnnotation,
  labelPatch,
  lineStylePatch,
  readAppearance,
  resetCommentPatch,
  type PropertyAnnotation,
} from "./propertyPatches";
import { readMarkupCustom } from "./markupModel";

const scale = { scale: { factor: 0.1, ratio: 100, unit: "m" }, precision: 2, source: "user" as const };

function wall(extra: Partial<PropertyAnnotation> = {}): PropertyAnnotation {
  return {
    type: PdfAnnotationSubtype.POLYLINE,
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    strokeColor: "#e53935",
    color: "#e53935",
    opacity: 1,
    strokeWidth: 2,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    contents: "10.00 sq m",
    custom: { markup: { v: 1, kind: "wall", height: 1 } },
    ...extra,
  };
}

function area(extra: Partial<PropertyAnnotation> = {}): PropertyAnnotation {
  return {
    type: PdfAnnotationSubtype.POLYGON,
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    strokeColor: "#e53935",
    color: "#ff8a80",
    opacity: 0.6,
    strokeWidth: 2,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    custom: { markup: { v: 1, kind: "area" } },
    ...extra,
  };
}

describe("readAppearance", () => {
  it("reads fill only for closed shapes", () => {
    expect(readAppearance(area())).toEqual({
      strokeColor: "#e53935",
      fillColor: "#ff8a80",
      opacity: 0.6,
      strokeWidth: 2,
      lineStyle: "solid",
    });
    expect(readAppearance(wall()).fillColor).toBeUndefined();
    expect(hasFill(wall())).toBe(false);
    expect(hasFill(area())).toBe(true);
  });

  it("reads only what an annotation has", () => {
    expect(readAppearance({ type: PdfAnnotationSubtype.TEXT })).toEqual({});
  });
});

describe("appearancePatch", () => {
  it("changes the stroke colour and opacity", () => {
    expect(appearancePatch(area(), { strokeColor: "#000000", opacity: 0.25 })).toEqual({
      strokeColor: "#000000",
      opacity: 0.25,
    });
  });

  it("clamps opacity to 0..1", () => {
    expect(appearancePatch(area(), { opacity: 3 })).toEqual({ opacity: 1 });
    expect(appearancePatch(area(), { opacity: -1 })).toEqual({ opacity: 0 });
  });

  it("ignores a fill colour on an open shape", () => {
    expect(appearancePatch(wall(), { fillColor: "#fff" })).toEqual({});
  });

  it("sets the fill of a closed shape through `color`", () => {
    expect(appearancePatch(area(), { fillColor: "#112233" })).toEqual({ color: "#112233" });
  });

  it("makes a line dashed with a pattern that follows the width", () => {
    expect(appearancePatch(wall(), { lineStyle: "dashed" })).toEqual({
      strokeStyle: PdfAnnotationBorderStyle.DASHED,
      strokeDashArray: dashArrayFor(2),
    });
  });

  it("re-derives the dash pattern when a dashed line changes width", () => {
    const dashed = wall({ strokeStyle: PdfAnnotationBorderStyle.DASHED, strokeDashArray: dashArrayFor(2) });
    expect(appearancePatch(dashed, { strokeWidth: 4 })).toEqual({
      strokeWidth: 4,
      strokeDashArray: dashArrayFor(4),
      strokeStyle: PdfAnnotationBorderStyle.DASHED,
    });
  });

  it("leaves the dash alone when a solid line changes width", () => {
    expect(appearancePatch(wall(), { strokeWidth: 5 })).toEqual({ strokeWidth: 5 });
  });

  it("clears the dash pattern when going back to solid", () => {
    const patch = appearancePatch(wall({ strokeStyle: PdfAnnotationBorderStyle.DASHED }), { lineStyle: "solid" });
    expect(patch).toEqual({ strokeStyle: PdfAnnotationBorderStyle.SOLID, strokeDashArray: undefined });
    expect("strokeDashArray" in patch).toBe(true);
  });
});

describe("lineStylePatch", () => {
  it("never makes a dash of zero length", () => {
    expect(lineStylePatch("dashed", 0).strokeDashArray).toEqual([3, 1]);
  });
});

describe("commentPatch", () => {
  it("marks the comment of our own markup as the user's", () => {
    const patch = commentPatch(wall(), "check on site", scale);
    expect(patch.contents).toBe("check on site");
    expect(readMarkupCustom(patch.custom)?.manualContents).toBe(true);
    expect(readMarkupCustom(patch.custom)?.height).toBe(1);
  });

  it("writes a plain comment on an annotation that is not ours", () => {
    expect(commentPatch({ type: PdfAnnotationSubtype.TEXT }, "hello", null)).toEqual({ contents: "hello" });
  });

  it("clearing the comment of our markup restores the measured value", () => {
    const typed = wall({ contents: "mine", custom: { markup: { v: 1, kind: "wall", height: 1, manualContents: true } } });
    const patch = commentPatch(typed, "", scale);
    expect(readMarkupCustom(patch.custom)?.manualContents).toBeUndefined();
    expect(patch.contents).toBe("10.00 sq m");
  });
});

describe("resetCommentPatch", () => {
  it("re-derives the value even when the typed text happens to equal it", () => {
    const typed = wall({ contents: "10.00 sq m", custom: { markup: { v: 1, kind: "wall", height: 1, manualContents: true } } });
    const patch = resetCommentPatch(typed, scale);
    expect(patch.contents).toBe("10.00 sq m");
    expect(readMarkupCustom(patch.custom)?.manualContents).toBeUndefined();
  });
});

describe("labelPatch", () => {
  it("stores the label under custom.markup and removes it when emptied", () => {
    const set = labelPatch(wall(), "Level 2");
    expect(readMarkupCustom(set?.custom)?.label).toBe("Level 2");
    const cleared = labelPatch({ ...wall(), custom: set?.custom }, "");
    expect(readMarkupCustom(cleared?.custom)?.label).toBeUndefined();
  });

  it("has nowhere to keep a label on an annotation that is not ours", () => {
    expect(labelPatch({ type: PdfAnnotationSubtype.TEXT }, "x")).toBeNull();
  });
});

describe("extentPatch", () => {
  it("sets the wall height and keeps the other fields", () => {
    const patch = extentPatch(wall(), "height", 2.7);
    expect(readMarkupCustom(patch?.custom)).toMatchObject({ kind: "wall", height: 2.7 });
  });

  it("refuses values that are not positive numbers", () => {
    expect(extentPatch(wall(), "height", 0)).toBeNull();
    expect(extentPatch(wall(), "height", Number.NaN)).toBeNull();
    expect(extentPatch(wall(), "height", -1)).toBeNull();
  });

  it("only applies to our own markups", () => {
    expect(extentPatch({ type: PdfAnnotationSubtype.POLYLINE }, "height", 3)).toBeNull();
  });
});

describe("isHiddenAnnotation", () => {
  it("is true for hidden, noView and invisible", () => {
    expect(isHiddenAnnotation({ flags: ["hidden"] })).toBe(true);
    expect(isHiddenAnnotation({ flags: ["print", "noView"] })).toBe(true);
    expect(isHiddenAnnotation({ flags: ["invisible"] })).toBe(true);
  });

  it("is false otherwise", () => {
    expect(isHiddenAnnotation({ flags: ["print"] })).toBe(false);
    expect(isHiddenAnnotation({})).toBe(false);
  });
});
