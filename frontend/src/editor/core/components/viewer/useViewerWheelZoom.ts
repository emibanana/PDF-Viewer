import { type RefObject, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Point } from "@embedpdf/plugin-zoom";
import { VIEWER_VIEWPORT_ATTR } from "@editor/components/viewer/usePagesPastInset";

/** One mouse-wheel notch (100px) zooms by the same 1.2x the zoom buttons step by. */
const ZOOM_PER_PIXEL = Math.log(1.2) / 100;
/** Caps a single event so a fast flick or a line-mode wheel cannot jump the zoom. */
const MAX_PIXELS_PER_EVENT = 100;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 800;

function wheelPixels(event: WheelEvent): number {
  const unit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? LINE_HEIGHT_PX
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? PAGE_HEIGHT_PX
        : 1;
  const px = event.deltaY * unit;
  return Math.max(-MAX_PIXELS_PER_EVENT, Math.min(MAX_PIXELS_PER_EVENT, px));
}

/** The pointer in the viewport's padding-box pixels, the frame the zoom plugin anchors in. */
function viewportPoint(viewport: Element, event: WheelEvent): Point {
  const rect = viewport.getBoundingClientRect();
  const x = event.clientX - rect.left - viewport.clientLeft;
  const y = event.clientY - rect.top - viewport.clientTop;
  return {
    vx: Math.max(0, Math.min(viewport.clientWidth, x)),
    vy: Math.max(0, Math.min(viewport.clientHeight, y)),
  };
}

interface PageAnchor {
  page: Element;
  fx: number;
  fy: number;
}

function pageAnchorAt(event: WheelEvent): PageAnchor | null {
  const hit = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  for (const el of hit) {
    const page = el.closest("[data-page-index]");
    if (!page) continue;
    const rect = page.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      page,
      fx: (event.clientX - rect.left) / rect.width,
      fy: (event.clientY - rect.top) / rect.height,
    };
  }
  return null;
}

/** Scrolls so the anchored page point sits under the pointer again. */
function pinAnchor(viewport: Element, anchor: PageAnchor, event: WheelEvent) {
  if (!anchor.page.isConnected) return;
  const rect = anchor.page.getBoundingClientRect();
  const dx = rect.left + anchor.fx * rect.width - event.clientX;
  const dy = rect.top + anchor.fy * rect.height - event.clientY;
  viewport.scrollLeft += dx;
  viewport.scrollTop += dy;
}

/**
 * Ctrl/Cmd + wheel (and touchpad pinch, which browsers report the same way)
 * zooms the document about the pointer, so the spot under it stays put.
 *
 * The zoom is committed with flushSync: the zoom plugin restores the scroll
 * position on the next animation frame, and if React has not laid the pages
 * out at the new size by then the browser clamps that scroll and the document
 * jumps away from the pointer.
 *
 * The plugin also derives its scroll target from scroll metrics that lag the
 * DOM while wheel events arrive faster than frames, and applies it in a later
 * animation frame. So the page point under the pointer is re-pinned from the
 * DOM right after the zoom and again after the plugin's own scroll lands.
 */
export function useViewerWheelZoom(
  ref: RefObject<HTMLElement | null>,
  zoomBy: (factor: number, center: Point) => void,
) {
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();

      const viewport = element.querySelector(`[${VIEWER_VIEWPORT_ATTR}]`);
      const pixels = wheelPixels(event);
      if (!viewport || pixels === 0) return;

      const factor = Math.exp(-pixels * ZOOM_PER_PIXEL);
      const center = viewportPoint(viewport, event);
      const anchor = pageAnchorAt(event);
      flushSync(() => zoomByRef.current(factor, center));
      if (!anchor) return;
      pinAnchor(viewport, anchor, event);
      requestAnimationFrame(() => pinAnchor(viewport, anchor, event));
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [ref]);
}
