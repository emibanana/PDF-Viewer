import { useTranslation } from "react-i18next";
import { defineCustomTool, useToolOperation } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import { ReorganizePagesParameters } from "@editor/hooks/tools/reorganizePages/useReorganizePagesParameters";
import { reorganizePages } from "@editor/services/pdfEdit/pages";

export {
  reorganizePagesToApiParams,
  reorganizePagesFromApiParams,
} from "@editor-core/hooks/tools/reorganizePages/useReorganizePagesOperation";

export const reorganizePagesOperationConfig = defineCustomTool({
  operationType: "reorganizePages",
  customProcessor: async (parameters: ReorganizePagesParameters, files: File[]) => ({
    files: await reorganizePages(parameters.customMode, parameters.pageNumbers, files),
  }),
});

export const useReorganizePagesOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<ReorganizePagesParameters>({
    ...reorganizePagesOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("reorganizePages.error.failed", "Failed to reorganize pages")),
  });
};
