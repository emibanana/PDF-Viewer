import type { ReactNode } from "react";

/** Core has no reader side panel; the studio layer supplies one with the same path. */
export function ReaderLeftPanel({ recent }: { recent: ReactNode }) {
  return <>{recent}</>;
}
