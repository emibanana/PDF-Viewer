import type { AnnotationCapability } from "@embedpdf/plugin-annotation";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { suppressMenuSelection } from "@editor/components/viewer/annotationMenuSuppression";
import { computeMarkupPatch } from "@editor/services/markups/markupContents";
import { applyCurveVertexEdit, polylineBounds } from "@editor/services/markups/curveEditing";
import {
  isOwnMarkup,
  markupKindOf,
  mergeMarkupCustom,
  readMarkupCustom,
  type MarkupPoint,
} from "@editor/services/markups/markupModel";
import { DEFAULT_PRECISION, computeMeasurement, formatPrimary } from "@editor/services/markups/measureMath";
import { setMarkupsUi } from "@editor/services/markups/markupsUiStore";
import {
  getActiveFileKey,
  getPageScale,
  getPageScales,
  subscribePageScales,
  type PageScale,
} from "@editor/services/markups/pageScaleStore";

/** Measurements from other programs whose geometry was edited here: their `/Contents` is ours from then on. */
const editedForeign = new Set<string>();

const GEOMETRY_KEYS = ["vertices", "linePoints"] as const;

function touchesGeometry(patch: object): boolean {
  return GEOMETRY_KEYS.some((key) => key in patch);
}

function measuredText(annotation: PdfAnnotationObject, pageScale: PageScale | null): string | null {
  const measurement = computeMeasurement(annotation, pageScale?.scale ?? null);
  return measurement ? formatPrimary(measurement, pageScale?.precision ?? DEFAULT_PRECISION) : null;
}

/**
 * The fields that keep a curve's clicked points and sampled spline in step with a vertex edit:
 * a dragged control-point handle re-samples the spline, a moved curve moves its points, and an
 * edit that fits neither drops the points. Derived from the pre-edit object, which is consistent,
 * so an undo restores them too. Null when `before` is not a curve or the patch has no vertices.
 */
function curveEditWrite(
  before: PdfAnnotationObject,
  patch: Partial<PdfAnnotationObject>,
  current: PdfAnnotationObject,
): Partial<PdfAnnotationObject> | null {
  const controlPoints = readMarkupCustom(before.custom)?.controlPoints;
  const patched = (patch as { vertices?: MarkupPoint[] }).vertices;
  const beforeVertices = (before as { vertices?: MarkupPoint[] }).vertices;
  if (!controlPoints || !patched || !beforeVertices) return null;
  const edit = applyCurveVertexEdit(controlPoints, beforeVertices, patched);
  const custom = mergeMarkupCustom(current.custom, { controlPoints: edit?.controlPoints });
  if (!edit) return { custom };
  const resampled = edit.vertices.length !== patched.length || edit.vertices.some((p, i) => p !== patched[i]);
  if (!resampled) return { custom };
  const strokeWidth = (current as { strokeWidth?: number }).strokeWidth ?? 1;
  return { custom, vertices: edit.vertices, rect: polylineBounds(edit.vertices, strokeWidth) };
}

/**
 * Keeps `/Contents` and the default wall height or slab depth of our measurement markups right
 * after every change, including undo and redo. Events are handled before the plugin commits
 * them, so the fix is written into the annotation object with `syncAnnotationObject`: no second
 * undo step, and the commit that follows carries it.
 *
 * The annotation is read from the plugin's state, not rebuilt from the event: an undo event
 * carries only the keys the original edit patched, so the pre-edit object plus that patch has
 * the old `/Contents` while the state still holds the edited one.
 *
 * A measurement another program wrote keeps its own `/Contents` until its geometry is edited
 * here and the measured value changes; from then on it is kept in step like ours.
 *
 * A page whose scale the user changes is different: nothing about the annotation changed, so its
 * markups are patched through `updateAnnotations` and the document is marked as changed. The
 * selection stays where it was (see `suppressMenuSelection`).
 * Scales read from the file never rewrite anything.
 */
export function attachMarkupSync(api: AnnotationCapability): () => void {
  const stopEvents = api.onAnnotationEvent((event) => {
    if (event.type !== "create" && event.type !== "update") return;
    if (event.committed) return;
    const merged =
      event.type === "update" ? ({ ...event.annotation, ...event.patch } as PdfAnnotationObject) : event.annotation;
    let annotation =
      event.type === "update"
        ? (api.forDocument(event.documentId).getAnnotationById(event.annotation.id)?.object ?? merged)
        : merged;
    const pageScale = getPageScale(getActiveFileKey(), event.pageIndex);
    const curveWrite = event.type === "update" ? curveEditWrite(event.annotation, event.patch, annotation) : null;
    if (curveWrite) annotation = { ...annotation, ...curveWrite } as PdfAnnotationObject;
    const foreignKey = `${event.documentId}:${annotation.id}`;
    if (
      event.type === "update" &&
      !isOwnMarkup(annotation) &&
      markupKindOf(annotation) &&
      touchesGeometry(event.patch) &&
      measuredText(event.annotation, pageScale) !== measuredText(annotation, pageScale)
    ) {
      editedForeign.add(foreignKey);
    }
    const patch = computeMarkupPatch(annotation, pageScale, { rewriteForeignContents: editedForeign.has(foreignKey) });
    let write: Partial<PdfAnnotationObject> | null = curveWrite ? { ...curveWrite, ...patch } : patch;
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
    if (patches.length > 0) {
      // The user changed a page setting, not these markups: the viewer must not select one.
      suppressMenuSelection(patches.map((entry) => entry.id));
      api.updateAnnotations(patches);
    }
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
