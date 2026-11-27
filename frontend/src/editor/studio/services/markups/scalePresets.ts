import type { MeasureScale } from "@editor/utils/measurementTypes";
import { calculateScaleFactor, generateScaleLabel, parsePresetRatio } from "@editor/utils/measurementUtils";

export type ScaleSystem = "metric" | "imperial";

export interface ScalePreset {
  id: string;
  /** Shown in the preset list and as the page's scale. */
  label: string;
  /** Real length per unit of paper length, so 100 for 1:100. */
  ratio: number;
  /** The unit values on a page with this scale are shown in. */
  unit: "m" | "ft";
  system: ScaleSystem;
}

const METRIC_RATIOS = [1, 5, 10, 20, 50, 100, 200, 500, 1000] as const;

/** Architectural paper-inch per real-foot scales; the ratio is real inches per paper inch. */
const IMPERIAL: readonly { label: string; ratio: number }[] = [
  { label: `1/8" = 1'-0"`, ratio: 96 },
  { label: `1/4" = 1'-0"`, ratio: 48 },
  { label: `1/2" = 1'-0"`, ratio: 24 },
  { label: `1" = 1'-0"`, ratio: 12 },
  { label: `1" = 10'`, ratio: 120 },
  { label: `1" = 20'`, ratio: 240 },
  { label: `1" = 50'`, ratio: 600 },
];

export const METRIC_PRESETS: readonly ScalePreset[] = METRIC_RATIOS.map((ratio) => ({
  id: `1:${ratio}`,
  label: `1:${ratio}`,
  ratio,
  unit: "m",
  system: "metric",
}));

export const IMPERIAL_PRESETS: readonly ScalePreset[] = IMPERIAL.map(({ label, ratio }) => ({
  id: label,
  label,
  ratio,
  unit: "ft",
  system: "imperial",
}));

export const SCALE_PRESETS: readonly ScalePreset[] = [...METRIC_PRESETS, ...IMPERIAL_PRESETS];

/** The scale a preset stands for; its `factor` is the real length of one PDF point. */
export function presetScale(preset: ScalePreset): MeasureScale {
  return { factor: calculateScaleFactor(preset.ratio, preset.unit), ratio: preset.ratio, unit: preset.unit };
}

const sameRatio = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));

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

/** How a page's scale reads in the panel: an imperial preset by its name, anything else as `1:100 (m)`. */
export function describeScale(scale: MeasureScale | null | undefined): string | null {
  if (!scale) return null;
  const preset = findPreset(scale);
  if (preset?.system === "imperial") return preset.label;
  return generateScaleLabel(scale.ratio, scale.unit);
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
