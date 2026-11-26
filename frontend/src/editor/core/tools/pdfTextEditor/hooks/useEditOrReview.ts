import { useCallback } from "react";
import { useToolWorkflowActions } from "@editor/contexts/ToolWorkflowContext";
import { reviewMode } from "@editor/tools/pdfTextEditor/store/reviewMode";

/** Leaves any review state behind and opens the text editor. */
export function useEditOrReview() {
  const { handleToolSelectForced } = useToolWorkflowActions();

  const startEditing = useCallback(() => {
    reviewMode.close();
    handleToolSelectForced("pdfTextEditor");
  }, [handleToolSelectForced]);

  return { startEditing };
}
