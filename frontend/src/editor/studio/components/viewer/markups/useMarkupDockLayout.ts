import { useMemo } from "react";
import { useMarkupsUi } from "@editor/services/markups/markupsUiStore";

export interface MarkupDockLayout {
  rightPx: number;
  bottomPx: number;
}

export function useMarkupDockLayout(): MarkupDockLayout {
  const rightPx = useMarkupsUi((state) => (state.rightDockOpen ? state.rightDockWidth : 0));
  const bottomPx = useMarkupsUi((state) => (state.bottomDockOpen ? state.bottomDockHeight : 0));
  return useMemo(() => ({ rightPx, bottomPx }), [rightPx, bottomPx]);
}
