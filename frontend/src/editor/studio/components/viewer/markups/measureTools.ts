import type { AnnotationCapability, AnnotationTool, HandlerFactory } from "@embedpdf/plugin-annotation";
import {
  PdfAnnotationBorderStyle,
  PdfAnnotationSubtype,
  type PdfAnnotationObject,
  type PdfPolygonAnnoObject,
  type Position,
} from "@embedpdf/models";
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
  const closed = spec.subtype === PdfAnnotationSubtype.POLYGON && spec.kind !== "count";
  return {
    type: spec.subtype,
    intent: spec.intent,
    subject: spec.subject,
    strokeColor: MEASURE_STROKE,
    color: closed ? MEASURE_FILL : MEASURE_STROKE,
    opacity: closed ? 0.6 : 1,
    strokeWidth: spec.kind === "count" ? 0.5 : 2,
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

const ANGLE_POINTS = 3;

/** Finishes the polyline on its third click: an angle is exactly two rays from a vertex. */
function angleHandler(base: Handler): Handler {
  return {
    annotationType: base.annotationType,
    create(context) {
      const inner = base.create(context);
      let clicks = 0;
      const reset = () => {
        clicks = 0;
      };
      return {
        ...inner,
        onClick(pos, evt, modeId) {
          inner.onClick?.(pos, evt, modeId);
          if (++clicks < ANGLE_POINTS) return;
          reset();
          inner.onDoubleClick?.(pos, evt, modeId);
        },
        onPointerCancel(pos, evt, modeId) {
          reset();
          inner.onPointerCancel?.(pos, evt, modeId);
        },
        onHandlerActiveStart(modeId) {
          reset();
          inner.onHandlerActiveStart?.(modeId);
        },
        onHandlerActiveEnd(modeId) {
          reset();
          inner.onHandlerActiveEnd?.(modeId);
        },
      };
    },
  };
}

/** Offsets from the checkmark's centre in a y-up page, in points: the shape Bluebeam draws for a count. */
const CHECKMARK: readonly Position[] = [
  { x: -9, y: -0.19 },
  { x: -6.96, y: 1.85 },
  { x: -2.44, y: -2.67 },
  { x: 6.96, y: 6.73 },
  { x: 9, y: 4.7 },
  { x: -2.44, y: -6.74 },
];

/** One click drops one checkmark; the save pass totals them per page and subject. */
function countHandler(base: Handler): Handler {
  return {
    annotationType: base.annotationType,
    create(context) {
      return {
        onClick(pos, evt) {
          if (evt.metaKey || evt.ctrlKey) return;
          const tool = context.getTool();
          if (!tool) return;
          const defaults = tool.defaults as Record<string, unknown>;
          const strokeWidth = typeof defaults.strokeWidth === "number" ? defaults.strokeWidth : 0.5;
          const vertices = CHECKMARK.map(({ x, y }) => ({ x: pos.x + x, y: pos.y - y }));
          const xs = vertices.map((v) => v.x);
          const ys = vertices.map((v) => v.y);
          const pad = strokeWidth / 2;
          const left = Math.min(...xs) - pad;
          const top = Math.min(...ys) - pad;
          const rect = { origin: { x: left, y: top }, size: { width: Math.max(...xs) + pad - left, height: Math.max(...ys) + pad - top } };
          const annotation = {
            ...defaults,
            type: PdfAnnotationSubtype.POLYGON,
            id: crypto.randomUUID(),
            pageIndex: context.pageIndex,
            created: new Date(),
            vertices,
            rect,
            contents: "1",
            flags: defaults.flags ?? ["print"],
          } as unknown as PdfPolygonAnnoObject;
          context.onCommit(annotation);
        },
      };
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
  if (spec.kind === "angle") handler = angleHandler(handler);
  if (spec.kind === "count") handler = countHandler(handler);
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
