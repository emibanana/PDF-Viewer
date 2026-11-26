/**
 * Tools PDF Viewer does not offer, because they need the Java backend that
 * this build does not ship. The Tools menu, search, Automate and deep links all
 * read the registry, which `ToolRegistryProvider` (studio) filters with this list.
 *
 * To bring a tool back, port it to run in the app (see the studio operation
 * hooks under `studio/hooks/tools/`), then delete its id from here and move its
 * row in docs/IMPLEMENTATION-PLAN.md from "Deferred" to the feature list.
 */

/** Hidden now; planned to be re-implemented client-side with the existing libraries. */
export const PORT_PLANNED_TOOL_IDS: readonly string[] = [
  // Flatten is ported for forms only; its default mode (whole page to an image) is not, so it stays hidden.
  "flatten",
  "split",
  "showJS",
  "editTableOfContents",
  "addAttachments",
  "crop",
  "watermark",
  "addPageNumbers",
  "sanitize",
  "getPdfInfo",
];

/** Hidden now and deferred: need native code, an AI model, an Office install or a server. */
export const DEFERRED_TOOL_IDS: readonly string[] = [
  "autoRotate",
  "pdfToSinglePage",
  "scalePages",
  "pageLayout",
  "bookletImposition",
  "overlayPdfs",
  "removeBlanks",
  "removeImage",
  "replaceColor",
  "addStamp",
  "unlockPDFForms",
  "createPortfolio",
  "extractImages",
  "scannerImageSplit",
  "checkAccessibility",
  "validateSignature",
  "certSign",
  "removeCertSign",
  "timestampPdf",
  "compress",
  "ocr",
  "convert",
  "repair",
  "autoRename",
  "autoFormDetection",
  "classify",
  // Link-only entries that open Stirling's online docs or the backend API.
  "devApi",
  "devFolderScanning",
  "devSsoGuide",
  "devAirgapped",
];

/** Dropped on purpose, not deferred: no plan to bring them back. */
export const REMOVED_TOOL_IDS: readonly string[] = ["automate"];

export const HIDDEN_TOOL_IDS: ReadonlySet<string> = new Set([
  ...PORT_PLANNED_TOOL_IDS,
  ...DEFERRED_TOOL_IDS,
  ...REMOVED_TOOL_IDS,
]);

export function omitHiddenTools<T extends object>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).filter(([id]) => !HIDDEN_TOOL_IDS.has(id)),
  ) as T;
}
