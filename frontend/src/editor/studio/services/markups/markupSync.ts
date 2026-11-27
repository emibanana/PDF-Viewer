import type { AnnotationCapability } from "@embedpdf/plugin-annotation";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { computeMarkupPatch } from "@editor/services/markups/markupContents";
import { mergeMarkupCustom, readMarkupCustom } from "@editor/services/markups/markupModel";
import { setMarkupsUi } from "@editor/services/markups/markupsUiStore";
import {
  getActiveFileKey,
  getPageScale,
  getPageScales,
  subscribePageScales,
  type PageScale,
} from "@editor/services/markups/pageScaleStore";

/**
 * Keeps `/Contents` and the default wall height or slab depth of our measurement markups right
 * after every change. Events are handled before the plugin commits them, so the fix is written
 * into the annotation object with `syncAnnotationObject`: no second undo step, and the commit
 * that follows carries it.
 *
 * A page whose scale the user changes is different: nothing about the annotation changed, so its
 * markups are patched through `updateAnnotations` and the document is marked as changed.
 * Scales read from the file never rewrite anything.
 */
export function attachMarkupSync(api: AnnotationCapability): () => void {
  const stopEvents = api.onAnnotationEvent((event) => {
    if (event.type !== "create" && event.type !== "update") return;
    if (event.committed) return;
    let annotation: PdfAnnotationObject =
      event.type === "update" ? ({ ...event.annotation, ...event.patch } as PdfAnnotationObject) : event.annotation;
    // Once the sampled spline is edited, the clicked points no longer describe it.
    const stale = event.type === "update" && "vertices" in event.patch && readMarkupCustom(annotation.custom)?.controlPoints;
    if (stale) annotation = { ...annotation, custom: mergeMarkupCustom(annotation.custom, { controlPoints: undefined }) };
    const patch = computeMarkupPatch(annotation, getPageScale(getActiveFileKey(), event.pageIndex));
    let write: Partial<PdfAnnotationObject> | null = stale ? { custom: annotation.custom, ...patch } : patch;
    // The plugin stamps the local user as author on every update; the author is whoever made the
    // markup, as in Revu, so an edit must not rewrite a reviewer's name.
    const originalAuthor = event.type === "update" ? event.annotation.author : undefined;
    if (originalAuthor && annotation.author !== originalAuthor) write = { ...write, author: originalAuthor };
    if (write) api.syncAnnotationObject(annotation.id, write, event.documentId);
  });

  let seenKey = getActiveFileKey();
  let seen = new Map<number, PageScale>(seenKey ? getPageScales(seenKey) : []);
  const stopScales = subscribePageScales(() => {
    const key = getActiveFileKey();
    const current = key ? getPageScales(key) : new Map<number, PageScale>();
    const changedPages: number[] = [];
    if (key === seenKey) {
      for (const [pageIndex, entry] of current) {
        if (seen.get(pageIndex) !== entry && entry.source === "user") changedPages.push(pageIndex);
      }
      for (const pageIndex of seen.keys()) if (!current.has(pageIndex)) changedPages.push(pageIndex);
    }
    seenKey = key;
    seen = new Map(current);
    const patches = changedPages.flatMap((pageIndex) =>
      api.getAnnotations({ pageIndex }).flatMap((tracked) => {
        if (tracked.commitState === "deleted") return [];
        const patch = computeMarkupPatch(tracked.object, current.get(pageIndex) ?? null);
        return patch ? [{ pageIndex, id: tracked.object.id, patch: patch as Partial<PdfAnnotationObject> }] : [];
      }),
    );
    if (patches.length > 0) api.updateAnnotations(patches);
  });

  return () => {
    stopEvents?.();
    stopScales();
  };
}

/** Mirrors the plugin's selection and armed tool into the markups UI store. */
export function attachMarkupUiSync(api: AnnotationCapability): () => void {
  const stopState = api.onStateChange(({ state }) => {
    const selectedId = state.selectedUid ?? null;
    const pageIndex = selectedId ? (state.byUid[selectedId]?.object.pageIndex ?? null) : null;
    setMarkupsUi({ selectedAnnotationId: selectedId, selectedPageIndex: pageIndex });
  });
  const stopTool = api.onActiveToolChange(({ tool }) => setMarkupsUi({ armedToolId: tool?.id ?? null }));
  return () => {
    stopState?.();
    stopTool?.();
  };
}
