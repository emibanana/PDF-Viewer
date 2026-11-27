import { useEffect } from "react";
import { finishPendingPageShape } from "@editor/components/viewer/ViewerPointerProviders";
import { isMeasureToolId } from "@editor/services/markups/markupModel";
import { getMarkupsUiState, subscribeMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { enterFinishesShape } from "@editor/services/markups/measureToolKeys";

/** Set on the root element while a measurement tool is armed; MarkupsDocks.css switches the annotations' pointer events off on it. */
export const MEASURE_ARMED_ATTRIBUTE = "data-measure-tool-armed";

let users = 0;
let uninstall: (() => void) | null = null;

function install(): () => void {
  const root = document.documentElement;
  const syncAttribute = () => {
    if (isMeasureToolId(getMarkupsUiState().armedToolId)) root.setAttribute(MEASURE_ARMED_ATTRIBUTE, "");
    else root.removeAttribute(MEASURE_ARMED_ATTRIBUTE);
  };
  syncAttribute();
  const stopStore = subscribeMarkupsUi(syncAttribute);
  const onKeyDown = (event: KeyboardEvent) => {
    if (!enterFinishesShape(getMarkupsUiState().armedToolId, event)) return;
    event.preventDefault();
    finishPendingPageShape();
  };
  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    stopStore();
    root.removeAttribute(MEASURE_ARMED_ATTRIBUTE);
  };
}

/**
 * While a measurement tool is armed in a mounted viewer: Enter finishes the polyline, curve or
 * polygon being drawn, and existing annotations stop catching the pointer so a drag that starts
 * on one draws a new markup, as in Revu. Reference counted: every page layer calls it, the
 * listeners are installed once.
 */
export function useMeasureToolInteraction(): void {
  useEffect(() => {
    if (users++ === 0) uninstall = install();
    return () => {
      if (--users === 0) {
        uninstall?.();
        uninstall = null;
      }
    };
  }, []);
}
