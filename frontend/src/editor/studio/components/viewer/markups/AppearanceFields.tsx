import { useTranslation } from "react-i18next";
import { ColorInput } from "@editor/ui/ColorInput";
import { FormField } from "@editor/ui/FormField";
import { NumberInput } from "@editor/ui/NumberInput";
import { SegmentedControl } from "@editor/ui/SegmentedControl";
import { Slider } from "@editor/ui/Slider";
import type { AppearanceValues, LineStyle } from "@editor/services/markups/propertyPatches";
import { useBufferedValue } from "@editor/components/viewer/markups/useBufferedValue";

// The picker reports every keystroke, including half-typed colours such as "#12".
const COMPLETE_HEX = /^#[0-9a-f]{6}$/i;

const SWATCHES = ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#000000", "#ffffff"];

interface AppearanceFieldsProps {
  values: AppearanceValues;
  /** Called with only the field that changed, after typing or dragging settles. */
  onChange: (change: AppearanceValues) => void;
}

function BufferedColor({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [shown, change, flush] = useBufferedValue(value, (next) => {
    if (COMPLETE_HEX.test(next)) onCommit(next);
  });
  return (
    <FormField label={label}>
      <ColorInput
        inputSize="sm"
        value={shown}
        onChange={change}
        onChangeEnd={(next) => {
          change(next);
          flush();
        }}
        onBlur={flush}
        swatches={SWATCHES}
        swatchesPerRow={8}
      />
    </FormField>
  );
}

function BufferedWidth({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const { t } = useTranslation();
  const [shown, change, flush] = useBufferedValue<number>(value, onCommit);
  return (
    <FormField label={t("markups.props.lineWidth", "Line width")}>
      <NumberInput
        inputSize="sm"
        value={shown}
        min={0.25}
        max={50}
        step={0.5}
        decimalScale={2}
        clampBehavior="blur"
        onChange={(next) => {
          if (typeof next === "number" && next > 0) change(next);
        }}
        onBlur={flush}
      />
    </FormField>
  );
}

function BufferedOpacity({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const { t } = useTranslation();
  const [shown, change] = useBufferedValue<number>(value, onCommit);
  return (
    <FormField label={t("markups.props.opacity", "Opacity")}>
      <Slider
        inputSize="sm"
        value={shown}
        min={0}
        max={1}
        step={0.05}
        formatValue={(v) => `${Math.round(v * 100)}%`}
        aria-label={t("markups.props.opacity", "Opacity")}
        onChange={change}
      />
    </FormField>
  );
}

/**
 * Colour, fill, opacity, line width and line style. Shows only the fields `values` has, so the
 * same block serves a selected markup, whatever its type, and a tool's defaults.
 */
export function AppearanceFields({ values, onChange }: AppearanceFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="markups-fields">
      {values.strokeColor !== undefined && (
        <BufferedColor
          label={t("markups.props.strokeColor", "Colour")}
          value={values.strokeColor}
          onCommit={(strokeColor) => onChange({ strokeColor })}
        />
      )}
      {values.fillColor !== undefined && (
        <BufferedColor
          label={t("markups.props.fillColor", "Fill colour")}
          value={values.fillColor}
          onCommit={(fillColor) => onChange({ fillColor })}
        />
      )}
      {values.opacity !== undefined && (
        <BufferedOpacity value={values.opacity} onCommit={(opacity) => onChange({ opacity })} />
      )}
      {values.strokeWidth !== undefined && (
        <BufferedWidth value={values.strokeWidth} onCommit={(strokeWidth) => onChange({ strokeWidth })} />
      )}
      {values.lineStyle !== undefined && (
        <FormField label={t("markups.props.lineStyle", "Line style")}>
          <SegmentedControl<LineStyle>
            size="sm"
            fullWidth
            ariaLabel={t("markups.props.lineStyle", "Line style")}
            value={values.lineStyle}
            onChange={(lineStyle) => onChange({ lineStyle })}
            options={[
              { value: "solid", label: t("markups.props.solid", "Solid") },
              { value: "dashed", label: t("markups.props.dashed", "Dashed") },
            ]}
          />
        </FormField>
      )}
    </div>
  );
}
