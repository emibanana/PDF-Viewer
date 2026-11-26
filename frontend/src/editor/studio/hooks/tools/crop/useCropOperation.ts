import { useTranslation } from "react-i18next";
import { useToolOperation, defineCustomTool } from "@editor/hooks/tools/shared/useToolOperation";
import { createStandardErrorHandler } from "@editor/utils/toolErrorHandler";
import { validateCropParameters, CropParameters, defaultParameters } from "@editor/hooks/tools/crop/useCropParameters";
import { cropPdfs } from "@editor/services/pdfEdit/crop";

export { cropToApiParams, cropFromApiParams, buildCropFormData } from "@editor-core/hooks/tools/crop/useCropOperation";

export const cropOperationConfig = defineCustomTool({
  validateParams: validateCropParameters,
  operationType: "crop",
  customProcessor: async (parameters: CropParameters, files: File[]) => ({
    files: await (async () => {
      if (parameters.autoCrop) {
        throw new Error("Auto-crop is not available in this build. Turn it off and draw the crop area.");
      }
      return cropPdfs(parameters.cropArea, parameters.pageNumbers, files);
    })(),
  }),
  defaultParameters,
});

export const useCropOperation = () => {
  const { t } = useTranslation();
  return useToolOperation<CropParameters>({
    ...cropOperationConfig,
    getErrorMessage: createStandardErrorHandler(t("crop.error.failed", "An error occurred while cropping the PDF.")),
  });
};
