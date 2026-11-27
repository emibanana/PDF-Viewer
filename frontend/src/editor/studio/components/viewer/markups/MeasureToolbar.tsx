import { useTranslation } from "react-i18next";
import { Button } from "@editor/ui/Button";
import { Icon, type IconName } from "@editor/ui/Icon";
import { MEASURE_TOOL_SPECS, type MarkupKind } from "@editor/services/markups/markupModel";
import { useCalibration } from "@editor/services/markups/calibrateStore";
import { useMarkupsUi } from "@editor/services/markups/markupsUiStore";
import { useMeasureActions } from "@editor/components/viewer/markups/useMeasureActions";

const TOOL_ICONS: Record<MarkupKind, IconName> = {
  length: "ruler",
  polylength: "route",
  curve: "spline",
  area: "square-dashed",
  wall: "layers",
  volume: "boxes",
  angle: "triangle",
  count: "check",
};

export function useToolLabels(): Record<MarkupKind, string> {
  const { t } = useTranslation();
  return {
    length: t("markups.tools.length", "Length"),
    polylength: t("markups.tools.polylength", "Polylength"),
    curve: t("markups.tools.curve", "Curve"),
    area: t("markups.tools.area", "Area"),
    wall: t("markups.tools.wall", "Wall"),
    volume: t("markups.tools.volume", "Volume"),
    angle: t("markups.tools.angle", "Angle"),
    count: t("markups.tools.count", "Count"),
  };
}

/** The six measurement tools and Calibrate. A tool stays armed after each markup; Esc stops it. */
export function MeasureToolbar() {
  const { t } = useTranslation();
  const labels = useToolLabels();
  const armedToolId = useMarkupsUi((state) => state.armedToolId);
  const calibrating = useCalibration().active;
  const { armTool, calibrate } = useMeasureActions();
  const hint = calibrating
    ? t("markups.calibrate.hint", "Click two points a known distance apart. Esc cancels.")
    : armedToolId
      ? t("markups.props.armedHint", "Click to place points. Double-click or Enter finishes. Esc stops the tool.")
      : null;

  return (
    <section className="markups-section" data-testid="markups-measure-toolbar">
      <div className="markups-dock__tools">
        {MEASURE_TOOL_SPECS.map((spec) => (
          <Button
            key={spec.id}
            size="sm"
            variant={armedToolId === spec.id ? "primary" : "secondary"}
            leftSection={<Icon name={TOOL_ICONS[spec.kind]} size="1rem" />}
            aria-pressed={armedToolId === spec.id}
            onClick={() => armTool(armedToolId === spec.id ? null : spec.id)}
            data-testid={`markups-tool-${spec.kind}`}
          >
            {labels[spec.kind]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={calibrating ? "primary" : "secondary"}
          leftSection={<Icon name="pencil-ruler" size="1rem" />}
          aria-pressed={calibrating}
          className="markups-dock__calibrate"
          onClick={calibrate}
          data-testid="markups-calibrate"
        >
          {t("markups.calibrate.button", "Calibrate")}
        </Button>
      </div>
      {hint && <p className="markups-hint">{hint}</p>}
    </section>
  );
}
