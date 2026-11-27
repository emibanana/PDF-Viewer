import { useMemo } from "react";
import { useMarkupsUi } from "@editor/services/markups/markupsUiStore";

export interface MarkupDockLayout {
  bottomPx: number;
}

export function useMarkupDockLayout(): MarkupDockLayout {
  const bottomPx = useMarkupsUi((state) => (state.bottomDockOpen ? state.bottomDockHeight : 0));
  return useMemo(() => ({ bottomPx }), [bottomPx]);
}
