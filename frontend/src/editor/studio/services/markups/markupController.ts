import type { AnnotationCapability, TrackedAnnotation } from "@embedpdf/plugin-annotation";
import type { ScrollCapability } from "@embedpdf/plugin-scroll";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { isMeasureToolId, type MeasureToolId } from "@editor/services/markups/markupModel";
import { setMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { cancelCalibration } from "@editor/services/markups/calibrateStore";

/**
 * The open document's annotation and scroll plugins, bound by `useMarkupTools` while the viewer
 * has annotations on. Everything here is a no-op or returns an empty result when nothing is
 * bound, so panels can call it without checking whether a document is open.
 */
interface BoundPlugins {
  annotation: AnnotationCapability;
  scroll: ScrollCapability | null;
}

let bound: BoundPlugins | null = null;
let stopAnnotationState: (() => void) | null = null;

const EMPTY_SELECTION: readonly string[] = [];
let annotationsVersion = 0;
let selection: readonly string[] = EMPTY_SELECTION;
let lastSeenByUid: unknown = null;
let pendingNotify: (() => void) | null = null;
const annotationListeners = new Set<() => void>();

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function flushAnnotationListeners(): void {
  pendingNotify = null;
  for (const listener of [...annotationListeners]) listener();
}

/**
 * Listeners are told at most once per frame: a drag fires a plugin state change per pointer
 * move, and the Markups List rebuilds every row on each notification.
 */
function scheduleAnnotationNotify(): void {
  if (pendingNotify) return;
  if (typeof requestAnimationFrame === "function") {
    const handle = requestAnimationFrame(flushAnnotationListeners);
    pendingNotify = () => cancelAnimationFrame(handle);
  } else {
    const handle = setTimeout(flushAnnotationListeners, 16);
    pendingNotify = () => clearTimeout(handle);
  }
}

/**
 * The UI store mirrors the armed tool and the selection through plugin events, and a document
 * switch destroys the old plugin without firing one. Binding therefore re-reads both from the
 * plugin, so a button never shows a tool armed that the new document does not have.
 */
function mirrorPluginUi(plugins: BoundPlugins | null): void {
  let armedToolId: string | null = null;
  let selectedAnnotationId: string | null = null;
  let selectedPageIndex: number | null = null;
  try {
    armedToolId = plugins?.annotation.getActiveTool?.()?.id ?? null;
    const selected = plugins?.annotation.getSelectedAnnotation?.() ?? null;
    selectedAnnotationId = selected?.object.id ?? null;
    selectedPageIndex = selected?.object.pageIndex ?? null;
  } catch {
    // The plugin has no document yet, so nothing is armed or selected.
  }
  setMarkupsUi({ armedToolId, selectedAnnotationId, selectedPageIndex });
}

export function bindMarkupController(plugins: BoundPlugins | null): void {
  stopAnnotationState?.();
  stopAnnotationState = null;
  bound = plugins;
  mirrorPluginUi(plugins);
  if (!plugins) cancelCalibration();
  lastSeenByUid = null;
  selection = EMPTY_SELECTION;
  annotationsVersion++;
  if (plugins) {
    stopAnnotationState =
      plugins.annotation.onStateChange(({ state }) => {
        const nextSelection = state.selectedUids ?? EMPTY_SELECTION;
        const selectionChanged = !sameIds(nextSelection, selection);
        const annotationsChanged = state.byUid !== lastSeenByUid;
        if (!selectionChanged && !annotationsChanged) return;
        lastSeenByUid = state.byUid;
        if (selectionChanged) selection = nextSelection.length === 0 ? EMPTY_SELECTION : [...nextSelection];
        if (annotationsChanged) annotationsVersion++;
        scheduleAnnotationNotify();
      }) ?? null;
  }
  pendingNotify?.();
  flushAnnotationListeners();
}

/**
 * Subscribes to changes of the bound document's annotations or selection, and to the document
 * being bound or unbound. Pair with {@link getMarkupAnnotationsVersion} and
 * {@link getMarkupSelection} in `useSyncExternalStore`.
 */
export function subscribeMarkupAnnotations(listener: () => void): () => void {
  annotationListeners.add(listener);
  return () => {
    annotationListeners.delete(listener);
  };
}

/** Changes whenever an annotation was added, edited or removed, or another document was bound. */
export function getMarkupAnnotationsVersion(): number {
  return annotationsVersion;
}

/** The ids of the annotations the viewer has selected; the same array until the selection changes. */
export function getMarkupSelection(): readonly string[] {
  return selection;
}

export function isMarkupControllerReady(): boolean {
  return bound !== null;
}

/** Arms a measurement tool so the next clicks on a page draw it; it stays armed after each markup. Null disarms. */
export function armMeasureTool(toolId: MeasureToolId | null): void {
  if (!bound) return;
  bound.annotation.setActiveTool(null);
  if (toolId) bound.annotation.setActiveTool(toolId);
  setMarkupsUi({ armedToolId: toolId });
}

export function disarmTool(): void {
  armMeasureTool(null);
}

/** True while one of the six measurement tools is armed. */
export function isMeasureToolArmed(armedToolId: string | null): armedToolId is MeasureToolId {
  return isMeasureToolId(armedToolId);
}

/** Every annotation of the open document that has not been deleted, in the plugin's order. */
export function listAnnotations(): TrackedAnnotation[] {
  if (!bound) return [];
  try {
    return bound.annotation.getAnnotations().filter((tracked) => tracked.commitState !== "deleted");
  } catch {
    return [];
  }
}

/** Brings the annotation to the middle of the viewport. */
export function scrollToMarkup(pageIndex: number, annotationId: string): void {
  if (!bound?.scroll) return;
  const tracked = bound.annotation.getAnnotationById(annotationId);
  const rect = tracked?.object.rect;
  try {
    bound.scroll.scrollToPage({
      pageNumber: pageIndex + 1,
      pageCoordinates: rect ? { x: rect.origin.x + rect.size.width / 2, y: rect.origin.y + rect.size.height / 2 } : undefined,
      alignX: 50,
      alignY: 50,
    });
  } catch {
    // The layout is not ready (no document yet); there is nothing to scroll.
  }
}

/** Selects an annotation, and with `scroll` brings it into view. Selecting does not disarm a tool. */
export function selectMarkup(pageIndex: number, annotationId: string, options: { scroll?: boolean } = {}): void {
  if (!bound) return;
  bound.annotation.selectAnnotation(pageIndex, annotationId);
  setMarkupsUi({ selectedAnnotationId: annotationId, selectedPageIndex: pageIndex });
  if (options.scroll) scrollToMarkup(pageIndex, annotationId);
}

export function deselectMarkup(): void {
  bound?.annotation.deselectAnnotation();
}

/** Applies a property patch through the plugin, so it is undoable and marks the document changed. */
export function updateMarkup(pageIndex: number, annotationId: string, patch: Partial<PdfAnnotationObject>): void {
  bound?.annotation.updateAnnotation(pageIndex, annotationId, patch);
}

export function deleteMarkups(items: { pageIndex: number; id: string }[]): void {
  if (items.length > 0) bound?.annotation.deleteAnnotations(items);
}

/** Adds the annotation to the selection, or removes it when already selected. */
export function toggleMarkupSelection(pageIndex: number, annotationId: string): void {
  bound?.annotation.toggleSelection(pageIndex, annotationId);
}

/** Replaces the selection with exactly these annotations. */
export function setMarkupSelection(annotationIds: string[]): void {
  bound?.annotation.setSelection(annotationIds);
}

/** Applies several property patches as one undo step. */
export function updateMarkups(patches: { pageIndex: number; id: string; patch: Partial<PdfAnnotationObject> }[]): void {
  if (patches.length > 0) bound?.annotation.updateAnnotations(patches);
}
