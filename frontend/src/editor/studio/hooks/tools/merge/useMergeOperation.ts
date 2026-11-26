import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
  type CustomProcessorResult,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  MergeParameters,
  defaultParameters,
} from "@editor/hooks/tools/merge/useMergeParameters";
import { mergePdfs } from "@editor/services/pdfEdit/merge";

// The request mappers describe a backend call this build does not make; they stay
// exported so anything that still imports them (automation, stored steps) keeps working.
export {
  mergeToApiParams,
  mergeFromApiParams,
} from "@editor-core/hooks/tools/merge/useMergeOperation";

// Runs in the app. The files arrive in the order the user arranged them.
const mergeProcessor = async (
  parameters: MergeParameters,
  files: File[],
): Promise<CustomProcessorResult> => ({
  files: [
    await mergePdfs(files, {
      removeDigitalSignature: parameters.removeDigitalSignature ?? false,
      generateTableOfContents: parameters.generateTableOfContents ?? false,
    }),
  ],
  consumedAllInputs: true,
});

export const mergeOperationConfig = defineCustomTool({
  operationType: "merge",
  customProcessor: mergeProcessor,
  defaultParameters,
});

export const useMergeOperation = () => {
  const { t } = useTranslation();

  return useToolOperation<MergeParameters>({
    ...mergeOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("merge.error.failed", "An error occurred while merging the PDFs."),
    ),
  });
};
