import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateAddPageNumbersParameters,
  AddPageNumbersParameters,
  defaultParameters,
} from "@editor/components/tools/addPageNumbers/useAddPageNumbersParameters";
import { addPageNumbers } from "@editor/services/pdfEdit/pageMarks";

export {
  addPageNumbersToApiParams,
  addPageNumbersFromApiParams,
  buildAddPageNumbersFormData,
} from "@editor-core/components/tools/addPageNumbers/useAddPageNumbersOperation";

export const addPageNumbersOperationConfig = defineCustomTool({
  validateParams: validateAddPageNumbersParameters,
  operationType: "addPageNumbers",
  customProcessor: async (parameters: AddPageNumbersParameters, files: File[]) => ({
    files: await (async () => {
      return addPageNumbers(
        {
          position: parameters.position,
          margin: parameters.customMargin,
          fontSize: parameters.fontSize,
          font: parameters.fontType,
          startingNumber: parameters.startingNumber,
          pages: parameters.pagesToNumber,
          text: parameters.customText,
          zeroPad: parameters.zeroPad,
        },
        files,
      );
    })(),
  }),
  defaultParameters,
});

export const useAddPageNumbersOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<AddPageNumbersParameters>({
    ...addPageNumbersOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("addPageNumbers.error.failed", "An error occurred while adding page numbers."),
    ),
  });
};
