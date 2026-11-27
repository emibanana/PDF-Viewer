import { describe, expect, it } from "vitest";
import { clientToPagePixels, normalizeTurns } from "./pageGeometry";

describe("normalizeTurns", () => {
  it("wraps into 0..3", () => {
    expect(normalizeTurns(4)).toBe(0);
    expect(normalizeTurns(-1)).toBe(3);
    expect(normalizeTurns(5)).toBe(1);
    expect(normalizeTurns(undefined)).toBe(0);
    expect(normalizeTurns(Number.NaN)).toBe(0);
  });
});

describe("clientToPagePixels", () => {
  const size = { width: 200, height: 100 };

  it("is the offset inside the box when the page is not rotated", () => {
    const rect = { left: 50, top: 20, width: 200, height: 100 };
    expect(clientToPagePixels({ x: 60, y: 30 }, rect, size, 0)).toEqual({ x: 10, y: 10 });
  });

  it("maps the corners of a page turned a quarter clockwise", () => {
    const rect = { left: 0, top: 0, width: 100, height: 200 };
    // The unrotated top-left corner ends up at the top-right of the turned box.
    expect(clientToPagePixels({ x: 100, y: 0 }, rect, size, 1)).toEqual({ x: 0, y: 0 });
    // The unrotated top-right corner ends up at the bottom-right.
    expect(clientToPagePixels({ x: 100, y: 200 }, rect, size, 1)).toEqual({ x: 200, y: 0 });
    // The unrotated bottom-left corner ends up at the top-left.
    expect(clientToPagePixels({ x: 0, y: 0 }, rect, size, 1)).toEqual({ x: 0, y: 100 });
  });

  it("maps a page turned half a turn", () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(clientToPagePixels({ x: 200, y: 100 }, rect, size, 2)).toEqual({ x: 0, y: 0 });
    expect(clientToPagePixels({ x: 0, y: 0 }, rect, size, 2)).toEqual({ x: 200, y: 100 });
  });

  it("maps a page turned three quarters clockwise", () => {
    const rect = { left: 0, top: 0, width: 100, height: 200 };
    expect(clientToPagePixels({ x: 0, y: 200 }, rect, size, 3)).toEqual({ x: 0, y: 0 });
    expect(clientToPagePixels({ x: 100, y: 200 }, rect, size, 3)).toEqual({ x: 0, y: 100 });
  });
});
