import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockCreatePdfiumEngine = vi.fn();

vi.mock("@embedpdf/engines/pdfium-worker-engine", () => ({
  createPdfiumEngine: (...args: unknown[]) => mockCreatePdfiumEngine(...args),
}));

const mockStartEagerWasmCompilation = vi.fn();

vi.mock("@editor/services/wasmPrecompiler", () => ({
  startEagerWasmCompilation: () => mockStartEagerWasmCompilation(),
}));

const WASM_URL = "https://example.com/pdfium.wasm";

function engineWith(wait: (ok: () => void, fail: () => void) => void) {
  return {
    closeAllDocuments: () => ({ wait }),
    destroy: vi.fn(),
  };
}

async function loadHook() {
  return import("@editor/hooks/useLocalPdfiumEngine");
}

describe("useLocalPdfiumEngine", () => {
  beforeEach(async () => {
    (await loadHook()).resetParkedPdfiumEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("creates the worker engine from the wasm url without gating on the precompiled module", async () => {
    const engine = engineWith((ok) => ok());
    mockCreatePdfiumEngine.mockReturnValue(engine);
    const { useLocalPdfiumEngine } = await loadHook();

    const { result } = renderHook(() =>
      useLocalPdfiumEngine({ wasmUrl: WASM_URL }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockStartEagerWasmCompilation).toHaveBeenCalledTimes(1);
    expect(mockCreatePdfiumEngine).toHaveBeenCalledWith(
      WASM_URL,
      expect.not.objectContaining({ wasmModule: expect.anything() }),
    );
    expect(result.current.engine).toBe(engine);
  });

  test("hands an unmounted viewer's engine to the next viewer with equal options", async () => {
    const engine = engineWith((ok) => ok());
    mockCreatePdfiumEngine.mockReturnValue(engine);
    const { useLocalPdfiumEngine } = await loadHook();

    const first = renderHook(() =>
      useLocalPdfiumEngine({
        wasmUrl: WASM_URL,
        fontFallback: { fonts: {} },
      }),
    );
    await waitFor(() => expect(first.result.current.engine).toBe(engine));
    first.unmount();
    expect(engine.destroy).not.toHaveBeenCalled();

    // A config rebuilt with the same content is the same engine.
    const second = renderHook(() =>
      useLocalPdfiumEngine({
        wasmUrl: WASM_URL,
        fontFallback: { fonts: {} },
      }),
    );
    expect(second.result.current.engine).toBe(engine);
    expect(second.result.current.isLoading).toBe(false);
    expect(mockCreatePdfiumEngine).toHaveBeenCalledTimes(1);
  });

  test("destroys the kept engine when an engine with other options replaces it", async () => {
    const first = engineWith((ok) => ok());
    const second = engineWith((ok) => ok());
    mockCreatePdfiumEngine
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    const { useLocalPdfiumEngine } = await loadHook();

    const { result, rerender, unmount } = renderHook(
      ({ url }: { url: string }) => useLocalPdfiumEngine({ wasmUrl: url }),
      { initialProps: { url: WASM_URL } },
    );
    await waitFor(() => expect(result.current.engine).toBe(first));

    rerender({ url: "https://example.com/other.wasm" });
    await waitFor(() => expect(result.current.engine).toBe(second));

    unmount();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).not.toHaveBeenCalled();
  });

  test("destroys an engine built with a caller's logger on unmount", async () => {
    const engine = engineWith((ok) => ok());
    mockCreatePdfiumEngine.mockReturnValue(engine);
    const { useLocalPdfiumEngine } = await loadHook();
    const logger = {} as never;

    const { result, unmount } = renderHook(() =>
      useLocalPdfiumEngine({ wasmUrl: WASM_URL, logger }),
    );
    await waitFor(() => expect(result.current.engine).toBe(engine));

    unmount();
    expect(engine.destroy).toHaveBeenCalledTimes(1);
  });

  async function keepThenDestroy(engine: unknown) {
    mockCreatePdfiumEngine.mockReturnValueOnce(engine);
    const { useLocalPdfiumEngine, resetParkedPdfiumEngine } = await loadHook();
    const { result, unmount } = renderHook(() =>
      useLocalPdfiumEngine({ wasmUrl: WASM_URL }),
    );
    await waitFor(() => expect(result.current.engine).toBe(engine));
    unmount();
    resetParkedPdfiumEngine();
  }

  test("still destroys the engine when closing its documents fails", async () => {
    // The engine's `wait` runs only one of its two callbacks, so destroy has to
    // be registered on the failure path too or the worker leaks.
    const engine = engineWith((_ok, fail) => fail());
    await keepThenDestroy(engine);
    expect(engine.destroy).toHaveBeenCalledTimes(1);
  });

  test("destroys the engine when closeAllDocuments is absent or returns nothing", async () => {
    const absent = { destroy: vi.fn() };
    await keepThenDestroy(absent);
    expect(absent.destroy).toHaveBeenCalledTimes(1);

    const noTask = { closeAllDocuments: () => undefined, destroy: vi.fn() };
    await keepThenDestroy(noTask);
    expect(noTask.destroy).toHaveBeenCalledTimes(1);
  });

  test("destroys the engine when closing its documents throws", async () => {
    const engine = {
      closeAllDocuments: () => {
        throw new Error("close failed");
      },
      destroy: vi.fn(),
    };
    await keepThenDestroy(engine);
    expect(engine.destroy).toHaveBeenCalledTimes(1);
  });

  test("destroys the engine exactly once when both close callbacks run", async () => {
    const engine = {
      closeAllDocuments: () => ({
        wait: (ok: () => void) => {
          ok();
          ok();
        },
      }),
      destroy: vi.fn(),
    };
    await keepThenDestroy(engine);
    expect(engine.destroy).toHaveBeenCalledTimes(1);
  });

  test("clears a prior error once a later attempt succeeds", async () => {
    mockCreatePdfiumEngine.mockImplementationOnce(() => {
      throw new Error("engine failed");
    });
    const recovered = engineWith((ok) => ok());
    mockCreatePdfiumEngine.mockReturnValueOnce(recovered);
    const { useLocalPdfiumEngine } = await loadHook();

    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useLocalPdfiumEngine({ wasmUrl: url }),
      { initialProps: { url: WASM_URL } },
    );
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    rerender({ url: "https://example.com/other.wasm" });

    await waitFor(() => {
      expect(result.current.engine).toBe(recovered);
    });
    expect(result.current.error).toBeNull();
  });
});
