import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelectedAnnotation } from "@editor/services/markups/annotationBridge";
import { cancelCalibration } from "@editor/services/markups/calibrateStore";
import { armMeasureTool } from "@editor/services/markups/markupController";
import { measureSpecForToolId } from "@editor/services/markups/markupModel";
import { useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useActiveFileKey } from "@editor/services/markups/pageScaleStore";
import { MeasureToolbar, useToolLabels } from "@editor/components/viewer/markups/MeasureToolbar";
import { PageScaleSection } from "@editor/components/viewer/markups/PageScaleSection";
import { PropertiesPanel } from "@editor/components/viewer/markups/PropertiesPanel";
import { ToolDefaultsPanel } from "@editor/components/viewer/markups/ToolDefaultsPanel";
import { useViewerPage } from "@editor/components/viewer/markups/useViewerPage";
import "@editor/components/viewer/markups/MarkupsDocks.css";
import "@editor/components/viewer/markups/MarkupsProperties.css";

/**
 * The Measure panel of the left panel: the measurement tools, the scale of the page in view (or
 * of the selected markup's page), then the selected markup's properties, or the armed tool's
 * defaults when nothing is selected. Mount it only while it is shown: leaving it disarms the
 * tool and ends a scale calibration, so the pages stop capturing clicks.
 */
export function MeasurePanel() {
  const { t } = useTranslation();
  const armedToolId = useMarkupsUi((state) => state.armedToolId);
  const selected = useSelectedAnnotation();
  const fileKey = useActiveFileKey();
  const viewerPage = useViewerPage();
  const toolLabels = useToolLabels();
  const armedSpec = armedToolId ? measureSpecForToolId(armedToolId) : undefined;
  const scalePage = selected?.pageIndex ?? viewerPage.pageIndex;

  useEffect(
    () => () => {
      cancelCalibration();
      armMeasureTool(null);
    },
    [],
  );

  return (
    <div className="measure-panel" data-testid="markups-measure-panel">
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
  );
}
