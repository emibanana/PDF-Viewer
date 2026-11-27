import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import {
  PersistentWorkbench,
  usePersistentWorkbenchHost,
  WorkbenchSlot,
} from "@editor/components/layout/PersistentWorkbench";

const lifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));

vi.mock("@editor/components/layout/Workbench", async () => {
  const { useEffect, useState } = await import("react");
  return {
    default: function FakeWorkbench() {
      const [edits, setEdits] = useState(0);
      useEffect(() => {
        lifecycle.mounts += 1;
        return () => {
          lifecycle.unmounts += 1;
        };
      }, []);
      return (
        <button data-testid="workbench" onClick={() => setEdits(edits + 1)}>
          edits:{edits}
        </button>
      );
    },
  };
});

let setMobile: (mobile: boolean) => void = () => {};

function Page() {
  const [mobile, setMobileState] = useState(false);
  setMobile = setMobileState;
  const host = usePersistentWorkbenchHost();
  return (
    <div>
      {mobile ? (
        <section data-testid="mobile">
          <div>
            <WorkbenchSlot host={host} />
          </div>
        </section>
      ) : (
        <main data-testid="desktop">
          <WorkbenchSlot host={host} style={{ display: "contents" }} />
        </main>
      )}
      <PersistentWorkbench host={host} />
    </div>
  );
}

describe("PersistentWorkbench", () => {
  it("keeps one Workbench, and its state, across layouts", () => {
    render(<Page />);
    const button = screen.getByTestId("workbench");
    act(() => button.click());
    expect(button.textContent).toBe("edits:1");

    act(() => setMobile(true));
    expect(screen.getByTestId("mobile").contains(button)).toBe(true);
    expect(screen.getByTestId("workbench")).toBe(button);
    expect(button.textContent).toBe("edits:1");

    act(() => setMobile(false));
    expect(screen.getByTestId("desktop").contains(button)).toBe(true);
    expect(button.textContent).toBe("edits:1");

    expect(lifecycle.mounts).toBe(1);
    expect(lifecycle.unmounts).toBe(0);
  });
});
