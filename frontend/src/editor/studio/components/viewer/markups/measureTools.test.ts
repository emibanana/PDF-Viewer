import { describe, expect, it, vi } from "vitest";
import { PdfAnnotationSubtype } from "@embedpdf/models";
import type { AnnotationTool } from "@embedpdf/plugin-annotation";
import { MEASURE_TOOL_SPECS } from "../../../services/markups/markupModel";
import type { PageScale } from "../../../services/markups/pageScaleStore";
import { registerMeasureTools } from "./measureTools";

type Committed = Record<string, unknown>;

/** A stand-in for the plugin's own tools: its pointer handler commits what it is told to. */
function fakeRegistry(commit: Committed) {
  const tools = new Map<string, AnnotationTool>();
  const base = (id: string, type: PdfAnnotationSubtype) =>
    tools.set(id, {
      id,
      name: id,
      matchScore: (a) => (a.type === type ? 1 : 0),
      interaction: { exclusive: false, cursor: "crosshair" },
      defaults: {},
      pointerHandler: {
        annotationType: type,
        create: (context: { onCommit: (annotation: Committed) => void }) => ({
          onDoubleClick: () => context.onCommit(commit),
        }),
      },
    } as unknown as AnnotationTool);
  base("line", PdfAnnotationSubtype.LINE);
  base("polyline", PdfAnnotationSubtype.POLYLINE);
  base("polygon", PdfAnnotationSubtype.POLYGON);
  return {
    tools,
    getTool: (id: string) => tools.get(id),
    addTool: vi.fn((tool: AnnotationTool) => {
      tools.set(tool.id, tool);
    }),
  };
}

const scale: PageScale = {
  scale: { factor: (0.0254 / 72) * 100, ratio: 100, unit: "m" },
  precision: 2,
  source: "user",
};

/** Runs the tool's pointer handler as the plugin would and returns the annotation it commits. */
function draw(tool: AnnotationTool): Committed {
  const onCommit = vi.fn();
  const handler = (
    tool.pointerHandler as unknown as {
      create: (context: unknown) => { onDoubleClick: () => void };
    }
  ).create({ pageIndex: 0, onCommit, onPreview: vi.fn(), getTool: () => tool });
  handler.onDoubleClick();
  expect(onCommit).toHaveBeenCalledTimes(1);
  return onCommit.mock.calls[0][0] as Committed;
}

describe("registerMeasureTools", () => {
  it("registers every tool once, with their kind in the defaults", () => {
    const registry = fakeRegistry({});
    registerMeasureTools(registry, () => null);
    expect(registry.addTool).toHaveBeenCalledTimes(MEASURE_TOOL_SPECS.length);
    expect(MEASURE_TOOL_SPECS.map((spec) => registry.getTool(spec.id)?.id)).toEqual(MEASURE_TOOL_SPECS.map((spec) => spec.id));
    for (const spec of MEASURE_TOOL_SPECS) {
      const tool = registry.getTool(spec.id) as unknown as {
        defaults: { type: number; intent: string; subject: string; custom: { markup: { kind: string } } };
        behavior: { deactivateToolAfterCreate: boolean };
      };
      expect(tool.defaults).toMatchObject({ type: spec.subtype, intent: spec.intent, subject: spec.subject });
      expect(tool.defaults.custom.markup.kind).toBe(spec.kind);
      expect(tool.behavior.deactivateToolAfterCreate).toBe(false);
    }
    registerMeasureTools(registry, () => null);
    expect(registry.addTool).toHaveBeenCalledTimes(MEASURE_TOOL_SPECS.length);
  });

  it("wins the match over the plain tools for our markups and for foreign dimension annotations", () => {
    const registry = fakeRegistry({});
    registerMeasureTools(registry, () => null);
    const best = (annotation: Record<string, unknown>) =>
      [...registry.tools.values()]
        .map((tool) => ({ id: tool.id, score: tool.matchScore(annotation as never) }))
        .sort((a, b) => b.score - a.score)[0].id;
    const own = (kind: string, type: PdfAnnotationSubtype) => ({ type, custom: { markup: { v: 1, kind } } });
    expect(best(own("length", PdfAnnotationSubtype.LINE))).toBe("measureLength");
    expect(best(own("curve", PdfAnnotationSubtype.POLYLINE))).toBe("measureCurve");
    expect(best(own("wall", PdfAnnotationSubtype.POLYLINE))).toBe("measureWall");
    expect(best(own("volume", PdfAnnotationSubtype.POLYGON))).toBe("measureVolume");
    expect(best({ type: PdfAnnotationSubtype.POLYGON, intent: "PolygonDimension" })).toBe("measureArea");
    expect(best({ type: PdfAnnotationSubtype.POLYLINE })).toBe("polyline");
    expect(best({ type: PdfAnnotationSubtype.LINE })).toBe("line");
  });

  it("writes the measured value into the contents of a new markup", () => {
    const registry = fakeRegistry({
      type: PdfAnnotationSubtype.LINE,
      custom: { markup: { v: 1, kind: "length" } },
      linePoints: { start: { x: 0, y: 0 }, end: { x: 72, y: 0 } },
    });
    registerMeasureTools(registry, () => scale);
    expect(draw(registry.getTool("measureLength") as AnnotationTool).contents).toBe("2.54 m");
  });

  it("defaults a new wall's height from the page scale", () => {
    const registry = fakeRegistry({
      type: PdfAnnotationSubtype.POLYLINE,
      custom: { markup: { v: 1, kind: "wall" } },
      vertices: [
        { x: 0, y: 0 },
        { x: 72, y: 0 },
      ],
    });
    registerMeasureTools(registry, () => scale);
    const wall = draw(registry.getTool("measureWall") as AnnotationTool);
    expect(wall.contents).toBe("7.62 sq m");
    expect((wall.custom as { markup: { height: number } }).markup.height).toBe(3);
  });

  it("turns the clicked points of a curve into the sampled spline and keeps the points", () => {
    const clicked = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 0 },
    ];
    const registry = fakeRegistry({
      type: PdfAnnotationSubtype.POLYLINE,
      strokeWidth: 2,
      vertices: clicked,
      rect: { origin: { x: 0, y: 0 }, size: { width: 1, height: 1 } },
      custom: { markup: { v: 1, kind: "curve" } },
    });
    registerMeasureTools(registry, () => scale);
    const curve = draw(registry.getTool("measureCurve") as AnnotationTool);
    const vertices = curve.vertices as { x: number; y: number }[];
    expect(vertices.length).toBeGreaterThan(20);
    expect(vertices[0]).toEqual(clicked[0]);
    expect(vertices[vertices.length - 1]).toEqual(clicked[2]);
    expect((curve.custom as { markup: { controlPoints: unknown } }).markup.controlPoints).toEqual(clicked);
    const rect = curve.rect as { origin: { x: number; y: number }; size: { width: number; height: number } };
    expect(rect.size.width).toBeGreaterThan(100);
    expect(rect.origin.x).toBeLessThan(0);
    expect(curve.contents).toMatch(/ m$/);
  });

  it("leaves a plugin without the base tools untouched", () => {
    const registry = fakeRegistry({});
    registry.tools.delete("polygon");
    registerMeasureTools(registry, () => null);
    expect(registry.addTool).toHaveBeenCalledTimes(5);
  });
});
