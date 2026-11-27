import { useSyncExternalStore } from "react";
import type { MeasureScale, PageMeasureScales } from "@editor/utils/measurementTypes";
import { extractPageMeasureScales } from "@editor/utils/pdfMeasurementExtraction";
import { DEFAULT_PRECISION } from "@editor/services/markups/measureMath";

/**
 * Where a page's scale came from. Only "user" scales are written back on save; "file" ones are
 * already in the PDF as it was opened.
 */
export type PageScaleSource = "file" | "user";

export interface PageScale {
  scale: MeasureScale;
  /** Decimal places shown for values measured on the page. */
  precision: number;
  source: PageScaleSource;
}

/**
 * Per-file, per-page scales of the open documents. A page with no entry has no scale set and
 * measures in paper units. Keys are workspace file ids; entries are replaced, never mutated, so
 * a value read from the store is a stable snapshot.
 */
const filesByKey = new Map<string, Map<number, PageScale>>();
const seededKeys = new Set<string>();
const aliases = new Map<string, string>();
const listeners = new Set<() => void>();
const activeKeyListeners = new Set<() => void>();
let version = 0;
let activeFileKey: string | null = null;

function emit(): void {
  version++;
  for (const listener of [...listeners]) listener();
}

function pagesOf(fileKey: string): Map<number, PageScale> {
  let pages = filesByKey.get(fileKey);
  if (!pages) {
    pages = new Map();
    filesByKey.set(fileKey, pages);
  }
  return pages;
}

export function subscribePageScales(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Changes on every scale edit; for `useSyncExternalStore` consumers that need the whole map. */
export function getPageScalesVersion(): number {
  return version;
}

export function getPageScale(fileKey: string | null | undefined, pageIndex: number): PageScale | null {
  if (!fileKey) return null;
  return filesByKey.get(fileKey)?.get(pageIndex) ?? null;
}

/** The scale to measure with on a page, or null when none is set. */
export function getMeasureScale(fileKey: string | null | undefined, pageIndex: number): MeasureScale | null {
  return getPageScale(fileKey, pageIndex)?.scale ?? null;
}

export function getPageScales(fileKey: string): ReadonlyMap<number, PageScale> {
  return filesByKey.get(fileKey) ?? new Map();
}

/** The scales set in the app (not read from the file), which the save pass writes. */
export function getUserPageScales(fileKey: string | null | undefined): Map<number, PageScale> {
  const result = new Map<number, PageScale>();
  if (!fileKey) return result;
  for (const [pageIndex, entry] of filesByKey.get(fileKey) ?? []) {
    if (entry.source === "user") result.set(pageIndex, entry);
  }
  return result;
}

export function setPageScale(fileKey: string, pageIndex: number, scale: MeasureScale, precision?: number): void {
  setScaleForPages(fileKey, [pageIndex], scale, precision);
}

/** Sets one scale on several pages at once ("apply to all pages"). Each keeps its own precision unless one is given. */
export function setScaleForPages(
  fileKey: string,
  pageIndices: readonly number[],
  scale: MeasureScale,
  precision?: number,
): void {
  const pages = pagesOf(fileKey);
  for (const pageIndex of pageIndices) {
    const existing = pages.get(pageIndex);
    pages.set(pageIndex, {
      scale,
      precision: precision ?? existing?.precision ?? DEFAULT_PRECISION,
      source: "user",
    });
  }
  emit();
}

export function setPagePrecision(fileKey: string, pageIndex: number, precision: number): void {
  const existing = getPageScale(fileKey, pageIndex);
  if (!existing || existing.precision === precision) return;
  pagesOf(fileKey).set(pageIndex, { ...existing, precision, source: "user" });
  emit();
}

export function clearPageScale(fileKey: string, pageIndex: number): void {
  if (pagesOf(fileKey).delete(pageIndex)) emit();
}

/** Picks the scale a page measures with from its viewports: the whole-page one, else the first. */
function pickViewportScale(scales: PageMeasureScales, pageIndex: number): MeasureScale | null {
  const info = scales.get(pageIndex);
  if (!info || info.viewports.length === 0) return null;
  return (info.viewports.find((viewport) => viewport.bbox === null) ?? info.viewports[0]).scale;
}

/** Fills in scales read from a PDF's `/VP` entries. Pages the user already set are left alone. */
export function seedPageScales(fileKey: string, scales: PageMeasureScales | null): void {
  seededKeys.add(fileKey);
  if (!scales) return;
  const pages = pagesOf(fileKey);
  let changed = false;
  for (const pageIndex of scales.keys()) {
    if (pages.has(pageIndex)) continue;
    const scale = pickViewportScale(scales, pageIndex);
    if (!scale) continue;
    pages.set(pageIndex, { scale, precision: DEFAULT_PRECISION, source: "file" });
    changed = true;
  }
  if (changed) emit();
}

/** Reads the PDF's page scales once per file key; later calls for the same key do nothing. */
export async function seedPageScalesFromFile(fileKey: string, file: Blob): Promise<void> {
  if (seededKeys.has(fileKey)) return;
  seededKeys.add(fileKey);
  seedPageScales(fileKey, await extractPageMeasureScales(file));
}

/** Forgets a file's scales and lets the next open read them from the PDF again. */
export function forgetFileScales(fileKey: string): void {
  seededKeys.delete(fileKey);
  if (filesByKey.delete(fileKey)) emit();
}

/**
 * Records that `alias` (a workspace file id, which changes with each saved version) stands for
 * `fileKey` (the lineage root the scales are kept under), so the save path finds the right scales.
 */
export function aliasFileKey(alias: string, fileKey: string): void {
  aliases.set(alias, fileKey);
}

export function resolveFileKey(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  return aliases.get(fileId) ?? fileId;
}

/** The file the viewer shows, which measurement tools and the value writer look scales up in. */
export function setActiveFileKey(fileKey: string | null): void {
  if (activeFileKey === fileKey) return;
  activeFileKey = fileKey;
  for (const listener of [...activeKeyListeners]) listener();
}

export function getActiveFileKey(): string | null {
  return activeFileKey;
}

function subscribeActiveFileKey(listener: () => void): () => void {
  activeKeyListeners.add(listener);
  return () => {
    activeKeyListeners.delete(listener);
  };
}

/** The viewer's file key, re-read when the viewer switches file. */
export function useActiveFileKey(): string | null {
  return useSyncExternalStore(subscribeActiveFileKey, getActiveFileKey);
}

/** The scale entry of one page, re-read whenever any scale changes. */
export function usePageScale(fileKey: string | null | undefined, pageIndex: number): PageScale | null {
  return useSyncExternalStore(subscribePageScales, () => getPageScale(fileKey, pageIndex));
}

export function resetPageScalesForTests(): void {
  filesByKey.clear();
  seededKeys.clear();
  aliases.clear();
  listeners.clear();
  activeKeyListeners.clear();
  activeFileKey = null;
  version = 0;
}
