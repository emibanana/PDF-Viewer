import { useMemo } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { useAnnotation } from "@embedpdf/plugin-annotation/react";
import { CalibrateOverlay } from "@editor/components/viewer/markups/CalibrateOverlay";
import { useMeasureToolInteraction } from "@editor/components/viewer/markups/useMeasureToolInteraction";
import { curveHandleCss, curveHandleIndices } from "@editor/services/markups/curveEditing";
import { labelAnchor, readableTextColor } from "@editor/services/markups/labelPlacement";
import { markupKindOf, readMarkupCustom } from "@editor/services/markups/markupModel";
import { DEFAULT_PRECISION, computeMeasurement, formatPrimary } from "@editor/services/markups/measureMath";
import { normalizeTurns } from "@editor/services/markups/pageGeometry";
import { useActiveFileKey, usePageScale } from "@editor/services/markups/pageScaleStore";
import { useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { isHiddenAnnotation } from "@editor/services/markups/propertyPatches";
import "@editor/components/viewer/markups/MarkupsDocks.css";

interface PlacedLabel {
  id: string;
  text: string;
  background: string | undefined;
  color: string;
  /** Page pixels at the current zoom, in the page's unrotated space. */
  x: number;
  y: number;
}

/**
 * The measured value of each measurement markup on a page (ours, and `*Dimension` annotations
 * other programs wrote, measured on the page's scale), drawn on it, plus the click
 * layer for calibration. The pills only show while the viewer bar's toggle is on. Labels are an overlay, not part of the saved appearance: they are
 * computed from the geometry and the page's scale, so they follow edits and scale changes, keep
 * one screen size at every zoom and are turned back upright on a rotated page. A markup that is
 * hidden or deleted has no label.
 */
export function MeasureLabelLayer({ documentId, pageIndex }: { documentId: string; pageIndex: number }) {
  useMeasureToolInteraction();
  const { state } = useAnnotation(documentId);
  const documentState = useDocumentState(documentId);
  const zoom = documentState?.scale ?? 1;
  const turns = normalizeTurns((documentState?.document?.pages?.[pageIndex]?.rotation ?? 0) + (documentState?.rotation ?? 0));
  const pageScale = usePageScale(useActiveFileKey(), pageIndex);
  const showLabels = useMarkupsUi((uiState) => uiState.showMeasureLabels);

  const labels = useMemo<PlacedLabel[]>(() => {
    if (!state) return [];
    const placed: PlacedLabel[] = [];
    for (const uid of state.pages[pageIndex] ?? []) {
      const tracked = state.byUid[uid];
      if (!tracked || tracked.commitState === "deleted") continue;
      const annotation = tracked.object;
      if (isHiddenAnnotation(annotation)) continue;
      const kind = markupKindOf(annotation);
      const measurement = kind ? computeMeasurement(annotation, pageScale?.scale ?? null) : null;
      const text = measurement ? formatPrimary(measurement, pageScale?.precision ?? DEFAULT_PRECISION) : null;
      const anchor = kind ? labelAnchor(annotation, kind) : null;
      if (!text || !anchor) continue;
      const background = "strokeColor" in annotation ? annotation.strokeColor : undefined;
      placed.push({
        id: annotation.id,
        text,
        background,
        color: readableTextColor(background),
        x: anchor.x * zoom,
        y: anchor.y * zoom,
      });
    }
    return placed;
  }, [state, pageIndex, zoom, pageScale]);

  const handleCss = useMemo(() => {
    const selected = state?.selectedUids?.length === 1 ? state.byUid[state.selectedUids[0]] : undefined;
    const controlPoints =
      selected && selected.object.pageIndex === pageIndex
        ? readMarkupCustom(selected.object.custom)?.controlPoints
        : undefined;
    return controlPoints ? curveHandleCss(pageIndex, curveHandleIndices(controlPoints)) : null;
  }, [state, pageIndex]);

  return (
    <>
      {handleCss && <style>{handleCss}</style>}
      {showLabels && labels.length > 0 && (
        <div className="measure-label-layer" aria-hidden>
          {labels.map((label) => (
            <span
              key={label.id}
              className="measure-label"
              data-testid="measure-label"
              style={{
                left: label.x,
                top: label.y,
                transform: `translate(-50%, -50%) rotate(${-turns * 90}deg)`,
                ["--measure-label-bg" as string]: label.background,
                ["--measure-label-fg" as string]: label.color,
              }}
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
      <CalibrateOverlay documentId={documentId} pageIndex={pageIndex} />
    </>
  );
}
