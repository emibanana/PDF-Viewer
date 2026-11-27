import { DEFAULT_PRECISION, computeMeasurement, defaultExtent, formatPrimary } from "@editor/services/markups/measureMath";
import {
  markupKindOf,
  mergeMarkupCustom,
  readMarkupCustom,
  type MarkupAnnotation,
} from "@editor/services/markups/markupModel";
import type { PageScale } from "@editor/services/markups/pageScaleStore";

export interface MarkupPatch {
  contents?: string;
  custom?: Record<string, unknown>;
}

export interface MarkupPatchOptions {
  /**
   * Also rewrite `/Contents` of a measurement another program wrote (a `*Dimension` annotation
   * without our fields). Off by default: that comment is the author's, and only a geometry edit
   * made here makes it stale.
   */
  rewriteForeignContents?: boolean;
}

/**
 * What an own measurement markup still needs so that `/Contents` shows its current value on
 * `pageScale` and its wall height or slab depth is set: the fields to write, or null when it is
 * already right. Ones whose comment the user wrote (`manualContents`) are never touched, and
 * annotations that are not ours only get their `/Contents` rewritten on request. Extents are only
 * defaulted once the page has a scale, because a default in paper units would be wrong the
 * moment a scale is set.
 */
export function computeMarkupPatch(
  annotation: MarkupAnnotation,
  pageScale: PageScale | null,
  options: MarkupPatchOptions = {},
): MarkupPatch | null {
  const markup = readMarkupCustom(annotation.custom);
  if (!markup) return options.rewriteForeignContents ? foreignContentsPatch(annotation, pageScale) : null;
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

function foreignContentsPatch(annotation: MarkupAnnotation, pageScale: PageScale | null): MarkupPatch | null {
  if (!markupKindOf(annotation)) return null;
  const measurement = computeMeasurement(annotation, pageScale?.scale ?? null);
  const text = measurement ? formatPrimary(measurement, pageScale?.precision ?? DEFAULT_PRECISION) : null;
  return text !== null && text !== annotation.contents ? { contents: text } : null;
}

/** `annotation` with {@link computeMarkupPatch} applied; the same object when nothing changes. */
export function normalizeMarkupAnnotation<A extends MarkupAnnotation>(annotation: A, pageScale: PageScale | null): A {
  const patch = computeMarkupPatch(annotation, pageScale);
  return patch ? { ...annotation, ...patch } : annotation;
}
