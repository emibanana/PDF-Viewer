import { useTranslation } from "react-i18next";
import {
  FREE_TEXT_FONTS,
  toStandardFont,
} from "@editor/components/viewer/freeTextFont";

const MIN_SIZE = 6;
const MAX_SIZE = 144;

interface FreeTextStyleControlsProps {
  fontSize: number;
  fontFamily: unknown;
  onChange: (patch: { fontSize?: number; fontFamily?: number }) => void;
}

const clamp = (size: number) =>
  Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(size)));

/** Font size and font of one text box, right on its floating menu. */
export function FreeTextStyleControls({
  fontSize,
  fontFamily,
  onChange,
}: FreeTextStyleControlsProps) {
  const { t } = useTranslation();
  const size = clamp(fontSize || 14);
  const sizeLabel = t("annotation.fontSize", "Font size");
  return (
    <>
      <select
        className="embedpdf-floating-select"
        aria-label={t("annotation.fontFamily", "Font")}
        title={t("annotation.fontFamily", "Font")}
        value={toStandardFont(fontFamily)}
        onChange={(event) =>
          onChange({ fontFamily: Number(event.currentTarget.value) })
        }
      >
        {FREE_TEXT_FONTS.map((font) => (
          <option key={font.value} value={font.value}>
            {font.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="embedpdf-floating-btn"
        aria-label={t("annotation.fontSmaller", "Smaller text")}
        title={t("annotation.fontSmaller", "Smaller text")}
        disabled={size <= MIN_SIZE}
        onClick={() => onChange({ fontSize: clamp(size - 1) })}
      >
        −
      </button>
      <input
        className="embedpdf-floating-number"
        type="number"
        min={MIN_SIZE}
        max={MAX_SIZE}
        aria-label={sizeLabel}
        title={sizeLabel}
        value={size}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isFinite(next) && next > 0) onChange({ fontSize: clamp(next) });
        }}
      />
      <button
        type="button"
        className="embedpdf-floating-btn"
        aria-label={t("annotation.fontLarger", "Larger text")}
        title={t("annotation.fontLarger", "Larger text")}
        disabled={size >= MAX_SIZE}
        onClick={() => onChange({ fontSize: clamp(size + 1) })}
      >
        +
      </button>
    </>
  );
}
