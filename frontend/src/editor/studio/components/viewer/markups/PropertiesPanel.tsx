import { useTranslation } from "react-i18next";
import type { PdfAnnotationObject } from "@embedpdf/models";
import { Button } from "@editor/ui/Button";
import { FormField } from "@editor/ui/FormField";
import { Input } from "@editor/ui/Input";
import { updateMarkup } from "@editor/services/markups/markupController";
import { markupKindOf, readMarkupCustom } from "@editor/services/markups/markupModel";
import { DEFAULT_PRECISION, computeMeasurement } from "@editor/services/markups/measureMath";
import { useActiveFileKey, usePageScale } from "@editor/services/markups/pageScaleStore";
import {
  appearancePatch,
  commentPatch,
  extentPatch,
  labelPatch,
  readAppearance,
  resetCommentPatch,
  subjectPatch,
  type AppearanceValues,
  type PropertyAnnotation,
} from "@editor/services/markups/propertyPatches";
import { AppearanceFields } from "@editor/components/viewer/markups/AppearanceFields";
import { ExtentField, MeasurementValues } from "@editor/components/viewer/markups/MeasurementValues";
import { useBufferedValue } from "@editor/components/viewer/markups/useBufferedValue";

function formatDate(date: Date | undefined, locale: string): string {
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale);
}

function BufferedText({
  label,
  value,
  onCommit,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  testId: string;
}) {
  const [shown, change, flush] = useBufferedValue(value, onCommit);
  return (
    <FormField label={label}>
      <Input
        inputSize="sm"
        value={shown}
        onChange={(event) => change(event.target.value)}
        onBlur={flush}
        onKeyDown={(event) => {
          if (event.key === "Enter") flush();
        }}
        data-testid={testId}
      />
    </FormField>
  );
}

function BufferedComments({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [shown, change, flush] = useBufferedValue(value, onCommit, 600);
  return (
    <FormField label={label}>
      <textarea
        className="markups-textarea"
        rows={3}
        value={shown}
        onChange={(event) => change(event.target.value)}
        onBlur={flush}
        data-testid="markups-prop-comments"
      />
    </FormField>
  );
}

function ReadOnlyText({ label, value }: { label: string; value: string }) {
  return (
    <FormField label={label}>
      <Input inputSize="sm" value={value} readOnly tabIndex={-1} />
    </FormField>
  );
}

/**
 * Live properties of the selected markup. There is no OK button: every change goes through the
 * annotation plugin as it settles, so it is one undo step and marks the document changed.
 * Annotations that are not measurements show the subject, comments and appearance only. Key it
 * by annotation id so a field's unsaved edit is committed to the markup it was typed for.
 */
export function PropertiesPanel({ annotation }: { annotation: PdfAnnotationObject }) {
  const { t, i18n } = useTranslation();
  const markup = annotation as PropertyAnnotation;
  const pageScale = usePageScale(useActiveFileKey(), annotation.pageIndex);
  const custom = readMarkupCustom(markup.custom);
  const kind = markupKindOf(markup);
  const measurement = kind ? computeMeasurement(markup, pageScale?.scale ?? null) : null;
  const appearance = readAppearance(markup);

  const apply = (patch: Record<string, unknown> | null) => {
    if (patch && Object.keys(patch).length > 0) updateMarkup(annotation.pageIndex, annotation.id, patch);
  };
  const onAppearance = (change: AppearanceValues) => apply(appearancePatch(markup, change));

  return (
    <div className="markups-properties" data-testid="markups-properties">
      <section className="markups-section">
        <h3 className="markups-section__title">{t("markups.props.markup", "Markup")}</h3>
        <div className="markups-fields">
          <BufferedText
            label={t("markups.props.subject", "Subject")}
            value={markup.subject ?? ""}
            onCommit={(subject) => apply(subjectPatch(subject))}
            testId="markups-prop-subject"
          />
          {custom && (
            <BufferedText
              label={t("markups.props.label", "Label")}
              value={custom.label ?? ""}
              onCommit={(label) => apply(labelPatch(markup, label))}
              testId="markups-prop-label"
            />
          )}
          <BufferedComments
            label={t("markups.props.comments", "Comments")}
            value={markup.contents ?? ""}
            onCommit={(text) => apply(commentPatch(markup, text, pageScale))}
          />
          {custom?.manualContents && (
            <Button
              size="sm"
              variant="tertiary"
              onClick={() => apply(resetCommentPatch(markup, pageScale))}
              data-testid="markups-reset-comments"
            >
              {t("markups.props.resetComments", "Reset to measured value")}
            </Button>
          )}
          <ReadOnlyText label={t("markups.props.author", "Author")} value={markup.author ?? ""} />
          <ReadOnlyText
            label={t("markups.props.date", "Date")}
            value={formatDate(markup.modified ?? markup.created, i18n.language)}
          />
        </div>
      </section>
      {measurement && (
        <section className="markups-section">
          <h3 className="markups-section__title">{t("markups.props.measurement", "Measurement")}</h3>
          {!measurement.scaled && (
            <p className="markups-hint">{t("markups.props.paperUnits", "Scale not set: values are in paper units.")}</p>
          )}
          <MeasurementValues measurement={measurement} precision={pageScale?.precision ?? DEFAULT_PRECISION} />
          {custom && measurement.scaled && kind === "wall" && (
            <ExtentField
              label={t("markups.props.height", "Height")}
              unit={measurement.unit}
              value={custom.height}
              onCommit={(height) => apply(extentPatch(markup, "height", height))}
            />
          )}
          {custom && measurement.scaled && kind === "volume" && (
            <ExtentField
              label={t("markups.props.depth", "Depth")}
              unit={measurement.unit}
              value={custom.depth}
              onCommit={(depth) => apply(extentPatch(markup, "depth", depth))}
            />
          )}
        </section>
      )}
      {Object.keys(appearance).length > 0 && (
        <section className="markups-section">
          <h3 className="markups-section__title">{t("markups.props.appearance", "Appearance")}</h3>
          <AppearanceFields values={appearance} onChange={onAppearance} />
        </section>
      )}
    </div>
  );
}
