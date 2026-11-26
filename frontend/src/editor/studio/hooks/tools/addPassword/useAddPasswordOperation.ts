import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateAddPasswordParameters,
  AddPasswordFullParameters,
  defaultParameters,
} from "@editor/hooks/tools/addPassword/useAddPasswordParameters";
import { defaultParameters as permissionsDefaults } from "@editor/hooks/tools/changePermissions/useChangePermissionsParameters";
import { encryptPdfs } from "@editor/services/pdfEdit/security";

export {
  addPasswordToApiParams,
  addPasswordFromApiParams,
  buildAddPasswordFormData,
} from "@editor-core/hooks/tools/addPassword/useAddPasswordOperation";

const fullDefaultParameters: AddPasswordFullParameters = {
  ...defaultParameters,
  permissions: permissionsDefaults,
};

export const addPasswordOperationConfig = defineCustomTool({
  validateParams: validateAddPasswordParameters,
  operationType: "addPassword",
  customProcessor: async (parameters: AddPasswordFullParameters, files: File[]) => ({
    files: await encryptPdfs(
      {
        password: parameters.password,
        ownerPassword: parameters.ownerPassword,
        keyLength: parameters.keyLength,
        restrictions: parameters.permissions,
      },
      files,
    ),
  }),
  defaultParameters: fullDefaultParameters,
});

export const useAddPasswordOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<AddPasswordFullParameters>({
    ...addPasswordOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("addPassword.error.failed", "An error occurred while encrypting the PDF.")),
  });
};
