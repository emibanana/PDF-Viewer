import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnnotationCapability } from "@embedpdf/plugin-annotation";
import { attachMarkupSync } from "./markupSync";
import {
  resetPageScalesForTests,
  setActiveFileKey,
  setPageScale,
} from "./pageScaleStore";
import { consumeMenuSuppression } from "../../../core/components/viewer/annotationMenuSuppression";

const metres = { factor: 0.0352778, ratio: 100, unit: "m" };

const lengthAnnotation = {
  id: "line-1",
  type: 4,
  pageIndex: 0,
  contents: "stale",
  linePoints: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
  custom: { markup: { v: 1, kind: "length" } },
};

function fakeApi() {
  const updateAnnotations = vi.fn();
  const api = {
    onAnnotationEvent: () => () => {},
    getAnnotations: () => [{ commitState: "synced", object: lengthAnnotation }],
    updateAnnotations,
  } as unknown as AnnotationCapability;
  return { api, updateAnnotations };
}

beforeEach(() => {
  resetPageScalesForTests();
  setActiveFileKey("file-a");
});

describe("attachMarkupSync, user scale change", () => {
  it("rewrites the page's markups and keeps the viewer from selecting one of them", () => {
    const { api, updateAnnotations } = fakeApi();
    const detach = attachMarkupSync(api);

    setPageScale("file-a", 0, metres);

    expect(updateAnnotations).toHaveBeenCalledTimes(1);
    expect(updateAnnotations.mock.calls[0][0]).toMatchObject([
      { pageIndex: 0, id: "line-1" },
    ]);
    expect(consumeMenuSuppression("line-1")).toBe(true);
    detach();
  });

  it("does not suppress anything when no markup needs rewriting", () => {
    const { api, updateAnnotations } = fakeApi();
    (api as unknown as { getAnnotations: () => unknown[] }).getAnnotations = () => [];
    const detach = attachMarkupSync(api);

    setPageScale("file-a", 0, metres);

    expect(updateAnnotations).not.toHaveBeenCalled();
    expect(consumeMenuSuppression("line-1")).toBe(false);
    detach();
  });
});
