import { useSyncExternalStore } from "react";

export interface CalibrationPoint {
  pageIndex: number;
  /** PDF points, in the page's own unrotated space. */
  x: number;
  y: number;
}

/** Two clicked points on one page, ready for the real-world distance to be entered. */
export interface CalibrationSpan {
  start: CalibrationPoint;
  end: CalibrationPoint;
  /** PDF points between them. */
  distancePts: number;
}

export interface CalibrationState {
  /** The page overlays capture clicks while this is on. */
  active: boolean;
  /** The first point, once it is placed. */
  start: CalibrationPoint | null;
  /** Both points, once the second is placed; the distance dialog is open for it. */
  span: CalibrationSpan | null;
}

const IDLE: CalibrationState = { active: false, start: null, span: null };

let state: CalibrationState = IDLE;
const listeners = new Set<() => void>();

function set(next: CalibrationState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

export function getCalibrationState(): CalibrationState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCalibration(): CalibrationState {
  return useSyncExternalStore(subscribe, () => state);
}

export function startCalibration(): void {
  set({ active: true, start: null, span: null });
}

/** Leaves calibration without applying anything. */
export function cancelCalibration(): void {
  if (state !== IDLE) set(IDLE);
}

/**
 * Takes a click on a page: the first click places the start, the second ends the span. A click
 * on another page than the start's begins again there, since a scale is read off one page.
 * A second click on the same spot is ignored: zero length gives no scale.
 */
export function placeCalibrationPoint(point: CalibrationPoint): void {
  if (!state.active || state.span) return;
  const start = state.start;
  if (!start || start.pageIndex !== point.pageIndex) {
    set({ active: true, start: point, span: null });
    return;
  }
  const distancePts = Math.hypot(point.x - start.x, point.y - start.y);
  if (distancePts <= 0) return;
  set({ active: true, start, span: { start, end: point, distancePts } });
}

/** After the dialog is closed without applying: back to picking, so another try is one click away. */
export function restartCalibration(): void {
  if (state.active) set({ active: true, start: null, span: null });
}
