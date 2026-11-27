import {
  getDefaultWorkbench,
  type WorkbenchType,
} from "@editor/types/workbench";

export type StartupWorkbench = "viewer" | "fileEditor";

export interface StartupNavigationAction {
  workbench: StartupWorkbench;
  activeFileIndex?: number;
  /**
   * True when the viewer already shows a document and would move to another one. No workbench
   * change happens, so the unsaved-changes guard never sees it: the caller has to ask itself
   * before the open document's edits are replaced.
   */
  replacesViewedFile?: boolean;
}

/** Several files means the file editor; one or none the viewer. */
export function getDefaultWorkbenchForFileCount(
  fileCount: number,
): WorkbenchType {
  return fileCount > 1 ? "fileEditor" : getDefaultWorkbench();
}

export function getStartupNavigationAction(
  previousFileCount: number,
  currentFileCount: number,
  selectedToolKey: string | null,
  currentWorkbench: WorkbenchType,
): StartupNavigationAction | null {
  // These tools manage their own state when files are added and should not be
  // auto-navigated away from their workbench.
  if (selectedToolKey === "pdfTextEditor" || selectedToolKey === "multiTool") {
    return null;
  }

  // The user is browsing their file library - don't auto-switch them out of
  // the file manager just because a new upload landed.
  if (currentWorkbench === "signing") {
    return null;
  }

  // Already actively viewing in the viewer → update to the latest file
  if (
    previousFileCount > 0 &&
    currentWorkbench === "viewer" &&
    currentFileCount > previousFileCount
  ) {
    return {
      workbench: "viewer",
      activeFileIndex: currentFileCount - 1,
      replacesViewedFile: true,
    };
  }

  // From landing page (no prior files)
  if (previousFileCount === 0) {
    if (currentFileCount === 1) {
      return { workbench: "viewer", activeFileIndex: 0 };
    }
    if (currentFileCount > 1) {
      return { workbench: "fileEditor" };
    }
  }

  return null;
}
