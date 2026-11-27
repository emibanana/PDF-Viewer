import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  getMarkupAnnotationsVersion,
  listAnnotations,
  subscribeMarkupAnnotations,
} from "@editor/services/markups/markupController";
import { MARKUP_STATUS_LABELS, MARKUP_TYPE_LABELS, type MarkupTextFormat } from "@editor/services/markups/markupColumns";
import { buildMarkupRows, type MarkupRow, type MarkupRowSource, type MarkupTypeId } from "@editor/services/markups/markupRows";
import { DEFAULT_PRECISION } from "@editor/services/markups/measureMath";
import {
  getActiveFileKey,
  getMeasureScale,
  getPageScale,
  getPageScalesVersion,
  subscribePageScales,
} from "@editor/services/markups/pageScaleStore";

/** Names and formats that follow the interface language. */
export function useMarkupTextFormat(): MarkupTextFormat & { typeNameOf: (type: MarkupTypeId) => string } {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  return useMemo(() => {
    const typeNameOf = (type: MarkupTypeId) => t(...MARKUP_TYPE_LABELS[type]);
    const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short" });
    return {
      typeNameOf,
      typeName: (row: MarkupRow) => typeNameOf(row.type),
      statusName: (status: string) => {
        const label = MARKUP_STATUS_LABELS[status];
        return label ? t(...label) : status;
      },
      date: (time: number) => dateFormat.format(time),
    };
  }, [t, language]);
}

/**
 * One row per listed annotation of the open document, rebuilt when an annotation or a page
 * scale changes. Empty while no document is bound.
 */
export function useMarkupRows(): MarkupRow[] {
  const { typeNameOf } = useMarkupTextFormat();
  const annotationsVersion = useSyncExternalStore(subscribeMarkupAnnotations, getMarkupAnnotationsVersion);
  const scalesVersion = useSyncExternalStore(subscribePageScales, getPageScalesVersion);
  return useMemo(() => {
    const fileKey = getActiveFileKey();
    const annotations = listAnnotations().map((tracked) => tracked.object as MarkupRowSource);
    return buildMarkupRows(annotations, {
      scaleFor: (pageIndex) => getMeasureScale(fileKey, pageIndex),
      precisionFor: (pageIndex) => getPageScale(fileKey, pageIndex)?.precision ?? DEFAULT_PRECISION,
      typeName: typeNameOf,
    });
    // The versions stand in for the annotation and scale stores, which the lookups above read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationsVersion, scalesVersion, typeNameOf]);
}
