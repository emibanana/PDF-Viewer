import { describe, expect, it } from "vitest";
import { applyCurveVertexEdit, curveHandleIndices } from "./curveEditing";
import { sampleCatmullRomIndexed } from "./measureMath";

const clicked = [
  { x: 0, y: 0 },
  { x: 100, y: 50 },
  { x: 200, y: 0 },
  { x: 300, y: 60 },
];
const sampled = sampleCatmullRomIndexed(clicked);

describe("curveHandleIndices", () => {
  it("offers one handle per clicked point, at the samples that are those points", () => {
    const indices = curveHandleIndices(clicked);
    expect(indices).toHaveLength(4);
    expect(sampled.points.length).toBeGreaterThan(40);
    indices.forEach((index, k) => expect(sampled.points[index]).toEqual(clicked[k]));
  });
});

describe("applyCurveVertexEdit", () => {
  it("re-samples the spline when a clicked point is dragged", () => {
    const handle = curveHandleIndices(clicked)[1];
    const patched = sampled.points.map((p, i) => (i === handle ? { x: 100, y: 90 } : p));
    const edit = applyCurveVertexEdit(clicked, sampled.points, patched);
    expect(edit?.controlPoints[1]).toEqual({ x: 100, y: 90 });
    expect(edit?.controlPoints[0]).toEqual(clicked[0]);
    expect(edit?.vertices).toEqual(sampleCatmullRomIndexed(edit?.controlPoints ?? []).points);
  });

  it("moves the clicked points with a moved curve", () => {
    const patched = sampled.points.map((p) => ({ x: p.x + 10, y: p.y - 5 }));
    const edit = applyCurveVertexEdit(clicked, sampled.points, patched);
    expect(edit?.controlPoints).toEqual(clicked.map((p) => ({ x: p.x + 10, y: p.y - 5 })));
    expect(edit?.vertices).toEqual(patched);
  });

  it("keeps the clicked points when the vertices come back unchanged, as an undo does", () => {
    const edit = applyCurveVertexEdit(clicked, sampled.points, sampled.points);
    expect(edit?.controlPoints).toEqual(clicked);
  });

  it("gives up when a vertex that is not a clicked point is the one that moved", () => {
    const patched = sampled.points.map((p, i) => (i === 3 ? { x: p.x, y: p.y + 20 } : p));
    expect(applyCurveVertexEdit(clicked, sampled.points, patched)).toBeNull();
  });

  it("gives up when the vertex count no longer matches", () => {
    expect(applyCurveVertexEdit(clicked, sampled.points, sampled.points.slice(1))).toBeNull();
  });
});
