import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateChangeMetadataParameters,
  ChangeMetadataParameters,
  defaultParameters,
} from "@editor/hooks/tools/changeMetadata/useChangeMetadataParameters";
import { changeMetadata } from "@editor/services/pdfEdit/metadata";

export {
  changeMetadataToApiParams,
  changeMetadataFromApiParams,
  buildChangeMetadataFormData,
} from "@editor-core/hooks/tools/changeMetadata/useChangeMetadataOperation";

export const changeMetadataOperationConfig = defineCustomTool({
  validateParams: validateChangeMetadataParameters,
  operationType: "changeMetadata",
  customProcessor: async (
    parameters: ChangeMetadataParameters,
    files: File[],
  ) => ({ files: await changeMetadata(parameters, files) }),
  defaultParameters,
});

export const useChangeMetadataOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<ChangeMetadataParameters>({
    ...changeMetadataOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t(
        "changeMetadata.error.failed",
        "An error occurred while changing the PDF metadata.",
      ),
    ),
  });
};
