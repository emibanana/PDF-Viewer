import { DEFAULT_PRECISION, computeMeasurement, defaultExtent, formatPrimary } from "@editor/services/markups/measureMath";
import { mergeMarkupCustom, readMarkupCustom, type MarkupAnnotation } from "@editor/services/markups/markupModel";
import type { PageScale } from "@editor/services/markups/pageScaleStore";

export interface MarkupPatch {
  contents?: string;
  custom?: Record<string, unknown>;
}

/**
 * What an own measurement markup still needs so that `/Contents` shows its current value on
 * `pageScale` and its wall height or slab depth is set: the fields to write, or null when it is
 * already right. Annotations that are not ours, and ones whose comment the user wrote
 * (`manualContents`), are never touched. Extents are only defaulted once the page has a scale,
 * because a default in paper units would be wrong the moment a scale is set.
 */
export function computeMarkupPatch(annotation: MarkupAnnotation, pageScale: PageScale | null): MarkupPatch | null {
  const markup = readMarkupCustom(annotation.custom);
  if (!markup) return null;
  const scale = pageScale?.scale ?? null;
  const patch: MarkupPatch = {};
  let custom = annotation.custom;
  if (scale) {
    const extent = defaultExtent(scale.unit);
    if (markup.kind === "wall" && markup.height === undefined) {
      custom = mergeMarkupCustom(custom, { height: extent.height });
    } else if (markup.kind === "volume" && markup.depth === undefined) {
      custom = mergeMarkupCustom(custom, { depth: extent.depth });
    }
  }
  if (custom !== annotation.custom) patch.custom = custom as Record<string, unknown>;
  if (!markup.manualContents) {
    const measurement = computeMeasurement({ ...annotation, custom }, scale);
    const text = measurement ? formatPrimary(measurement, pageScale?.precision ?? DEFAULT_PRECISION) : null;
    if (text !== null && text !== annotation.contents) patch.contents = text;
  }
  return patch.contents === undefined && patch.custom === undefined ? null : patch;
}

/** `annotation` with {@link computeMarkupPatch} applied; the same object when nothing changes. */
export function normalizeMarkupAnnotation<A extends MarkupAnnotation>(annotation: A, pageScale: PageScale | null): A {
  const patch = computeMarkupPatch(annotation, pageScale);
  return patch ? { ...annotation, ...patch } : annotation;
}
