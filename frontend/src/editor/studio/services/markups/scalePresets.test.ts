import { describe, expect, it } from "vitest";
import { calculateCalibratedScale } from "../../../core/utils/measurementUtils";
import {
  METRIC_PRESETS,
  customScale,
  describeScale,
  findPreset,
  parseRatioInput,
  presetScale,
  roundRatio,
} from "./scalePresets";

describe("presets", () => {
  it("lists the metric presets of the plan", () => {
    expect(METRIC_PRESETS.map((preset) => preset.label)).toEqual([
      "1:1",
      "1:5",
      "1:10",
      "1:20",
      "1:50",
      "1:100",
      "1:200",
      "1:500",
      "1:1000",
    ]);
  });

  it("makes 1 mm on paper 100 mm in the world at 1:100", () => {
    const scale = presetScale(METRIC_PRESETS.find((preset) => preset.id === "1:100")!);
    const mmInPoints = 72 / 25.4;
    expect(mmInPoints * scale.factor).toBeCloseTo(0.1, 9);
    expect(scale.unit).toBe("m");
  });
});

describe("findPreset and describeScale", () => {
  it("recognises a preset's own scale", () => {
    const preset = METRIC_PRESETS[4];
    expect(findPreset(presetScale(preset))).toBe(preset);
  });

  it("describes a metric preset as ratio and unit", () => {
    expect(describeScale(presetScale(METRIC_PRESETS[5]))).toBe("1:100 (m)");
  });

  it("recognises a calibration that landed on a preset", () => {
    const calibrated = calculateCalibratedScale(72 / 25.4, 0.1, "m");
    expect(findPreset(calibrated)).toBe(METRIC_PRESETS.find((preset) => preset.id === "1:100"));
  });

  it("does not treat a different factor with the same ratio as a preset", () => {
    expect(findPreset({ factor: 0.5, ratio: 100, unit: "m" })).toBeNull();
  });

  it("returns null when no scale is set", () => {
    expect(describeScale(null)).toBeNull();
    expect(findPreset(null)).toBeNull();
  });
});

describe("parseRatioInput", () => {
  it.each([
    ["100", 100],
    ["1:100", 100],
    [" 1 : 250 ", 250],
    ["12.5", 12.5],
  ])("reads %s", (text, expected) => {
    expect(parseRatioInput(text)).toBe(expected);
  });

  it.each(["", "abc", "0", "-5", "2:100", "1:", "1:0"])("rejects %j", (text) => {
    expect(parseRatioInput(text)).toBeNull();
  });
});

describe("customScale", () => {
  it("builds a scale from a ratio and a unit", () => {
    const scale = customScale(50, "m");
    expect(scale).toEqual({ factor: presetScale(METRIC_PRESETS[4]).factor, ratio: 50, unit: "m" });
  });

  it("returns null for an unknown or imperial unit, or a bad ratio", () => {
    expect(customScale(50, "parsec")).toBeNull();
    expect(customScale(50, "ft")).toBeNull();
    expect(customScale(0, "m")).toBeNull();
  });
});

describe("roundRatio", () => {
  it.each([
    [100.0001, 100],
    [99.9996, 100],
    [50.26, 50.26],
    [12.3456, 12.35],
    [48.01, 48],
    [48.5, 48.5],
    [1000.2, 1000],
  ])("shows %f as %f", (ratio, expected) => {
    expect(roundRatio(ratio)).toBe(expected);
  });

  it("reads the factor of a 1:100 /VP written to six digits as 1:100", () => {
    const factor = 0.0352778;
    const ratio = factor / presetScale(METRIC_PRESETS[0]).factor;
    expect(ratio).not.toBe(100);
    expect(roundRatio(ratio)).toBe(100);
    expect(findPreset({ factor, ratio, unit: "m" })?.id).toBe("1:100");
  });
});
