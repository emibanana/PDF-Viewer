# Workbench, open files and the file sidebar

All paths are under `frontend/src/editor/core/` unless noted.

## The model

- **Workbench** = the set of files currently open. State lives in `contexts/file/` (`FileReducer`, `fileActions`, hooks in `fileHooks.ts`; use `useFileState`, `useFileActions`, `useAllFiles`). Files not in the workbench still exist in the library (IndexedDB, `services/fileStorage`, read with `loadLeafMetadata()` as `StirlingFileStub`s).
- **Views** (`types/workbench.ts`): `viewer`, `pageEditor`, `fileEditor` (shown to the user as "Active Files"), `signing`, and `custom:<id>`. Switch with `useNavigationActions().actions.setWorkbench`.
- **Tools act on every open file.** `hooks/tools/shared/useViewScopedFiles.ts` returns all workbench files, or only the viewed file in `viewer` mode (unless the tool passes `ignoreViewerScope`, as Merge does). There is no per-file "selected" scope: `useBaseTool` comments mention a selection, but the code returns all files. So a tick next to a file means nothing to tools; to include or exclude a file, open or close it.
- Adding a library file to the workbench by stub (`fileActions.addStirlingFileStubs([stub], { selectFiles: true })`) keeps its id. `addFiles(File[])` makes a new id and a new library entry, so use it only for new bytes.
- `contexts/FilesModalContext.tsx` `openFilesModal` is only the OS file dialog now (the in-app library modal was removed). It is not a library picker.

## The sidebar (`components/shared/FileSidebar.tsx`, row: `FileSidebarFileItem.tsx`)

It is the "PDF Library": every stored file, newest first, with a per-row menu (view, rename, download, duplicate, cloud, version history, delete).

- **Viewer and custom views:** a plain recent list. Clicking a row opens the file in the viewer (`handleFileClick` -> `handleEyeClick`); the eye button on the viewed row closes the viewer. Rows carry no checkbox: the highlight only marks the file being viewed.
- **`fileEditor` and `pageEditor`:** the list is replaced by `AddFromRecentPrompt`, whose button opens `components/shared/AddFromRecentModal.tsx`, a multi-select dialog that adds many library files to the workbench at once (files already open or with lost data are shown disabled). The Active Files grid (`components/fileEditor/FileEditor.tsx`) is the list of open files there.
- Row handlers are wrapped in `useStableCallback` so memoised rows do not re-render when the library reloads; `FileSidebar.test.tsx` asserts that, and mocks `FileSidebarFileItem` and `AddFromRecentModal`, so a new import from either module must be added to those mocks.

## Merge

`tools/Merge.tsx` needs two or more open files and switches to the Active Files grid on entry. Files are added through the grid's Add File card, drag and drop, Open from computer, or the sidebar's Add from recent files.
