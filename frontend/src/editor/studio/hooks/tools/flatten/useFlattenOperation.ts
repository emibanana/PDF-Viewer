import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { renderPagesWithPdfjs } from "@editor/services/pdfEdit/renderPages";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import { FlattenParameters, defaultParameters } from "@editor/hooks/tools/flatten/useFlattenParameters";
import { flattenForms, flattenToImages } from "@editor/services/pdfEdit/flatten";

export {
  flattenToApiParams,
  flattenFromApiParams,
  buildFlattenFormData,
} from "@editor-core/hooks/tools/flatten/useFlattenOperation";

export const flattenOperationConfig = defineCustomTool({
  operationType: "flatten",
  customProcessor: async (parameters: FlattenParameters, files: File[]) => {
    if (!parameters.flattenOnlyForms) {
      return {
        files: await flattenToImages(files, parameters.renderDpi ?? 150, renderPagesWithPdfjs),
      };
    }
    return { files: await flattenForms(files) };
  },
  defaultParameters,
});

export const useFlattenOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<FlattenParameters>({
    ...flattenOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("flatten.error.failed", "An error occurred while flattening the PDF.")),
  });
};
