import { ToolId } from "@editor/types/toolId";

// Map URL paths to tool keys (multiple URLs can map to same tool)
export const URL_TO_TOOL_MAP: Record<string, ToolId> = {
  // Basic tools - standard patterns
  "/split": "split",
  "/split-pdfs": "split",
  "/merge": "merge",
  "/merge-pdfs": "merge",
  "/rotate": "rotate",
  "/rotate-pdf": "rotate",
  "/flatten": "flatten",
  "/crop": "crop",

  // Convert tool and all its variants

  // Security tools
  "/add-password": "addPassword",
  "/remove-password": "removePassword",
  "/change-permissions": "changePermissions",

  // Content manipulation
  "/sanitize": "sanitize",
  "/sanitize-pdf": "sanitize",
  "/watermark": "watermark",
  "/add-watermark": "watermark",
  "/add-image": "addImage",
  "/add-page-numbers": "addPageNumbers",
  "/redact": "redact",

  // Page manipulation
  "/remove-pages": "removePages",
  "/extract-pages": "extractPages",
  "/reorganize-pages": "reorganizePages",

  // Splitting tools
  "/auto-split-pdf": "split",
  "/auto-size-split-pdf": "split",

  // Annotation and content removal
  "/annotations": "annotate",
  "/annotate": "annotate",
  "/remove-annotations": "removeAnnotations",

  // Image and visual tools
  "/adjust-contrast": "adjustContrast",

  // Metadata and info
  "/change-metadata": "changeMetadata",
  "/get-pdf-info": "getPdfInfo",
  "/add-attachments": "addAttachments",

  // Advanced tools
  "/edit-table-of-contents": "editTableOfContents",
  "/compare": "compare",
  "/multi-tool": "multiTool",
  "/show-js": "showJS",

  // Special/utility tools
  "/read": "read",
  "/sign": "sign",
  "/add-text": "addText",
  "/pdf-text-editor": "pdfTextEditor",

  // Developer tools

  // Legacy URL mappings from sitemap
  "/pdf-organizer": "reorganizePages",
  "/extract-page": "extractPages",
  "/auto-redact": "redact",
  "/view-pdf": "read",
  "/get-info-on-pdf": "getPdfInfo",
  "/show-javascript": "showJS",
  "/split-by-size-or-count": "split",
  "/split-pdf-by-sections": "split",
  "/split-pdf-by-chapters": "split",
};
