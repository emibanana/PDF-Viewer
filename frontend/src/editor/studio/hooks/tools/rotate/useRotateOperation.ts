import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import { validateRotateParameters, RotateParameters, defaultParameters } from "@editor/hooks/tools/rotate/useRotateParameters";
import { rotatePdfs } from "@editor/services/pdfEdit/rotate";

export {
  rotateToApiParams,
  rotateFromApiParams,
  buildRotateFormData,
} from "@editor-core/hooks/tools/rotate/useRotateOperation";

export const rotateOperationConfig = defineCustomTool({
  validateParams: validateRotateParameters,
  operationType: "rotate",
  customProcessor: async (parameters: RotateParameters, files: File[]) => ({
    files: await rotatePdfs(parameters.angle, files),
  }),
  defaultParameters,
});

export const useRotateOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<RotateParameters>({
    ...rotateOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("rotate.error.failed", "An error occurred while rotating the PDF.")),
  });
};
