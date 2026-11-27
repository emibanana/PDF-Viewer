import { useCallback, useEffect, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Icon } from "@editor/ui/Icon";
import { ActionIcon } from "@editor/ui/ActionIcon";
import { useAllFiles, useFileActions } from "@editor/contexts/FileContext";
import { useViewer } from "@editor/contexts/ViewerContext";
import { useNavigationActions, useNavigationGuard } from "@editor/contexts/NavigationContext";
import { useSidebarDock } from "@editor/contexts/SidebarContext";
import { useFileHandler } from "@editor/hooks/useFileHandler";
import { pendingFilePathMappings } from "@editor/services/pendingFilePathMappings";
import { isTauriRuntime, readPathAsFile } from "@editor/services/tauriFiles";
import { createQuickKey } from "@editor/types/fileContext";
import { useWorkbenchFileDrop } from "@editor/components/layout/useWorkbenchFileDrop";
import { MeasurePanel } from "@editor/components/viewer/markups/MeasurePanel";
import { setReaderNavOpen, useReaderNav } from "@editor/utils/readerNavStore";
import "@editor/components/viewer/readerPanel/ReaderLeftPanel.css";

interface SiblingPdf {
  name: string;
  path: string;
}

const samePath = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * The reader's left panel: recent files above a divider, the other PDFs in the
 * open file's folder below it. Bookmarks, comments and attachments take the same
 * space when picked from the quick-nav rail (their sidebars dock into it).
 */
export function ReaderLeftPanel({ recent }: { recent: ReactNode }) {
  const { t } = useTranslation();
  const { open, tab } = useReaderNav();
  // Files dropped anywhere on the panel open like drops on the workbench.
  const dropHandlers = useWorkbenchFileDrop(true);
  const dock = useSidebarDock();
  const { fileStubs } = useAllFiles();
  const { actions } = useFileActions();
  const { addFiles } = useFileHandler();
  const navActions = useNavigationActions().actions;
  const { requestNavigation } = useNavigationGuard();
  const viewer = useViewer();
  const { activeFileId, setActiveFileId } = viewer;

  const activeStub = fileStubs.find((stub) => (stub.id as string) === activeFileId);
  const activePath = activeStub?.localFilePath ?? null;

  const [nearby, setNearby] = useState<SiblingPdf[]>([]);

  useEffect(() => {
    if (!activePath || !isTauriRuntime()) {
      setNearby([]);
      return;
    }
    let cancelled = false;
    invoke<SiblingPdf[]>("list_sibling_pdfs", { path: activePath })
      .then((list) => !cancelled && setNearby(list))
      .catch(() => !cancelled && setNearby([]));
    return () => {
      cancelled = true;
    };
  }, [activePath]);

  // The rail picks a tab; the viewer's one content slot has to agree with it.
  const wantBookmarks = open && tab === "bookmarks";
  const wantComments = open && tab === "comments";
  const wantPages = open && tab === "pages";
  const wantAttachments = open && tab === "attachments";
  const {
    isBookmarkSidebarVisible,
    isAttachmentSidebarVisible,
    isCommentsSidebarVisible,
    isLayerSidebarVisible,
    isThumbnailSidebarVisible,
    toggleThumbnailSidebar,
    toggleBookmarkSidebar,
    toggleAttachmentSidebar,
    setCommentsSidebarVisible,
  } = viewer;
  // Thumbnails are their own flag, not part of the viewer's content slot.
  useEffect(() => {
    if (wantPages !== isThumbnailSidebarVisible) toggleThumbnailSidebar();
  }, [wantPages, isThumbnailSidebarVisible, toggleThumbnailSidebar]);

  useEffect(() => {
    // One change per pass: the viewer keeps a single content slot, so showing a
    // panel already replaces the one before it, and a second toggle in the same
    // pass would undo the first.
    if (wantBookmarks) {
      if (!isBookmarkSidebarVisible) toggleBookmarkSidebar();
    } else if (wantAttachments) {
      if (!isAttachmentSidebarVisible) toggleAttachmentSidebar();
    } else if (wantComments) {
      if (!isCommentsSidebarVisible) setCommentsSidebarVisible(true);
    } else if (isBookmarkSidebarVisible) {
      toggleBookmarkSidebar();
    } else if (isAttachmentSidebarVisible) {
      toggleAttachmentSidebar();
    } else if (isCommentsSidebarVisible) {
      setCommentsSidebarVisible(false);
    }
  }, [
    wantBookmarks,
    wantComments,
    wantAttachments,
    isBookmarkSidebarVisible,
    isAttachmentSidebarVisible,
    isCommentsSidebarVisible,
    toggleBookmarkSidebar,
    toggleAttachmentSidebar,
    setCommentsSidebarVisible,
  ]);

  // The layers toggle in the viewer bar docks here too, whichever tab is showing.
  const showMeasure = open && tab === "measure";
  const showDock = !showMeasure && (tab !== "files" || isLayerSidebarVisible);

  const openPathNow = useCallback(
    async (path: string) => {
      const existing = fileStubs.find((stub) => samePath(stub.localFilePath, path));
      if (existing) {
        setActiveFileId(existing.id);
        navActions.setWorkbench("viewer");
        return;
      }
      try {
        const file = await readPathAsFile(path);
        pendingFilePathMappings.set(file, path);
        const added = await addFiles([file], { selectFiles: true });
        const key = createQuickKey(file);
        for (const stirlingFile of added) {
          if (stirlingFile.quickKey === key) {
            actions.updateStirlingFileStub(stirlingFile.fileId, { localFilePath: path, isDirty: false });
            setActiveFileId(stirlingFile.fileId);
          }
        }
        navActions.setWorkbench("viewer");
      } catch (error) {
        console.error("Could not open", path, error);
      }
    },
    [fileStubs, setActiveFileId, navActions, addFiles, actions],
  );
  // Leaving a file with unsaved changes asks first, in the editor and the reader alike.
  const openPath = useCallback(
    (path: string) => requestNavigation(() => void openPathNow(path)),
    [requestNavigation, openPathNow],
  );

  const renderRow = (entry: { name: string; path: string }) => (
    <button
      key={entry.path}
      type="button"
      className="reader-panel__row"
      data-active={samePath(entry.path, activePath) || undefined}
      title={entry.path}
      onClick={() => openPath(entry.path)}
    >
      <Icon name="file-text" size="1rem" />
      <span className="reader-panel__name">{entry.name}</span>
    </button>
  );

  const titles: Record<string, string> = {
    files: t("readerPanel.files", "Files"),
    bookmarks: t("readerPanel.bookmarks", "Bookmarks"),
    pages: t("readerPanel.pages", "Pages"),
    comments: t("readerPanel.comments", "Comments"),
    attachments: t("readerPanel.attachments", "Attachments"),
    measure: t("markups.bar.properties", "Measure"),
  };

  return (
    <aside className="reader-panel" data-testid="reader-left-panel" hidden={!open} data-wide={tab === "measure" || undefined} {...dropHandlers}>
      <div className="reader-panel__header">
        <span className="reader-panel__title">{titles[tab]}</span>
        <ActionIcon
          variant="tertiary"
          accent="neutral"
          size="sm"
          onClick={() => setReaderNavOpen(false)}
          aria-label={t("readerPanel.retract", "Hide panel")}
          title={t("readerPanel.retract", "Hide panel")}
        >
          <Icon name="chevron-left" size="1.1rem" />
        </ActionIcon>
      </div>

      {/* Bookmarks, comments and attachments portal their sidebar in here. */}
      <div ref={dock?.setElement} className="reader-panel__dock" data-empty={!showDock || undefined} />

      {/* The file cards stay mounted while another tab shows: they own opening and
          dropping files. */}
      {showMeasure && (
        <div className="reader-panel__measure">
          <MeasurePanel />
        </div>
      )}

      <div className="reader-panel__files" hidden={showDock || showMeasure}>
        <section className="reader-panel__recent">
          <h3 className="reader-panel__heading">{t("readerPanel.recent", "Recent")}</h3>
          <div className="reader-panel__recent-list">{recent}</div>
        </section>
        <hr className="reader-panel__separator" />
        <section className="reader-panel__section reader-panel__nearby">
          <h3 className="reader-panel__heading">{t("readerPanel.nearby", "In this folder")}</h3>
          {nearby.length === 0 ? (
            <p className="reader-panel__empty">
              {activePath
                ? t("readerPanel.noNearby", "No other PDFs in this folder.")
                : t("readerPanel.noFolder", "Open a file from disk to see its folder.")}
            </p>
          ) : (
            nearby.map(renderRow)
          )}
        </section>
      </div>
    </aside>
  );
}
