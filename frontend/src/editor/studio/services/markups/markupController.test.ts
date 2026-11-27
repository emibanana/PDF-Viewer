import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMarkupsUiState, resetMarkupsUiForTests, setMarkupsUi } from "./markupsUiStore";
import { getCalibrationState, startCalibration } from "./calibrateStore";
import {
  bindMarkupController,
  getMarkupAnnotationsVersion,
  getMarkupSelection,
  setMarkupSelection,
  subscribeMarkupAnnotations,
  toggleMarkupSelection,
  updateMarkups,
} from "./markupController";

type StateHandler = (event: { state: { byUid: object; selectedUids: string[] } }) => void;

function fakePlugin() {
  let handler: StateHandler | null = null;
  const annotation = {
    onStateChange: vi.fn((next: StateHandler) => {
      handler = next;
      return () => {
        handler = null;
      };
    }),
    setSelection: vi.fn(),
    toggleSelection: vi.fn(),
    updateAnnotations: vi.fn(),
  };
  return {
    plugins: { annotation: annotation as never, scroll: null },
    annotation,
    emit: (byUid: object, selectedUids: string[]) => handler?.({ state: { byUid, selectedUids } }),
    isSubscribed: () => handler !== null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  bindMarkupController(null);
  vi.useRealTimers();
});

describe("annotation change notifications", () => {
  it("tells listeners once per frame however many state changes came in", () => {
    const plugin = fakePlugin();
    bindMarkupController(plugin.plugins);
    const listener = vi.fn();
    subscribeMarkupAnnotations(listener);
    const before = getMarkupAnnotationsVersion();
    plugin.emit({ a: 1 }, []);
    plugin.emit({ a: 2 }, []);
    plugin.emit({ a: 3 }, []);
    expect(listener).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getMarkupAnnotationsVersion()).toBe(before + 3);
  });

  it("tracks the selection and keeps the same array while it does not change", () => {
    const plugin = fakePlugin();
    bindMarkupController(plugin.plugins);
    const byUid = {};
    plugin.emit(byUid, ["a", "b"]);
    const selection = getMarkupSelection();
    expect(selection).toEqual(["a", "b"]);
    plugin.emit(byUid, ["a", "b"]);
    expect(getMarkupSelection()).toBe(selection);
    plugin.emit(byUid, []);
    expect(getMarkupSelection()).toEqual([]);
  });

  it("does not count a selection change as an annotation change", () => {
    const plugin = fakePlugin();
    bindMarkupController(plugin.plugins);
    const byUid = {};
    plugin.emit(byUid, []);
    const version = getMarkupAnnotationsVersion();
    plugin.emit(byUid, ["a"]);
    expect(getMarkupAnnotationsVersion()).toBe(version);
  });

  it("stops listening to the old document when another is bound or none is", () => {
    const first = fakePlugin();
    bindMarkupController(first.plugins);
    expect(first.isSubscribed()).toBe(true);
    const second = fakePlugin();
    bindMarkupController(second.plugins);
    expect(first.isSubscribed()).toBe(false);
    bindMarkupController(null);
    expect(second.isSubscribed()).toBe(false);
    expect(getMarkupSelection()).toEqual([]);
  });
});

describe("selection and batch commands", () => {
  it("forwards them to the plugin, and does nothing when no document is bound", () => {
    expect(() => setMarkupSelection(["a"])).not.toThrow();
    const plugin = fakePlugin();
    bindMarkupController(plugin.plugins);
    setMarkupSelection(["a", "b"]);
    toggleMarkupSelection(1, "c");
    updateMarkups([{ pageIndex: 0, id: "a", patch: { contents: "x" } }]);
    updateMarkups([]);
    expect(plugin.annotation.setSelection).toHaveBeenCalledWith(["a", "b"]);
    expect(plugin.annotation.toggleSelection).toHaveBeenCalledWith(1, "c");
    expect(plugin.annotation.updateAnnotations).toHaveBeenCalledTimes(1);
  });
});

describe("binding another document", () => {
  it("drops an armed tool and a selection that belonged to the document before", () => {
    resetMarkupsUiForTests();
    setMarkupsUi({ armedToolId: "measureLength", selectedAnnotationId: "a1", selectedPageIndex: 0 });
    const next = fakePlugin();
    bindMarkupController(next.plugins);
    expect(getMarkupsUiState().armedToolId).toBeNull();
    expect(getMarkupsUiState().selectedAnnotationId).toBeNull();
  });

  it("shows the tool the bound plugin really has armed", () => {
    resetMarkupsUiForTests();
    const plugin = fakePlugin();
    Object.assign(plugin.annotation, {
      getActiveTool: () => ({ id: "measureArea" }),
      getSelectedAnnotation: () => ({ object: { id: "a2", pageIndex: 3 } }),
    });
    bindMarkupController(plugin.plugins);
    expect(getMarkupsUiState()).toMatchObject({
      armedToolId: "measureArea",
      selectedAnnotationId: "a2",
      selectedPageIndex: 3,
    });
  });

  it("cancels a calibration that was waiting on the unbound document", () => {
    startCalibration();
    expect(getCalibrationState().active).toBe(true);
    bindMarkupController(null);
    expect(getCalibrationState().active).toBe(false);
  });
});
