// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { enterFinishesShape } from "./measureToolKeys";

const press = (
  key: string,
  target: EventTarget | null = null,
  mods: Partial<Record<"ctrlKey" | "altKey" | "metaKey", boolean>> = {},
) => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  target,
  ...mods,
});

describe("enterFinishesShape", () => {
  it.each(["measurePolylength", "measureCurve", "measureArea", "measureWall", "measureVolume"])(
    "finishes a shape drawn with %s",
    (tool) => {
      expect(enterFinishesShape(tool, press("Enter", document.body))).toBe(true);
    },
  );

  it("has nothing to finish for a length, which ends on its second click", () => {
    expect(enterFinishesShape("measureLength", press("Enter"))).toBe(false);
  });

  it("does nothing without a measurement tool armed", () => {
    expect(enterFinishesShape(null, press("Enter"))).toBe(false);
    expect(enterFinishesShape("freehand", press("Enter"))).toBe(false);
  });

  it("ignores other keys and modified Enter", () => {
    expect(enterFinishesShape("measureArea", press("a"))).toBe(false);
    expect(enterFinishesShape("measureArea", press("Enter", null, { ctrlKey: true }))).toBe(false);
  });

  it("leaves Enter to fields and buttons", () => {
    for (const tag of ["input", "textarea", "select", "button"]) {
      expect(enterFinishesShape("measureArea", press("Enter", document.createElement(tag)))).toBe(false);
    }
  });
});
