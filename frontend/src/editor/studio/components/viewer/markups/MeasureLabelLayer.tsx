import { useMemo } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import { useAnnotation } from "@embedpdf/plugin-annotation/react";
import { isOwnMarkup } from "@editor/services/markups/markupModel";
import "@editor/components/viewer/markups/MarkupsDocks.css";

interface PlacedLabel {
  id: string;
  text: string;
  color: string | undefined;
  x: number;
  y: number;
}

/**
 * The measured value of each of our measurement markups on a page, drawn beside it. An overlay,
 * not part of the saved appearance; the same text is in the annotation's `/Contents`.
 */
export function MeasureLabelLayer({ documentId, pageIndex }: { documentId: string; pageIndex: number }) {
  const { state } = useAnnotation(documentId);
  const scale = useDocumentState(documentId)?.scale ?? 1;

  const labels = useMemo<PlacedLabel[]>(() => {
    if (!state) return [];
    const placed: PlacedLabel[] = [];
    for (const uid of state.pages[pageIndex] ?? []) {
      const tracked = state.byUid[uid];
      if (!tracked || tracked.commitState === "deleted") continue;
      const annotation = tracked.object;
      if (!isOwnMarkup(annotation) || !annotation.contents) continue;
      const { origin, size } = annotation.rect;
      placed.push({
        id: annotation.id,
        text: annotation.contents,
        color: "strokeColor" in annotation ? annotation.strokeColor : undefined,
        x: (origin.x + size.width / 2) * scale,
        y: (origin.y + size.height / 2) * scale,
      });
    }
    return placed;
  }, [state, pageIndex, scale]);

  if (labels.length === 0) return null;
  return (
    <div className="measure-label-layer" aria-hidden>
      {labels.map((label) => (
        <span
          key={label.id}
          className="measure-label"
          style={{ left: label.x, top: label.y, ["--measure-label-color" as string]: label.color }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}
