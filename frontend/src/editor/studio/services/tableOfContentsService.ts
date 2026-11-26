import { replaceOutline } from "@editor/services/pdfEdit/outline";

export type { BookmarkPayload } from "@editor-core/services/tableOfContentsService";
import type { BookmarkPayload } from "@editor-core/services/tableOfContentsService";

/** Returns `file` rewritten with `bookmarks` as its whole table of contents. */
export async function replaceTableOfContents(file: File, bookmarks: BookmarkPayload[]): Promise<Blob> {
  return replaceOutline(file, bookmarks);
}
