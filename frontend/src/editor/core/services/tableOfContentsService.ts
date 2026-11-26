import apiClient from "@editor/services/apiClient";

/** One bookmark; `pageNumber` is one-based. */
export interface BookmarkPayload {
  title: string;
  pageNumber: number;
  children: BookmarkPayload[];
}

/** Returns `file` rewritten with `bookmarks` as its whole table of contents. */
export async function replaceTableOfContents(
  file: File,
  bookmarks: BookmarkPayload[],
): Promise<Blob> {
  const formData = new FormData();
  formData.append("fileInput", file);
  formData.append("replaceExisting", "true");
  formData.append("bookmarkData", JSON.stringify(bookmarks));
  const response = await apiClient.post(
    "/api/v1/general/edit-table-of-contents",
    formData,
    { responseType: "blob" },
  );
  return response.data as Blob;
}
