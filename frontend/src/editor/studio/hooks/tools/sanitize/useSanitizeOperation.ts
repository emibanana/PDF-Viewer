import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateSanitizeParameters,
  SanitizeParameters,
  defaultParameters,
} from "@editor/hooks/tools/sanitize/useSanitizeParameters";
import { sanitizePdfs } from "@editor/services/pdfEdit/sanitize";

export {
  sanitizeToApiParams,
  sanitizeFromApiParams,
  buildSanitizeFormData,
} from "@editor-core/hooks/tools/sanitize/useSanitizeOperation";

export const sanitizeOperationConfig = defineCustomTool({
  validateParams: validateSanitizeParameters,
  operationType: "sanitize",
  customProcessor: async (parameters: SanitizeParameters, files: File[]) => ({
    files: await (async () => {
      return sanitizePdfs(parameters, files);
    })(),
  }),
  defaultParameters,
});

export const useSanitizeOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<SanitizeParameters>({
    ...sanitizeOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("sanitize.error.failed", "An error occurred while sanitising the PDF.")),
  });
};
