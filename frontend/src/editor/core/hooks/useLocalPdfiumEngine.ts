import { useEffect, useRef, useState } from "react";
import { type Logger, type PdfEngine } from "@embedpdf/models";
import type { FontFallbackConfig } from "@embedpdf/engines/pdfium-worker-engine";
import { startEagerWasmCompilation } from "@editor/services/wasmPrecompiler";

interface LocalPdfiumEngineOptions {
  wasmUrl: string;
  logger?: Logger;
  encoderPoolSize?: number;
  fontFallback?: FontFallbackConfig | null;
}

/**
 * Destroy an engine once its documents are closed. Teardown has to be
 * unconditional: `closeAllDocuments` may be absent, return nothing, or throw,
 * and `wait` runs only one of its two callbacks, so a failed close would
 * otherwise leave the worker running for the lifetime of the app.
 */
function destroyEngine(engine: PdfEngine<Blob> | null): void {
  if (!engine) return;

  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    try {
      engine.destroy?.();
    } catch {
      // Nothing left to release once destroy itself fails.
    }
  };

  try {
    const closing = engine.closeAllDocuments?.();
    if (closing?.wait) {
      closing.wait(destroy, destroy);
    } else {
      destroy();
    }
  } catch {
    destroy();
  }
}

/**
 * An engine whose viewer unmounted, kept for the next viewer with the same
 * options: a fresh one costs a worker plus a PDFium WASM boot on every
 * document open. Only one is kept; its documents are closed by the registry
 * that opened them, so nothing here may close all of the engine's documents
 * once it can be handed on.
 */
let parked: { key: string; engine: PdfEngine<Blob> } | null = null;

function engineKey({
  wasmUrl,
  logger,
  encoderPoolSize,
  fontFallback,
}: LocalPdfiumEngineOptions): string | null {
  // A caller's logger is bound to that caller, so its engine is not shared.
  if (logger) return null;
  return JSON.stringify({ wasmUrl, encoderPoolSize, fontFallback });
}

function takeParkedEngine(key: string | null): PdfEngine<Blob> | null {
  if (key === null || parked?.key !== key) return null;
  const { engine } = parked;
  parked = null;
  return engine;
}

function parkEngine(key: string | null, engine: PdfEngine<Blob> | null) {
  if (!engine) return;
  if (key === null) {
    destroyEngine(engine);
    return;
  }
  if (parked) destroyEngine(parked.engine);
  parked = { key, engine };
}

/** Test seam: drops the kept engine so each test starts cold. */
export function resetParkedPdfiumEngine(): void {
  if (parked) destroyEngine(parked.engine);
  parked = null;
}

/**
 * The PDFium worker engine for one viewer. On unmount the engine is kept for
 * the next viewer with equal options rather than destroyed; the options are
 * compared by value, so a font config rebuilt with the same fonts still reuses it.
 */
export function useLocalPdfiumEngine({
  wasmUrl,
  logger,
  encoderPoolSize,
  fontFallback,
}: LocalPdfiumEngineOptions) {
  const [engine, setEngine] = useState<PdfEngine<Blob> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const engineRef = useRef<PdfEngine<Blob> | null>(null);
  const key = engineKey({ wasmUrl, logger, encoderPoolSize, fontFallback });

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const reused = takeParkedEngine(key);
    if (reused) {
      engineRef.current = reused;
      setEngine(reused);
      setIsLoading(false);
    } else {
      // Reset per attempt so the render tree never exposes the engine this run
      // is about to release, nor a stale error left over from an earlier failure.
      setEngine(null);
      setIsLoading(true);
      (async () => {
        try {
          startEagerWasmCompilation();
          const { createPdfiumEngine } =
            await import("@embedpdf/engines/pdfium-worker-engine");
          // The worker engine resolves pdfium from wasmUrl itself, so the
          // precompiled module (a main-thread optimization) must not gate
          // creation; awaiting it here would only delay the engine.
          const pdfEngine = createPdfiumEngine(wasmUrl, {
            logger,
            encoderPoolSize,
            fontFallback,
          });
          if (cancelled) {
            parkEngine(key, pdfEngine);
            return;
          }
          engineRef.current = pdfEngine;
          setEngine(pdfEngine);
          setIsLoading(false);
        } catch (cause) {
          if (!cancelled) {
            setError(cause instanceof Error ? cause : new Error(String(cause)));
            setIsLoading(false);
          }
        }
      })();
    }

    return () => {
      cancelled = true;
      const current = engineRef.current;
      engineRef.current = null;
      parkEngine(key, current);
    };
    // The key carries the other options by value.
  }, [key, logger]);

  return { engine, isLoading, error };
}
