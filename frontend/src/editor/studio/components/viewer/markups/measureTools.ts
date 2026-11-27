import type { AnnotationCapability, AnnotationTool, HandlerFactory } from "@embedpdf/plugin-annotation";
import { PdfAnnotationBorderStyle, PdfAnnotationSubtype, type PdfAnnotationObject, type Position } from "@embedpdf/models";
import { clickToClickLineHandler } from "@editor/components/viewer/clickToClickLineHandler";
import {
  MEASURE_TOOL_SPECS,
  isOwnMarkup,
  mergeMarkupCustom,
  markupKindOf,
  type MeasureToolSpec,
} from "@editor/services/markups/markupModel";
import { polylineBounds } from "@editor/services/markups/curveEditing";
import { sampleCatmullRom } from "@editor/services/markups/measureMath";
import { normalizeMarkupAnnotation } from "@editor/services/markups/markupContents";
import type { PageScale } from "@editor/services/markups/pageScaleStore";

type ToolRegistry = Pick<AnnotationCapability, "getTool" | "addTool">;
type Handler = HandlerFactory<PdfAnnotationObject, string>;

const BASE_TOOL_ID: Partial<Record<PdfAnnotationSubtype, string>> = {
  [PdfAnnotationSubtype.LINE]: "line",
  [PdfAnnotationSubtype.POLYLINE]: "polyline",
  [PdfAnnotationSubtype.POLYGON]: "polygon",
};

const MEASURE_STROKE = "#e53935";
const MEASURE_FILL = "#ff8a80";
const MATCH_OWN = 20;
const MATCH_FOREIGN_DIMENSION = 15;

/**
 * Own markups match their tool by `custom.markup.kind`; a plain dimension annotation from
 * another program matches the tool its `/IT` and subtype stand for. Both outrank the plain
 * line, polyline and polygon tools, which score 1 to 10 for the same subtype.
 */
function matchScoreFor(spec: MeasureToolSpec) {
  return (annotation: PdfAnnotationObject): number => {
    if (markupKindOf(annotation) !== spec.kind) return 0;
    return isOwnMarkup(annotation) ? MATCH_OWN : MATCH_FOREIGN_DIMENSION;
  };
}

function defaultsFor(spec: MeasureToolSpec): Record<string, unknown> {
  const closed = spec.subtype === PdfAnnotationSubtype.POLYGON;
  return {
    type: spec.subtype,
    intent: spec.intent,
    subject: spec.subject,
    strokeColor: MEASURE_STROKE,
    color: closed ? MEASURE_FILL : MEASURE_STROKE,
    opacity: closed ? 0.6 : 1,
    strokeWidth: 2,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    custom: { markup: { v: 1, kind: spec.kind } },
  };
}

/** Turns the clicked points of a polyline into the spline through them, so the saved geometry draws as a curve in every viewer. */
function curveHandler(base: Handler): Handler {
  return {
    annotationType: base.annotationType,
    create(context) {
      return base.create({
        ...context,
        onPreview: (state) => {
          const vertices = (state?.data as { vertices?: Position[]; strokeWidth?: number } | undefined)?.vertices;
          if (!state || !vertices) return context.onPreview(state);
          const sampled = sampleCatmullRom(vertices);
          const bounds = polylineBounds(sampled, (state.data as { strokeWidth?: number }).strokeWidth ?? 1);
          context.onPreview({ ...state, bounds, data: { ...state.data, vertices: sampled, rect: bounds } });
        },
        onCommit: (annotation, ctx) => {
          if (annotation.type !== PdfAnnotationSubtype.POLYLINE) return context.onCommit(annotation, ctx);
          const controlPoints = annotation.vertices.map(({ x, y }) => ({ x, y }));
          const vertices = sampleCatmullRom(controlPoints);
          context.onCommit(
            {
              ...annotation,
              vertices,
              rect: polylineBounds(vertices, annotation.strokeWidth),
              custom: mergeMarkupCustom(annotation.custom, { controlPoints }),
            },
            ctx,
          );
        },
      });
    },
  };
}

/** Fills `/Contents` and the default wall height or slab depth into the annotation as it is created, so creation stays one undo step. */
function measuredHandler(base: Handler, getPageScale: MeasureScaleLookup): Handler {
  return {
    annotationType: base.annotationType,
    create(context) {
      return base.create({
        ...context,
        onCommit: (annotation, ctx) =>
          context.onCommit(normalizeMarkupAnnotation(annotation, getPageScale(context.pageIndex)), ctx),
      });
    },
  };
}

export type MeasureScaleLookup = (pageIndex: number) => PageScale | null;

function buildTool(spec: MeasureToolSpec, base: AnnotationTool, getPageScale: MeasureScaleLookup): AnnotationTool {
  const baseHandler = base.pointerHandler as Handler;
  let handler = spec.kind === "length" ? clickToClickLineHandler(baseHandler) : baseHandler;
  if (spec.kind === "curve") handler = curveHandler(handler);
  return {
    ...base,
    id: spec.id,
    name: spec.subject,
    labelKey: undefined,
    matchScore: matchScoreFor(spec),
    defaults: defaultsFor(spec),
    interaction: { ...base.interaction, cursor: "crosshair" },
    behavior: { deactivateToolAfterCreate: false, selectAfterCreate: true },
    clickBehavior: undefined,
    pointerHandler: measuredHandler(handler, getPageScale),
  };
}

/**
 * Adds the six measurement tools to the annotation plugin, each built on the plugin's own line,
 * polyline or polygon tool so selection, move, vertex editing and undo behave the same. Safe to
 * call again: tools that exist are left as they are, with their defaults.
 *
 * `getPageScale` is read at the moment a markup is committed, so a new markup carries its value
 * on the page's current scale.
 */
export function registerMeasureTools(api: ToolRegistry, getPageScale: MeasureScaleLookup): void {
  for (const spec of MEASURE_TOOL_SPECS) {
    if (api.getTool(spec.id)) continue;
    const base = api.getTool(BASE_TOOL_ID[spec.subtype] ?? "");
    if (!base?.pointerHandler) continue;
    api.addTool(buildTool(spec, base, getPageScale));
  }
}
