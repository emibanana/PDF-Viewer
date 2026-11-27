import { useTranslation } from "react-i18next";
import { ActionIcon } from "@editor/ui/ActionIcon";
import { Button } from "@editor/ui/Button";
import { Icon } from "@editor/ui/Icon";
import { armMeasureTool } from "@editor/services/markups/markupController";
import { MEASURE_TOOL_SPECS, type MarkupKind } from "@editor/services/markups/markupModel";
import { getMarkupsUiState, setMarkupsUi, useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useDockResize } from "@editor/components/viewer/markups/useDockResize";
import "@editor/components/viewer/markups/MarkupsDocks.css";

/** The Measure / Properties dock: measurement tool buttons now, the selected markup's properties next. */
export function MarkupsRightDock({ rightOffsetRem }: { rightOffsetRem: number }) {
  const { t } = useTranslation();
  const open = useMarkupsUi((state) => state.rightDockOpen);
  const width = useMarkupsUi((state) => state.rightDockWidth);
  const armedToolId = useMarkupsUi((state) => state.armedToolId);
  const toolLabels: Record<MarkupKind, string> = {
    length: t("markups.tools.length", "Length"),
    polylength: t("markups.tools.polylength", "Polylength"),
    curve: t("markups.tools.curve", "Curve"),
    area: t("markups.tools.area", "Area"),
    wall: t("markups.tools.wall", "Wall"),
    volume: t("markups.tools.volume", "Volume"),
  };
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
        <div className="markups-dock__tools">
          {MEASURE_TOOL_SPECS.map((spec) => (
            <Button
              key={spec.id}
              variant={armedToolId === spec.id ? "primary" : "secondary"}
              onClick={() => armMeasureTool(armedToolId === spec.id ? null : spec.id)}
              data-testid={`markups-tool-${spec.kind}`}
            >
              {toolLabels[spec.kind]}
            </Button>
          ))}
        </div>
        <p className="markups-dock__empty">{t("markups.dock.noSelection", "Select a markup to see its properties.")}</p>
      </div>
    </aside>
  );
}
