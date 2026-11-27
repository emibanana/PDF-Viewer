export interface MarkupDockLayout {
  /** Width in pixels the right dock takes from the pages; 0 while it is closed. */
  rightPx: number;
  /** Height in pixels the bottom dock takes under the pages; 0 while it is closed. */
  bottomPx: number;
}

const NO_DOCKS: MarkupDockLayout = { rightPx: 0, bottomPx: 0 };

/** Core has no markup docks; the studio layer supplies this hook with the same path. */
export function useMarkupDockLayout(): MarkupDockLayout {
  return NO_DOCKS;
}
