import { type RefObject, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Point } from "@embedpdf/plugin-zoom";
import { VIEWER_VIEWPORT_ATTR } from "@editor/components/viewer/usePagesPastInset";

/** One mouse-wheel notch (100px) zooms by the same 1.2x the zoom buttons step by. */
const ZOOM_PER_PIXEL = Math.log(1.2) / 100;
/** Caps a single event so a fast flick or a line-mode wheel cannot jump the zoom. */
const MAX_PIXELS_PER_EVENT = 100;
/** Time constant of the glide toward the requested zoom; the app's other transitions run 150-280 ms. */
const SMOOTHING_MS = 70;
/** Zoom the glide still owes (log scale) below which it lands exactly. */
const SETTLE_EPSILON = 0.002;
/** Most zoom a burst of wheel events may queue ahead of the glide (log scale, about three notches). */
const MAX_PENDING_LOG = Math.log(1.2) * 3;
const FRAME_MS = 16;
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
function viewportPoint(viewport: Element, event: { clientX: number; clientY: number }): Point {
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

interface Pointer {
  clientX: number;
  clientY: number;
}

function pageAnchorAt({ clientX, clientY }: Pointer): PageAnchor | null {
  const hit = document.elementsFromPoint?.(clientX, clientY) ?? [];
  for (const el of hit) {
    const page = el.closest("[data-page-index]");
    if (!page) continue;
    const rect = page.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      page,
      fx: (clientX - rect.left) / rect.width,
      fy: (clientY - rect.top) / rect.height,
    };
  }
  return null;
}

/** Scrolls so the anchored page point sits under the pointer again. */
function pinAnchor(viewport: Element, anchor: PageAnchor, { clientX, clientY }: Pointer) {
  if (!anchor.page.isConnected) return;
  const rect = anchor.page.getBoundingClientRect();
  viewport.scrollLeft += rect.left + anchor.fx * rect.width - clientX;
  viewport.scrollTop += rect.top + anchor.fy * rect.height - clientY;
}

/**
 * Ctrl/Cmd + wheel (and touchpad pinch, which browsers report the same way)
 * zooms the document about the pointer, so the spot under it stays put.
 *
 * Wheel input only queues how much zoom is owed; an animation-frame loop pays
 * it off with an exponential glide, so a notch eases in instead of snapping.
 * Each frame is one complete zoom step.
 *
 * A step is committed with flushSync: the zoom plugin restores the scroll
 * position on the next animation frame, and if React has not laid the pages
 * out at the new size by then the browser clamps that scroll and the document
 * jumps away from the pointer.
 *
 * The plugin also derives its scroll target from scroll metrics that lag the
 * DOM while steps arrive faster than frames, and applies it in a later
 * animation frame. So the page point under the pointer is re-pinned from the
 * DOM right after the step and again after the plugin's own scroll lands.
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

    let pendingLog = 0;
    let pointer: Pointer = { clientX: 0, clientY: 0 };
    let frame = 0;
    let lastTime = 0;

    const step = (viewport: Element, log: number) => {
      const anchor = pageAnchorAt(pointer);
      const center = viewportPoint(viewport, pointer);
      const at = { ...pointer };
      flushSync(() => zoomByRef.current(Math.exp(log), center));
      if (!anchor) return;
      pinAnchor(viewport, anchor, at);
      requestAnimationFrame(() => pinAnchor(viewport, anchor, at));
    };

    const tick = (time: number) => {
      frame = 0;
      const viewport = element.querySelector(`[${VIEWER_VIEWPORT_ATTR}]`);
      if (!viewport || pendingLog === 0) return;
      const dt = lastTime === 0 ? FRAME_MS : Math.min(time - lastTime, 100);
      lastTime = time;
      const settled = Math.abs(pendingLog) < SETTLE_EPSILON;
      const log = settled ? pendingLog : pendingLog * (1 - Math.exp(-dt / SMOOTHING_MS));
      pendingLog -= log;
      step(viewport, log);
      if (settled) pendingLog = 0;
      if (pendingLog !== 0) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      event.stopPropagation();

      const pixels = wheelPixels(event);
      if (pixels === 0) return;

      pointer = { clientX: event.clientX, clientY: event.clientY };
      pendingLog = Math.max(
        -MAX_PENDING_LOG,
        Math.min(MAX_PENDING_LOG, pendingLog - pixels * ZOOM_PER_PIXEL),
      );
      if (!frame) frame = requestAnimationFrame(tick);
    };

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
}
