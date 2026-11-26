import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useSuggestedTools } from "@editor/hooks/useSuggestedTools";
import { useToolRecommendations } from "@editor/hooks/useToolRecommendations";
import { useNavigationState } from "@editor/contexts/NavigationContext";
import { useToolWorkflow } from "@editor/contexts/ToolWorkflowContext";
import type { ToolAvailabilityMap } from "@editor/hooks/useToolManagement";
import type { ToolId } from "@editor/types/toolId";
import type { ToolRegistryEntry } from "@editor/data/toolsTaxonomy";

vi.mock("@editor/hooks/useToolRecommendations", () => ({
  useToolRecommendations: vi.fn(),
}));
vi.mock("@editor/contexts/NavigationContext", () => ({
  useNavigationState: vi.fn(),
}));
vi.mock("@editor/contexts/ToolWorkflowContext", () => ({
  useToolWorkflow: vi.fn(),
}));
vi.mock("@editor/hooks/useToolNavigation", () => ({
  useToolNavigation: () => ({
    getToolNavigation: (toolId: string) => ({
      href: `/${toolId}`,
      onClick: () => {},
    }),
  }),
}));

const mockRecommendations = vi.mocked(useToolRecommendations);
const mockNavigation = vi.mocked(useNavigationState);
const mockWorkflow = vi.mocked(useToolWorkflow);

/** A tool that can actually open, so it survives the availability filter. */
function entry(name: string): ToolRegistryEntry {
  return {
    name,
    icon: null,
    component: (() => null) as unknown as ToolRegistryEntry["component"],
  } as ToolRegistryEntry;
}

const REGISTRY: Partial<Record<ToolId, ToolRegistryEntry>> = {
  sanitize: entry("Sanitize"),
  split: entry("Split"),
  addPassword: entry("Add Password"),
  merge: entry("Merge"),
  rotate: entry("Rotate"),
  watermark: entry("Watermark"),
  // Workbench-only: no component, but still openable.
  multiTool: {
    name: "Multi Tool",
    icon: null,
    component: null,
  } as ToolRegistryEntry,
  // No component and no link - nothing to open.
  redact: {
    name: "Redact",
    icon: null,
    component: null,
  } as ToolRegistryEntry,
};

/** Every id at the same score, i.e. the data expressing no preference at all. */
function tied(...ids: string[]) {
  return ids.map((toolKey) => ({ toolKey, score: 2 }));
}

function setup(
  recommendations: { toolKey: string; score: number }[] | null,
  selectedTool: ToolId | null = null,
  toolAvailability: ToolAvailabilityMap = {},
) {
  mockRecommendations.mockReturnValue({ recommendations });
  mockNavigation.mockReturnValue({ selectedTool } as ReturnType<typeof useNavigationState>);
  mockWorkflow.mockReturnValue({
    getSelectedTool: (id: ToolId | null) => (id ? (REGISTRY[id] ?? null) : null),
    toolAvailability,
  } as unknown as ReturnType<typeof useToolWorkflow>);

  return renderHook(() => useSuggestedTools()).result.current.map((t) => t.id);
}

describe("useSuggestedTools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the curated list when the backend has no usage data", () => {
    expect(setup(null)).toEqual(["sanitize", "split", "merge", "rotate"]);
  });

  it("leads with the usage ranking, then tops up from the curated list", () => {
    expect(
      setup([
        { toolKey: "addPassword", score: 9 },
        { toolKey: "merge", score: 4 },
      ]),
    ).toEqual(["addPassword", "merge", "sanitize", "split"]);
  });

  it("never suggests the tool the user is currently in", () => {
    expect(
      setup(
        [
          { toolKey: "sanitize", score: 9 },
          { toolKey: "addPassword", score: 4 },
        ],
        "sanitize",
      ),
    ).toEqual(["addPassword", "split", "merge", "rotate"]);
  });

  it("breaks ties on the curated order rather than the alphabet", () => {
    // Alphabetically this is addPassword, merge, rotate, sanitize.
    const ids = setup(tied("watermark", "addPassword", "split", "merge", "rotate", "sanitize"));

    expect(ids).toEqual(["sanitize", "split", "merge", "rotate"]);
  });

  it("keeps a real score ahead of the curated order", () => {
    const ids = setup([
      { toolKey: "merge", score: 9 },
      { toolKey: "sanitize", score: 2 },
      { toolKey: "split", score: 2 },
    ]);

    expect(ids[0]).toBe("merge");
  });

  it("skips tools that are unknown or still coming soon", () => {
    expect(
      setup([
        { toolKey: "redact", score: 9 },
        { toolKey: "nonsense", score: 8 },
        { toolKey: "merge", score: 7 },
      ]),
    ).toEqual(["merge", "sanitize", "split", "rotate"]);
  });

  it("skips a tool this install cannot run", () => {
    const ids = setup([{ toolKey: "merge", score: 9 }], null, {
      merge: { available: false, reason: "disabledByAdmin" },
    });

    expect(ids).toEqual(["sanitize", "split", "rotate"]);
  });

  it("keeps workbench-only tools, which have no component by design", () => {
    expect(
      setup([
        { toolKey: "multiTool", score: 9 },
        { toolKey: "merge", score: 4 },
      ]),
    ).toEqual(["multiTool", "merge", "sanitize", "split"]);
  });

  it("does not repeat a ranked tool that is also in the curated list", () => {
    const ids = setup([
      { toolKey: "split", score: 9 },
      { toolKey: "sanitize", score: 4 },
    ]);
    expect(ids).toEqual(["split", "sanitize", "merge", "rotate"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
