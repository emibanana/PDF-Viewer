import type { Rect } from "@embedpdf/models";
import type { MarkupPoint } from "@editor/services/markups/markupModel";
import { sampleCatmullRomIndexed } from "@editor/services/markups/measureMath";

const EPSILON = 1e-6;

const samePoint = (a: MarkupPoint, b: MarkupPoint) => Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON;

export interface CurveEdit {
  controlPoints: MarkupPoint[];
  vertices: MarkupPoint[];
}

/**
 * What a curve's clicked points and sampled vertices become when its vertices are patched to
 * `patched`, given the consistent pair `controlPoints` and `vertices` from before the edit. The
 * three edits an editor produces: nothing changed (an undo back to this state), the whole curve
 * moved (every vertex by the same delta), or one control point dragged (its handle is the only one
 * offered, so it is the only vertex that differs), which re-samples the spline through the new
 * point. Anything else is no longer a curve through the clicked points: null.
 */
export function applyCurveVertexEdit(
  controlPoints: readonly MarkupPoint[],
  vertices: readonly MarkupPoint[],
  patched: readonly MarkupPoint[],
): CurveEdit | null {
  const sampled = sampleCatmullRomIndexed(controlPoints);
  if (patched.length !== vertices.length || sampled.points.length !== vertices.length) return null;
  const changed = patched.flatMap((point, index) => (samePoint(point, vertices[index]) ? [] : [index]));
  if (changed.length === 0) return { controlPoints: controlPoints.map(({ x, y }) => ({ x, y })), vertices: [...patched] };
  const dx = patched[0].x - vertices[0].x;
  const dy = patched[0].y - vertices[0].y;
  if (patched.every((point, index) => samePoint(point, { x: vertices[index].x + dx, y: vertices[index].y + dy }))) {
    return {
      controlPoints: controlPoints.map(({ x, y }) => ({ x: x + dx, y: y + dy })),
      vertices: [...patched],
    };
  }
  if (changed.length !== 1) return null;
  const controlIndex = sampled.controlIndices.indexOf(changed[0]);
  if (controlIndex < 0) return null;
  const next = controlPoints.map(({ x, y }, index) => (index === controlIndex ? { ...patched[changed[0]] } : { x, y }));
  return { controlPoints: next, vertices: sampleCatmullRomIndexed(next).points };
}

/** Vertex indices of a curve's sampled geometry that are its clicked points. */
export function curveHandleIndices(controlPoints: readonly MarkupPoint[]): number[] {
  return sampleCatmullRomIndexed(controlPoints).controlIndices;
}

/** The rectangle a polyline's annotation occupies: its points padded by the stroke and a margin for line ends. */
export function polylineBounds(points: readonly MarkupPoint[], strokeWidth: number): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = strokeWidth / 2 + 1.2 * strokeWidth;
  const left = Math.min(...xs) - pad;
  const top = Math.min(...ys) - pad;
  return {
    origin: { x: left, y: top },
    size: { width: Math.max(...xs) + pad - left, height: Math.max(...ys) + pad - top },
  };
}

/**
 * Stylesheet that hides every vertex handle of the selected curve on `pageIndex` except those at
 * `handleIndices`: the annotation plugin offers a handle per sampled vertex (over a hundred on a
 * drawn curve), which would bury the line. The handle elements carry `data-epdf-vertex`.
 */
export function curveHandleCss(pageIndex: number, handleIndices: readonly number[]): string {
  const keep = handleIndices.map((index) => `:not([data-epdf-vertex="${index}"])`).join("");
  return `[data-page-index="${pageIndex}"] [data-epdf-vertex]${keep}{display:none !important;}`;
}
