import { useTranslation } from "react-i18next";
import { FormField } from "@editor/ui/FormField";
import { NumberInput } from "@editor/ui/NumberInput";
import { DEFAULT_PRECISION, formatQuantity, type Measurement, type Quantity } from "@editor/services/markups/measureMath";
import { useBufferedValue } from "@editor/components/viewer/markups/useBufferedValue";

interface ExtentFieldProps {
  label: string;
  unit: string;
  value: number | undefined;
  onCommit: (value: number) => void;
}

/** A wall height or slab depth in the page's unit; only a positive number is committed. */
export function ExtentField({ label, unit, value, onCommit }: ExtentFieldProps) {
  const [shown, change, flush] = useBufferedValue<number | string>(value ?? "", (next) => {
    if (typeof next === "number" && next > 0) onCommit(next);
  });
  return (
    <FormField label={label}>
      <NumberInput
        inputSize="sm"
        value={shown}
        min={0}
        step={0.1}
        decimalScale={4}
        allowNegative={false}
        suffix={unit ? ` ${unit}` : undefined}
        onChange={change}
        onBlur={flush}
      />
    </FormField>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="markups-values__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface MeasurementValuesProps {
  measurement: Measurement;
  precision?: number;
}

/** The measured values of a markup, read-only, each with its unit. */
export function MeasurementValues({ measurement, precision = DEFAULT_PRECISION }: MeasurementValuesProps) {
  const { t } = useTranslation();
  const { unit } = measurement;
  const show = (value: number | undefined, quantity: Quantity) =>
    value === undefined ? null : formatQuantity(value, unit, quantity, precision);
  const rows: [string, string | null][] = [
    [t("markups.props.length", "Length"), show(measurement.length, "length")],
    [t("markups.props.area", "Area"), show(measurement.area, "area")],
    [t("markups.props.perimeter", "Perimeter"), show(measurement.perimeter, "length")],
    [t("markups.props.wallArea", "Wall area"), show(measurement.wallArea, "area")],
    [t("markups.props.volume", "Volume"), show(measurement.volume, "volume")],
  ];
  return (
    <dl className="markups-values" data-testid="markups-values">
      {rows.map(([label, value]) => (value === null ? null : <Row key={label} label={label} value={value} />))}
    </dl>
  );
}
