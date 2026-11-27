import { PdfAnnotationBorderStyle } from "@embedpdf/models";
import { getPluginToolDefaults, setPluginToolDefaults } from "@editor/services/markups/annotationBridge";
import {
  MEASURE_TOOL_SPECS,
  isClosedKind,
  mergeMarkupCustom,
  readMarkupCustom,
  type MeasureToolId,
  type MeasureToolSpec,
} from "@editor/services/markups/markupModel";
import { lineStylePatch, type LineStyle } from "@editor/services/markups/propertyPatches";

/** What a tool gives a new markup that the user can set ahead of drawing it. Heights and depths are in the page scale's unit. */
export interface ToolDefaults {
  subject: string;
  strokeColor: string;
  fillColor: string;
  opacity: number;
  strokeWidth: number;
  lineStyle: LineStyle;
  height?: number;
  depth?: number;
}

export type StoredToolDefaults = Partial<Record<MeasureToolId, Partial<ToolDefaults>>>;

const STORAGE_KEY = "markups.toolDefaults";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim());

const isPositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** Keeps only the fields of `raw` that are usable; stored data can be anything. */
export function sanitizeToolDefaults(raw: unknown): Partial<ToolDefaults> {
  if (!isRecord(raw)) return {};
  const result: Partial<ToolDefaults> = {};
  if (typeof raw.subject === "string" && raw.subject.trim() !== "") result.subject = raw.subject;
  if (isColor(raw.strokeColor)) result.strokeColor = raw.strokeColor;
  if (isColor(raw.fillColor)) result.fillColor = raw.fillColor;
  if (typeof raw.opacity === "number" && raw.opacity >= 0 && raw.opacity <= 1) result.opacity = raw.opacity;
  if (isPositive(raw.strokeWidth)) result.strokeWidth = raw.strokeWidth;
  if (raw.lineStyle === "solid" || raw.lineStyle === "dashed") result.lineStyle = raw.lineStyle;
  if (isPositive(raw.height)) result.height = raw.height;
  if (isPositive(raw.depth)) result.depth = raw.depth;
  return result;
}

export function loadStoredToolDefaults(): StoredToolDefaults {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    const result: StoredToolDefaults = {};
    for (const spec of MEASURE_TOOL_SPECS) {
      const defaults = sanitizeToolDefaults(parsed[spec.id]);
      if (Object.keys(defaults).length > 0) result[spec.id] = defaults;
    }
    return result;
  } catch {
    return {};
  }
}

/** Remembers `patch` for a tool, on top of what is already stored for it. */
export function saveToolDefaults(toolId: MeasureToolId, patch: Partial<ToolDefaults>): void {
  try {
    const stored = loadStoredToolDefaults();
    stored[toolId] = { ...stored[toolId], ...sanitizeToolDefaults(patch) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be full or blocked; the defaults then last until the viewer is closed.
  }
}

/** Reads a tool's defaults out of the plugin's own default object for it. */
export function toolDefaultsFromPlugin(spec: MeasureToolSpec, pluginDefaults: Record<string, unknown>): ToolDefaults {
  const markup = readMarkupCustom(pluginDefaults.custom);
  const strokeColor = typeof pluginDefaults.strokeColor === "string" ? pluginDefaults.strokeColor : "#e53935";
  const result: ToolDefaults = {
    subject: typeof pluginDefaults.subject === "string" ? pluginDefaults.subject : spec.subject,
    strokeColor,
    fillColor: typeof pluginDefaults.color === "string" ? pluginDefaults.color : strokeColor,
    opacity: typeof pluginDefaults.opacity === "number" ? pluginDefaults.opacity : 1,
    strokeWidth: typeof pluginDefaults.strokeWidth === "number" ? pluginDefaults.strokeWidth : 2,
    lineStyle: pluginDefaults.strokeStyle === PdfAnnotationBorderStyle.DASHED ? "dashed" : "solid",
  };
  if (markup?.height !== undefined) result.height = markup.height;
  if (markup?.depth !== undefined) result.depth = markup.depth;
  return result;
}

/**
 * The plugin tool-default fields that carry `change`. Wall height and slab depth go into the
 * custom fields a new markup starts with; the fill colour only applies to the closed shapes.
 */
export function pluginPatchFor(
  spec: MeasureToolSpec,
  pluginDefaults: Record<string, unknown>,
  change: Partial<ToolDefaults>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (change.subject !== undefined) patch.subject = change.subject;
  if (change.strokeColor !== undefined) patch.strokeColor = change.strokeColor;
  if (change.opacity !== undefined) patch.opacity = change.opacity;
  if (change.fillColor !== undefined && isClosedKind(spec.kind)) {
    patch.color = change.fillColor;
  }
  const current = toolDefaultsFromPlugin(spec, pluginDefaults);
  const width = change.strokeWidth ?? current.strokeWidth;
  if (change.strokeWidth !== undefined) patch.strokeWidth = change.strokeWidth;
  if (change.lineStyle !== undefined || (change.strokeWidth !== undefined && current.lineStyle === "dashed")) {
    Object.assign(patch, lineStylePatch(change.lineStyle ?? current.lineStyle, width));
  }
  const extent =
    spec.kind === "wall" && change.height !== undefined
      ? { height: change.height }
      : spec.kind === "volume" && change.depth !== undefined
        ? { depth: change.depth }
        : null;
  if (extent) patch.custom = mergeMarkupCustom(pluginDefaults.custom, extent);
  return patch;
}

/** Puts what the user stored for each tool into the plugin, so markups drawn from now on start that way. */
export function applyStoredToolDefaults(stored: StoredToolDefaults = loadStoredToolDefaults()): void {
  for (const spec of MEASURE_TOOL_SPECS) {
    const change = stored[spec.id];
    const pluginDefaults = getPluginToolDefaults(spec.id);
    if (!change || !pluginDefaults) continue;
    const patch = pluginPatchFor(spec, pluginDefaults, change);
    if (Object.keys(patch).length > 0) setPluginToolDefaults(spec.id, patch);
  }
}

/** Changes a tool's defaults for markups drawn from now on and remembers them for the next session. */
export function updateToolDefaults(spec: MeasureToolSpec, change: Partial<ToolDefaults>): void {
  const pluginDefaults = getPluginToolDefaults(spec.id);
  if (pluginDefaults) {
    const patch = pluginPatchFor(spec, pluginDefaults, change);
    if (Object.keys(patch).length > 0) setPluginToolDefaults(spec.id, patch);
  }
  saveToolDefaults(spec.id, change);
}
