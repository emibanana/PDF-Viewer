import { useTranslation } from "react-i18next";
import { defineCustomTool, useToolOperation } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateExtractPagesParameters,
  ExtractPagesParameters,
  defaultParameters,
} from "@editor/hooks/tools/extractPages/useExtractPagesParameters";
import { extractPages } from "@editor/services/pdfEdit/pages";

// One output per input, which useToolOperation requires for "extractPages".
export const extractPagesOperationConfig = defineCustomTool({
  validateParams: validateExtractPagesParameters,
  operationType: "extractPages",
  customProcessor: async (parameters: ExtractPagesParameters, files: File[]) => ({
    files: await extractPages(parameters.pageNumbers, files),
    consumedAllInputs: false,
  }),
  defaultParameters,
});

export const useExtractPagesOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<ExtractPagesParameters>({
    ...extractPagesOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("extractPages.error.failed", "Failed to extract pages")),
  });
};
