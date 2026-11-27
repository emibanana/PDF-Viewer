import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageMeasureScales } from "@editor/utils/measurementTypes";
import {
  aliasFileKey,
  clearPageScale,
  getMeasureScale,
  getPageScale,
  getUserPageScales,
  resetPageScalesForTests,
  resolveFileKey,
  seedPageScales,
  setPagePrecision,
  setPageScale,
  setScaleForPages,
  subscribePageScales,
} from "./pageScaleStore";

const metres = { factor: 0.03527, ratio: 100, unit: "m" };
const centimetres = { factor: 0.0833, ratio: 12, unit: "cm" };

beforeEach(() => resetPageScalesForTests());

describe("pageScaleStore", () => {
  it("has no scale until one is set", () => {
    expect(getMeasureScale("a", 0)).toBeNull();
    expect(getPageScale(null, 0)).toBeNull();
  });

  it("keeps a scale per file and page, as one the user set", () => {
    setPageScale("a", 1, metres);
    expect(getMeasureScale("a", 1)).toEqual(metres);
    expect(getMeasureScale("a", 0)).toBeNull();
    expect(getMeasureScale("b", 1)).toBeNull();
    expect(getPageScale("a", 1)).toMatchObject({ source: "user", precision: 2 });
  });

  it("applies one scale to several pages and remembers each page's precision", () => {
    setPageScale("a", 0, metres, 3);
    setScaleForPages("a", [0, 1, 2], centimetres);
    expect(getPageScale("a", 0)).toMatchObject({ scale: centimetres, precision: 3 });
    expect(getPageScale("a", 2)).toMatchObject({ scale: centimetres, precision: 2 });
    setPagePrecision("a", 2, 0);
    expect(getPageScale("a", 2)?.precision).toBe(0);
  });

  it("notifies subscribers on every change, and replaces entries instead of mutating them", () => {
    const listener = vi.fn();
    const stop = subscribePageScales(listener);
    setPageScale("a", 0, metres);
    const before = getPageScale("a", 0);
    setPagePrecision("a", 0, 1);
    expect(getPageScale("a", 0)).not.toBe(before);
    clearPageScale("a", 0);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    setPageScale("a", 0, metres);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("seeds from the file's viewports without overwriting the user, and never writes them back", () => {
    setPageScale("a", 1, centimetres);
    const fromFile: PageMeasureScales = new Map([
      [
        0,
        {
          pageHeight: 100,
          viewports: [
            { bbox: [0, 0, 50, 50], scale: centimetres },
            { bbox: null, scale: metres },
          ],
        },
      ],
      [1, { pageHeight: 100, viewports: [{ bbox: null, scale: metres }] }],
    ]);
    seedPageScales("a", fromFile);
    expect(getMeasureScale("a", 0)).toEqual(metres);
    expect(getPageScale("a", 0)?.source).toBe("file");
    expect(getMeasureScale("a", 1)).toEqual(centimetres);
    expect([...getUserPageScales("a").keys()]).toEqual([1]);
  });

  it("resolves a workspace file id to the key its scales are kept under", () => {
    aliasFileKey("version-2", "root");
    expect(resolveFileKey("version-2")).toBe("root");
    expect(resolveFileKey("other")).toBe("other");
    expect(resolveFileKey(undefined)).toBeNull();
  });
});
