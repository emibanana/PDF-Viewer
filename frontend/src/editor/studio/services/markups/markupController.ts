import type { AnnotationCapability, TrackedAnnotation } from "@embedpdf/plugin-annotation";
import type { ScrollCapability } from "@embedpdf/plugin-scroll";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { isMeasureToolId, type MeasureToolId } from "@editor/services/markups/markupModel";
import { setMarkupsUi } from "@editor/services/markups/markupsUiStore";

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

export function bindMarkupController(plugins: BoundPlugins | null): void {
  bound = plugins;
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
