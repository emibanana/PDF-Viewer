import { describe, expect, it } from "vitest";
import { reuseSnapshots } from "@editor/tools/pdfTextEditor/store/reuseSnapshots";

const run = (id: string, text: string, xs: number[] = [1, 2]) => ({
  id,
  text,
  bounds: { x: 0, y: 0 },
  xs,
  note: undefined as string | undefined,
});

describe("reuseSnapshots", () => {
  it("keeps the previous object for an equal snapshot and takes the new one for a changed one", () => {
    const prev = [run("a", "one"), run("b", "two")];
    const next = [run("a", "one"), run("b", "TWO")];
    const out = reuseSnapshots(prev, next);
    expect(out[0]).toBe(prev[0]);
    expect(out[1]).toBe(next[1]);
  });

  it("notices a changed nested array and a run with no previous", () => {
    const prev = [run("a", "one", [1, 2])];
    const next = [run("a", "one", [1, 3]), run("c", "new")];
    const out = reuseSnapshots(prev, next);
    expect(out[0]).toBe(next[0]);
    expect(out[1]).toBe(next[1]);
  });
});
