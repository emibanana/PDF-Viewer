import {
  PROPRIETARY_REGULAR_TOOL_IDS,
  PROPRIETARY_SUPER_TOOL_IDS,
  PROPRIETARY_LINK_TOOL_IDS,
} from "@editor/types/proprietaryToolId";

export type ToolKind = "regular" | "super" | "link";

// ocr, convert, repair and certSign have no tool page or menu entry any more. Their operations
// stay because live features (text-editor OCR, create-PDF, damaged-file repair, signing) still
// run them; remove them together with those features.
export const OPERATION_ONLY_TOOL_IDS = [
  "ocr",
  "convert",
  "repair",
  "certSign",
] as const;
export type OperationOnlyToolId = (typeof OPERATION_ONLY_TOOL_IDS)[number];

export const CORE_REGULAR_TOOL_IDS = [
  "sign",
  "addText",
  "addPassword",
  "removePassword",
  "removePages",
  "removeAnnotations",
  "changePermissions",
  "watermark",
  "sanitize",
  "split",
  "merge",
  "addImage",
  "rotate",
  "annotate",
  "editTableOfContents",
  "adjustContrast",
  "crop",
  "compare",
  "addPageNumbers",
  "redact",
  "flatten",
  "extractPages",
  "reorganizePages",
  "addAttachments",
  "changeMetadata",
  "getPdfInfo",
  "showJS",
  "pdfTextEditor",
  "formFill",
] as const;

export const CORE_SUPER_TOOL_IDS = ["multiTool", "read"] as const;

export const CORE_LINK_TOOL_IDS = [
] as const;

export const REGULAR_TOOL_IDS = [
  ...CORE_REGULAR_TOOL_IDS,
  ...PROPRIETARY_REGULAR_TOOL_IDS,
] as const;

export const SUPER_TOOL_IDS = [
  ...CORE_SUPER_TOOL_IDS,
  ...PROPRIETARY_SUPER_TOOL_IDS,
] as const;

export const LINK_TOOL_IDS = [
  ...CORE_LINK_TOOL_IDS,
  ...PROPRIETARY_LINK_TOOL_IDS,
] as const;

export const TOOL_IDS = [
  ...REGULAR_TOOL_IDS,
  ...SUPER_TOOL_IDS,
  ...LINK_TOOL_IDS,
];

// Tool identity - what PDF operation we're performing (type-safe)
export type ToolId = (typeof TOOL_IDS)[number];
/** Anything a tool operation can be recorded as: a tool, or one of the operation-only ids. */
export type OperationId = ToolId | OperationOnlyToolId;
export const isValidToolId = (value: string): value is ToolId =>
  TOOL_IDS.includes(value as ToolId);

export type RegularToolId = (typeof REGULAR_TOOL_IDS)[number];
export const isRegularToolId = (toolId: ToolId): toolId is RegularToolId =>
  REGULAR_TOOL_IDS.includes(toolId as RegularToolId);

export type SuperToolId = (typeof SUPER_TOOL_IDS)[number];
export const isSuperToolId = (toolId: ToolId): toolId is SuperToolId =>
  SUPER_TOOL_IDS.includes(toolId as SuperToolId);

export type LinkToolId = (typeof LINK_TOOL_IDS)[number];
export const isLinkToolId = (toolId: ToolId): toolId is LinkToolId =>
  LINK_TOOL_IDS.includes(toolId as LinkToolId);

type Assert<A extends true> = A;
type Disjoint<A, B> = [A & B] extends [never] ? true : false;

type _Check1 = Assert<Disjoint<RegularToolId, SuperToolId>>;
type _Check2 = Assert<Disjoint<RegularToolId, LinkToolId>>;
type _Check3 = Assert<Disjoint<SuperToolId, LinkToolId>>;
