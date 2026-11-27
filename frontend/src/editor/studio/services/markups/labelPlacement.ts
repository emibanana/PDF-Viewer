import type { MarkupAnnotation, MarkupKind, MarkupPoint } from "@editor/services/markups/markupModel";
import { distance, polygonArea } from "@editor/services/markups/measureMath";

/** The point `fraction` of the way along an open path, by length. */
export function pointAlongPath(points: readonly MarkupPoint[], fraction: number): MarkupPoint | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  if (total === 0) return points[0];
  let remaining = total * Math.min(1, Math.max(0, fraction));
  for (let i = 1; i < points.length; i++) {
    const step = distance(points[i - 1], points[i]);
    if (remaining <= step && step > 0) {
      const t = remaining / step;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    remaining -= step;
  }
  return points[points.length - 1];
}

/** Area centroid of a polygon; the mean of its corners when it is flat. */
export function polygonCentroid(points: readonly MarkupPoint[]): MarkupPoint | null {
  if (points.length === 0) return null;
  const mean = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  if (points.length < 3 || polygonArea(points) < 1e-9) return mean;
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    twiceArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
}

/** Where a measurement's value is written on the page, in PDF points: the middle of a line or path, the centre of an area. */
export function labelAnchor(annotation: MarkupAnnotation, kind: MarkupKind): MarkupPoint | null {
  if (kind === "area" || kind === "volume") return polygonCentroid(annotation.vertices ?? []);
  const path = annotation.linePoints ? [annotation.linePoints.start, annotation.linePoints.end] : (annotation.vertices ?? []);
  return pointAlongPath(path, 0.5);
}

/** Black or white, whichever reads on `background`; white for a colour that cannot be parsed. */
export function readableTextColor(background: string | undefined): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec(background?.trim() ?? "");
  if (!match) return "#fff";
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.4 ? "#111" : "#fff";
}
