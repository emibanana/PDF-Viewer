import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon } from "@editor/ui/ActionIcon";
import { Icon } from "@editor/ui/Icon";
import { useSelectedAnnotation } from "@editor/services/markups/annotationBridge";
import { cancelCalibration } from "@editor/services/markups/calibrateStore";
import { measureSpecForToolId } from "@editor/services/markups/markupModel";
import { getMarkupsUiState, setMarkupsUi, useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useActiveFileKey } from "@editor/services/markups/pageScaleStore";
import { MeasureToolbar, useToolLabels } from "@editor/components/viewer/markups/MeasureToolbar";
import { PageScaleSection } from "@editor/components/viewer/markups/PageScaleSection";
import { PropertiesPanel } from "@editor/components/viewer/markups/PropertiesPanel";
import { ToolDefaultsPanel } from "@editor/components/viewer/markups/ToolDefaultsPanel";
import { useDockResize } from "@editor/components/viewer/markups/useDockResize";
import { useViewerPage } from "@editor/components/viewer/markups/useViewerPage";
import "@editor/components/viewer/markups/MarkupsDocks.css";
import "@editor/components/viewer/markups/MarkupsProperties.css";

/**
 * The Measure / Properties dock: the measurement tools and Calibrate, the scale of the page in
 * view (or of the selected markup's page), then the selected markup's properties, or the armed
 * tool's defaults when nothing is selected.
 */
export function MarkupsRightDock({ rightOffsetRem }: { rightOffsetRem: number }) {
  const { t } = useTranslation();
  const open = useMarkupsUi((state) => state.rightDockOpen);
  const width = useMarkupsUi((state) => state.rightDockWidth);
  const armedToolId = useMarkupsUi((state) => state.armedToolId);
  const selected = useSelectedAnnotation();
  const fileKey = useActiveFileKey();
  const viewerPage = useViewerPage();
  const toolLabels = useToolLabels();
  const armedSpec = armedToolId ? measureSpecForToolId(armedToolId) : undefined;
  const scalePage = selected?.pageIndex ?? viewerPage.pageIndex;

  useEffect(() => {
    if (!open) cancelCalibration();
  }, [open]);

  const startResize = useDockResize(
    "x",
    -1,
    () => getMarkupsUiState().rightDockWidth,
    (size) => setMarkupsUi({ rightDockWidth: size }),
  );
  if (!open) return null;

  return (
    <aside
      className="markups-dock markups-dock--right"
      style={{ width, right: `${rightOffsetRem}rem` }}
      aria-label={t("markups.bar.properties", "Measure / Properties")}
      data-testid="markups-right-dock"
    >
      <div className="markups-dock__resize markups-dock__resize--horizontal" onPointerDown={startResize} />
      <div className="markups-dock__header">
        <span className="markups-dock__title">{t("markups.bar.properties", "Measure / Properties")}</span>
        <ActionIcon
          variant="tertiary"
          size="sm"
          aria-label={t("common.close", "Close")}
          onClick={() => setMarkupsUi({ rightDockOpen: false })}
        >
          <Icon name="x" size="1rem" />
        </ActionIcon>
      </div>
      <div className="markups-dock__body">
        <MeasureToolbar />
        <PageScaleSection fileKey={fileKey} pageIndex={scalePage} totalPages={viewerPage.totalPages} />
        {selected ? (
          <PropertiesPanel key={selected.id} annotation={selected} />
        ) : armedSpec ? (
          <ToolDefaultsPanel
            key={armedSpec.id}
            spec={armedSpec}
            toolLabel={toolLabels[armedSpec.kind]}
            pageIndex={scalePage}
          />
        ) : (
          <p className="markups-dock__empty">{t("markups.dock.noSelection", "Select a markup to see its properties.")}</p>
        )}
      </div>
    </aside>
  );
}
