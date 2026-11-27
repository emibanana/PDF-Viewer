export interface MarkupDockLayout {
  /** Height in pixels the bottom dock takes under the pages; 0 while it is closed. */
  bottomPx: number;
}

const NO_DOCKS: MarkupDockLayout = { bottomPx: 0 };

/** Core has no markup docks; the studio layer supplies this hook with the same path. */
export function useMarkupDockLayout(): MarkupDockLayout {
  return NO_DOCKS;
}
