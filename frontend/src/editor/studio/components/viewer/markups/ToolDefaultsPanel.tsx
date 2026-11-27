import { useTranslation } from "react-i18next";
import { FormField } from "@editor/ui/FormField";
import { Input } from "@editor/ui/Input";
import { isClosedKind, type MeasureToolSpec } from "@editor/services/markups/markupModel";
import { useActiveFileKey, usePageScale } from "@editor/services/markups/pageScaleStore";
import type { AppearanceValues } from "@editor/services/markups/propertyPatches";
import { AppearanceFields } from "@editor/components/viewer/markups/AppearanceFields";
import { ExtentField } from "@editor/components/viewer/markups/MeasurementValues";
import { useBufferedValue } from "@editor/components/viewer/markups/useBufferedValue";
import { useToolDefaults } from "@editor/components/viewer/markups/useToolDefaults";

/**
 * What the armed measurement tool will give the next markup: subject, appearance and wall
 * height or slab depth. Edits apply to the tool at once and are remembered per tool; markups
 * already drawn are not touched. Key it by tool so switching tools reloads the fields.
 */
export function ToolDefaultsPanel({
  spec,
  toolLabel,
  pageIndex,
}: {
  spec: MeasureToolSpec;
  toolLabel: string;
  pageIndex: number;
}) {
  const { t } = useTranslation();
  const { values, update } = useToolDefaults(spec);
  const unit = usePageScale(useActiveFileKey(), pageIndex)?.scale.unit ?? null;
  const [subject, changeSubject, flushSubject] = useBufferedValue(values.subject, (next) => {
    if (next.trim() !== "") update({ subject: next });
  });
  const appearance: AppearanceValues = {
    strokeColor: values.strokeColor,
    opacity: values.opacity,
    strokeWidth: values.strokeWidth,
    lineStyle: values.lineStyle,
    ...(isClosedKind(spec.kind) ? { fillColor: values.fillColor } : {}),
  };

  return (
    <div className="markups-properties" data-testid="markups-tool-defaults">
      <section className="markups-section">
        <h3 className="markups-section__title">{t("markups.props.toolDefaults", "{{tool}} defaults", { tool: toolLabel })}</h3>
        <p className="markups-hint">
          {t("markups.props.toolDefaultsHint", "Applied to the markups you draw next. Select a markup to edit it instead.")}
        </p>
        <div className="markups-fields">
          <FormField label={t("markups.props.subject", "Subject")}>
            <Input
              inputSize="sm"
              value={subject}
              onChange={(event) => changeSubject(event.target.value)}
              onBlur={flushSubject}
            />
          </FormField>
          {spec.kind === "wall" && (
            <ExtentField
              label={t("markups.props.height", "Height")}
              unit={unit ?? ""}
              value={values.height}
              onCommit={(height) => update({ height })}
            />
          )}
          {spec.kind === "volume" && (
            <ExtentField
              label={t("markups.props.depth", "Depth")}
              unit={unit ?? ""}
              value={values.depth}
              onCommit={(depth) => update({ depth })}
            />
          )}
        </div>
      </section>
      <section className="markups-section">
        <h3 className="markups-section__title">{t("markups.props.appearance", "Appearance")}</h3>
        <AppearanceFields
          values={appearance}
          onChange={update}
        />
      </section>
    </div>
  );
}
