import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  ChangePermissionsParameters,
  defaultParameters,
  validateChangePermissionsParameters,
} from "@editor/hooks/tools/changePermissions/useChangePermissionsParameters";
import { encryptPdfs } from "@editor/services/pdfEdit/security";

export {
  changePermissionsToApiParams,
  changePermissionsFromApiParams,
  buildChangePermissionsFormData,
} from "@editor-core/hooks/tools/changePermissions/useChangePermissionsOperation";

// Permissions are an encryption setting, so this encrypts with the restrictions and
// whichever passwords were given (an unknown owner password if none).
export const changePermissionsOperationConfig = defineCustomTool({
  validateParams: validateChangePermissionsParameters,
  operationType: "changePermissions",
  customProcessor: async (
    parameters: ChangePermissionsParameters,
    files: File[],
  ) => ({
    files: await encryptPdfs(
      {
        password: parameters.password,
        ownerPassword: parameters.ownerPassword,
        restrictions: parameters,
      },
      files,
    ),
  }),
  defaultParameters,
});

export const useChangePermissionsOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<ChangePermissionsParameters>({
    ...changePermissionsOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t(
        "changePermissions.error.failed",
        "An error occurred while changing PDF permissions.",
      ),
    ),
  });
};
