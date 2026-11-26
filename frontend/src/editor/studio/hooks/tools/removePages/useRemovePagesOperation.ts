import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateRemovePagesParameters,
  RemovePagesParameters,
  defaultParameters,
} from "@editor/hooks/tools/removePages/useRemovePagesParameters";
import { removePages } from "@editor/services/pdfEdit/pages";

export {
  removePagesToApiParams,
  removePagesFromApiParams,
  buildRemovePagesFormData,
} from "@editor-core/hooks/tools/removePages/useRemovePagesOperation";

export const removePagesOperationConfig = defineCustomTool({
  validateParams: validateRemovePagesParameters,
  operationType: "removePages",
  customProcessor: async (
    parameters: RemovePagesParameters,
    files: File[],
  ) => ({
    files: await removePages(parameters.pageNumbers, files),
  }),
  defaultParameters,
});

export const useRemovePagesOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<RemovePagesParameters>({
    ...removePagesOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("removePages.error.failed", "Failed to remove pages"),
    ),
  });
};
