import { lazy, useMemo } from "react";
import { Icon } from "@editor/ui/Icon";
import { useTranslation } from "react-i18next";
import { reorganizePagesOperationConfig } from "@editor/hooks/tools/reorganizePages/useReorganizePagesOperation";
import {
  SubcategoryId,
  ToolCategoryId,
  ToolRegistry,
  RegularToolRegistry,
  SuperToolRegistry,
  LinkToolRegistry,
} from "@editor/data/toolsTaxonomy";
import { isSuperToolId, isLinkToolId } from "@editor/types/toolId";
import {
  asRegistryConfig,
  lazySettings,
} from "@editor/hooks/tools/shared/toolOperationTypes";
import { adjustContrastOperationConfig } from "@editor/hooks/tools/adjustContrast/useAdjustContrastOperation";
import { getSynonyms } from "@editor/utils/toolSynonyms";
import { useProprietaryToolRegistry } from "@editor/data/useProprietaryToolRegistry";
import { splitOperationConfig } from "@editor/hooks/tools/split/useSplitOperation";
import { addPasswordOperationConfig } from "@editor/hooks/tools/addPassword/useAddPasswordOperation";
import { removePasswordOperationConfig } from "@editor/hooks/tools/removePassword/useRemovePasswordOperation";
import { sanitizeOperationConfig } from "@editor/hooks/tools/sanitize/useSanitizeOperation";
import { addWatermarkOperationConfig } from "@editor/hooks/tools/addWatermark/useAddWatermarkOperation";
import { addAttachmentsOperationConfig } from "@editor/hooks/tools/addAttachments/useAddAttachmentsOperation";
import { changePermissionsOperationConfig } from "@editor/hooks/tools/changePermissions/useChangePermissionsOperation";
import { mergeOperationConfig } from "@editor/hooks/tools/merge/useMergeOperation";
import { editTableOfContentsOperationConfig } from "@editor/hooks/tools/editTableOfContents/useEditTableOfContentsOperation";
import { flattenOperationConfig } from "@editor/hooks/tools/flatten/useFlattenOperation";
import { redactOperationConfig } from "@editor/hooks/tools/redact/useRedactOperation";
import { rotateOperationConfig } from "@editor/hooks/tools/rotate/useRotateOperation";
import { changeMetadataOperationConfig } from "@editor/hooks/tools/changeMetadata/useChangeMetadataOperation";
import { signOperationConfig } from "@editor/hooks/tools/sign/useSignOperation";
import { cropOperationConfig } from "@editor/hooks/tools/crop/useCropOperation";
import { removeAnnotationsOperationConfig } from "@editor/hooks/tools/removeAnnotations/useRemoveAnnotationsOperation";
import { removePagesOperationConfig } from "@editor/hooks/tools/removePages/useRemovePagesOperation";
import { addPageNumbersOperationConfig } from "@editor/components/tools/addPageNumbers/useAddPageNumbersOperation";
import { extractPagesOperationConfig } from "@editor/hooks/tools/extractPages/useExtractPagesOperation";
import { ENDPOINTS as SPLIT_ENDPOINT_NAMES } from "@editor/constants/splitConstants";
import { ToolId } from "@editor/types/toolId";

const loadPdfTextEditor = () =>
  import("@editor/tools/pdfTextEditor/PdfTextEditor");

export interface TranslatedToolCatalog {
  allTools: ToolRegistry;
  regularTools: RegularToolRegistry;
  superTools: SuperToolRegistry;
  linkTools: LinkToolRegistry;
}

// Hook to get the translated tool registry
export function useTranslatedToolCatalog(): TranslatedToolCatalog {
  const { t } = useTranslation();
  const proprietaryTools = useProprietaryToolRegistry();

  return useMemo(() => {
    const allTools: ToolRegistry = {
      // Proprietary tools (if any)
      ...proprietaryTools,
      // Recommended Tools in order
      pdfTextEditor: {
        icon: <Icon name="square-pen" size="1.5rem" />,
        name: t("home.pdfTextEditor.title", "PDF Text Editor"),
        component: lazy(loadPdfTextEditor),
        preload: loadPdfTextEditor,
        description: t(
          "home.pdfTextEditor.desc",
          "Review and edit text and images in PDFs with grouped text editing and PDF regeneration",
        ),
        categoryId: ToolCategoryId.RECOMMENDED_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        maxFiles: 1,
        endpoints: ["text-editor-pdf"],
        synonyms: getSynonyms(t, "pdfTextEditor"),
        supportsAutomate: false,
        automationSettings: null,
      },
      multiTool: {
        icon: <Icon name="rows-3" size="1.5rem" />,
        name: t("home.multiTool.title", "Multi-Tool"),
        component: null,
        workbench: "pageEditor",
        description: t(
          "home.multiTool.desc",
          "Use multiple tools on a single PDF document",
        ),
        categoryId: ToolCategoryId.RECOMMENDED_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        maxFiles: -1,
        endpoints: ["multi-tool"],
        synonyms: getSynonyms(t, "multiTool"),
        supportsAutomate: false,
        automationSettings: null,
      },
      merge: {
        icon: <Icon name="copy-plus" size="1.5rem" />,
        name: t("home.merge.title", "Merge"),
        component: lazy(() => import("@editor/tools/Merge")),
        description: t(
          "home.merge.desc",
          "Merge multiple PDFs into a single document",
        ),
        categoryId: ToolCategoryId.RECOMMENDED_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        maxFiles: -1,
        endpoints: ["merge-pdfs"],
        operationConfig: asRegistryConfig(mergeOperationConfig),
        automationSettings: lazySettings(
          () => import("@editor/components/tools/merge/MergeSettings"),
        ),
        synonyms: getSynonyms(t, "merge"),
      },
      // Signing
      sign: {
        icon: <Icon name="signature" size="1.5rem" />,
        name: t("home.sign.title", "Sign"),
        component: lazy(() => import("@editor/tools/Sign")),
        description: t(
          "home.sign.desc",
          "Adds signature to PDF by drawing, text or image",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.SIGNING,
        endpoints: ["sign"],
        operationConfig: asRegistryConfig(signOperationConfig),
        automationSettings: lazySettings(
          () => import("@editor/components/tools/sign/SignSettings"),
        ), // TODO:: not all settings shown, suggested next tools shown
        synonyms: getSynonyms(t, "sign"),
        supportsAutomate: false, //TODO make support Sign
      },
      addText: {
        icon: <Icon name="type" size="1.5rem" />,
        name: t("home.addText.title", "Add Text"),
        component: lazy(() => import("@editor/tools/AddText")),
        description: t(
          "home.addText.desc",
          "Add custom text anywhere in your PDF",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        endpoints: ["sign"],
        operationConfig: asRegistryConfig(signOperationConfig),
        automationSettings: null,
        synonyms: getSynonyms(t, "addText"),
        supportsAutomate: false,
      },
      addImage: {
        icon: <Icon name="image" size="1.5rem" />,
        name: t("home.addImage.title", "Add Image"),
        component: lazy(() => import("@editor/tools/AddImage")),
        description: t("home.addImage.desc", "Add images anywhere in your PDF"),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        endpoints: ["add-image"],
        operationConfig: asRegistryConfig(signOperationConfig),
        automationSettings: null,
        synonyms: getSynonyms(t, "addImage"),
        supportsAutomate: false,
      },
      annotate: {
        icon: <Icon name="pencil" size="1.5rem" />,
        name: t("home.annotate.title", "Annotate"),
        component: lazy(() => import("@editor/tools/Annotate")),
        description: t(
          "home.annotate.desc",
          "Highlight, draw, add notes, and shapes directly in the viewer",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        workbench: "viewer",
        endpoints: ["view-pdf"],
        operationConfig: asRegistryConfig(signOperationConfig),
        automationSettings: null,
        synonyms: getSynonyms(t, "annotate"),
        supportsAutomate: false,
      },

      // Document Security

      addPassword: {
        icon: <Icon name="password" size="1.5rem" />,
        name: t("home.addPassword.title", "Add Password"),
        component: lazy(() => import("@editor/tools/AddPassword")),
        description: t(
          "home.addPassword.desc",
          "Add password protection and restrictions to PDF files",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_SECURITY,
        maxFiles: -1,
        endpoints: ["add-password"],
        operationConfig: asRegistryConfig(addPasswordOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/addPassword/AddPasswordSettings"),
        ),
        synonyms: getSynonyms(t, "addPassword"),
      },
      watermark: {
        icon: <Icon name="watermark" size="1.5rem" />,
        name: t("home.watermark.title", "Add Watermark"),
        component: lazy(() => import("@editor/tools/AddWatermark")),
        maxFiles: -1,
        description: t(
          "home.watermark.desc",
          "Add a custom watermark to your PDF document.",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_SECURITY,
        endpoints: ["add-watermark"],
        operationConfig: asRegistryConfig(addWatermarkOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/addWatermark/AddWatermarkSingleStepSettings"),
        ),
        synonyms: getSynonyms(t, "watermark"),
      },
      sanitize: {
        icon: <Icon name="brush-cleaning" size="1.5rem" />,
        name: t("home.sanitize.title", "Sanitize"),
        component: lazy(() => import("@editor/tools/Sanitize")),
        maxFiles: -1,
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_SECURITY,
        description: t(
          "home.sanitize.desc",
          "Remove potentially harmful elements from PDF files",
        ),
        endpoints: ["sanitize-pdf"],
        operationConfig: asRegistryConfig(sanitizeOperationConfig),
        automationSettings: lazySettings(
          () => import("@editor/components/tools/sanitize/SanitizeSettings"),
        ),
        synonyms: getSynonyms(t, "sanitize"),
      },
      flatten: {
        icon: <Icon name="layers-minus" size="1.5rem" />,
        name: t("home.flatten.title", "Flatten"),
        component: lazy(() => import("@editor/tools/Flatten")),
        description: t(
          "home.flatten.desc",
          "Remove all interactive elements and forms from a PDF",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_SECURITY,
        maxFiles: -1,
        endpoints: ["flatten"],
        operationConfig: asRegistryConfig(flattenOperationConfig),
        automationSettings: lazySettings(
          () => import("@editor/components/tools/flatten/FlattenSettings"),
        ),
        synonyms: getSynonyms(t, "flatten"),
      },
      formFill: {
        icon: <Icon name="clipboard-pen-line" size="1.5rem" />,
        name: t("home.formFill.title", "Form Editor"),
        component: lazy(() => import("@editor/tools/formFill/FormFill")),
        description: t(
          "home.formFill.desc",
          "Fill, create, edit, and delete PDF form fields with a visual editor",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        workbench: "viewer" as const,
        endpoints: ["form-fill"],
        automationSettings: null,
        supportsAutomate: false,
        synonyms: [
          "form",
          "fill",
          "fillable",
          "input",
          "field",
          "acroform",
          "edit",
          "create",
          "editor",
          "modify",
          "builder",
        ],
      },
      changePermissions: {
        icon: <Icon name="lock" size="1.5rem" />,
        name: t("home.changePermissions.title", "Change Permissions"),
        component: lazy(() => import("@editor/tools/ChangePermissions")),
        description: t(
          "home.changePermissions.desc",
          "Change document restrictions and permissions",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_SECURITY,
        maxFiles: -1,
        endpoints: ["add-password"],
        operationConfig: asRegistryConfig(changePermissionsOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/changePermissions/ChangePermissionsSettings"),
        ),
        synonyms: getSynonyms(t, "changePermissions"),
      },
      getPdfInfo: {
        icon: <Icon name="clipboard-check" size="1.5rem" />,
        name: t("home.getPdfInfo.title", "Get ALL Info on PDF"),
        component: lazy(() => import("@editor/tools/GetPdfInfo")),
        description: t(
          "home.getPdfInfo.desc",
          "Grabs any and all information possible on PDFs",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.VERIFICATION,
        endpoints: ["get-info-on-pdf"],
        synonyms: getSynonyms(t, "getPdfInfo"),
        supportsAutomate: false,
        automationSettings: null,
        maxFiles: 1,
      },

      // Document Review

      read: {
        icon: <Icon name="file-text" size="1.5rem" />,
        name: t("home.read.title", "Read"),
        component: null,
        workbench: "viewer",
        description: t(
          "home.read.desc",
          "View and annotate PDFs. Highlight text, draw, or insert comments for review and collaboration.",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_REVIEW,
        endpoints: ["view-pdf"],
        synonyms: getSynonyms(t, "read"),
        supportsAutomate: false,
        automationSettings: null,
      },
      changeMetadata: {
        icon: <Icon name="clipboard-list" size="1.5rem" />,
        name: t("home.changeMetadata.title", "Change Metadata"),
        component: lazy(() => import("@editor/tools/ChangeMetadata")),
        description: t(
          "home.changeMetadata.desc",
          "Change/Remove/Add metadata from a PDF document",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_REVIEW,
        maxFiles: -1,
        endpoints: ["update-metadata"],
        operationConfig: asRegistryConfig(changeMetadataOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/changeMetadata/ChangeMetadataSingleStep"),
        ),
        synonyms: getSynonyms(t, "changeMetadata"),
      },
      editTableOfContents: {
        icon: <Icon name="table-of-contents" size="1.5rem" />,
        name: t("home.editTableOfContents.title", "Edit Table of Contents"),
        component: lazy(() => import("@editor/tools/EditTableOfContents")),
        description: t(
          "home.editTableOfContents.desc",
          "Add or edit bookmarks and table of contents in PDF documents",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.DOCUMENT_REVIEW,
        maxFiles: 1,
        endpoints: ["edit-table-of-contents"],
        operationConfig: asRegistryConfig(editTableOfContentsOperationConfig),
        automationSettings: null,
        supportsAutomate: false,
        synonyms: getSynonyms(t, "editTableOfContents"),
      },
      // Page Formatting

      crop: {
        icon: <Icon name="crop" size="1.5rem" />,
        name: t("home.crop.title", "Crop PDF"),
        component: lazy(() => import("@editor/tools/Crop")),
        description: t(
          "home.crop.desc",
          "Crop a PDF to reduce its size (maintains text!)",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        maxFiles: -1,
        endpoints: ["crop"],
        operationConfig: asRegistryConfig(cropOperationConfig),
        automationSettings: lazySettings(
          () => import("@editor/components/tools/crop/CropAutomationSettings"),
        ),
      },
      rotate: {
        icon: <Icon name="rotate-cw" size="1.5rem" />,
        name: t("home.rotate.title", "Rotate"),
        component: lazy(() => import("@editor/tools/Rotate")),
        description: t("home.rotate.desc", "Easily rotate your PDFs."),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        maxFiles: -1,
        endpoints: ["rotate-pdf"],
        operationConfig: asRegistryConfig(rotateOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/rotate/RotateAutomationSettings"),
        ),
        synonyms: getSynonyms(t, "rotate"),
      },
      split: {
        icon: <Icon name="scissors" size="1.5rem" />,
        name: t("home.split.title", "Split"),
        component: lazy(() => import("@editor/tools/Split")),
        description: t("home.split.desc", "Split PDFs into multiple documents"),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        endpoints: Array.from(new Set(Object.values(SPLIT_ENDPOINT_NAMES))),
        operationConfig: asRegistryConfig(splitOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/split/SplitAutomationSettings"),
        ),
        synonyms: getSynonyms(t, "split"),
      },
      reorganizePages: {
        icon: <Icon name="move-item-down" size="1.5rem" />,
        name: t("home.reorganizePages.title", "Reorganize Pages"),
        component: lazy(() => import("@editor/tools/ReorganizePages")),
        description: t(
          "home.reorganizePages.desc",
          "Rearrange, duplicate, or delete PDF pages with visual drag-and-drop control.",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        endpoints: ["rearrange-pages"],
        operationConfig: asRegistryConfig(reorganizePagesOperationConfig),
        synonyms: getSynonyms(t, "reorganizePages"),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/reorganizePages/ReorganizePagesSettings"),
        ),
      },
      addPageNumbers: {
        icon: <Icon name="file-digit" size="1.5rem" />,
        name: t("home.addPageNumbers.title", "Add Page Numbers"),
        component: lazy(() => import("@editor/tools/AddPageNumbers")),
        description: t(
          "home.addPageNumbers.desc",
          "Add Page numbers throughout a document in a set location",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/addPageNumbers/AddPageNumbersAutomationSettings"),
        ),
        maxFiles: -1,
        endpoints: ["add-page-numbers"],
        operationConfig: asRegistryConfig(addPageNumbersOperationConfig),
        synonyms: getSynonyms(t, "addPageNumbers"),
      },
      addAttachments: {
        icon: <Icon name="paperclip" size="1.5rem" />,
        name: t("home.addAttachments.title", "Manage Attachments"),
        component: lazy(() => import("@editor/tools/AddAttachments")),
        description: t(
          "home.addAttachments.desc",
          "View, add, extract, rename, or delete embedded PDF attachments",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.PAGE_FORMATTING,
        synonyms: getSynonyms(t, "addAttachments"),
        maxFiles: 1,
        endpoints: [
          "add-attachments",
          "batch-process-attachments",
          "list-attachments",
          "extract-single-attachment",
        ],
        operationConfig: asRegistryConfig(addAttachmentsOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/addAttachments/AddAttachmentsSettings"),
        ),
      },

      // Extraction

      extractPages: {
        icon: <Icon name="upload" size="1.5rem" />,
        name: t("home.extractPages.title", "Extract Pages"),
        component: lazy(() => import("@editor/tools/ExtractPages")),
        description: t(
          "home.extractPages.desc",
          "Extract specific pages from a PDF document",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.EXTRACTION,
        synonyms: getSynonyms(t, "extractPages"),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/extractPages/ExtractPagesSettings"),
        ),
        operationConfig: asRegistryConfig(extractPagesOperationConfig),
        endpoints: ["rearrange-pages"],
      },

      // Removal

      removePages: {
        icon: <Icon name="trash" size="1.5rem" />,
        name: t("home.removePages.title", "Remove Pages"),
        component: lazy(() => import("@editor/tools/RemovePages")),
        description: t(
          "home.removePages.desc",
          "Remove specific pages from a PDF document",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.REMOVAL,
        maxFiles: 1,
        endpoints: ["remove-pages"],
        synonyms: getSynonyms(t, "removePages"),
        operationConfig: asRegistryConfig(removePagesOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/removePages/RemovePagesSettings"),
        ),
      },
      removeAnnotations: {
        icon: <Icon name="annotation-off" size="1.5rem" />,
        name: t("home.removeAnnotations.title", "Remove Annotations"),
        component: lazy(() => import("@editor/tools/RemoveAnnotations")),
        description: t(
          "home.removeAnnotations.desc",
          "Remove annotations and comments from PDF documents",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.REMOVAL,
        maxFiles: -1,
        endpoints: ["remove-annotations"],
        operationConfig: asRegistryConfig(removeAnnotationsOperationConfig),
        automationSettings: null,
        synonyms: getSynonyms(t, "removeAnnotations"),
      },
      removePassword: {
        icon: <Icon name="lock-open-password" size="1.5rem" />,
        name: t("removePassword.title", "Remove Password"),
        component: lazy(() => import("@editor/tools/RemovePassword")),
        description: t(
          "home.removePassword.desc",
          "Remove the opening password, permissions password, or both.",
        ),
        categoryId: ToolCategoryId.STANDARD_TOOLS,
        subcategoryId: SubcategoryId.REMOVAL,
        endpoints: ["remove-password"],
        maxFiles: -1,
        operationConfig: asRegistryConfig(removePasswordOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/removePassword/RemovePasswordSettings"),
        ),
        synonyms: getSynonyms(t, "removePassword"),
      },

      // Automation

      // Advanced Formatting

      adjustContrast: {
        icon: <Icon name="palette" size="1.5rem" />,
        name: t("home.adjustContrast.title", "Adjust Colors/Contrast"),
        component: lazy(() => import("@editor/tools/AdjustContrast")),
        description: t(
          "home.adjustContrast.desc",
          "Adjust colors and contrast of PDF documents",
        ),
        categoryId: ToolCategoryId.ADVANCED_TOOLS,
        subcategoryId: SubcategoryId.ADVANCED_FORMATTING,
        maxFiles: -1,
        endpoints: ["adjust-contrast"],
        operationConfig: asRegistryConfig(adjustContrastOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/adjustContrast/AdjustContrastSingleStepSettings"),
        ),
        synonyms: getSynonyms(t, "adjustContrast"),
      },

      // Developer Tools

      showJS: {
        icon: <Icon name="braces" size="1.5rem" />,
        name: t("home.showJS.title", "Show JavaScript"),
        component: lazy(() => import("@editor/tools/ShowJS")),
        description: t(
          "home.showJS.desc",
          "Extract and display JavaScript code from PDF documents",
        ),
        categoryId: ToolCategoryId.ADVANCED_TOOLS,
        subcategoryId: SubcategoryId.DEVELOPER_TOOLS,
        maxFiles: 1,
        endpoints: ["show-javascript"],
        synonyms: getSynonyms(t, "showJS"),
        supportsAutomate: false,
        automationSettings: null,
      },

      // Recommended Tools
      compare: {
        icon: <Icon name="image-compare" size="1.5rem" />,
        name: t("home.compare.title", "Compare"),
        component: lazy(() => import("@editor/tools/Compare")),
        description: t(
          "home.compare.desc",
          "Compare two PDF documents and highlight differences",
        ),
        categoryId: ToolCategoryId.RECOMMENDED_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        maxFiles: 2,
        endpoints: ["compare"],
        operationConfig: undefined,
        automationSettings: null,
        synonyms: getSynonyms(t, "compare"),
        supportsAutomate: false,
      },

      redact: {
        icon: <Icon name="redact" size="1.5rem" />,
        name: t("home.redact.title", "Redact"),
        component: lazy(() => import("@editor/tools/Redact")),
        description: t(
          "home.redact.desc",
          "Permanently remove sensitive information from PDF documents",
        ),
        categoryId: ToolCategoryId.RECOMMENDED_TOOLS,
        subcategoryId: SubcategoryId.GENERAL,
        maxFiles: -1,
        endpoints: ["auto-redact"],
        operationConfig: asRegistryConfig(redactOperationConfig),
        automationSettings: lazySettings(
          () =>
            import("@editor/components/tools/redact/RedactSingleStepSettings"),
        ),
        synonyms: getSynonyms(t, "redact"),
      },
    };

    const regularTools = {} as RegularToolRegistry;
    const superTools = {} as SuperToolRegistry;
    const linkTools = {} as LinkToolRegistry;

    Object.entries(allTools).forEach(([key, entry]) => {
      const toolId = key as ToolId;
      if (isSuperToolId(toolId)) {
        superTools[toolId] = entry;
      } else if (isLinkToolId(toolId)) {
        // No link tools remain in this build, so the id type narrows to never.
        (linkTools as Record<string, typeof entry>)[toolId] = entry;
      } else {
        regularTools[toolId] = entry;
      }
    });

    return {
      allTools,
      regularTools,
      superTools,
      linkTools,
    };
  }, [t, proprietaryTools]);
}
