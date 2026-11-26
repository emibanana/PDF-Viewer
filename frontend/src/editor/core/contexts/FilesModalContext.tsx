import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useFileHandler } from "@editor/hooks/useFileHandler";
import { useFileActions } from "@editor/contexts/FileContext";
import { useFileContext } from "@editor/contexts/file/fileHooks";
import {
  useNavigationActions,
  useNavigationState,
} from "@editor/contexts/NavigationContext";
import { hasNativeFileDialog } from "@editor/services/fileDialogService";
import { openFilesFromDisk } from "@editor/services/openFilesFromDisk";

type CustomFileHandler = (
  files: File[],
  insertAfterPage?: number,
) => void | Promise<void>;

interface FilesModalOptions {
  insertAfterPage?: number;
  customHandler?: CustomFileHandler;
  /** 1 limits the OS dialog to a single file. */
  maxSelectable?: number | null;
  /** File extensions without the dot; limits what the OS dialog offers. */
  supportedFormats?: string[];
}

interface FilesModalContextType {
  /** Opens the OS file dialog; the chosen files go to `customHandler` or the workbench. */
  openFilesModal: (options?: FilesModalOptions) => Promise<void>;
  /** Nothing stays open between dialog and ingest, so there is nothing to close. */
  closeFilesModal: () => void;
  /** Adds files the caller already holds to the workbench. */
  onFileUpload: (files: File[]) => Promise<void>;
}

export const FilesModalContext = createContext<FilesModalContextType | null>(
  null,
);

/** A plain `<input type=file>`, for running outside the desktop shell. */
function pickWithBrowserInput(multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export const FilesModalProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { addFiles } = useFileHandler();
  const { actions } = useFileActions();
  const fileCtx = useFileContext();
  const { actions: navActions } = useNavigationActions();
  const { workbench: currentWorkbench } = useNavigationState();
  // The page editor lays out every open file, so an added file belongs there.
  const staysOnAdd = currentWorkbench === "pageEditor";

  const addToWorkbench = useCallback(
    async (files: File[]) => {
      const added = await addFiles(files);
      // Adding an input must preserve a tool's existing selection.
      const currentSelected = fileCtx.selectors
        .getSelectedStirlingFileStubs()
        .map((stub) => stub.id);
      actions.setSelectedFiles(
        Array.from(
          new Set([...currentSelected, ...added.map((file) => file.fileId)]),
        ),
      );
      if (!staysOnAdd && added.length > 0) {
        navActions.setWorkbench(added.length === 1 ? "viewer" : "fileEditor");
      }
    },
    [addFiles, actions, fileCtx, navActions, staysOnAdd],
  );

  const addToWorkbenchRef = useRef(addToWorkbench);
  addToWorkbenchRef.current = addToWorkbench;

  const openFilesModal = useCallback(async (options?: FilesModalOptions) => {
    const multiple = options?.maxSelectable !== 1;
    const files = hasNativeFileDialog
      ? await openFilesFromDisk({
          multiple,
          filters: options?.supportedFormats?.length
            ? [{ name: "Files", extensions: options.supportedFormats }]
            : undefined,
        })
      : await pickWithBrowserInput(multiple);
    if (files.length === 0) return;
    if (options?.customHandler) {
      await options.customHandler(files, options.insertAfterPage);
    } else {
      await addToWorkbenchRef.current(files);
    }
  }, []);

  const closeFilesModal = useCallback(() => {}, []);

  const contextValue: FilesModalContextType = useMemo(
    () => ({
      openFilesModal,
      closeFilesModal,
      onFileUpload: addToWorkbench,
    }),
    [openFilesModal, closeFilesModal, addToWorkbench],
  );

  return (
    <FilesModalContext.Provider value={contextValue}>
      {children}
    </FilesModalContext.Provider>
  );
};

export const useFilesModalContext = () => {
  const context = useContext(FilesModalContext);
  if (!context) {
    throw new Error(
      "useFilesModalContext must be used within FilesModalProvider",
    );
  }
  return context;
};
