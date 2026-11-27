import { useSyncExternalStore } from "react";

export const BOTTOM_DOCK_MIN_HEIGHT = 140;
export const BOTTOM_DOCK_MAX_HEIGHT = 720;
export const RIGHT_DOCK_MIN_WIDTH = 260;
export const RIGHT_DOCK_MAX_WIDTH = 520;

export interface MarkupsUiState {
  rightDockOpen: boolean;
  bottomDockOpen: boolean;
  /** Pixels; applies while the bottom dock is open. */
  bottomDockHeight: number;
  /** Pixels; applies while the right dock is open. */
  rightDockWidth: number;
  /** The annotation id the viewer has selected, with the page it is on. */
  selectedAnnotationId: string | null;
  selectedPageIndex: number | null;
  /** The measurement tool currently drawing, or any other armed annotation tool id. */
  armedToolId: string | null;
}

const STORAGE_KEY = "markups.ui";
const PERSISTED_KEYS = ["rightDockOpen", "bottomDockOpen", "bottomDockHeight", "rightDockWidth"] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function loadPersisted(): Partial<MarkupsUiState> {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const source = parsed as Record<string, unknown>;
    const result: Partial<MarkupsUiState> = {};
    if (typeof source.rightDockOpen === "boolean") result.rightDockOpen = source.rightDockOpen;
    if (typeof source.bottomDockOpen === "boolean") result.bottomDockOpen = source.bottomDockOpen;
    if (typeof source.bottomDockHeight === "number") {
      result.bottomDockHeight = clamp(source.bottomDockHeight, BOTTOM_DOCK_MIN_HEIGHT, BOTTOM_DOCK_MAX_HEIGHT);
    }
    if (typeof source.rightDockWidth === "number") {
      result.rightDockWidth = clamp(source.rightDockWidth, RIGHT_DOCK_MIN_WIDTH, RIGHT_DOCK_MAX_WIDTH);
    }
    return result;
  } catch {
    return {};
  }
}

function initialState(): MarkupsUiState {
  return {
    rightDockOpen: false,
    bottomDockOpen: false,
    bottomDockHeight: 260,
    rightDockWidth: 320,
    selectedAnnotationId: null,
    selectedPageIndex: null,
    armedToolId: null,
    ...loadPersisted(),
  };
}

let state: MarkupsUiState = initialState();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    const subset = Object.fromEntries(PERSISTED_KEYS.map((key) => [key, state[key]]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subset));
  } catch {
    // Storage can be full or blocked; the layout then simply is not remembered.
  }
}

export function getMarkupsUiState(): MarkupsUiState {
  return state;
}

export function subscribeMarkupsUi(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Applies `patch` (sizes are clamped) and notifies subscribers when something changed. */
export function setMarkupsUi(patch: Partial<MarkupsUiState>): void {
  const next: MarkupsUiState = { ...state, ...patch };
  next.bottomDockHeight = clamp(next.bottomDockHeight, BOTTOM_DOCK_MIN_HEIGHT, BOTTOM_DOCK_MAX_HEIGHT);
  next.rightDockWidth = clamp(next.rightDockWidth, RIGHT_DOCK_MIN_WIDTH, RIGHT_DOCK_MAX_WIDTH);
  const changed = (Object.keys(next) as (keyof MarkupsUiState)[]).some((key) => next[key] !== state[key]);
  if (!changed) return;
  const persistedChanged = PERSISTED_KEYS.some((key) => next[key] !== state[key]);
  state = next;
  if (persistedChanged) persist();
  for (const listener of [...listeners]) listener();
}

export function toggleRightDock(): void {
  setMarkupsUi({ rightDockOpen: !state.rightDockOpen });
}

export function toggleBottomDock(): void {
  setMarkupsUi({ bottomDockOpen: !state.bottomDockOpen });
}

/** Subscribes to one slice of the state; `select` must return a primitive or a stable reference. */
export function useMarkupsUi<T>(select: (state: MarkupsUiState) => T): T {
  return useSyncExternalStore(subscribeMarkupsUi, () => select(state));
}

export function resetMarkupsUiForTests(): void {
  state = {
    rightDockOpen: false,
    bottomDockOpen: false,
    bottomDockHeight: 260,
    rightDockWidth: 320,
    selectedAnnotationId: null,
    selectedPageIndex: null,
    armedToolId: null,
  };
  listeners.clear();
}
