import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@editor/ui/Button";
import { Checkbox } from "@editor/ui/Checkbox";
import { FormField } from "@editor/ui/FormField";
import { Input } from "@editor/ui/Input";
import { Select, type SelectOptionGroup } from "@editor/ui/Select";
import { ScaleCalibrationDialog } from "@editor/components/viewer/ScaleCalibrationDialog";
import type { MeasureScale } from "@editor/utils/measurementTypes";
import { getUnitOptions } from "@editor/utils/measurementUtils";
import { cancelCalibration, restartCalibration, useCalibration } from "@editor/services/markups/calibrateStore";
import { setPagePrecision, setScaleForPages, usePageScale } from "@editor/services/markups/pageScaleStore";
import {
  IMPERIAL_PRESETS,
  METRIC_PRESETS,
  SCALE_PRESETS,
  customScale,
  describeScale,
  findPreset,
  parseRatioInput,
  presetScale,
  roundRatio,
} from "@editor/services/markups/scalePresets";

const PRECISIONS = [0, 1, 2, 3, 4] as const;

const ratioToText = (ratio: number | null | undefined) => (ratio ? String(roundRatio(ratio)) : "");

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

interface PageScaleSectionProps {
  fileKey: string | null;
  pageIndex: number;
  totalPages: number;
}

/**
 * The scale of one page: a preset, a typed ratio, or two clicked points of known length. With
 * "apply to all pages" ticked a change goes to every page of the file instead of just this one.
 */
export function PageScaleSection({ fileKey, pageIndex, totalPages }: PageScaleSectionProps) {
  const { t } = useTranslation();
  const entry = usePageScale(fileKey, pageIndex);
  const calibration = useCalibration();
  const [applyToAll, setApplyToAll] = useState(false);
  const scale = entry?.scale ?? null;
  const preset = findPreset(scale);
  const [ratioText, setRatioText] = useState(ratioToText(scale?.ratio));
  const [unit, setUnit] = useState(scale?.unit ?? "m");

  useEffect(() => {
    if (scale?.ratio) setRatioText(ratioToText(scale.ratio));
    if (scale) setUnit(scale.unit);
  }, [scale]);

  const pagesToChange = (page: number) => (applyToAll && totalPages > 0 ? range(totalPages) : [page]);

  const applyScale = (next: MeasureScale, page = pageIndex) => {
    if (fileKey) setScaleForPages(fileKey, pagesToChange(page), next);
  };

  const presetOptions = useMemo<SelectOptionGroup[]>(
    () => [
      {
        group: t("markups.scale.metric", "Metric"),
        options: METRIC_PRESETS.map(({ id, label }) => ({ value: id, label })),
      },
      {
        group: t("markups.scale.imperial", "Imperial"),
        options: IMPERIAL_PRESETS.map(({ id, label }) => ({ value: id, label })),
      },
    ],
    [t],
  );
  const unitOptions = getUnitOptions(t);
  const parsedRatio = parseRatioInput(ratioText);
  const typedScale = parsedRatio === null ? null : customScale(parsedRatio, unit);
  const label = describeScale(scale);

  const onApplyToAll = (checked: boolean) => {
    setApplyToAll(checked);
    if (!checked || !fileKey || !entry || totalPages === 0) return;
    setScaleForPages(fileKey, range(totalPages), entry.scale, entry.precision);
  };

  const onPrecision = (value: string | null) => {
    if (value === null || !fileKey || !entry) return;
    const precision = Number(value);
    for (const page of pagesToChange(pageIndex)) setPagePrecision(fileKey, page, precision);
  };

  const span = calibration.span;
  const measurement = useMemo(
    () => (span ? { start: span.start, end: span.end, pdfDistancePts: span.distancePts } : null),
    [span],
  );

  return (
    <section className="markups-section" data-testid="markups-page-scale">
      <h3 className="markups-section__title">{t("markups.scale.title", "Page scale")}</h3>
      <p className="markups-scale__current" data-testid="markups-page-scale-label">
        {t("markups.scale.page", "Page {{page}}", { page: pageIndex + 1 })}
        {": "}
        {label ?? t("markups.scale.notSet", "Scale not set")}
      </p>
      <div className="markups-fields">
        <FormField label={t("markups.scale.preset", "Scale")}>
          <Select
            inputSize="sm"
            options={presetOptions}
            value={preset?.id ?? null}
            placeholder={t("markups.scale.choose", "Choose a scale")}
            disabled={!fileKey}
            onChange={(id) => {
              const chosen = SCALE_PRESETS.find((candidate) => candidate.id === id);
              if (chosen) applyScale(presetScale(chosen));
            }}
          />
        </FormField>
        <div className="markups-scale__custom">
          <FormField label={t("markups.scale.customRatio", "Custom 1 :")}>
            <Input
              inputSize="sm"
              inputMode="decimal"
              value={ratioText}
              invalid={ratioText.trim() !== "" && parsedRatio === null}
              placeholder="100"
              onChange={(event) => setRatioText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && typedScale) applyScale(typedScale);
              }}
            />
          </FormField>
          <FormField label={t("markups.scale.unit", "Unit")}>
            <Select
              inputSize="sm"
              options={unitOptions}
              value={unit}
              allowDeselect={false}
              onChange={(next) => next && setUnit(next)}
            />
          </FormField>
          <Button
            size="sm"
            variant="secondary"
            disabled={!typedScale || !fileKey}
            onClick={() => typedScale && applyScale(typedScale)}
            data-testid="markups-scale-set"
          >
            {t("markups.scale.set", "Set")}
          </Button>
        </div>
        <FormField label={t("markups.scale.precision", "Precision")}>
          <Select
            inputSize="sm"
            options={PRECISIONS.map((digits) => ({
              value: String(digits),
              label: digits === 0 ? "0" : `0.${"0".repeat(digits)}`,
            }))}
            value={entry ? String(entry.precision) : null}
            allowDeselect={false}
            disabled={!entry}
            onChange={onPrecision}
          />
        </FormField>
        <Checkbox
          checked={applyToAll}
          onChange={(event) => onApplyToAll(event.target.checked)}
          label={t("markups.scale.applyAll", "Apply to all pages")}
        />
      </div>
      <ScaleCalibrationDialog
        opened={measurement !== null}
        measurement={measurement}
        defaultUnit={scale?.unit ?? "m"}
        onApplyScale={(next) => {
          if (span) applyScale(next, span.start.pageIndex);
          cancelCalibration();
        }}
        onClose={restartCalibration}
      />
    </section>
  );
}
