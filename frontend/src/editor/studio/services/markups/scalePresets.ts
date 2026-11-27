import type { MeasureScale } from "@editor/utils/measurementTypes";
import { calculateScaleFactor, generateScaleLabel, parsePresetRatio } from "@editor/utils/measurementUtils";

export interface ScalePreset {
  id: string;
  /** Shown in the preset list and as the page's scale. */
  label: string;
  /** Real length per unit of paper length, so 100 for 1:100. */
  ratio: number;
  /** The unit values on a page with this scale are shown in. */
  unit: "m";
}

const METRIC_RATIOS = [1, 5, 10, 20, 50, 100, 200, 500, 1000] as const;

export const METRIC_PRESETS: readonly ScalePreset[] = METRIC_RATIOS.map((ratio) => ({
  id: `1:${ratio}`,
  label: `1:${ratio}`,
  ratio,
  unit: "m",
}));

export const SCALE_PRESETS: readonly ScalePreset[] = METRIC_PRESETS;

/** The scale a preset stands for; its `factor` is the real length of one PDF point. */
export function presetScale(preset: ScalePreset): MeasureScale {
  return { factor: calculateScaleFactor(preset.ratio, preset.unit), ratio: preset.ratio, unit: preset.unit };
}

/** A factor stored to six digits (0.0352778) reads back about 1e-6 off, so equality is looser than float noise. */
const RATIO_TOLERANCE = 5e-4;

const sameRatio = (a: number, b: number) => Math.abs(a - b) <= RATIO_TOLERANCE * Math.max(Math.abs(a), Math.abs(b));

/** The preset a scale equals, so a scale read from a file or calibrated to a round value shows its name. */
export function findPreset(scale: MeasureScale | null | undefined): ScalePreset | null {
  if (!scale || scale.ratio === null) return null;
  const ratio = scale.ratio;
  return (
    SCALE_PRESETS.find(
      (preset) =>
        preset.unit === scale.unit.toLowerCase() &&
        sameRatio(preset.ratio, ratio) &&
        sameRatio(presetScale(preset).factor, scale.factor),
    ) ?? null
  );
}

/** How a page's scale reads in the panel, for example `1:100 (m)`. */
export function describeScale(scale: MeasureScale | null | undefined): string | null {
  if (!scale) return null;
  return generateScaleLabel(scale.ratio, scale.unit);
}

/**
 * A ratio derived from a file's scale factor, rounded for display and editing. The factor in a
 * `/VP` is stored to a few digits (0.0352778 for 1:100), so dividing it back gives 100.0001. A
 * ratio within 0.05% of a whole number (every preset ratio is one) shows as that number, anything
 * else to two decimals.
 */
export function roundRatio(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return ratio;
  const whole = Math.round(ratio);
  if (whole > 0 && sameRatio(whole, ratio)) return whole;
  return Number(ratio.toFixed(2));
}

/** Reads `100`, `1:100` or `1 : 100` as the ratio 100; null for anything that is not a positive ratio. */
export function parseRatioInput(text: string): number | null {
  const trimmed = text.trim().replace(/\s+/g, "");
  if (trimmed === "") return null;
  if (trimmed.includes(":")) return parsePresetRatio(trimmed);
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A scale from a typed ratio and a unit; null when either is not usable. */
export function customScale(ratio: number, unit: string): MeasureScale | null {
  try {
    return { factor: calculateScaleFactor(ratio, unit), ratio, unit };
  } catch {
    return null;
  }
}
