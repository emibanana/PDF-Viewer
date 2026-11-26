import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateSplitParameters,
  SplitParameters,
  defaultParameters,
} from "@editor/hooks/tools/split/useSplitParameters";
import { SPLIT_METHODS } from "@editor/constants/splitConstants";
import {
  parseSize,
  splitPdfs,
  type SplitPlan,
} from "@editor/services/pdfEdit/split";

export {
  splitToApiParams,
  splitFromApiParams,
  buildSplitFormData,
  getSplitEndpoint,
} from "@editor-core/hooks/tools/split/useSplitOperation";

function planFor(p: SplitParameters): SplitPlan {
  switch (p.method ?? SPLIT_METHODS.BY_PAGES) {
    case SPLIT_METHODS.BY_PAGES:
      return { kind: "afterPages", pages: p.pages };
    case SPLIT_METHODS.BY_SIZE:
      return { kind: "size", maxBytes: parseSize(p.splitValue) };
    case SPLIT_METHODS.BY_PAGE_COUNT:
      return { kind: "pageCount", count: Math.max(1, Number(p.splitValue)) };
    case SPLIT_METHODS.BY_DOC_COUNT:
      return { kind: "docCount", count: Math.max(1, Number(p.splitValue)) };
    case SPLIT_METHODS.BY_CHAPTERS:
      return { kind: "chapters", level: Number(p.bookmarkLevel || "1") };
    default:
      throw new Error("This split method is not available in this build.");
  }
}

export const splitOperationConfig = defineCustomTool({
  validateParams: validateSplitParameters,
  operationType: "split",
  customProcessor: async (parameters: SplitParameters, files: File[]) => ({
    files: await splitPdfs(planFor(parameters), files),
    consumedAllInputs: true,
  }),
  defaultParameters,
});

export const useSplitOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<SplitParameters>({
    ...splitOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("split.error.failed", "An error occurred while splitting the PDF."),
    ),
  });
};
