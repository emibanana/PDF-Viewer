import { describe, expect, it } from "vitest";
import { windowTitleFor } from "./useWindowTitle";
import { unsavedPrompt } from "./useUnsavedCloseGuard";

describe("windowTitleFor", () => {
  it("names the app when no file is open", () => {
    expect(windowTitleFor(undefined, false)).toBe("PDF Viewer");
  });

  it("puts the file first and marks unsaved changes", () => {
    expect(windowTitleFor("a.pdf", false)).toBe("a.pdf - PDF Viewer");
    expect(windowTitleFor("a.pdf", true)).toBe("\u25CF a.pdf - PDF Viewer");
  });
});

describe("unsavedPrompt", () => {
  it("lists a few names and counts the rest", () => {
    const names = ["a", "b", "c", "d", "e", "f", "g"];
    const text = unsavedPrompt(names);
    expect(text).toContain("e\n");
    expect(text).not.toContain("\nf");
    expect(text).toContain("+ 2 more");
  });
});
