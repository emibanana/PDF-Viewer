import { useTranslation } from "react-i18next";
import {
  useToolOperation,
  defineCustomTool,
} from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import {
  validateAddWatermarkParameters,
  AddWatermarkParameters,
  defaultParameters,
} from "@editor/hooks/tools/addWatermark/useAddWatermarkParameters";
import { addWatermark } from "@editor/services/pdfEdit/pageMarks";
import { flattenToImages } from "@editor/services/pdfEdit/flatten";
import { renderPagesWithPdfjs } from "@editor/services/pdfEdit/renderPages";

export {
  addWatermarkToApiParams,
  addWatermarkFromApiParams,
  buildAddWatermarkFormData,
} from "@editor-core/hooks/tools/addWatermark/useAddWatermarkOperation";

export const addWatermarkOperationConfig = defineCustomTool({
  validateParams: validateAddWatermarkParameters,
  operationType: "watermark",
  customProcessor: async (parameters: AddWatermarkParameters, files: File[]) => ({
    files: await (async () => {
      const marked = await addWatermark(
        {
          text: parameters.watermarkType === "image" ? undefined : parameters.watermarkText,
          image: parameters.watermarkType === "image" ? parameters.watermarkImage : undefined,
          fontSize: parameters.fontSize,
          rotation: parameters.rotation,
          opacity: parameters.opacity / 100,
          widthSpacer: parameters.widthSpacer,
          heightSpacer: parameters.heightSpacer,
          color: parameters.customColor,
        },
        files,
      );
      return parameters.convertPDFToImage
        ? flattenToImages(marked, 150, renderPagesWithPdfjs)
        : marked;
    })(),
  }),
  defaultParameters,
});

export const useAddWatermarkOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<AddWatermarkParameters>({
    ...addWatermarkOperationConfig,
    getErrorMessage: createStandardErrorHandler(
      t("watermark.error.failed", "An error occurred while adding the watermark."),
    ),
  });
};
