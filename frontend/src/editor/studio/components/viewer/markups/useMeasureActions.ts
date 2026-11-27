import { useCallback } from "react";
import { useViewer } from "@editor/contexts/ViewerContext";
import { armMeasureTool, deselectMarkup } from "@editor/services/markups/markupController";
import type { MeasureToolId } from "@editor/services/markups/markupModel";
import { cancelCalibration, startCalibration } from "@editor/services/markups/calibrateStore";

/**
 * Arms a measurement tool or starts calibrating. Both need the page's pointer, so the hand
 * (pan) mode is turned off first; the annotation plugin's own interaction mode already replaces
 * text selection when a tool is armed.
 */
export function useMeasureActions() {
  const { panActions, getPanState } = useViewer();

  const leavePan = useCallback(() => {
    if (getPanState().isPanning) panActions.disablePan();
  }, [getPanState, panActions]);

  const armTool = useCallback(
    (toolId: MeasureToolId | null) => {
      cancelCalibration();
      if (toolId) leavePan();
      armMeasureTool(toolId);
    },
    [leavePan],
  );

  const calibrate = useCallback(() => {
    armMeasureTool(null);
    deselectMarkup();
    leavePan();
    startCalibration();
  }, [leavePan]);

  return { armTool, calibrate };
}
