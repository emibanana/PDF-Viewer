import {
  METHOD_OPTIONS as ALL_METHOD_OPTIONS,
  SPLIT_METHODS,
} from "@editor-core/constants/splitConstants";

export * from "@editor-core/constants/splitConstants";

/** Methods that run in this build. Sections, page dividers and poster need image analysis or page-box cropping that is not ported. */
const SUPPORTED = new Set<string>([
  SPLIT_METHODS.BY_PAGES,
  SPLIT_METHODS.BY_CHAPTERS,
  SPLIT_METHODS.BY_SIZE,
  SPLIT_METHODS.BY_PAGE_COUNT,
  SPLIT_METHODS.BY_DOC_COUNT,
]);

export const METHOD_OPTIONS = ALL_METHOD_OPTIONS.filter((o) =>
  SUPPORTED.has(o.value),
);
