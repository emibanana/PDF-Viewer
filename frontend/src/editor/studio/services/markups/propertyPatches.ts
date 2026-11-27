import { PdfAnnotationBorderStyle, PdfAnnotationSubtype, type PdfAnnotationFlagName } from "@embedpdf/models";
import { DEFAULT_PRECISION, computeMeasurement, formatPrimary } from "@editor/services/markups/measureMath";
import { mergeMarkupCustom, readMarkupCustom, type MarkupAnnotation } from "@editor/services/markups/markupModel";
import type { PageScale } from "@editor/services/markups/pageScaleStore";

export type LineStyle = "solid" | "dashed";

/** What the Appearance fields show and edit; `fillColor` and `opacity` are absent where the annotation has none. */
export interface AppearanceValues {
  strokeColor?: string;
  fillColor?: string;
  opacity?: number;
  strokeWidth?: number;
  lineStyle?: LineStyle;
}

/** The part of an annotation the Properties fields read; every field is optional because the subtypes differ. */
export interface PropertyAnnotation extends MarkupAnnotation {
  author?: string;
  created?: Date;
  modified?: Date;
  flags?: PdfAnnotationFlagName[];
  strokeColor?: string;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  strokeStyle?: PdfAnnotationBorderStyle;
  strokeDashArray?: number[];
}

const MIN_WIDTH = 0.25;

const FILLABLE: ReadonlySet<PdfAnnotationSubtype> = new Set([
  PdfAnnotationSubtype.POLYGON,
  PdfAnnotationSubtype.SQUARE,
  PdfAnnotationSubtype.CIRCLE,
]);

/** A dash pattern that scales with the line, the same shape the viewer draws when none is stored. */
export function dashArrayFor(strokeWidth: number): number[] {
  const unit = Math.max(strokeWidth, 1);
  return [unit * 3, unit];
}

/** The stroke fields that make a line solid or dashed at `strokeWidth`. */
export function lineStylePatch(style: LineStyle, strokeWidth: number) {
  return style === "dashed"
    ? { strokeStyle: PdfAnnotationBorderStyle.DASHED, strokeDashArray: dashArrayFor(strokeWidth) }
    : { strokeStyle: PdfAnnotationBorderStyle.SOLID, strokeDashArray: undefined };
}

/** Whether the annotation has an interior that the fill colour applies to. */
export function hasFill(annotation: PropertyAnnotation): boolean {
  return FILLABLE.has(annotation.type) && typeof annotation.color === "string";
}

export function readAppearance(annotation: PropertyAnnotation): AppearanceValues {
  const values: AppearanceValues = {};
  if (typeof annotation.strokeColor === "string") values.strokeColor = annotation.strokeColor;
  if (hasFill(annotation)) values.fillColor = annotation.color;
  if (typeof annotation.opacity === "number") values.opacity = annotation.opacity;
  if (typeof annotation.strokeWidth === "number") values.strokeWidth = annotation.strokeWidth;
  if (annotation.strokeStyle !== undefined) {
    values.lineStyle = annotation.strokeStyle === PdfAnnotationBorderStyle.DASHED ? "dashed" : "solid";
  }
  return values;
}

/**
 * The annotation fields that apply `change` to `annotation`. A width change on a dashed line
 * re-derives its dash pattern, and fields the annotation does not have are left out.
 */
export function appearancePatch(annotation: PropertyAnnotation, change: AppearanceValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (change.strokeColor !== undefined && "strokeColor" in annotation) patch.strokeColor = change.strokeColor;
  if (change.fillColor !== undefined && hasFill(annotation)) patch.color = change.fillColor;
  if (change.opacity !== undefined && "opacity" in annotation) patch.opacity = clamp(change.opacity, 0, 1);
  const current = readAppearance(annotation);
  const widthChanged = change.strokeWidth !== undefined && "strokeWidth" in annotation;
  if (widthChanged) patch.strokeWidth = Math.max(MIN_WIDTH, change.strokeWidth as number);
  const styleChanged = change.lineStyle !== undefined && "strokeStyle" in annotation;
  if (styleChanged || (widthChanged && current.lineStyle === "dashed")) {
    const width = (patch.strokeWidth as number | undefined) ?? current.strokeWidth ?? 1;
    Object.assign(patch, lineStylePatch(change.lineStyle ?? current.lineStyle ?? "solid", width));
  }
  return patch;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function subjectPatch(subject: string): Record<string, unknown> {
  return { subject };
}

/** The label lives in our own fields; an empty label removes it. */
export function labelPatch(annotation: MarkupAnnotation, label: string): Record<string, unknown> | null {
  if (!readMarkupCustom(annotation.custom)) return null;
  return { custom: mergeMarkupCustom(annotation.custom, { label: label === "" ? undefined : label }) };
}

/**
 * The comment the user typed. On our measurement markups it is marked as theirs so the measured
 * value stops overwriting it; clearing it hands `/Contents` back to the measured value.
 */
export function commentPatch(annotation: MarkupAnnotation, text: string, pageScale: PageScale | null): Record<string, unknown> {
  if (!readMarkupCustom(annotation.custom)) return { contents: text };
  if (text === "") return resetCommentPatch(annotation, pageScale);
  return { contents: text, custom: mergeMarkupCustom(annotation.custom, { manualContents: true }) };
}

/** Drops the typed comment so `/Contents` shows the measured value again. */
export function resetCommentPatch(annotation: MarkupAnnotation, pageScale: PageScale | null): Record<string, unknown> {
  const custom = mergeMarkupCustom(annotation.custom, { manualContents: undefined });
  const measurement = computeMeasurement({ ...annotation, custom }, pageScale?.scale ?? null);
  const text = measurement ? formatPrimary(measurement, pageScale?.precision ?? DEFAULT_PRECISION) : null;
  return { custom, contents: text ?? "" };
}

/** Wall height or slab depth, in the page scale's unit. Values that are not positive numbers are refused (null). */
export function extentPatch(
  annotation: MarkupAnnotation,
  field: "height" | "depth",
  value: number,
): Record<string, unknown> | null {
  if (!readMarkupCustom(annotation.custom) || !Number.isFinite(value) || value <= 0) return null;
  const custom = mergeMarkupCustom(annotation.custom, field === "height" ? { height: value } : { depth: value });
  return { custom };
}

/** True when the annotation is marked hidden or not viewable, which the on-page labels follow. */
export function isHiddenAnnotation(annotation: Pick<PropertyAnnotation, "flags">): boolean {
  return !!annotation.flags?.some((flag) => flag === "hidden" || flag === "noView" || flag === "invisible");
}
