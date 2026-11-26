import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateRemovePasswordParameters,
  RemovePasswordParameters,
  defaultParameters,
} from "@editor/hooks/tools/removePassword/useRemovePasswordParameters";
import { REMOVE_PASSWORD_ENDPOINT } from "@editor/hooks/tools/removePassword/buildRemovePasswordFormData";
import { decryptPdfs } from "@editor/services/pdfEdit/security";

// The endpoint is not called. It tells the shared file checks that this tool is the
// one that accepts password-protected PDFs, which no other in-app tool does.
export const removePasswordOperationConfig = defineCustomTool({
  validateParams: validateRemovePasswordParameters,
  operationType: "removePassword",
  endpoint: REMOVE_PASSWORD_ENDPOINT,
  customProcessor: async (parameters: RemovePasswordParameters, files: File[]) => ({
    files: await decryptPdfs([parameters.password, parameters.ownerPassword], files),
  }),
  defaultParameters,
});

export const useRemovePasswordOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<RemovePasswordParameters>({
    ...removePasswordOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("removePassword.error.failed", "An error occurred while removing the password from the PDF."),
    ),
  });
};
