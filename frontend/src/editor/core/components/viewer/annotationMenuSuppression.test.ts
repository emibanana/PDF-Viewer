import { describe, expect, it } from "vitest";
import {
  consumeMenuSuppression,
  suppressMenuSelection,
} from "@editor/components/viewer/annotationMenuSuppression";

describe("annotationMenuSuppression", () => {
  it("is consumed by the first committed update of a marked annotation only", () => {
    suppressMenuSelection(["a", "b"], 1000);
    expect(consumeMenuSuppression("a", 1001)).toBe(true);
    expect(consumeMenuSuppression("a", 1002)).toBe(false);
    expect(consumeMenuSuppression("b", 1003)).toBe(true);
  });

  it("does not affect annotations that were never marked", () => {
    expect(consumeMenuSuppression("unmarked", 1000)).toBe(false);
  });

  it("expires, so a commit that never arrives cannot swallow a later edit", () => {
    suppressMenuSelection(["late"], 1000);
    expect(consumeMenuSuppression("late", 1000 + 60_000)).toBe(false);
    expect(consumeMenuSuppression("late", 1001)).toBe(false);
  });
});
