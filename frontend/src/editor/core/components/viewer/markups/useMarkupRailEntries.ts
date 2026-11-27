import type { QuickNavEntry } from "@editor/components/shared/quickNav/QuickNavRailBase";

/** Core has no markup tools; the studio layer supplies this hook with the same path. */
export function useMarkupRailEntries(): QuickNavEntry[] {
  return [];
}
