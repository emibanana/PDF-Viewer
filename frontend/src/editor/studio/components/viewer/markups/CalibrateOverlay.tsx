import { useEffect, useRef, useState } from "react";
import { useDocumentState } from "@embedpdf/core/react";
import {
  cancelCalibration,
  placeCalibrationPoint,
  useCalibration,
  type CalibrationPoint,
} from "@editor/services/markups/calibrateStore";
import { clientToPagePixels, normalizeTurns } from "@editor/services/markups/pageGeometry";

const SWALLOWED_EVENTS = ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick", "touchstart", "touchend", "contextmenu"];

/**
 * Catches the two clicks of a calibration on a page. Sits above the page's own layers while
 * calibrating and keeps the clicks from reaching them, so nothing is selected or drawn.
 * Esc leaves calibration.
 */
export function CalibrateOverlay({ documentId, pageIndex }: { documentId: string; pageIndex: number }) {
  const { active, start, span } = useCalibration();
  const documentState = useDocumentState(documentId);
  const zoom = documentState?.scale ?? 1;
  const page = documentState?.document?.pages?.[pageIndex];
  const turns = normalizeTurns((page?.rotation ?? 0) + (documentState?.rotation ?? 0));
  const [hover, setHover] = useState<CalibrationPoint | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const geometry = useRef({ zoom, turns, width: page?.size.width ?? 0, height: page?.size.height ?? 0 });

  useEffect(() => {
    geometry.current = { zoom, turns, width: page?.size.width ?? 0, height: page?.size.height ?? 0 };
  }, [zoom, turns, page?.size.width, page?.size.height]);

  useEffect(() => {
    const target = element.current;
    if (!active || !target) return undefined;
    const toPagePoint = (event: MouseEvent): CalibrationPoint => {
      const { zoom: z, turns: quarter, width, height } = geometry.current;
      const pixels = clientToPagePixels(
        { x: event.clientX, y: event.clientY },
        target.getBoundingClientRect(),
        { width: width * z, height: height * z },
        quarter,
      );
      return { pageIndex, x: pixels.x / z, y: pixels.y / z };
    };
    const swallow = (event: Event) => event.stopPropagation();
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      if (event.button === 0) placeCalibrationPoint(toPagePoint(event));
    };
    const onMove = (event: MouseEvent) => setHover(toPagePoint(event));
    const onLeave = () => setHover(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelCalibration();
    };
    for (const type of SWALLOWED_EVENTS) target.addEventListener(type, swallow);
    target.addEventListener("click", onClick);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      for (const type of SWALLOWED_EVENTS) target.removeEventListener(type, swallow);
      target.removeEventListener("click", onClick);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKeyDown);
      setHover(null);
    };
  }, [active, pageIndex]);

  if (!active) return null;
  const first = span?.start ?? start;
  const second = span?.end ?? (first?.pageIndex === pageIndex ? hover : null);
  const line = first && second && first.pageIndex === pageIndex ? { a: first, b: second } : null;
  return (
    <div ref={element} className="calibrate-overlay" data-testid="calibrate-overlay">
      <svg className="calibrate-overlay__svg" aria-hidden>
        {line && (
          <>
            <line className="calibrate-overlay__halo" x1={line.a.x * zoom} y1={line.a.y * zoom} x2={line.b.x * zoom} y2={line.b.y * zoom} />
            <line className="calibrate-overlay__line" x1={line.a.x * zoom} y1={line.a.y * zoom} x2={line.b.x * zoom} y2={line.b.y * zoom} />
          </>
        )}
        {first && first.pageIndex === pageIndex && (
          <circle className="calibrate-overlay__dot" cx={first.x * zoom} cy={first.y * zoom} r={4} />
        )}
        {span && span.end.pageIndex === pageIndex && (
          <circle className="calibrate-overlay__dot" cx={span.end.x * zoom} cy={span.end.y * zoom} r={4} />
        )}
      </svg>
    </div>
  );
}
