import { beforeEach, describe, expect, it, vi } from "vitest";
import { PdfAnnotationBorderStyle } from "@embedpdf/models";
import { MEASURE_TOOL_SPECS, readMarkupCustom, type MeasureToolSpec } from "./markupModel";
import {
  loadStoredToolDefaults,
  pluginPatchFor,
  sanitizeToolDefaults,
  saveToolDefaults,
  toolDefaultsFromPlugin,
} from "./toolDefaults";

const specOf = (kind: string): MeasureToolSpec => MEASURE_TOOL_SPECS.find((spec) => spec.kind === kind) as MeasureToolSpec;

function pluginDefaultsOf(kind: "wall" | "area" | "length", extra: Record<string, unknown> = {}) {
  const spec = specOf(kind);
  return {
    subject: spec.subject,
    strokeColor: "#e53935",
    color: kind === "area" ? "#ff8a80" : "#e53935",
    opacity: kind === "area" ? 0.6 : 1,
    strokeWidth: 2,
    strokeStyle: PdfAnnotationBorderStyle.SOLID,
    custom: { markup: { v: 1, kind } },
    ...extra,
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("sanitizeToolDefaults", () => {
  it("keeps valid fields and drops the rest", () => {
    expect(
      sanitizeToolDefaults({
        subject: "Wall type A",
        strokeColor: "#112233",
        fillColor: "red",
        opacity: 1.5,
        strokeWidth: 3,
        lineStyle: "wavy",
        height: -1,
        depth: 0.2,
        extra: 1,
      }),
    ).toEqual({ subject: "Wall type A", strokeColor: "#112233", strokeWidth: 3, depth: 0.2 });
  });

  it("returns nothing for data that is not an object", () => {
    expect(sanitizeToolDefaults(null)).toEqual({});
    expect(sanitizeToolDefaults("x")).toEqual({});
    expect(sanitizeToolDefaults([1])).toEqual({});
  });
});

describe("stored defaults", () => {
  it("round-trips per tool", () => {
    saveToolDefaults("measureWall", { strokeColor: "#00ff00", height: 2.4 });
    saveToolDefaults("measureWall", { lineStyle: "dashed" });
    saveToolDefaults("measureArea", { opacity: 0.3 });
    expect(loadStoredToolDefaults()).toEqual({
      measureWall: { strokeColor: "#00ff00", height: 2.4, lineStyle: "dashed" },
      measureArea: { opacity: 0.3 },
    });
  });

  it("survives broken storage", () => {
    localStorage.setItem("markups.toolDefaults", "{not json");
    expect(loadStoredToolDefaults()).toEqual({});
    localStorage.setItem("markups.toolDefaults", "[]");
    expect(loadStoredToolDefaults()).toEqual({});
  });

  it("ignores tools it does not know", () => {
    localStorage.setItem("markups.toolDefaults", JSON.stringify({ measureNothing: { strokeWidth: 4 } }));
    expect(loadStoredToolDefaults()).toEqual({});
  });

  it("does not throw when storage refuses a write", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => saveToolDefaults("measureLength", { strokeWidth: 4 })).not.toThrow();
  });
});

describe("toolDefaultsFromPlugin", () => {
  it("reads the plugin's defaults", () => {
    expect(toolDefaultsFromPlugin(specOf("area"), pluginDefaultsOf("area"))).toEqual({
      subject: "Area",
      strokeColor: "#e53935",
      fillColor: "#ff8a80",
      opacity: 0.6,
      strokeWidth: 2,
      lineStyle: "solid",
    });
  });

  it("reads a stored wall height", () => {
    const defaults = pluginDefaultsOf("wall", { custom: { markup: { v: 1, kind: "wall", height: 2.4 } } });
    expect(toolDefaultsFromPlugin(specOf("wall"), defaults).height).toBe(2.4);
  });
});

describe("pluginPatchFor", () => {
  it("maps the fill colour to `color` on closed shapes only", () => {
    expect(pluginPatchFor(specOf("area"), pluginDefaultsOf("area"), { fillColor: "#123456" })).toEqual({ color: "#123456" });
    expect(pluginPatchFor(specOf("length"), pluginDefaultsOf("length"), { fillColor: "#123456" })).toEqual({});
  });

  it("puts a wall height into the custom fields a new markup starts with", () => {
    const patch = pluginPatchFor(specOf("wall"), pluginDefaultsOf("wall"), { height: 2.7 });
    expect(readMarkupCustom(patch.custom)).toMatchObject({ kind: "wall", height: 2.7 });
  });

  it("ignores a depth on a wall and a height on a volume", () => {
    expect(pluginPatchFor(specOf("wall"), pluginDefaultsOf("wall"), { depth: 1 })).toEqual({});
  });

  it("sets a dashed pattern from the line width", () => {
    const patch = pluginPatchFor(specOf("length"), pluginDefaultsOf("length"), { lineStyle: "dashed", strokeWidth: 4 });
    expect(patch).toMatchObject({
      strokeStyle: PdfAnnotationBorderStyle.DASHED,
      strokeWidth: 4,
      strokeDashArray: [12, 4],
    });
  });
});
