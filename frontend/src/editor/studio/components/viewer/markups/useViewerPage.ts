import { useEffect, useState } from "react";
import { useViewer } from "@editor/contexts/ViewerContext";

export interface ViewerPage {
  /** Zero-based index of the page in view. */
  pageIndex: number;
  totalPages: number;
}

/** The page the viewer is showing and how many there are, following scrolling. */
export function useViewerPage(): ViewerPage {
  const { getScrollState, registerImmediateScrollUpdate } = useViewer();
  const [page, setPage] = useState<ViewerPage>(() => {
    const { currentPage, totalPages } = getScrollState();
    return { pageIndex: Math.max(0, currentPage - 1), totalPages };
  });

  useEffect(() => {
    const read = (currentPage: number, totalPages: number) =>
      setPage((previous) => {
        const pageIndex = Math.max(0, currentPage - 1);
        return previous.pageIndex === pageIndex && previous.totalPages === totalPages ? previous : { pageIndex, totalPages };
      });
    const { currentPage, totalPages } = getScrollState();
    read(currentPage, totalPages);
    return registerImmediateScrollUpdate(read);
  }, [getScrollState, registerImmediateScrollUpdate]);

  return page;
}
